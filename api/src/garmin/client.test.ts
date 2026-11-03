import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fetchGarminActivity } from './client.js'

process.env.GARMIN_BASE_URL = 'https://gateway.example.com'
process.env.GARMIN_API_KEY = 'rest-key-123'

const realFetch = globalThis.fetch

interface Call { url: string; init?: RequestInit }

// Remplace fetch par une réponse fixe et enregistre les appels reçus.
function mockFetch(status: number, body: unknown): Call[] {
  const calls: Call[] = []
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    return new Response(text, { status, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return calls
}

afterEach(() => {
  globalThis.fetch = realFetch
})

const ACTIVITY = {
  activity_id: '21234567890',
  summary: { duration_seconds: 1, start_time: '2026-11-02T07:01:12Z', end_time: '2026-11-02T07:01:13Z', total_distance_km: 0 },
  series: { timestamps: ['2026-11-02T07:01:12Z', '2026-11-02T07:01:13Z'], power_w: [212, 215], temperature_c: null },
}

test("appelle la route series du gateway avec l'identifiant encodé", async () => {
  const calls = mockFetch(200, ACTIVITY)
  await fetchGarminActivity('21234567890')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://gateway.example.com/api/v1/activities/21234567890/series')
})

test("encode l'identifiant d'activité dans l'URL", async () => {
  const calls = mockFetch(200, ACTIVITY)
  await fetchGarminActivity('12/34')
  assert.equal(calls[0].url, 'https://gateway.example.com/api/v1/activities/12%2F34/series')
})

test('envoie la clé REST en en-tête Bearer', async () => {
  const calls = mockFetch(200, ACTIVITY)
  await fetchGarminActivity('21234567890')
  const headers = new Headers(calls[0].init?.headers)
  assert.equal(headers.get('Authorization'), 'Bearer rest-key-123')
})

test("200 → renvoie l'objet JSON du gateway", async () => {
  mockFetch(200, ACTIVITY)
  const activity = await fetchGarminActivity('21234567890')
  assert.deepEqual(activity, ACTIVITY)
})

test('404 → erreur contenant le code HTTP et le corps', async () => {
  mockFetch(404, { error: 'activity not found' })
  await assert.rejects(fetchGarminActivity('21234567890'), (err: Error) => {
    assert.match(err.message, /HTTP 404/)
    assert.match(err.message, /activity not found/)
    return true
  })
})

test('502 → erreur contenant le code HTTP et le corps', async () => {
  mockFetch(502, { error: 'Garmin API error' })
  await assert.rejects(fetchGarminActivity('21234567890'), (err: Error) => {
    assert.match(err.message, /HTTP 502/)
    assert.match(err.message, /Garmin API error/)
    return true
  })
})

// Les variables sont lues à chaque appel : on les retire le temps du test.
async function withoutEnv(name: string, fn: () => Promise<void>) {
  const saved = process.env[name]
  delete process.env[name]
  try {
    await fn()
  } finally {
    process.env[name] = saved
  }
}

test('GARMIN_BASE_URL absente → erreur claire sans appel réseau', async () => {
  const calls = mockFetch(200, ACTIVITY)
  await withoutEnv('GARMIN_BASE_URL', async () => {
    await assert.rejects(fetchGarminActivity('21234567890'), /GARMIN_BASE_URL/)
  })
  assert.equal(calls.length, 0)
})

test('GARMIN_API_KEY absente → erreur claire sans appel réseau', async () => {
  const calls = mockFetch(200, ACTIVITY)
  await withoutEnv('GARMIN_API_KEY', async () => {
    await assert.rejects(fetchGarminActivity('21234567890'), /GARMIN_API_KEY/)
  })
  assert.equal(calls.length, 0)
})
