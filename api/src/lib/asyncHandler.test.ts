import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Request, Response } from 'express'
import { asyncHandler } from './asyncHandler.js'

test('asyncHandler transmet une promesse rejetée à next() au lieu de la laisser non gérée', async () => {
  const boom = new Error('boom')
  let received: unknown
  const handler = asyncHandler(async () => { throw boom })
  await handler({} as Request, {} as Response, (err?: unknown) => { received = err })
  assert.equal(received, boom)
})
