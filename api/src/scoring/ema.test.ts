import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRadarCumule } from './ema.js'
import { AXES, type EffetReelBrut } from './types.js'

function effet(value: number): EffetReelBrut {
  return Object.fromEntries(AXES.map(a => [a, value])) as EffetReelBrut
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

test('aucune séance scorée : pas d\'état', () => {
  assert.equal(computeRadarCumule([], '2026-10-29', 42), null)
})

test('une séance le jour même : valeur += (charge - valeur) / constante_temps, depuis 0', () => {
  const result = computeRadarCumule([{ date: '2026-10-29', effet: effet(42) }], '2026-10-29', 42)!
  assert.ok(Math.abs(result.vma - 1) < 1e-9)
})

test('les jours de repos font décroître l\'état (EMA en jours, pas en séances)', () => {
  const seances = [{ date: '2026-09-17', effet: effet(42) }]
  const jourMeme = computeRadarCumule(seances, '2026-09-17', 42)!
  const sixSemainesPlusTard = computeRadarCumule(seances, addDays('2026-09-17', 42), 42)!
  // (1 - 1/42)^42 ≈ 0.364
  assert.ok(Math.abs(sixSemainesPlusTard.vma / jourMeme.vma - Math.pow(41 / 42, 42)) < 1e-9)
})

test('le rythme compte : 10 séances quotidiennes pèsent plus que 10 séances hebdomadaires', () => {
  const quotidien = Array.from({ length: 10 }, (_, i) => ({ date: addDays('2026-01-01', i), effet: effet(10) }))
  const hebdo = Array.from({ length: 10 }, (_, i) => ({ date: addDays('2026-01-01', i * 7), effet: effet(10) }))
  const a = computeRadarCumule(quotidien, quotidien[9].date, 42)!
  const b = computeRadarCumule(hebdo, hebdo[9].date, 42)!
  assert.ok(a.vma > b.vma)
})

test('deux séances le même jour s\'additionnent dans la charge du jour', () => {
  const deux = computeRadarCumule([
    { date: '2026-10-29', effet: effet(10) },
    { date: '2026-10-29', effet: effet(20) },
  ], '2026-10-29', 42)!
  const une = computeRadarCumule([{ date: '2026-10-29', effet: effet(30) }], '2026-10-29', 42)!
  assert.ok(Math.abs(deux.vma - une.vma) < 1e-9)
})

test('l\'ordre d\'entrée ne compte pas, seule la date compte', () => {
  const s = [
    { date: '2026-10-01', effet: effet(5) },
    { date: '2026-10-10', effet: effet(50) },
    { date: '2026-10-20', effet: effet(15) },
  ]
  const trie = computeRadarCumule(s, '2026-10-29', 42)!
  const melange = computeRadarCumule([s[2], s[0], s[1]], '2026-10-29', 42)!
  assert.deepEqual(melange, trie)
})

test('une constante de temps plus courte réagit plus vite', () => {
  const s = [{ date: '2026-10-29', effet: effet(42) }]
  assert.ok(computeRadarCumule(s, '2026-10-29', 7)!.vo2max > computeRadarCumule(s, '2026-10-29', 42)!.vo2max)
})
