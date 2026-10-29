import { AXES, type EffetReelBrut } from './types.js'

export interface SeanceScoree {
  date: string // YYYY-MM-DD
  effet: EffetReelBrut
}

const JOUR_MS = 86_400_000

function dayIndex(date: string): number {
  return Math.round(new Date(`${date}T00:00:00Z`).getTime() / JOUR_MS)
}

// 2.4 — radar cumulé : EMA quotidienne par axe (même principe que la CTL),
// recalculée à partir de l'historique des séances scorées plutôt que mise à
// jour incrémentalement. Chaque jour, de la première séance scorée jusqu'à
// `aujourdhui` : valeur += (charge_du_jour - valeur) / constante_temps, où
// charge_du_jour = somme des effet_reel_brut des séances de ce jour (0 les
// jours de repos, d'où la décroissance). Démarre à 0.
//
// Recalculer depuis l'historique garantit qu'une séance re-liée, supprimée
// ou signalée (condition_signalee) n'est jamais comptée deux fois ni gardée
// à tort, et que l'ordre de prise en compte est celui des dates.
export function computeRadarCumule(
  seances: SeanceScoree[],
  aujourdhui: string,
  constanteTempsJours: number,
): EffetReelBrut | null {
  if (seances.length === 0) return null

  const chargeParJour = new Map<number, EffetReelBrut>()
  for (const s of seances) {
    const jour = dayIndex(s.date)
    const charge = chargeParJour.get(jour) ?? (Object.fromEntries(AXES.map(a => [a, 0])) as EffetReelBrut)
    for (const axis of AXES) charge[axis] += s.effet[axis]
    chargeParJour.set(jour, charge)
  }

  const jours = [...chargeParJour.keys()]
  const debut = Math.min(...jours)
  const fin = Math.max(dayIndex(aujourdhui), ...jours)

  const etat = Object.fromEntries(AXES.map(a => [a, 0])) as EffetReelBrut
  for (let jour = debut; jour <= fin; jour++) {
    const charge = chargeParJour.get(jour)
    for (const axis of AXES) {
      etat[axis] += ((charge?.[axis] ?? 0) - etat[axis]) / constanteTempsJours
    }
  }
  return etat
}
