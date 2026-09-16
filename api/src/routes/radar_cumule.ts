import { Router } from 'express'
import db from '../db.js'
import { AXES } from '../scoring/types.js'

const router = Router()

// 3.2 — radar CUMULÉ (état de forme global) : état EMA persistant par axe,
// sur SA PROPRE échelle (pas normalisé en proportions comme le radar par
// séance, voir routes/seances.ts `GET /:id/radar`). Ne jamais confondre les
// deux échelles côté client.
router.get('/', (_req, res) => {
  const row = db.prepare('SELECT * FROM radar_cumule WHERE id = ?').get('singleton') as (Record<string, number> & { updated_at: string }) | undefined
  if (!row) {
    res.status(404).json({ error: "Aucune séance scorée pour l'instant — le radar cumulé n'a pas encore d'état" })
    return
  }
  const axes = Object.fromEntries(AXES.map(a => [a, row[a]]))
  res.json({ data: { axes, updated_at: row.updated_at } })
})

export default router
