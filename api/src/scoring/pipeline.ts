import db from '../db.js'
import { fetchGarminActivity } from '../garmin/client.js'
import { loadScoringConfig } from './config.js'
import { segmentByPowerZone, type PowerZoneBound } from './segmentation.js'
import { computeCompliance } from './compliance.js'
import { computeEffect, computeFacteurExecution } from './effect.js'
import { updateEma } from './ema.js'
import { AXES, type BlocPrescrit, type Categorie, type EffetReelBrut, type NatureEffort } from './types.js'

interface SeanceRow {
  id: string
  categorie: Categorie
  nature_effort: NatureEffort
  blocs_prescrits: string | null
  condition_signalee: number
}

function getPowerZones(): PowerZoneBound[] {
  return (db.prepare('SELECT zone, power_min, power_max FROM power_zones ORDER BY power_min ASC').all() as PowerZoneBound[])
}

// Référence pour le garde-fou anti-aberration (2.3) : moyenne de
// sum(effet_reel_brut) sur les N dernières séances comparables (même
// categorie, déjà scorées, non exclues). null si aucun historique — dans ce
// cas aucun plafond n'est appliqué (première séance de cette catégorie).
function getPlafondReference(categorie: Categorie, excludeId: string, fenetre: number): number | null {
  const rows = db.prepare(`
    SELECT effet_reel_brut FROM seances
    WHERE categorie = ? AND id != ? AND condition_signalee = 0 AND effet_reel_brut IS NOT NULL
    ORDER BY date DESC LIMIT ?
  `).all(categorie, excludeId, fenetre) as { effet_reel_brut: string }[]
  if (rows.length === 0) return null
  const budgets = rows.map(r => {
    const effet = JSON.parse(r.effet_reel_brut) as EffetReelBrut
    return AXES.reduce((sum, axis) => sum + effet[axis], 0)
  })
  return budgets.reduce((a, b) => a + b, 0) / budgets.length
}

function getRadarCumule(): EffetReelBrut | null {
  const row = db.prepare('SELECT * FROM radar_cumule WHERE id = ?').get('singleton') as (EffetReelBrut & { id: string }) | undefined
  if (!row) return null
  return Object.fromEntries(AXES.map(a => [a, row[a]])) as EffetReelBrut
}

function saveRadarCumule(effet: EffetReelBrut) {
  const now = new Date().toISOString()
  const cols = AXES.join(', ')
  const placeholders = AXES.map(() => '?').join(', ')
  const updates = AXES.map(a => `${a} = excluded.${a}`).join(', ')
  db.prepare(`
    INSERT INTO radar_cumule (id, ${cols}, updated_at)
    VALUES ('singleton', ${placeholders}, ?)
    ON CONFLICT(id) DO UPDATE SET ${updates}, updated_at = excluded.updated_at
  `).run(...AXES.map(a => effet[a]), now)
}

// Point d'entrée unique du déclenchement (étape 4) — appelé par les routes
// seances après un create/update avec garmin_activity_id non-vide, que
// l'écriture vienne du canal MCP (proxié) ou UI. Ne relance jamais
// automatiquement en cas d'échec : pas de champ de statut, pas de retry —
// l'utilisateur vide puis remet garmin_activity_id pour redéclencher.
export async function runScoringPipeline(seanceId: string, garminActivityId: string): Promise<void> {
  const seance = db.prepare('SELECT id, categorie, nature_effort, blocs_prescrits, condition_signalee FROM seances WHERE id = ?').get(seanceId) as SeanceRow | undefined
  if (!seance) throw new Error(`Séance ${seanceId} introuvable`)
  if (seance.condition_signalee) return // exclue des calculs par design (1.1)

  const config = loadScoringConfig()
  const activity = await fetchGarminActivity(garminActivityId)
  const blocsPrescrits = seance.blocs_prescrits ? (JSON.parse(seance.blocs_prescrits) as BlocPrescrit[]) : null

  const categorie = seance.categorie
  const segments = categorie === 'renforcement' || categorie === 'autre'
    ? []
    : segmentByPowerZone(activity, getPowerZones(), config.min_interval_seconds)

  const compliance = computeCompliance(categorie, segments, blocsPrescrits, activity.summary.duration_seconds, config.conformite_statuts)
  const facteurExecution = computeFacteurExecution(
    compliance.conformite_globale_pct,
    compliance.conformite_intensite_pct,
    compliance.duree_conformite_pct,
    config.facteur_execution,
  )
  const plafondReference = getPlafondReference(categorie, seanceId, config.plafond_fenetre_seances)

  const { effet } = computeEffect({
    categorie,
    natureEffort: seance.nature_effort,
    segments,
    dureeRealiseeTotaleS: activity.summary.duration_seconds,
    facteurExecution,
    poidsIntensite: config.poids_intensite,
    poidsRenfo: config.poids_renfo,
    repartition: config.repartition,
    zone2ResilienceThermique: config.zone2_resilience_thermique,
    rampPoints: config.resistance_musculaire_ramp.points,
    coeffPlafond: config.coeff_plafond,
    plafondReference,
  })

  db.prepare('UPDATE seances SET effet_reel_brut = ?, conformite = ?, distance_realisee_km = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(effet), JSON.stringify(compliance), activity.summary.total_distance_km, new Date().toISOString(), seanceId)

  const nouveauCumule = updateEma(getRadarCumule(), effet, config.constante_temps_ema_jours)
  saveRadarCumule(nouveauCumule)
}
