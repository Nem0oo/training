// Tests HTTP du login : limitation des tentatives échouées par IP.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Server } from 'http'
import type { AddressInfo } from 'net'

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'training-auth-test-'))
const { createApp } = await import('../app.js')

let server: Server
let base: string

before(async () => {
  server = createApp({ apiPassword: 'bon-mot-de-passe', jwtSecret: 'secret', internalApiKey: 'k' }).listen(0)
  await new Promise(r => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => { server.close() })

// nginx transmet l'IP du client dans X-Real-IP (pwa/nginx.conf).
async function login(password: string, ip: string) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Real-IP': ip },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(5000),
  })
  return res
}

test('un bon mot de passe renvoie un token, un mauvais renvoie 401', async () => {
  assert.equal((await login('bon-mot-de-passe', '10.0.0.1')).status, 200)
  assert.equal((await login('faux', '10.0.0.1')).status, 401)
})

test('après 5 échecs depuis une IP, les tentatives suivantes sont refusées en 429, même avec le bon mot de passe', async () => {
  const ip = '10.0.0.2'
  for (let i = 0; i < 5; i++) assert.equal((await login('faux', ip)).status, 401)
  const bloque = await login('bon-mot-de-passe', ip)
  assert.equal(bloque.status, 429)
  assert.ok(Number(bloque.headers.get('retry-after')) > 0)
})

test('le blocage d\'une IP ne bloque pas les autres', async () => {
  for (let i = 0; i < 6; i++) await login('faux', '10.0.0.3')
  assert.equal((await login('bon-mot-de-passe', '10.0.0.4')).status, 200)
})

test('une connexion réussie remet le compteur d\'échecs à zéro', async () => {
  const ip = '10.0.0.5'
  for (let i = 0; i < 4; i++) await login('faux', ip)
  assert.equal((await login('bon-mot-de-passe', ip)).status, 200)
  for (let i = 0; i < 4; i++) assert.equal((await login('faux', ip)).status, 401)
  assert.equal((await login('bon-mot-de-passe', ip)).status, 200)
})
