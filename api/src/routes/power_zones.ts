import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

router.get('/', (_req, res) => {
  res.json({ data: db.prepare('SELECT * FROM power_zones ORDER BY power_min ASC').all() })
})

router.post('/', (req, res) => {
  const { zone, nom, power_min, power_max } = req.body
  if (!ZONES.includes(zone) || !nom || typeof power_min !== 'number') {
    res.status(400).json({ error: 'zone (Z1-Z5), nom et power_min sont requis' })
    return
  }
  if (power_min < 0 || (power_max !== undefined && power_max !== null && power_max < power_min)) {
    res.status(400).json({ error: 'power_max doit être supérieur ou égal à power_min' })
    return
  }
  const existing = db.prepare('SELECT id FROM power_zones WHERE zone = ?').get(zone)
  if (existing) { res.status(409).json({ error: `La zone ${zone} existe déjà` }); return }

  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO power_zones (id, zone, nom, power_min, power_max, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, zone, nom, power_min, power_max ?? null, now, now)
  res.status(201).json({ data: db.prepare('SELECT * FROM power_zones WHERE id = ?').get(id) })
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM power_zones WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Zone de puissance introuvable' }); return }

  if (req.body.zone !== undefined && !ZONES.includes(req.body.zone)) {
    res.status(400).json({ error: `zone invalide : ${req.body.zone}` })
    return
  }

  const allowed = ['zone', 'nom', 'power_min', 'power_max']
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k))
  if (updates.length === 0) { res.json({ data: existing }); return }

  const fields = updates.map(([k]) => `${k} = ?`).join(', ')
  const values = updates.map(([, v]) => v)
  db.prepare(`UPDATE power_zones SET ${fields}, updated_at = ? WHERE id = ?`)
    .run(...values, new Date().toISOString(), req.params.id)

  res.json({ data: db.prepare('SELECT * FROM power_zones WHERE id = ?').get(req.params.id) })
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM power_zones WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Zone de puissance introuvable' }); return }
  db.prepare('DELETE FROM power_zones WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

export default router
