import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateDistancePrevueKm } from './distance.js'

const CONFIG = {
  echauffement_km: 3,
  recuperation_km: 1.5,
  allure_seuil_tempo_min_par_km: 4.5833333333333335, // 4'35"
  allure_ef_sl_min_par_km: 6.75, // 6'45"
}

test('sans blocs prescrits, pas d\'estimation', () => {
  assert.equal(estimateDistancePrevueKm(null, CONFIG), null)
  assert.equal(estimateDistancePrevueKm([], CONFIG), null)
})

test('bloc Z1 seul (EF/SL continue) : mis à l\'allure EF/SL', () => {
  const km = estimateDistancePrevueKm([{ zone_cible: 'Z1', duree_min: 60 }], CONFIG)
  assert.ok(Math.abs(km! - 60 / 6.75) < 0.001)
})

test('bloc Z4 (seuil) + Z1 (échauffement+récup fusionnés) : forfait fixe + allure sur le core', () => {
  const km = estimateDistancePrevueKm(
    [{ zone_cible: 'Z4', duree_min: 20 }, { zone_cible: 'Z1', duree_min: 28 }],
    CONFIG,
  )
  const attendu = 20 / 4.5833333333333335 + 3 + 1.5
  assert.ok(Math.abs(km! - attendu) < 0.001)
})

test('bloc Z3 (tempo) + Z1 : même règle que Z4', () => {
  const km = estimateDistancePrevueKm(
    [{ zone_cible: 'Z3', duree_min: 41 }, { zone_cible: 'Z1', duree_min: 28 }],
    CONFIG,
  )
  const attendu = 41 / 4.5833333333333335 + 3 + 1.5
  assert.ok(Math.abs(km! - attendu) < 0.001)
})

test('bloc core (Z4) sans bloc Z1 : pas de forfait échauffement/récup', () => {
  const km = estimateDistancePrevueKm([{ zone_cible: 'Z4', duree_min: 20 }], CONFIG)
  const attendu = 20 / 4.5833333333333335
  assert.ok(Math.abs(km! - attendu) < 0.001)
})
