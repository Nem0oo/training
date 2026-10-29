// Vérifie le chemin réellement appelé côté API par les outils MCP, via un
// faux serveur HTTP qui enregistre chaque requête reçue.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'

const requests: { method: string; url: string }[] = []
let server: Server

before(async () => {
  server = createServer((req, res) => {
    requests.push({ method: req.method!, url: req.url! })
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ data: {} }))
  }).listen(0)
  await new Promise(r => server.once('listening', r))
  process.env.API_INTERNAL_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.INTERNAL_API_KEY = 'test-key'
})
after(() => { server.close() })

const tools = () => import('./tools.js')
const VALID_ID = '3f2b8c1e-9d4a-4b7e-8f21-6a5c0d9e1b23'

for (const [name, call] of [
  ['delete_seance', (t: typeof import('./tools.js'), id: string) => t.deleteSeance(id)],
  ['update_seance', (t: typeof import('./tools.js'), id: string) => t.updateSeance(id, { nom: 'x' })],
  ['get_seance', (t: typeof import('./tools.js'), id: string) => t.getSeance(id)],
  ['get_seance_radar', (t: typeof import('./tools.js'), id: string) => t.getSeanceRadar(id)],
] as const) {
  test(`${name} refuse un id de type path traversal sans appeler l'API`, async () => {
    const t = await tools()
    requests.length = 0
    for (const id of ['../power-zones/abc', '%2e%2e/vma', '..', 'abc/def']) {
      await assert.rejects(() => call(t, id), /id invalide/)
    }
    assert.deepEqual(requests, [])
  })
}

test('get_seance avec un UUID valide appelle /api/seances/<id>', async () => {
  const t = await tools()
  requests.length = 0
  await t.getSeance(VALID_ID)
  assert.deepEqual(requests, [{ method: 'GET', url: `/api/seances/${VALID_ID}` }])
})

test('get_seance_radar avec un UUID valide appelle /api/seances/<id>/radar', async () => {
  const t = await tools()
  requests.length = 0
  await t.getSeanceRadar(VALID_ID)
  assert.deepEqual(requests, [{ method: 'GET', url: `/api/seances/${VALID_ID}/radar` }])
})
