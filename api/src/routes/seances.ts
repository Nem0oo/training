import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { runScoringPipeline } from '../scoring/pipeline.js'

const router = Router()

// Étape 4 : déclenchement du moteur de scoring, identique que l'écriture
// vienne de l'UI ou du canal MCP (qui proxie vers cette même route — voir
// mcp/src/tools.ts). Synchrone, dans la requête : pas de champ de statut de
// calcul ni de retry auto — un échec (ex : activité pas encore synchronisée
// côté Garmin) est juste renvoyé dans la réponse, la séance reste écrite.
async function maybeTriggerScoring(id: string, newGarminActivityId: unknown, previousGarminActivityId: unknown): Promise<string | undefined> {
  if (typeof newGarminActivityId !== 'string' || !newGarminActivityId) return undefined
  if (newGarminActivityId === previousGarminActivityId) return undefined
  try {
    await runScoringPipeline(id, newGarminActivityId)
    return undefined
  } catch (err) {
    return (err as Error).message
  }
}

const CATEGORIES = ['cardio', 'renforcement', 'competition', 'autre']
const NATURES_EFFORT = ['continu', 'repetition_courte', 'non_applicable']
const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

function validateBlocsPrescrits(blocs: unknown): string | null {
  if (blocs === undefined || blocs === null) return null
  if (!Array.isArray(blocs)) return 'blocs_prescrits doit être un tableau'
  for (const bloc of blocs) {
    if (typeof bloc !== 'object' || bloc === null) return 'chaque bloc_prescrit doit être un objet'
    const b = bloc as Record<string, unknown>
    if (!ZONES.includes(b.zone_cible as string)) return `zone_cible invalide : ${b.zone_cible}`
    if (typeof b.duree_min !== 'number' || b.duree_min <= 0) return 'duree_min doit être un nombre > 0'
    if (b.repetitions !== undefined && typeof b.repetitions !== 'number') return 'repetitions doit être un nombre'
  }
  return null
}

// Ligne SQLite -> objet API : parse les colonnes JSON stockées en TEXT et
// convertit le booléen SQLite (0/1) en booléen JS.
function deserialize(row: Record<string, unknown>) {
  return {
    ...row,
    condition_signalee: Boolean(row.condition_signalee),
    blocs_prescrits: row.blocs_prescrits ? JSON.parse(row.blocs_prescrits as string) : null,
    effet_reel_brut: row.effet_reel_brut ? JSON.parse(row.effet_reel_brut as string) : null,
    conformite: row.conformite ? JSON.parse(row.conformite as string) : null,
  }
}

router.get('/', (req, res) => {
  let query = 'SELECT * FROM seances WHERE 1=1'
  const args: unknown[] = []

  const { from, to, type, etat, limit } = req.query
  if (from)  { query += ' AND date >= ?'; args.push(from) }
  if (to)    { query += ' AND date <= ?'; args.push(to) }
  if (type)  { query += ' AND type = ?';  args.push(type) }
  if (etat)  { query += ' AND etat = ?';  args.push(etat) }
  query += ' ORDER BY date ASC LIMIT ?'
  args.push(Number(limit) || 50)

  const rows = db.prepare(query).all(...args) as Record<string, unknown>[]
  res.json({ data: rows.map(deserialize) })
})

router.post('/', async (req, res) => {
  const {
    nom, date, contenu, type, etat, commentaire_coach,
    condition_signalee, garmin_activity_id, categorie, nature_effort, blocs_prescrits,
  } = req.body
  if (!nom || !date || !type) {
    res.status(400).json({ error: 'nom, date et type sont requis' })
    return
  }
  if (categorie !== undefined && !CATEGORIES.includes(categorie)) {
    res.status(400).json({ error: `categorie invalide : ${categorie}` })
    return
  }
  if (nature_effort !== undefined && !NATURES_EFFORT.includes(nature_effort)) {
    res.status(400).json({ error: `nature_effort invalide : ${nature_effort}` })
    return
  }
  const blocsError = validateBlocsPrescrits(blocs_prescrits)
  if (blocsError) { res.status(400).json({ error: blocsError }); return }

  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO seances (
      id, nom, date, contenu, type, etat, commentaire_coach,
      condition_signalee, garmin_activity_id, categorie, nature_effort, blocs_prescrits,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, nom, date, contenu ?? '', type, etat ?? 'planifiee', commentaire_coach ?? '',
    condition_signalee ? 1 : 0,
    garmin_activity_id ?? null,
    categorie ?? 'autre',
    nature_effort ?? 'non_applicable',
    blocs_prescrits ? JSON.stringify(blocs_prescrits) : null,
    now, now,
  )

  const scoring_error = await maybeTriggerScoring(id, garmin_activity_id, null)
  const data = deserialize(db.prepare('SELECT * FROM seances WHERE id = ?').get(id) as Record<string, unknown>)
  res.status(201).json(scoring_error ? { data, scoring_error } : { data })
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM seances WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!row) { res.status(404).json({ error: 'Séance introuvable' }); return }
  res.json({ data: deserialize(row) })
})

