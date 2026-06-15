import { Router } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req, res) => {
  const weeks = Number(req.query.weeks) || 4
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)
  const sinceISO = since.toISOString().slice(0, 10)

  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))
  const weekISO = startOfWeek.toISOString().slice(0, 10)

  const total = (db.prepare('SELECT COUNT(*) as n FROM seances').get() as { n: number }).n

  const parType = db.prepare(
    'SELECT type, COUNT(*) as n FROM seances WHERE date >= ? GROUP BY type'
  ).all(sinceISO) as { type: string; n: number }[]

  const parEtat = db.prepare(
    'SELECT etat, COUNT(*) as n FROM seances WHERE date >= ? GROUP BY etat'
  ).all(sinceISO) as { etat: string; n: number }[]

  const semaineCount = (db.prepare(
    'SELECT COUNT(*) as n FROM seances WHERE date >= ?'
  ).get(weekISO) as { n: number }).n

  res.json({
    data: {
      total_seances: total,
      par_type: Object.fromEntries(parType.map(r => [r.type, r.n])),
      par_etat: Object.fromEntries(parEtat.map(r => [r.etat, r.n])),
      seances_cette_semaine: semaineCount,
    },
  })
})

export default router
