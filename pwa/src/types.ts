export type SeanceType = 'endurance' | 'fractionne' | 'cotes' | 'recuperation' | 'competition' | 'autre'
export type SeanceEtat = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

export interface Seance {
  id: string
  nom: string
  date: string
  contenu: string
  type: SeanceType
  etat: SeanceEtat
  commentaire_coach: string
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
