import { AXES, type Axis, type Categorie, type EffetReelBrut, type NatureEffort, type Segment, type Zone } from './types.js'

type NonMuscularAxis = Exclude<Axis, 'resistance_musculaire'>

interface RepartitionConfig {
  Z1: Record<NonMuscularAxis, number>
  Z2: Omit<Record<NonMuscularAxis, number>, 'endurance_fondamentale' | 'resilience_thermique'>
  Z3: Record<NonMuscularAxis, number>
  Z4: { continu: Record<NonMuscularAxis, number>; repetition_courte: Record<NonMuscularAxis, number> }
  Z5: { continu: Record<NonMuscularAxis, number>; repetition_courte: Record<NonMuscularAxis, number> }
}

function emptyEffet(): EffetReelBrut {
  return Object.fromEntries(AXES.map(a => [a, 0])) as EffetReelBrut
}

function rampFraction(minutesBefore: number, points: { minutes: number; fraction: number }[]): number {
  const sorted = [...points].sort((a, b) => a.minutes - b.minutes)
  if (minutesBefore <= sorted[0].minutes) return sorted[0].fraction
  if (minutesBefore >= sorted[sorted.length - 1].minutes) return sorted[sorted.length - 1].fraction
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    if (minutesBefore >= a.minutes && minutesBefore <= b.minutes) {
      const t = (minutesBefore - a.minutes) / (b.minutes - a.minutes)
      return a.fraction + t * (b.fraction - a.fraction)
    }
  }
  return 0
}

// Z4/Z5 sans nature_effort exploitable (séance cardio/competition où le champ
// est resté 'non_applicable') : on retombe sur la variante 'continu', par
// défaut plus neutre qu'une répétition courte — hypothèse documentée, pas de
// règle métier fournie pour ce cas dans la spec.
function repartitionFor(
  zone: Zone,
  natureEffort: NatureEffort,
  avgTempC: number | null,
  repartition: RepartitionConfig,
  zone2: { min: number; max: number; temp_min_c: number; temp_max_c: number },
): Record<NonMuscularAxis, number> {
  if (zone === 'Z1') return repartition.Z1
  if (zone === 'Z3') return repartition.Z3
  if (zone === 'Z2') {
    const temp = avgTempC ?? (zone2.temp_min_c + zone2.temp_max_c) / 2
    const clamped = Math.min(Math.max(temp, zone2.temp_min_c), zone2.temp_max_c)
    const t = (clamped - zone2.temp_min_c) / (zone2.temp_max_c - zone2.temp_min_c)
    const resilience_thermique = zone2.min + t * (zone2.max - zone2.min)
    return { ...repartition.Z2, endurance_fondamentale: 80 - resilience_thermique, resilience_thermique } as Record<NonMuscularAxis, number>
  }
  const variante = natureEffort === 'non_applicable' ? 'continu' : natureEffort
  return zone === 'Z4' ? repartition.Z4[variante] : repartition.Z5[variante]
}

export interface EffectResult {
  effet: EffetReelBrut
  budget_total_avant_plafond: number
  budget_total_apres_plafond: number
  plafond_applique: boolean
}

// 2.3 — modèle d'effet 7 axes. resistance_musculaire est un carve-out PAR
// SEGMENT (pas un accumulateur unique appliqué en une fois à la fin) : chaque
// segment ≥60s dévie une fraction croissante de son propre budget selon la
// durée cumulée d'effort continu déjà écoulée AVANT lui dans la séance — deux
// segments identiques en zone/durée/variante produisent donc un effet
// différent selon leur position (fatigue biomécanique qui s'installe avec le
// temps, pas dès le départ).
export function computeEffect(params: {
  categorie: Categorie
  natureEffort: NatureEffort
  segments: Segment[]
  dureeRealiseeTotaleS: number
  facteurExecution: number
  poidsIntensite: Record<Zone, number>
  poidsRenfo: number
  repartition: RepartitionConfig
  zone2ResilienceThermique: { min: number; max: number; temp_min_c: number; temp_max_c: number }
  rampPoints: { minutes: number; fraction: number }[]
  coeffPlafond: number
  plafondReference: number | null
}): EffectResult {
  const effet = emptyEffet()
  let budgetTotal = 0

  if (params.categorie === 'renforcement') {
    const budgetSeance = (params.dureeRealiseeTotaleS / 3600) * params.poidsRenfo
    effet.resistance_musculaire = budgetSeance
    budgetTotal = budgetSeance
  } else {
    for (const seg of params.segments) {
      const budgetBac = (seg.duration_s / 3600) * params.poidsIntensite[seg.zone]
      budgetTotal += budgetBac

      const minutesBefore = seg.cumulative_duration_before_s / 60
      const partRm = rampFraction(minutesBefore, params.rampPoints)
      const budgetRestant = budgetBac * (1 - partRm)
      effet.resistance_musculaire += budgetBac * partRm

      const table = repartitionFor(seg.zone, params.natureEffort, seg.avg_temperature_c, params.repartition, params.zone2ResilienceThermique)
      for (const axis of Object.keys(table) as NonMuscularAxis[]) {
        effet[axis] += budgetRestant * (table[axis] / 100)
      }
    }
  }

  // Garde-fou anti-aberration : plafonne le budget total (avant facteur
  // d'exécution) à coeff_plafond × la moyenne mobile des séances comparables.
  const cap = params.plafondReference !== null ? params.coeffPlafond * params.plafondReference : null
  let budgetApresPlafond = budgetTotal
  let plafondApplique = false
  if (cap !== null && budgetTotal > cap && budgetTotal > 0) {
    const scale = cap / budgetTotal
    for (const axis of AXES) effet[axis] *= scale
    budgetApresPlafond = cap
    plafondApplique = true
  }

  for (const axis of AXES) effet[axis] *= params.facteurExecution

  return {
    effet,
    budget_total_avant_plafond: budgetTotal,
    budget_total_apres_plafond: budgetApresPlafond,
    plafond_applique: plafondApplique,
  }
}

export function computeFacteurExecution(
  conformiteGlobalePct: number,
  conformiteIntensitePct: number | null,
  dureeConformitePct: number | null,
  config: { plafond: number; seuil_intensite_pct: number; seuil_duree_pct: number; reduction: number },
): number {
  let facteur = Math.min(conformiteGlobalePct / 100, config.plafond)
  const intensiteFaible = conformiteIntensitePct !== null && conformiteIntensitePct < config.seuil_intensite_pct
  const dureeFaible = dureeConformitePct !== null && dureeConformitePct < config.seuil_duree_pct
  if (intensiteFaible || dureeFaible) facteur *= config.reduction
  return Math.max(facteur, 0)
}
