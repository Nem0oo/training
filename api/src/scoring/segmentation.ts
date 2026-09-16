import type { GarminActivity, Segment, Zone } from './types.js'

export interface PowerZoneBound {
  zone: Zone
  power_min: number
  power_max: number | null
}

function findZone(power: number, zones: PowerZoneBound[]): Zone | null {
  for (const z of zones) {
    if (power >= z.power_min && (z.power_max === null || power <= z.power_max)) return z.zone
  }
  return null
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

// 2.1 — segmentation du réalisé en intervalles continus par zone de puissance,
// PRÉSERVÉS DANS L'ORDRE TEMPOREL (nécessaire au carve-out resistance_musculaire
// de 2.3, qui dépend de la position du segment dans la séance — voir spec).
// power_w est le seul signal utilisé (jamais hr_bpm) : la FC a un temps de
// latence physiologique incompatible avec la détection de zones sur des
// répétitions courtes (<1min), la puissance répond quasi instantanément.
export function segmentByPowerZone(
  activity: GarminActivity,
  zones: PowerZoneBound[],
  minIntervalSeconds: number,
): Segment[] {
  const { timestamps, power_w, temperature_c } = activity.series
  if (!power_w) {
    throw new Error("Impossible de segmenter : l'activité Garmin ne contient aucune donnée de puissance (power_w)")
  }
  if (zones.length === 0) {
    throw new Error('Aucune zone de puissance définie (power_zones vide) — impossible de segmenter')
  }

  const times = timestamps.map(t => new Date(t).getTime() / 1000)

  const segments: Segment[] = []
  let cumulativeBefore = 0

  let runZone: Zone | null = null
  let runStartIdx = -1
  let runTemps: number[] = []

  function flushRun(endIdx: number) {
    if (runZone === null || runStartIdx === -1) return
    const duration = times[endIdx] - times[runStartIdx]
    if (duration >= minIntervalSeconds) {
      segments.push({
        zone: runZone,
        duration_s: duration,
        avg_temperature_c: average(runTemps.filter((v): v is number => v !== null && v !== undefined)),
        cumulative_duration_before_s: cumulativeBefore,
      })
      cumulativeBefore += duration
    }
    runZone = null
    runStartIdx = -1
    runTemps = []
  }

  for (let i = 0; i < times.length; i++) {
    const power = power_w[i]
    const zone = power === null || power === undefined ? null : findZone(power, zones)

    if (zone !== runZone) {
      // La zone change (ou on sort d'une zone connue vers un trou de données) :
      // clôture le run précédent au dernier index qui en faisait encore partie.
      flushRun(i === 0 ? 0 : i - 1)
      runZone = zone
      runStartIdx = zone === null ? -1 : i
      runTemps = []
    }
    if (zone !== null && temperature_c && temperature_c[i] != null) {
      runTemps.push(temperature_c[i] as number)
    }
  }
  flushRun(times.length - 1)

  return segments
}
