// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import { createHumanOccupancyLifecycle } from '../src/simulation/humanOccupancyLifecycle.js'

test('a new lifecycle begins empty', () => {
  const occupancy = createHumanOccupancyLifecycle({ emptyGraceMs: 1_000 })

  assert.deepEqual(occupancy.snapshot(100), {
    humanCount: 0,
    mode: 'empty',
    graceEndsAtMs: null,
  })
})

test('arrival is occupied and departure begins one bounded grace period', () => {
  const occupancy = createHumanOccupancyLifecycle({ emptyGraceMs: 1_000 })

  assert.equal(occupancy.observe(2, 100).mode, 'occupied')
  assert.deepEqual(occupancy.observe(0, 200), {
    humanCount: 0,
    mode: 'grace',
    graceEndsAtMs: 1_200,
  })
  assert.equal(occupancy.observe(0, 800).graceEndsAtMs, 1_200)
  assert.equal(occupancy.snapshot(1_200).mode, 'empty')
})

test('a returning human immediately clears empty-world grace', () => {
  const occupancy = createHumanOccupancyLifecycle({ emptyGraceMs: 1_000 })
  occupancy.observe(1, 100)
  occupancy.observe(0, 200)

  assert.deepEqual(occupancy.observe(1, 300), {
    humanCount: 1,
    mode: 'occupied',
    graceEndsAtMs: null,
  })
})

test('zero grace transitions directly to empty', () => {
  const occupancy = createHumanOccupancyLifecycle({ emptyGraceMs: 0 })
  occupancy.observe(1, 100)

  assert.equal(occupancy.observe(0, 200).mode, 'empty')
})

test('invalid configuration and observations fail early', () => {
  assert.throws(() => createHumanOccupancyLifecycle({ emptyGraceMs: -1 }), /emptyGraceMs/)
  const occupancy = createHumanOccupancyLifecycle({ emptyGraceMs: 1_000 })
  assert.throws(() => occupancy.observe(0.5, 0), /humanCount/)
  assert.throws(() => occupancy.snapshot(Number.NaN), /atMs/)
})
