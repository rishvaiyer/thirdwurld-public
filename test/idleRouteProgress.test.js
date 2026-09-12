// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import { simulationConfig } from '../src/config/simulation.js'
import { createIdleRouteProgress } from '../src/simulation/idleRouteProgress.js'

test('idle movement advances by elapsed wall-clock time', () => {
  const advance = createIdleRouteProgress(simulationConfig)
  const result = advance({
    position: [0, 0, 0],
    waypoints: [[0, 0, 20]],
    elapsedMs: 1_000,
  })

  assert.ok(Math.abs(result.position[2] - 2.6) < 0.001)
  assert.equal(result.nextWaypointIndex, 0)
  assert.equal(result.arrived, false)
  assert.ok(Math.abs(result.distanceMoved - 2.6) < 0.001)
})

test('long pauses are capped instead of becoming teleports', () => {
  const advance = createIdleRouteProgress(simulationConfig)
  const result = advance({
    position: [0, 0, 0],
    waypoints: [[0, 0, 500]],
    elapsedMs: 60 * 60 * 1_000,
  })

  assert.equal(result.position[2], 12)
  assert.equal(result.distanceMoved, 12)
})

test('route progress follows corners and reports arrival', () => {
  const advance = createIdleRouteProgress(simulationConfig)
  const result = advance({
    position: [0, 0, 0],
    waypoints: [
      [0, 0, 4],
      [6, 1, 4],
    ],
    elapsedMs: 10_000,
  })

  assert.deepEqual(result.position, [6, 1, 4])
  assert.equal(result.nextWaypointIndex, 2)
  assert.equal(result.arrived, true)
  assert.equal(result.distanceMoved, 10)
})

test('movement settings remain configurable without changing route logic', () => {
  const advance = createIdleRouteProgress({
    idleMovement: { metersPerSecond: 1, maxStepMeters: 3 },
  })
  const result = advance({
    position: [0, 0, 0],
    waypoints: [[4, 0, 0]],
    elapsedMs: 10_000,
  })

  assert.deepEqual(result.position, [3, 0, 0])
  assert.ok(Math.abs(result.rotationY + Math.PI / 2) < 0.001)
})

test('an empty route is stable and inputs are not mutated', () => {
  const advance = createIdleRouteProgress(simulationConfig)
  const position = [1, 2, 3]
  const result = advance({ position, waypoints: [], elapsedMs: 1_000 })

  assert.deepEqual(result, {
    position: [1, 2, 3],
    rotationY: 0,
    nextWaypointIndex: 0,
    arrived: false,
    distanceMoved: 0,
  })
  assert.deepEqual(position, [1, 2, 3])
})

test('invalid route state fails early', () => {
  const advance = createIdleRouteProgress(simulationConfig)
  assert.throws(
    () => advance({ position: [0, 0], waypoints: [], elapsedMs: 1_000 }),
    /position/
  )
  assert.throws(
    () => advance({ position: [0, 0, 0], waypoints: [], nextWaypointIndex: 1, elapsedMs: 1_000 }),
    /nextWaypointIndex/
  )
})
