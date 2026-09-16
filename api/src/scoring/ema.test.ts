import { test } from 'node:test'
import assert from 'node:assert/strict'
import { updateEma } from './ema.js'
import { AXES, type EffetReelBrut } from './types.js'

function effet(value: number): EffetReelBrut {
  return Object.fromEntries(AXES.map(a => [a, value])) as EffetReelBrut
}

test('première séance : amorce l\'état cumulé directement à sa valeur (pas de démarrage à froid depuis 0)', () => {
  const result = updateEma(null, effet(5), 42)
  assert.deepEqual(result, effet(5))
})

test('mise à jour EMA suit la formule valeur += (nouveau - valeur) / constante_temps', () => {
  const previous = effet(10)
  const nouveau = effet(52)
  const result = updateEma(previous, nouveau, 42)
  // 10 + (52 - 10) / 42 = 10 + 1 = 11
  assert.ok(Math.abs(result.vma - 11) < 1e-9)
})

test('une constante de temps plus courte réagit plus vite à une nouvelle séance', () => {
  const previous = effet(0)
  const nouveau = effet(42)
  const slow = updateEma(previous, nouveau, 42)
  const fast = updateEma(previous, nouveau, 7)
  assert.ok(fast.vo2max > slow.vo2max)
})
