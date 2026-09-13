// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import { simulationConfig } from '../src/config/simulation.js'
import { createSimulationPacePolicy } from '../src/simulation/simulationPace.js'

test('an occupied world runs at its active pace', () => {
  const selectPace = createSimulationPacePolicy(simulationConfig)

  assert.deepEqual(selectPace({ humanCount: 1 }), {
    mode: 'active',
    tickIntervalSeconds: 1 / 30,
    autonomousWorkAllowed: true,
    reason: 'human-present',
  })
})

test('an empty world slows down and avoids autonomous work by default', () => {
  const selectPace = createSimulationPacePolicy(simulationConfig)

  assert.deepEqual(selectPace({ humanCount: 0 }), {
    mode: 'idle',
    tickIntervalSeconds: 1 / 2,
    autonomousWorkAllowed: false,
    reason: 'empty-world',
  })
})

test('always-live behavior is an explicit configuration choice', () => {
  const selectPace = createSimulationPacePolicy({
    ...simulationConfig,
    pace: { ...simulationConfig.pace, activeTickIntervalSeconds: 0.1, liveWhileEmpty: true },
  })

  assert.deepEqual(selectPace({ humanCount: 0 }), {
    mode: 'active',
    tickIntervalSeconds: 0.1,
    autonomousWorkAllowed: true,
    reason: 'configured-always-live',
  })
})

test('empty-world grace temporarily preserves active behavior', () => {
  const selectPace = createSimulationPacePolicy(simulationConfig)

  assert.deepEqual(selectPace({ humanCount: 0, emptyGraceActive: true }), {
    mode: 'active',
    tickIntervalSeconds: 1 / 30,
    autonomousWorkAllowed: true,
    reason: 'empty-world-grace',
  })
})

test('invalid configuration and occupancy fail early', () => {
  assert.throws(
    () => createSimulationPacePolicy({ pace: { ...simulationConfig.pace, idleTickIntervalSeconds: 0 } }),
    /pace\.idleTickIntervalSeconds/
  )
  assert.throws(
    () => createSimulationPacePolicy({ pace: { ...simulationConfig.pace, liveWhileEmpty: 'yes' } }),
    /pace\.liveWhileEmpty/
  )

  const selectPace = createSimulationPacePolicy(simulationConfig)
  assert.throws(() => selectPace({ humanCount: -1 }), /humanCount/)
  assert.throws(() => selectPace({ humanCount: 0, emptyGraceActive: 'yes' }), /emptyGraceActive/)
})
