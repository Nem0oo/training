import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { Axis, Zone } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = process.env.SCORING_CONFIG_PATH ?? join(__dirname, '../../../config/scoring.json')

type NonMuscularAxis = Exclude<Axis, 'resistance_musculaire'>

interface ScoringConfig {
  min_interval_seconds: number
  poids_intensite: Record<Zone, number>
  poids_renfo: number
  repartition: {
    Z1: Record<NonMuscularAxis, number>
    Z2: Omit<Record<NonMuscularAxis, number>, 'endurance_fondamentale' | 'resilience_thermique'>
    Z3: Record<NonMuscularAxis, number>
    Z4: { continu: Record<NonMuscularAxis, number>; repetition_courte: Record<NonMuscularAxis, number> }
    Z5: { continu: Record<NonMuscularAxis, number>; repetition_courte: Record<NonMuscularAxis, number> }
  }
  zone2_resilience_thermique: { min: number; max: number; temp_min_c: number; temp_max_c: number }
  resistance_musculaire_ramp: { points: { minutes: number; fraction: number }[] }
  conformite_statuts: { ok_min_pct: number; ok_max_pct: number; warn_min_pct: number; warn_max_pct: number }
  facteur_execution: { plafond: number; seuil_intensite_pct: number; seuil_duree_pct: number; reduction: number }
  coeff_plafond: number
  plafond_fenetre_seances: number
  constante_temps_ema_jours: number
  estimation_distance: {
    echauffement_km: number
    recuperation_km: number
    allure_seuil_tempo_min_par_km: number
    allure_ef_sl_min_par_km: number
  }
}

let cached: ScoringConfig | null = null

// Lu à chaque appel de haut niveau du moteur (pas mis en cache indéfiniment)
// pour qu'un changement du fichier monté soit pris en compte après un simple
// redémarrage du conteneur, sans avoir besoin de rebuild.
export function loadScoringConfig(): ScoringConfig {
  if (cached) return cached
  const raw = readFileSync(CONFIG_PATH, 'utf-8')
  cached = JSON.parse(raw) as ScoringConfig
  return cached
}

export function reloadScoringConfig(): ScoringConfig {
  cached = null
  return loadScoringConfig()
}
