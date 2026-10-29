import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localDate, statsPeriod } from './dates.js'

test('localDate donne la date du jour dans le fuseau demandé, pas en UTC', () => {
  // Lundi 2 novembre 2026, 00:30 à Paris = dimanche 1er, 23:30 UTC.
  assert.equal(localDate(new Date('2026-11-01T23:30:00Z'), 'Europe/Paris'), '2026-11-02')
})

test('statsPeriod : lundi 00:30 heure de Paris compte déjà dans la nouvelle semaine', () => {
  const p = statsPeriod(new Date('2026-11-01T23:30:00Z'), 4, 'Europe/Paris')
  assert.equal(p.today, '2026-11-02')
  assert.equal(p.monday, '2026-11-02')
  assert.equal(p.nextMonday, '2026-11-09')
})

test('statsPeriod : en milieu de semaine, bornes lundi inclus / lundi suivant exclu', () => {
  const p = statsPeriod(new Date('2026-10-29T10:00:00Z'), 4, 'Europe/Paris') // jeudi
  assert.equal(p.monday, '2026-10-26')
  assert.equal(p.nextMonday, '2026-11-02')
})

test('statsPeriod : since = aujourd\'hui moins N semaines', () => {
  const p = statsPeriod(new Date('2026-10-29T10:00:00Z'), 4, 'Europe/Paris')
  assert.equal(p.since, '2026-10-01')
})
