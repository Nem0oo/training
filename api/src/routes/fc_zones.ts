import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ data: db.prepare('SELECT * FROM fc_zones ORDER BY ordre ASC, fc_min ASC').all() })
})

router.post('/', (req, res) => {
  const { nom, fc_min, fc_max, ordre } = req.body
  if (!nom || typeof fc_min !== 'number' || typeof fc_max !== 'number') {
    res.status(400).json({ error: 'nom, fc_min et fc_max sont requis' })
    return
  }
  if (fc_min < 0 || fc_max < fc_min) {
    res.status(400).json({ error: 'fc_max doit être supérieur ou égal à fc_min' })
    return
  }
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO fc_zones (id, nom, fc_min, fc_max, ordre, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, nom, fc_min, fc_max, ordre ?? 0, now, now)
  res.status(201).json({ data: db.prepare('SELECT * FROM fc_zones WHERE id = ?').get(id) })
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM fc_zones WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Zone FC introuvable' }); return }

  const allowed = ['nom', 'fc_min', 'fc_max', 'ordre']
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k))
  if (updates.length === 0) { res.json({ data: existing }); return }

  const fields = updates.map(([k]) => `${k} = ?`).join(', ')
  const values = updates.map(([, v]) => v)
  db.prepare(`UPDATE fc_zones SET ${fields}, updated_at = ? WHERE id = ?`)
    .run(...values, new Date().toISOString(), req.params.id)

  res.json({ data: db.prepare('SELECT * FROM fc_zones WHERE id = ?').get(req.params.id) })
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM fc_zones WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Zone FC introuvable' }); return }
  db.prepare('DELETE FROM fc_zones WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

export default router
