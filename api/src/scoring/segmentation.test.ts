import { test } from 'node:test'
import assert from 'node:assert/strict'
import { segmentByPowerZone, type PowerZoneBound } from './segmentation.js'
import type { GarminActivity } from './types.js'

const ZONES: PowerZoneBound[] = [
  { zone: 'Z1', power_min: 0, power_max: 100 },
  { zone: 'Z2', power_min: 101, power_max: 200 },
  { zone: 'Z3', power_min: 201, power_max: 300 },
  { zone: 'Z4', power_min: 301, power_max: 400 },
  { zone: 'Z5', power_min: 401, power_max: null },
]

// Construit une activité avec un échantillon par seconde à partir d'une liste
// de puissances (index i = seconde i). `null` = pas de donnée à cet instant.
function activityFromPowers(powers: (number | null)[], temperatures?: (number | null)[]): GarminActivity {
  const timestamps = powers.map((_, i) => new Date(2026, 0, 1, 8, 0, i).toISOString())
  return {
    activity_id: 'test',
    summary: { duration_seconds: powers.length - 1, start_time: timestamps[0], end_time: timestamps[timestamps.length - 1], total_distance_km: 0 },
    series: { timestamps, power_w: powers, temperature_c: temperatures ?? null },
  }
}

test('un run continu de 90s dans une seule zone produit un segment de cette durée', () => {
  const powers = Array(90).fill(150) // Z2
  const segments = segmentByPowerZone(activityFromPowers(powers), ZONES, 60)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].zone, 'Z2')
  assert.equal(segments[0].duration_s, 89) // dernier - premier timestamp, en secondes
})

test('un intervalle <60s est ignoré (répétitions courtes)', () => {
  const powers = [...Array(30).fill(50), ...Array(20).fill(350), ...Array(30).fill(50)] // Z1, Z4 (20s < 60s), Z1
  const segments = segmentByPowerZone(activityFromPowers(powers), ZONES, 60)
  // Les deux runs Z1 sont séparés par un run Z4 qui n'atteint pas 60s -> lui-même ignoré,
  // et il rompt la continuité Z1 donc les deux runs Z1 (29s chacun) sont aussi < 60s -> tout est ignoré.
  assert.equal(segments.length, 0)
})

test('un trou de données (power null) rompt la continuité de la zone', () => {
  const powers = [...Array(40).fill(150), null, null, ...Array(40).fill(150)]
  const segments = segmentByPowerZone(activityFromPowers(powers), ZONES, 60)
  // Deux runs Z2 de 39s chacun (bornés par le trou) -> tous les deux < 60s -> ignorés
  assert.equal(segments.length, 0)
})

test('cumulative_duration_before_s ne compte que les segments gardés qui précèdent', () => {
  const powers = [...Array(70).fill(50), ...Array(80).fill(150)] // Z1 70s, puis Z2 79s
  const segments = segmentByPowerZone(activityFromPowers(powers), ZONES, 60)
  assert.equal(segments.length, 2)
  assert.equal(segments[0].zone, 'Z1')
  assert.equal(segments[0].cumulative_duration_before_s, 0)
  assert.equal(segments[1].zone, 'Z2')
  assert.equal(segments[1].cumulative_duration_before_s, segments[0].duration_s)
})

test('la puissance moyenne de zone utilise power_w, jamais hr — une puissance élevée classe en Z5 même à FC basse (non modélisée ici)', () => {
  const powers = Array(65).fill(450)
  const segments = segmentByPowerZone(activityFromPowers(powers), ZONES, 60)
  assert.equal(segments.length, 1)
  assert.equal(segments[0].zone, 'Z5')
})

test('lève une erreur si power_w est absent de la série', () => {
  const activity = activityFromPowers([])
  activity.series.power_w = null
  assert.throws(() => segmentByPowerZone(activity, ZONES, 60))
})
