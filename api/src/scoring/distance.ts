import type { BlocPrescrit } from './types.js'

export interface EstimationDistanceConfig {
  echauffement_km: number
  recuperation_km: number
  allure_seuil_tempo_min_par_km: number
  allure_ef_sl_min_par_km: number
}

// Estimation du volume PRÉVU (km) à partir des blocs prescrits — hypothèses
// arbitraires de l'athlète (config/scoring.json), pas une mesure. Convention
// de saisie du plan : un bloc Z1 aux côtés d'un bloc Z3/Z4 est toujours
// l'échauffement + la récupération fusionnés (jamais l'un sans l'autre) —
// forfait fixe, jamais mis à l'allure. Un bloc Z1 seul (EF/SL continue, pas
// de Z3/Z4) est mis à l'allure EF/SL.
export function estimateDistancePrevueKm(
  blocsPrescrits: BlocPrescrit[] | null,
  config: EstimationDistanceConfig,
): number | null {
  if (!blocsPrescrits || blocsPrescrits.length === 0) return null

  const core = blocsPrescrits.find(b => b.zone_cible === 'Z3' || b.zone_cible === 'Z4')
  const z1 = blocsPrescrits.find(b => b.zone_cible === 'Z1')

  if (core) {
    const coreKm = core.duree_min / config.allure_seuil_tempo_min_par_km
    const echRecupKm = z1 ? config.echauffement_km + config.recuperation_km : 0
    return coreKm + echRecupKm
  }
  if (z1) return z1.duree_min / config.allure_ef_sl_min_par_km
  return null
}
