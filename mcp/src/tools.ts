import { v4 as uuidv4 } from 'uuid'
import db from './db.js'

export function listSeances(params: {
  from?: string
  to?: string
  type?: string
  etat?: string
  limit?: number
}) {
  let query = 'SELECT * FROM seances WHERE 1=1'
  const args: unknown[] = []

  if (params.from) { query += ' AND date >= ?'; args.push(params.from) }
  if (params.to)   { query += ' AND date <= ?'; args.push(params.to) }
  if (params.type) { query += ' AND type = ?';  args.push(params.type) }
  if (params.etat) { query += ' AND etat = ?';  args.push(params.etat) }

  query += ' ORDER BY date ASC LIMIT ?'
  args.push(params.limit ?? 50)

  return db.prepare(query).all(...args)
}

export function getSeance(id: string) {
  const row = db.prepare('SELECT * FROM seances WHERE id = ?').get(id)
  if (!row) throw new Error(`Séance ${id} introuvable`)
  return row
}

export function createSeance(data: {
  nom: string
  date: string
  contenu?: string
  type: string
  etat?: string
  commentaire_coach?: string
}) {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(`
    INSERT INTO seances (id, nom, date, contenu, type, etat, commentaire_coach, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.nom, data.date, data.contenu ?? '', data.type, data.etat ?? 'planifiee', data.commentaire_coach ?? '', now, now)
  return getSeance(id)
}

export function updateSeance(id: string, data: {
  nom?: string
  date?: string
  contenu?: string
  type?: string
  etat?: string
  commentaire_coach?: string
}) {
  getSeance(id) // throws if not found
  const fields = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => `${k} = ?`)
  if (fields.length === 0) return getSeance(id)

  const values = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([, v]) => v)

  db.prepare(`
    UPDATE seances SET ${fields.join(', ')}, updated_at = ? WHERE id = ?
  `).run(...values, new Date().toISOString(), id)

  return getSeance(id)
}

export function deleteSeance(id: string) {
  getSeance(id) // throws if not found
  db.prepare('DELETE FROM seances WHERE id = ?').run(id)
  return { success: true }
}

export function getStats(weeks = 4) {
  const since = new Date()
  since.setDate(since.getDate() - weeks * 7)
  const sinceISO = since.toISOString().slice(0, 10)

  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1)
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

  return {
    total_seances: total,
    par_type: Object.fromEntries(parType.map(r => [r.type, r.n])),
    par_etat: Object.fromEntries(parEtat.map(r => [r.etat, r.n])),
    seances_cette_semaine: semaineCount,
  }
}
