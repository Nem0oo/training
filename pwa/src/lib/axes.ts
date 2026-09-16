import type { EffetReelBrut } from '../types'

export const AXES = [
  'endurance_fondamentale',
  'seuil_lactique',
  'vo2max',
  'vma',
  'resistance_musculaire',
  'economie_course',
  'resilience_thermique',
] as const satisfies readonly (keyof EffetReelBrut)[]

export const AXIS_LABELS: Record<keyof EffetReelBrut, string> = {
  endurance_fondamentale: 'Endurance fond.',
  seuil_lactique: 'Seuil',
  vo2max: 'VO2max',
  vma: 'VMA',
  resistance_musculaire: 'Résist. musc.',
  economie_course: 'Écon. course',
  resilience_thermique: 'Résil. thermique',
}

export function toChartData(effet: EffetReelBrut): { label: string; value: number }[] {
  return AXES.map(axis => ({ label: AXIS_LABELS[axis], value: effet[axis] }))
}
