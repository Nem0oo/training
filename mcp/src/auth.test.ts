// Vérifie les canaux acceptés pour la clé API du serveur MCP : en-têtes
// X-Api-Key et Authorization: Bearer uniquement, jamais l'URL.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { IncomingHttpHeaders } from 'http'
import { authenticateRequest } from './auth.js'

const KEY = 'secret-key'

function req(headers: IncomingHttpHeaders, url = '/mcp') {
  return { headers, url }
}

async function assertUnauthorized(fn: () => unknown) {
  await assert.rejects(async () => fn(), (err: unknown) => {
    assert.ok(err instanceof Response, 'doit lever une Response')
    assert.equal(err.status, 401)
    return true
  })
}

test('accepte la clé via X-Api-Key', () => {
  assert.deepEqual(authenticateRequest(req({ 'x-api-key': KEY }), KEY), { apiKey: KEY })
})

test('accepte la clé via Authorization: Bearer', () => {
  assert.deepEqual(authenticateRequest(req({ authorization: `Bearer ${KEY}` }), KEY), { apiKey: KEY })
})

test('rejette en 401 une bonne clé passée seulement en ?api_key=', async () => {
  await assertUnauthorized(() => authenticateRequest(req({}, `/mcp?api_key=${KEY}`), KEY))
  await assertUnauthorized(() => authenticateRequest(req({}, `/mcp/sse?api_key=${KEY}`), KEY))
})

test('rejette en 401 une requête sans clé', async () => {
  await assertUnauthorized(() => authenticateRequest(req({}), KEY))
})

test('rejette en 401 une mauvaise clé en en-tête', async () => {
  await assertUnauthorized(() => authenticateRequest(req({ 'x-api-key': 'wrong' }), KEY))
  await assertUnauthorized(() => authenticateRequest(req({ authorization: 'Bearer wrong' }), KEY))
})