router.put('/:id', async (req, res) => {
  const existing = db.prepare('SELECT * FROM seances WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) { res.status(404).json({ error: 'Séance introuvable' }); return }

  if (req.body.categorie !== undefined && !CATEGORIES.includes(req.body.categorie)) {
    res.status(400).json({ error: `categorie invalide : ${req.body.categorie}` })
    return
  }
  if (req.body.nature_effort !== undefined && !NATURES_EFFORT.includes(req.body.nature_effort)) {
    res.status(400).json({ error: `nature_effort invalide : ${req.body.nature_effort}` })
    return
  }
  if (req.body.blocs_prescrits !== undefined) {
    const blocsError = validateBlocsPrescrits(req.body.blocs_prescrits)
    if (blocsError) { res.status(400).json({ error: blocsError }); return }
  }

  // effet_reel_brut est une sortie du moteur de scoring : jamais acceptée en
  // écriture via create_seance/update_seance (MCP ou UI).
  const allowed = [
    'nom', 'date', 'contenu', 'type', 'etat', 'commentaire_coach',
    'condition_signalee', 'garmin_activity_id', 'categorie', 'nature_effort', 'blocs_prescrits',
  ]
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k))
  if (updates.length === 0) { res.json({ data: deserialize(existing as Record<string, unknown>) }); return }

  const fields = updates.map(([k]) => `${k} = ?`).join(', ')
  const values = updates.map(([k, v]) => {
    if (k === 'condition_signalee') return v ? 1 : 0
    if (k === 'blocs_prescrits') return v ? JSON.stringify(v) : null
    return v
  })
  db.prepare(`UPDATE seances SET ${fields}, updated_at = ? WHERE id = ?`)
    .run(...values, new Date().toISOString(), req.params.id)

  const scoring_error = await maybeTriggerScoring(req.params.id, req.body.garmin_activity_id, existing.garmin_activity_id)
  const data = deserialize(db.prepare('SELECT * FROM seances WHERE id = ?').get(req.params.id) as Record<string, unknown>)
  res.json(scoring_error ? { data, scoring_error } : { data })
})

// 3.1 — radar PAR SÉANCE : proportions internes de l'impact de cette séance
// entre les 7 axes, normalisées par la somme de ses propres valeurs (PAS la
// même échelle que le radar cumulé — ne jamais mélanger les deux, voir 3.2
// dans routes/radar_cumule.ts).
router.get('/:id/radar', (req, res) => {
  const row = db.prepare('SELECT effet_reel_brut FROM seances WHERE id = ?').get(req.params.id) as { effet_reel_brut: string | null } | undefined
  if (!row) { res.status(404).json({ error: 'Séance introuvable' }); return }
  if (!row.effet_reel_brut) {
    res.status(409).json({ error: "Cette séance n'a pas encore été scorée (pas de garmin_activity_id lié, condition_signalee=true, ou calcul pas encore déclenché)" })
    return
  }
  const effet = JSON.parse(row.effet_reel_brut) as Record<string, number>
  const total = Object.values(effet).reduce((a, b) => a + b, 0)
  const proportions = Object.fromEntries(
    Object.entries(effet).map(([axe, v]) => [axe, total > 0 ? v / total : 0]),
  )
  res.json({ data: { proportions, effet_reel_brut: effet } })
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM seances WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Séance introuvable' }); return }
  db.prepare('DELETE FROM seances WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

export default router
