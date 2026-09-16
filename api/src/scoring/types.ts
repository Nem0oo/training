export type Zone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'
export type NatureEffort = 'continu' | 'repetition_courte' | 'non_applicable'
export type Categorie = 'cardio' | 'renforcement' | 'competition' | 'autre'

export const AXES = [
  'endurance_fondamentale',
  'seuil_lactique',
  'vo2max',
  'vma',
  'resistance_musculaire',
  'economie_course',
  'resilience_thermique',
] as const
export type Axis = typeof AXES[number]

export type EffetReelBrut = Record<Axis, number>

export interface BlocPrescrit {
  zone_cible: Zone
  duree_min: number
  repetitions?: number
}

// Activité Garmin telle que renvoyée par garmin-bridge (/activities/{id}/json).
export interface GarminActivity {
  activity_id: string
  summary: {
    duration_seconds: number
    start_time: string
    end_time: string
  }
  series: {
    timestamps: string[]
    power_w: (number | null)[] | null
    temperature_c: (number | null)[] | null
  }
}

// Segment continu ≥ min_interval_seconds dans une même zone de puissance,
// PRÉSERVÉ DANS L'ORDRE TEMPOREL (nécessaire à 2.3, voir resistance_musculaire).
export interface Segment {
  zone: Zone
  duration_s: number
  avg_temperature_c: number | null
  cumulative_duration_before_s: number
}

export interface ZoneCompliance {
  zone: Zone
  temps_realise_min: number
  temps_prescrit_min: number
  ratio_pct: number | null
  statut: '✅' | '⚠️' | '❌'
}

export interface ComplianceResult {
  par_zone: ZoneCompliance[]
  duree_totale_realisee_min: number
  duree_totale_prescrite_min: number
  duree_conformite_pct: number | null
  conformite_intensite_pct: number | null
  conformite_globale_pct: number
}
