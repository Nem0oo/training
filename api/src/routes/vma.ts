import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ data: db.prepare('SELECT * FROM vma ORDER BY date_test DESC').all() })
})

router.post('/', (req, res) => {
  const { valeur, date_test, note } = req.body
  if (!valeur || !date_test) {
    res.status(400).json({ error: 'valeur et date_test sont requis' })
    return
  }
  if (typeof valeur !== 'number' || valeur <= 0) {
    res.status(400).json({ error: 'valeur doit être un nombre positif' })
    return
  }
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO vma (id, valeur, date_test, note, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, valeur, date_test, note ?? '', now)
  res.status(201).json({ data: db.prepare('SELECT * FROM vma WHERE id = ?').get(id) })
})

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM vma WHERE id = ?').get(req.params.id)
  if (!existing) { res.status(404).json({ error: 'VMA introuvable' }); return }
  db.prepare('DELETE FROM vma WHERE id = ?').run(req.params.id)
  res.status(204).send()
})

export default router
