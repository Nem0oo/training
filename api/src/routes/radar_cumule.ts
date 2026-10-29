import { Router } from 'express'
import db from '../db.js'
import { loadScoringConfig } from '../scoring/config.js'
import { computeRadarCumule } from '../scoring/ema.js'
import type { EffetReelBrut } from '../scoring/types.js'
import { localDate } from '../lib/dates.js'

const router = Router()

// 3.2 — radar CUMULÉ (état de forme global) : EMA quotidienne par axe,
// recalculée à chaque lecture depuis les séances scorées et non signalées
// (voir scoring/ema.ts), sur SA PROPRE échelle (pas normalisé en proportions
// comme le radar par séance, voir routes/seances.ts `GET /:id/radar`). Ne
// jamais confondre les deux échelles côté client.
router.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT date, effet_reel_brut FROM seances
    WHERE effet_reel_brut IS NOT NULL AND condition_signalee = 0
  `).all() as { date: string; effet_reel_brut: string }[]

  const dateCalcul = localDate(new Date())
  const axes = computeRadarCumule(
    rows.map(r => ({ date: r.date, effet: JSON.parse(r.effet_reel_brut) as EffetReelBrut })),
    dateCalcul,
    loadScoringConfig().constante_temps_ema_jours,
  )
  if (!axes) {
    res.status(404).json({ error: "Aucune séance scorée pour l'instant — le radar cumulé n'a pas encore d'état" })
    return
  }
  res.json({ data: { axes, updated_at: dateCalcul } })
})

export default router
