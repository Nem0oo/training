import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCompliance } from './compliance.js'
import type { Segment } from './types.js'

const THRESHOLDS = { ok_min_pct: 85, ok_max_pct: 115, warn_min_pct: 70, warn_max_pct: 130 }

test('cardio : conformité par zone compare réalisé vs prescrit, indépendamment de l\'ordre', () => {
  const segments: Segment[] = [
    { zone: 'Z2', duration_s: 38 * 60, avg_temperature_c: 18, cumulative_duration_before_s: 0 },
  ]
  const result = computeCompliance('cardio', segments, [{ zone_cible: 'Z2', duree_min: 40 }], 38 * 60, THRESHOLDS)
  assert.equal(result.par_zone.length, 1)
  assert.equal(result.par_zone[0].zone, 'Z2')
  assert.equal(result.par_zone[0].temps_realise_min, 38)
  assert.equal(result.par_zone[0].temps_prescrit_min, 40)
  assert.ok(Math.abs((result.par_zone[0].ratio_pct as number) - 95) < 0.01)
  assert.equal(result.par_zone[0].statut, '✅')
})

test('cardio : zone réalisée hors zone prescrite ressort en ❌ (ratio null forcé à ❌)', () => {
  const segments: Segment[] = [
    { zone: 'Z4', duration_s: 5 * 60, avg_temperature_c: null, cumulative_duration_before_s: 0 },
  ]
  const result = computeCompliance('cardio', segments, [{ zone_cible: 'Z2', duree_min: 40 }], 5 * 60, THRESHOLDS)
  const z4 = result.par_zone.find(z => z.zone === 'Z4')!
  assert.equal(z4.temps_prescrit_min, 0)
  assert.equal(z4.ratio_pct, null)
  assert.equal(z4.statut, '❌')
})

test('renforcement : conformité = durée réalisée vs prescrite uniquement, zone ignorée', () => {
  const result = computeCompliance('renforcement', [], [{ zone_cible: 'Z3', duree_min: 30 }], 25 * 60, THRESHOLDS)
  assert.equal(result.par_zone.length, 0)
  assert.equal(result.duree_totale_prescrite_min, 30)
  assert.equal(result.duree_totale_realisee_min, 25)
  assert.ok(Math.abs((result.duree_conformite_pct as number) - (25 / 30 * 100)) < 0.01)
})

test('sans blocs_prescrits, la conformité globale par défaut ne pénalise pas (100%)', () => {
  const segments: Segment[] = [{ zone: 'Z1', duration_s: 20 * 60, avg_temperature_c: null, cumulative_duration_before_s: 0 }]
  const result = computeCompliance('cardio', segments, null, 20 * 60, THRESHOLDS)
  assert.equal(result.conformite_globale_pct, 100)
})
