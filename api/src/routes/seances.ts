import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

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

  res.json({ data: db.prepare(query).all(...args) })
})

router.post('/', (req, res) => {
  const { nom, date, contenu, type, etat, commentaire_coach } = req.body
  if (!nom || !date || !type) {
    res.status(400).json({ error: 'nom, date et type sont requis' })
    return
  }
  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO seances (id, nom, date, contenu, type, etat, commentaire_coach, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, nom, date, contenu ?? '', type, etat ?? 'planifiee', commentaire_coach ?? '', now, now)

  res.status(201).json({ data: db.prepare('SELECT * FROM seances WHERE id = ?').get(id) })
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM seances WHERE id = ?').get(req.params.id)
  if (!row) { res.status(404).json({ error: 'Séance introuvable' }); return }
  res.json({ data: row })
})

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM seances WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Séance introuvable' }); return }

  const allowed = ['nom', 'date', 'contenu', 'type', 'etat', 'commentaire_coach']
  const updates = Object.entries(req.body)
    .filter(([k]) => allowed.includes(k))
  if (updates.length === 0) { res.json({ data: existing }); return }

  const fields = updates.map(([k]) => `${k} = ?`).join(', ')
  const values = updates.map(([, v]) => v)
  db.prepare(`UPDATE seances SET ${fields}, updated_at = ? WHERE id = ?`)
    .run(...values, new Date().toISOString(), req.params.id)

  res.json({ data: db.prepare('SELECT * FROM seances WHERE id = ?').get(req.params.id) })
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM seances WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'Séance introuvable' }); return }
  db.prepare('DELETE FROM seances WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

export default router
