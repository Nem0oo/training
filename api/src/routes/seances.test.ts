// Tests HTTP des routes séances / radar cumulé, sur une vraie base SQLite
// temporaire. better-sqlite3 étant un module natif, ils tournent dans le
// conteneur node:20 (voir README section Tests), pas forcément sur l'hôte.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Server } from 'http'
import type { AddressInfo } from 'net'

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'training-test-'))
const KEY = 'test-internal-key'

const { createApp } = await import('../app.js')
const { default: db } = await import('../db.js')

let server: Server
let base: string

before(async () => {
  server = createApp({ apiPassword: 'pw', jwtSecret: 'secret', internalApiKey: KEY }).listen(0)
  await new Promise(r => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => { server.close() })

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Internal-Key': KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })
  const json = res.status === 204 ? null : await res.json().catch(() => null)
  return { status: res.status, json }
}

async function createSeance(fields: Record<string, unknown> = {}) {
  const { status, json } = await call('POST', '/api/seances', { nom: 'S', date: '2026-10-01', type: 'endurance', ...fields })
  assert.equal(status, 201)
  return json.data.id as string
}

// Simule une séance déjà scorée par le moteur (sans appel Garmin).
function markScored(id: string, value = 10) {
  const effet = { endurance_fondamentale: value, seuil_lactique: value, vo2max: value, vma: value, resistance_musculaire: value, economie_course: value, resilience_thermique: value }
  db.prepare("UPDATE seances SET garmin_activity_id = 'g1', effet_reel_brut = ?, conformite = '{}', distance_realisee_km = 10 WHERE id = ?")
    .run(JSON.stringify(effet), id)
}

function clearAll() { db.prepare('DELETE FROM seances').run() }

// --- Point 5 : validation, plus de crash sur contrainte SQLite ------------

test('PUT avec un etat invalide renvoie 400 (au lieu de faire tomber le process)', async () => {
  const id = await createSeance()
  const { status } = await call('PUT', `/api/seances/${id}`, { etat: 'done' })
  assert.equal(status, 400)
})

test('PUT avec un type invalide renvoie 400', async () => {
  const id = await createSeance()
  const { status } = await call('PUT', `/api/seances/${id}`, { type: 'x' })
  assert.equal(status, 400)
})

test('POST avec un etat invalide renvoie 400', async () => {
  const { status } = await call('POST', '/api/seances', { nom: 'S', date: '2026-10-01', type: 'endurance', etat: 'done' })
  assert.equal(status, 400)
})

test('POST et PUT avec une date hors format YYYY-MM-DD renvoient 400', async () => {
  assert.equal((await call('POST', '/api/seances', { nom: 'S', date: '29/10/2026', type: 'endurance' })).status, 400)
  const id = await createSeance()
  assert.equal((await call('PUT', `/api/seances/${id}`, { date: '2026-13-45' })).status, 400)
})

test('une erreur inattendue dans une route async renvoie 500 et le serveur reste debout', async () => {
  // Lier un objet à un paramètre SQLite fait lever better-sqlite3.
  const { status } = await call('POST', '/api/seances', { nom: { x: 1 }, date: '2026-10-01', type: 'endurance' })
  assert.equal(status, 500)
  assert.equal((await call('GET', '/api/seances')).status, 200)
})

// --- Point 6 : ordre de la liste -------------------------------------------

test('GET /api/seances?order=desc renvoie les séances les plus récentes en premier', async () => {
  clearAll()
  for (const date of ['2026-01-01', '2026-06-01', '2026-10-01']) await createSeance({ date })
  const { json } = await call('GET', '/api/seances?order=desc&limit=2')
  assert.deepEqual(json.data.map((s: { date: string }) => s.date), ['2026-10-01', '2026-06-01'])
})

test('GET /api/seances reste trié par date croissante par défaut', async () => {
  clearAll()
  for (const date of ['2026-06-01', '2026-01-01']) await createSeance({ date })
  const { json } = await call('GET', '/api/seances')
  assert.deepEqual(json.data.map((s: { date: string }) => s.date), ['2026-01-01', '2026-06-01'])
})

test('GET /api/seances avec un order invalide renvoie 400', async () => {
  assert.equal((await call('GET', '/api/seances?order=sideways')).status, 400)
})

// --- Point 4 : le radar cumulé suit l'historique réel ----------------------

test('le radar cumulé reflète les séances scorées', async () => {
  clearAll()
  markScored(await createSeance({ date: '2026-10-01' }))
  const { status, json } = await call('GET', '/api/radar-cumule')
  assert.equal(status, 200)
  assert.ok(json.data.axes.vma > 0)
})

test('lire le radar cumulé deux fois ne compte pas la séance deux fois', async () => {
  clearAll()
  markScored(await createSeance({ date: '2026-10-01' }))
  const a = (await call('GET', '/api/radar-cumule')).json.data.axes.vma
  const b = (await call('GET', '/api/radar-cumule')).json.data.axes.vma
  assert.equal(a, b)
})

test('supprimer une séance scorée la retire du radar cumulé', async () => {
  clearAll()
  const id = await createSeance({ date: '2026-10-01' })
  markScored(id)
  await call('DELETE', `/api/seances/${id}`)
  assert.equal((await call('GET', '/api/radar-cumule')).status, 404)
})

test('signaler une séance scorée (condition_signalee) la retire du radar cumulé', async () => {
  clearAll()
  const id = await createSeance({ date: '2026-10-01' })
  markScored(id)
  await call('PUT', `/api/seances/${id}`, { condition_signalee: true })
  assert.equal((await call('GET', '/api/radar-cumule')).status, 404)
})

test('vider garmin_activity_id efface les résultats du scoring de la séance', async () => {
  clearAll()
  const id = await createSeance({ date: '2026-10-01' })
  markScored(id)
  const { json } = await call('PUT', `/api/seances/${id}`, { garmin_activity_id: null })
  assert.equal(json.data.effet_reel_brut, null)
  assert.equal(json.data.conformite, null)
  assert.equal(json.data.distance_realisee_km, null)
  assert.equal((await call('GET', '/api/radar-cumule')).status, 404)
})
