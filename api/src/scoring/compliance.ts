import type { BlocPrescrit, Categorie, ComplianceResult, Segment, Zone, ZoneCompliance } from './types.js'

const ZONES: Zone[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

function statutFor(ratioPct: number, thresholds: { ok_min_pct: number; ok_max_pct: number; warn_min_pct: number; warn_max_pct: number }): '✅' | '⚠️' | '❌' {
  if (ratioPct >= thresholds.ok_min_pct && ratioPct <= thresholds.ok_max_pct) return '✅'
  if (ratioPct >= thresholds.warn_min_pct && ratioPct <= thresholds.warn_max_pct) return '⚠️'
  return '❌'
}

// 2.2 — comparaison bac réalisé (agrégé par zone, ordre perdu volontairement,
// voir limites connues) vs bac prescrit. L'allure n'entre jamais dans ce calcul :
// power_w (via les segments de 2.1) est le seul critère décisionnel.
export function computeCompliance(
  categorie: Categorie,
  segments: Segment[],
  blocsPrescrits: BlocPrescrit[] | null,
  dureeRealiseeTotaleS: number,
  thresholds: { ok_min_pct: number; ok_max_pct: number; warn_min_pct: number; warn_max_pct: number },
): ComplianceResult {
  const dureeTotaleRealiseeMin = dureeRealiseeTotaleS / 60
  const prescrits = blocsPrescrits ?? []

  if (categorie === 'renforcement') {
    const dureeTotalePrescriteMin = prescrits.reduce((sum, b) => sum + b.duree_min, 0)
    const dureeConformitePct = dureeTotalePrescriteMin > 0 ? (dureeTotaleRealiseeMin / dureeTotalePrescriteMin) * 100 : null
    return {
      par_zone: [],
      duree_totale_realisee_min: dureeTotaleRealiseeMin,
      duree_totale_prescrite_min: dureeTotalePrescriteMin,
      duree_conformite_pct: dureeConformitePct,
      conformite_intensite_pct: null,
      conformite_globale_pct: dureeConformitePct ?? 100,
    }
  }

  const realiseParZone: Record<Zone, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }
  for (const seg of segments) realiseParZone[seg.zone] += seg.duration_s / 60

  const prescritParZone: Record<Zone, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }
  for (const bloc of prescrits) prescritParZone[bloc.zone_cible] += bloc.duree_min

  const parZone: ZoneCompliance[] = ZONES
    .filter(zone => prescritParZone[zone] > 0 || realiseParZone[zone] > 0)
    .map(zone => {
      const temps_realise_min = realiseParZone[zone]
      const temps_prescrit_min = prescritParZone[zone]
      const ratio_pct = temps_prescrit_min > 0 ? (temps_realise_min / temps_prescrit_min) * 100 : null
      return {
        zone,
        temps_realise_min,
        temps_prescrit_min,
        ratio_pct,
        statut: ratio_pct !== null ? statutFor(ratio_pct, thresholds) : '❌',
      }
    })

  const dureeTotalePrescriteMin = prescrits.reduce((sum, b) => sum + b.duree_min, 0)
  const dureeConformitePct = dureeTotalePrescriteMin > 0 ? (dureeTotaleRealiseeMin / dureeTotalePrescriteMin) * 100 : null

  const zonesAvecPrescription = parZone.filter(z => z.temps_prescrit_min > 0)
  const totalPrescrit = zonesAvecPrescription.reduce((sum, z) => sum + z.temps_prescrit_min, 0)
  const conformiteIntensitePct = totalPrescrit > 0
    ? zonesAvecPrescription.reduce((sum, z) => sum + (z.ratio_pct as number) * z.temps_prescrit_min, 0) / totalPrescrit
    : null

  const termes = [conformiteIntensitePct, dureeConformitePct].filter((v): v is number => v !== null)
  const conformiteGlobalePct = termes.length > 0 ? termes.reduce((a, b) => a + b, 0) / termes.length : 100

  return {
    par_zone: parZone,
    duree_totale_realisee_min: dureeTotaleRealiseeMin,
    duree_totale_prescrite_min: dureeTotalePrescriteMin,
    duree_conformite_pct: dureeConformitePct,
    conformite_intensite_pct: conformiteIntensitePct,
    conformite_globale_pct: conformiteGlobalePct,
  }
}
