// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import * as thirdwurld from 'thirdwurld-public'
import { createHyperfyRuntime } from 'thirdwurld-public/hyperfy'

test('the public interface exposes runtimes and editable configuration', () => {
  assert.equal(typeof thirdwurld.createWorldRuntime, 'function')
  assert.equal(typeof thirdwurld.createHyperfyRuntime, 'function')
  assert.equal(createHyperfyRuntime, thirdwurld.createHyperfyRuntime)
  assert.ok(Array.isArray(thirdwurld.worldConfig.destinations))
  assert.ok(Array.isArray(thirdwurld.activityConfig.activities))
  assert.ok(Array.isArray(thirdwurld.routineConfig.periods))
  assert.equal(thirdwurld.simulationConfig.occupancy.emptyGraceMs, 15 * 60 * 1_000)
})
