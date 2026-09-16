import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeEffect, computeFacteurExecution } from './effect.js'
import type { Segment, Zone } from './types.js'

const POIDS_INTENSITE: Record<Zone, number> = { Z1: 1.0, Z2: 1.5, Z3: 2.5, Z4: 4.0, Z5: 6.0 }
const REPARTITION = {
  Z1: { endurance_fondamentale: 60, seuil_lactique: 0, vo2max: 0, vma: 0, economie_course: 20, resilience_thermique: 20 },
  Z2: { seuil_lactique: 0, vo2max: 0, vma: 0, economie_course: 20 },
  Z3: { endurance_fondamentale: 20, seuil_lactique: 40, vo2max: 10, vma: 0, economie_course: 15, resilience_thermique: 15 },
  Z4: {
    continu: { endurance_fondamentale: 5, seuil_lactique: 60, vo2max: 25, vma: 0, economie_course: 5, resilience_thermique: 5 },
    repetition_courte: { endurance_fondamentale: 5, seuil_lactique: 35, vo2max: 15, vma: 35, economie_course: 5, resilience_thermique: 5 },
  },
  Z5: {
    continu: { endurance_fondamentale: 0, seuil_lactique: 10, vo2max: 75, vma: 10, economie_course: 5, resilience_thermique: 0 },
    repetition_courte: { endurance_fondamentale: 0, seuil_lactique: 10, vo2max: 15, vma: 70, economie_course: 5, resilience_thermique: 0 },
  },
} as any
const ZONE2 = { min: 15, max: 25, temp_min_c: 15, temp_max_c: 35 }
const RAMP = [
  { minutes: 0, fraction: 0 },
  { minutes: 60, fraction: 0 },
  { minutes: 120, fraction: 0.2 },
  { minutes: 150, fraction: 0.35 },
  { minutes: 180, fraction: 0.55 },
  { minutes: 240, fraction: 0.8 },
  { minutes: 300, fraction: 0.95 },
]

const BASE = {
  poidsIntensite: POIDS_INTENSITE,
  poidsRenfo: 2.0,
  repartition: REPARTITION,
  zone2ResilienceThermique: ZONE2,
  rampPoints: RAMP,
  coeffPlafond: 8,
  plafondReference: null,
}

test('renforcement : 100% du budget va en resistance_musculaire', () => {
  const result = computeEffect({
    ...BASE,
    categorie: 'renforcement',
    natureEffort: 'non_applicable',
    segments: [],
    dureeRealiseeTotaleS: 3600, // 1h
    facteurExecution: 1,
  })
  assert.equal(result.effet.resistance_musculaire, 2.0) // 1h * poids_renfo(2.0)
  assert.equal(result.effet.endurance_fondamentale, 0)
  assert.equal(result.effet.vo2max, 0)
})

test('cardio : segment en tout début de séance (part_rm=0) suit intégralement la table de répartition', () => {
  const segments: Segment[] = [{ zone: 'Z1', duration_s: 3600, avg_temperature_c: null, cumulative_duration_before_s: 0 }]
  const result = computeEffect({
    ...BASE,
    categorie: 'cardio',
    natureEffort: 'continu',
    segments,
    dureeRealiseeTotaleS: 3600,
    facteurExecution: 1,
  })
  // budget_bac = 1h * poids Z1 (1.0) = 1.0 ; part_rm=0 -> tout suit la table Z1 (60/0/0/0/20/20)
  assert.equal(result.effet.resistance_musculaire, 0)
  assert.ok(Math.abs(result.effet.endurance_fondamentale - 0.6) < 1e-9)
  assert.ok(Math.abs(result.effet.economie_course - 0.2) < 1e-9)
  assert.ok(Math.abs(result.effet.resilience_thermique - 0.2) < 1e-9)
})

