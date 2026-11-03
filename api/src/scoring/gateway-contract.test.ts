import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { segmentByPowerZone, type PowerZoneBound } from './segmentation.js'
import type { GarminActivity } from './types.js'

// Fixture synthétique conforme au contrat REST v1 de garmin-gateway
// (GET /api/v1/activities/{id}/series), avec deux blocs nets de 60 s en Z2 puis Z3.
const raw = JSON.parse(readFileSync(new URL('./fixtures/gateway-series.json', import.meta.url), 'utf8'))
const activity = raw as GarminActivity

const ZONES: PowerZoneBound[] = [
  { zone: 'Z1', power_min: 0, power_max: 100 },
  { zone: 'Z2', power_min: 101, power_max: 200 },
  { zone: 'Z3', power_min: 201, power_max: 300 },
  { zone: 'Z4', power_min: 301, power_max: 400 },
  { zone: 'Z5', power_min: 401, power_max: null },
]

test('la fixture respecte la forme du contrat (séries alignées, horodatages UTC en Z)', () => {
  const { timestamps } = raw.series
  for (const [name, values] of Object.entries(raw.series as Record<string, unknown[] | null>)) {
    if (values !== null) assert.equal(values.length, timestamps.length, `longueur de ${name}`)
  }
  for (const t of timestamps) assert.match(t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  const durationS = (Date.parse(raw.summary.end_time) - Date.parse(raw.summary.start_time)) / 1000
  assert.equal(raw.summary.duration_seconds, durationS)
})

test('une réponse du gateway est segmentée par zone de puissance de bout en bout', () => {
  const segments = segmentByPowerZone(activity, ZONES, 60)
  assert.deepEqual(segments, [
    { zone: 'Z2', duration_s: 60, avg_temperature_c: 14, cumulative_duration_before_s: 0 },
    { zone: 'Z3', duration_s: 60, avg_temperature_c: 15, cumulative_duration_before_s: 60 },
  ])
})

// Sortie du vrai décodeur FIT de garmin-gateway (tests/fixtures/series_expected.json du gateway) :
// 60 enregistrements, puissance 200 + 3 × (i mod 10) W sauf l'enregistrement 3 (null),
// pause de 5 s entre les enregistrements 29 et 30, température 14 °C puis 15 °C à partir du 30.
const realRaw = JSON.parse(readFileSync(new URL('./fixtures/gateway-series-real.json', import.meta.url), 'utf8'))
const realActivity = realRaw as GarminActivity

test('la sortie réelle du gateway respecte la forme du contrat', () => {
  const { timestamps } = realRaw.series
  assert.equal(timestamps.length, 60)
  for (const [name, values] of Object.entries(realRaw.series as Record<string, unknown[] | null>)) {
    assert.ok(Array.isArray(values), `${name} présent`)
    assert.equal(values.length, timestamps.length, `longueur de ${name}`)
  }
  for (const t of timestamps) assert.match(t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  assert.equal(realRaw.summary.start_time, timestamps[0])
  assert.equal(realRaw.summary.end_time, timestamps[timestamps.length - 1])
  const durationS = (Date.parse(realRaw.summary.end_time) - Date.parse(realRaw.summary.start_time)) / 1000
  assert.equal(realRaw.summary.duration_seconds, durationS)
  assert.equal(realRaw.series.power_w[3], null)
})

test('la sortie réelle du gateway est segmentée : le trou de puissance coupe le run, la pause non', () => {
  // Toutes les puissances (200–227 W) tombent dans Z3.
  const oneZone: PowerZoneBound[] = [{ zone: 'Z3', power_min: 150, power_max: null }]
  assert.deepEqual(segmentByPowerZone(realActivity, oneZone, 0), [
    // Enregistrements 0–2, jusqu'à l'enregistrement 3 sans puissance.
    { zone: 'Z3', duration_s: 3, avg_temperature_c: 14, cumulative_duration_before_s: 0 },
    // Enregistrements 4–59 : 56 s d'échantillons + 4 s de pause ; 26 × 14 °C puis 30 × 15 °C.
    { zone: 'Z3', duration_s: 60, avg_temperature_c: (26 * 14 + 30 * 15) / 56, cumulative_duration_before_s: 3 },
  ])
})

test('la sortie réelle du gateway est découpée selon les puissances enregistrées', () => {
  const segments = segmentByPowerZone(realActivity, ZONES, 0)
  // 200 W (i mod 10 = 0, Z2) aux enregistrements 0, 10, …, 50 ; le reste (203–227 W) en Z3.
  const z2 = segments.filter(s => s.zone === 'Z2')
  const z3 = segments.filter(s => s.zone === 'Z3')
  assert.equal(segments.length, z2.length + z3.length)
  assert.equal(z2.length, 6)
  assert.ok(z2.every(s => s.duration_s === 1))
  assert.equal(z3.reduce((a, s) => a + s.duration_s, 0), 57)
  let cumulative = 0
  for (const s of segments) {
    assert.equal(s.cumulative_duration_before_s, cumulative)
    cumulative += s.duration_s
  }
})
