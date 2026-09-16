import { AXES, type EffetReelBrut } from './types.js'

// 2.4 — état persistant par axe (niveau athlète, pas par séance), mis à jour
// à chaque séance scorée (non exclue par condition_signalee).
//
// Amorçage : pas de règle donnée dans la spec pour la toute première séance
// (previous === null). On initialise l'état cumulé directement à
// effet_reel_brut de cette première séance plutôt qu'à 0, pour éviter un
// biais de démarrage à froid qui mettrait ~CONSTANTE_TEMPS jours à rattraper
// un état plausible.
export function updateEma(
  previous: EffetReelBrut | null,
  nouveau: EffetReelBrut,
  constanteTempsJours: number,
): EffetReelBrut {
  if (previous === null) {
    return { ...nouveau }
  }
  const result = {} as EffetReelBrut
  for (const axis of AXES) {
    result[axis] = previous[axis] + (nouveau[axis] - previous[axis]) / constanteTempsJours
  }
  return result
}
