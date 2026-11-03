// create_seance / update_seance : l'API renvoie { data, scoring_error } quand le
// moteur de scoring échoue (la séance est quand même écrite). Le MCP doit faire
// remonter ce message à côté des champs de la séance.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'

let responseBody: unknown = {}
let server: Server

before(async () => {
  server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(responseBody))
  }).listen(0)
  await new Promise(r => server.once('listening', r))
  process.env.API_INTERNAL_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.INTERNAL_API_KEY = 'test-key'
})
after(() => { server.close() })

const tools = () => import('./tools.js')
const VALID_ID = '3f2b8c1e-9d4a-4b7e-8f21-6a5c0d9e1b23'
const seance = { id: VALID_ID, nom: 'x', effet_reel_brut: null }

for (const [name, call] of [
  ['create_seance', (t: typeof import('./tools.js')) => t.createSeance({ nom: 'x', date: '2026-11-02', type: 'autre' })],
  ['update_seance', (t: typeof import('./tools.js')) => t.updateSeance(VALID_ID, { garmin_activity_id: '123' })],
] as const) {
  test(`${name} renvoie le scoring_error de l'API avec la séance`, async () => {
    responseBody = { data: seance, scoring_error: 'HTTP 404 activité introuvable' }
    const result = await call(await tools())
    assert.deepEqual(result, { ...seance, scoring_error: 'HTTP 404 activité introuvable' })
  })

  test(`${name} sans scoring_error renvoie la séance seule`, async () => {
    responseBody = { data: seance }
    const result = await call(await tools())
    assert.deepEqual(result, seance)
  })
}
