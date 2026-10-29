// Tests HTTP de /api/stats sur une base SQLite temporaire (voir seances.test.ts).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Server } from 'http'
import type { AddressInfo } from 'net'

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'training-stats-test-'))
const KEY = 'test-internal-key'

const { createApp } = await import('../app.js')
const { default: db } = await import('../db.js')
const { statsPeriod } = await import('../lib/dates.js')

let server: Server
let base: string

before(async () => {
  server = createApp({ apiPassword: 'pw', jwtSecret: 'secret', internalApiKey: KEY }).listen(0)
  await new Promise(r => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => { server.close() })

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function insert(date: string, etat = 'planifiee') {
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO seances (id, nom, date, type, etat, created_at, updated_at)
              VALUES (?, 'S', ?, 'endurance', ?, ?, ?)`).run(`${date}-${Math.random()}`, date, etat, now, now)
}

async function getStats() {
  const res = await fetch(`${base}/api/stats?weeks=4`, { headers: { 'X-Internal-Key': KEY }, signal: AbortSignal.timeout(5000) })
  return (await res.json()).data
}

test('les séances planifiées dans le futur ne sont pas comptées dans les N dernières semaines', async () => {
  db.prepare('DELETE FROM seances').run()
  const { today } = statsPeriod(new Date(), 4)
  insert(addDays(today, -3), 'terminee')
  insert(addDays(today, 60))
  insert(addDays(today, 120))
  const stats = await getStats()
  assert.deepEqual(stats.par_etat, { terminee: 1 })
  assert.deepEqual(stats.par_type, { endurance: 1 })
})

test('seances_cette_semaine ne compte que la semaine en cours (lundi -> dimanche)', async () => {
  db.prepare('DELETE FROM seances').run()
  const { monday, nextMonday } = statsPeriod(new Date(), 4)
  insert(monday)
  insert(addDays(nextMonday, -1)) // dimanche
  insert(nextMonday)              // semaine prochaine
  insert(addDays(nextMonday, 30))
  const stats = await getStats()
  assert.equal(stats.seances_cette_semaine, 2)
})