test('cardio : un segment positionné loin dans la séance dévie une partie de son budget vers resistance_musculaire', () => {
  const segments: Segment[] = [{ zone: 'Z1', duration_s: 3600, avg_temperature_c: null, cumulative_duration_before_s: 200 * 60 }]
  const result = computeEffect({
    ...BASE,
    categorie: 'cardio',
    natureEffort: 'continu',
    segments,
    dureeRealiseeTotaleS: 3600,
    facteurExecution: 1,
  })
  // interpolation entre (180min, 0.55) et (240min, 0.8) à 200min -> 0.55 + (20/60)*0.25 ≈ 0.6333
  const expectedPartRm = 0.55 + (20 / 60) * 0.25
  assert.ok(Math.abs(result.effet.resistance_musculaire - expectedPartRm) < 1e-6)
  // le reste (1 - part_rm) suit la table Z1, dont 60% va en endurance_fondamentale
  assert.ok(Math.abs(result.effet.endurance_fondamentale - (1 - expectedPartRm) * 0.6) < 1e-6)
})

test('deux segments identiques en zone/durée mais positions différentes donnent un effet différent (limite connue assumée : effet dépend de la position)', () => {
  const early: Segment = { zone: 'Z2', duration_s: 600, avg_temperature_c: 20, cumulative_duration_before_s: 0 }
  const late: Segment = { zone: 'Z2', duration_s: 600, avg_temperature_c: 20, cumulative_duration_before_s: 250 * 60 }
  const resultEarly = computeEffect({ ...BASE, categorie: 'cardio', natureEffort: 'continu', segments: [early], dureeRealiseeTotaleS: 600, facteurExecution: 1 })
  const resultLate = computeEffect({ ...BASE, categorie: 'cardio', natureEffort: 'continu', segments: [late], dureeRealiseeTotaleS: 600, facteurExecution: 1 })
  assert.notEqual(resultEarly.effet.resistance_musculaire, resultLate.effet.resistance_musculaire)
  assert.ok(resultLate.effet.resistance_musculaire > resultEarly.effet.resistance_musculaire)
})

test('garde-fou : un budget total très supérieur à la référence est plafonné', () => {
  const segments: Segment[] = [{ zone: 'Z5', duration_s: 3600 * 5, avg_temperature_c: null, cumulative_duration_before_s: 0 }] // séance aberrante, 5h en Z5
  const result = computeEffect({
    ...BASE,
    categorie: 'cardio',
    natureEffort: 'continu',
    segments,
    dureeRealiseeTotaleS: 3600 * 5,
    facteurExecution: 1,
    plafondReference: 3, // moyenne mobile récente de 3 "unités de budget"
  })
  assert.equal(result.plafond_applique, true)
  assert.equal(result.budget_total_apres_plafond, 8 * 3) // coeff_plafond(8) * reference(3)
})

test('facteur_execution s\'applique uniformément à tous les axes', () => {
  const segments: Segment[] = [{ zone: 'Z1', duration_s: 3600, avg_temperature_c: null, cumulative_duration_before_s: 0 }]
  const full = computeEffect({ ...BASE, categorie: 'cardio', natureEffort: 'continu', segments, dureeRealiseeTotaleS: 3600, facteurExecution: 1 })
  const half = computeEffect({ ...BASE, categorie: 'cardio', natureEffort: 'continu', segments, dureeRealiseeTotaleS: 3600, facteurExecution: 0.5 })
  assert.ok(Math.abs(half.effet.endurance_fondamentale - full.effet.endurance_fondamentale * 0.5) < 1e-9)
})

test('computeFacteurExecution : conformité normale, pas de réduction', () => {
  const f = computeFacteurExecution(95, 95, 100, { plafond: 1.0, seuil_intensite_pct: 70, seuil_duree_pct: 80, reduction: 0.4 })
  assert.ok(Math.abs(f - 0.95) < 1e-9)
})

test('computeFacteurExecution : conformité intensité sous le seuil -> forte réduction', () => {
  const f = computeFacteurExecution(60, 50, 100, { plafond: 1.0, seuil_intensite_pct: 70, seuil_duree_pct: 80, reduction: 0.4 })
  assert.ok(Math.abs(f - 0.6 * 0.4) < 1e-9)
})

test('computeFacteurExecution : plafonné à 1.0 même si la conformité dépasse 100%', () => {
  const f = computeFacteurExecution(140, 140, 140, { plafond: 1.0, seuil_intensite_pct: 70, seuil_duree_pct: 80, reduction: 0.4 })
  assert.equal(f, 1.0)
})
