import { Router } from 'express'
import db from '../db.js'
import { statsPeriod } from '../lib/dates.js'

const router = Router()

router.get('/', (req, res) => {
  const weeks = Number(req.query.weeks) || 4
  // Bornées à aujourd'hui : les séances planifiées à venir (plan de saison
  // importé) ne doivent pas gonfler les « N dernières semaines ».
  const { since, today, monday, nextMonday } = statsPeriod(new Date(), weeks)

  const total = (db.prepare('SELECT COUNT(*) as n FROM seances').get() as { n: number }).n

  const parType = db.prepare(
    'SELECT type, COUNT(*) as n FROM seances WHERE date >= ? AND date <= ? GROUP BY type'
  ).all(since, today) as { type: string; n: number }[]

  const parEtat = db.prepare(
    'SELECT etat, COUNT(*) as n FROM seances WHERE date >= ? AND date <= ? GROUP BY etat'
  ).all(since, today) as { etat: string; n: number }[]

  const semaineCount = (db.prepare(
    'SELECT COUNT(*) as n FROM seances WHERE date >= ? AND date < ?'
  ).get(monday, nextMonday) as { n: number }).n

  res.json({
    data: {
      total_seances: total,
      par_type: Object.fromEntries(parType.map(r => [r.type, r.n])),
      par_etat: Object.fromEntries(parEtat.map(r => [r.etat, r.n])),
      seances_cette_semaine: semaineCount,
    },
  })
})

// Volume cumulé (km) depuis la première séance du plan — courbe prévue
// (distance_prevue_km, toute séance) vs réalisée (distance_realisee_km,
// alimentée uniquement une fois la séance scorée), bucketée par semaine ISO
// (lundi). Une semaine sans donnée réalisée n'ajoute rien au cumul — la
// courbe réalisée reste simplement à plat tant que la séance n'est pas
// scorée, ce qui donne l'écart visuel avance/retard sur le plan.
router.get('/volume', (req, res) => {
  const tag = req.query.tag as string | undefined

  const rows = db.prepare(
    'SELECT date, tags, distance_prevue_km, distance_realisee_km FROM seances ORDER BY date ASC'
  ).all() as { date: string; tags: string | null; distance_prevue_km: number | null; distance_realisee_km: number | null }[]

  const filtered = tag
    ? rows.filter(r => r.tags && (JSON.parse(r.tags) as string[]).includes(tag))
    : rows

  const weekly = new Map<string, { prevu: number; realise: number }>()
  for (const r of filtered) {
    const d = new Date(r.date + 'T00:00:00Z')
    const dayOffset = (d.getUTCDay() + 6) % 7 // 0 = lundi
    d.setUTCDate(d.getUTCDate() - dayOffset)
    const weekKey = d.toISOString().slice(0, 10)
    const bucket = weekly.get(weekKey) ?? { prevu: 0, realise: 0 }
    bucket.prevu += r.distance_prevue_km ?? 0
    bucket.realise += r.distance_realisee_km ?? 0
    weekly.set(weekKey, bucket)
  }

  const semaines = [...weekly.keys()].sort()
  let cumulePrevu = 0
  let cumuleRealise = 0
  const data = semaines.map(semaine => {
    const b = weekly.get(semaine)!
    cumulePrevu += b.prevu
    cumuleRealise += b.realise
    return {
      semaine,
      cumule_prevu_km: Math.round(cumulePrevu * 10) / 10,
      cumule_realise_km: Math.round(cumuleRealise * 10) / 10,
    }
  })

  res.json({ data })
})

export default router
