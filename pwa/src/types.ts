export type SeanceType = 'endurance' | 'fractionne' | 'cotes' | 'recuperation' | 'competition' | 'autre'
export type SeanceEtat = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'
export type SeanceCategorie = 'cardio' | 'renforcement' | 'competition' | 'autre'
export type NatureEffort = 'continu' | 'repetition_courte' | 'non_applicable'
export type ZoneCible = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

export interface BlocPrescrit {
  zone_cible: ZoneCible
  duree_min: number
  repetitions?: number
}

// Sortie du moteur de scoring (7 axes) — jamais écrit par l'UI/MCP, seulement
// affiché (voir radar par séance, à venir).
export interface EffetReelBrut {
  endurance_fondamentale: number
  seuil_lactique: number
  vo2max: number
  vma: number
  resistance_musculaire: number
  economie_course: number
  resilience_thermique: number
}

export interface Seance {
  id: string
  nom: string
  date: string
  contenu: string
  type: SeanceType
  etat: SeanceEtat
  commentaire_coach: string
  condition_signalee: boolean
  garmin_activity_id: string | null
  categorie: SeanceCategorie
  nature_effort: NatureEffort
  blocs_prescrits: BlocPrescrit[] | null
  effet_reel_brut: EffetReelBrut | null
  created_at: string
  updated_at: string
}

export interface Stats {
  total_seances: number
  par_type: Partial<Record<SeanceType, number>>
  par_etat: Partial<Record<SeanceEtat, number>>
  seances_cette_semaine: number
}

export interface VMA {
  id: string
  valeur: number
  date_test: string
  note: string
  created_at: string
}

export interface FCZone {
  id: string
  nom: string
  fc_min: number
  fc_max: number
  ordre: number
  created_at: string
  updated_at: string
}

export interface PowerZone {
  id: string
  zone: ZoneCible
  nom: string
  power_min: number
  power_max: number | null
  created_at: string
  updated_at: string
}
