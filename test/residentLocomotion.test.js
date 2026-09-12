// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import { locomotionConfig } from '../src/config/locomotion.js'
import { createResidentLocomotion } from '../src/simulation/residentLocomotion.js'

const planMotion = createResidentLocomotion(locomotionConfig)

function motion(overrides = {}) {
  return planMotion({
    residentId: 'resident:a',
    position: { x: 0, z: 0 },
    waypoint: [0, 0, -10],
    currentRotationY: 0,
    deltaSeconds: 1 / 30,
    segmentDistance: 10,
    remainingDistance: 12,
    ...overrides,
  })
}

test('an aligned resident can move and run along a clear route', () => {
  const result = motion()

  assert.equal(result.aligned, true)
  assert.equal(result.yielding, false)
  assert.equal(result.running, true)
  assert.ok(result.speedScale >= locomotionConfig.movement.minimumSpeedScale)
  assert.ok(result.speedScale <= locomotionConfig.movement.maximumSpeedScale)
})

test('turning is capped by elapsed time and movement waits for alignment', () => {
  const result = motion({ waypoint: [10, 0, 0] })

  assert.equal(result.rotationY, -locomotionConfig.turning.radiansPerSecond / 30)
  assert.equal(result.aligned, false)
  assert.equal(result.running, false)
  assert.equal(result.speedScale, 0)
})

test('a close neighbor makes the resident yield and slow down', () => {
  const result = motion({ neighbors: [{ x: 0.6, z: -0.2 }] })

  assert.equal(result.yielding, true)
  assert.equal(result.running, false)
  assert.ok(result.speedScale < 1)
})

test('a resident stops inside the configured safety radius', () => {
  const result = motion({ neighbors: [{ x: 0, z: -0.4 }] })

  assert.equal(result.yielding, true)
  assert.equal(result.speedScale, 0)
})

test('run thresholds use hysteresis to prevent gait flicker', () => {
  assert.equal(motion({ remainingDistance: 6, segmentDistance: 3, wasRunning: false }).running, false)
  assert.equal(motion({ remainingDistance: 6, segmentDistance: 3, wasRunning: true }).running, true)
})

test('speed variation is stable per resident', () => {
  const first = motion({ residentId: 'resident:a' }).speedScale
  const repeated = motion({ residentId: 'resident:a' }).speedScale
  const different = motion({ residentId: 'resident:b' }).speedScale

  assert.equal(first, repeated)
  assert.notEqual(first, different)
})

test('movement feel can be tuned through configuration', () => {
  const configured = createResidentLocomotion({
    ...locomotionConfig,
    movement: { minimumSpeedScale: 0.5, maximumSpeedScale: 0.5 },
  })
  const result = configured({
    residentId: 'resident:a',
    position: { x: 0, z: 0 },
    waypoint: [0, 0, -10],
    currentRotationY: 0,
    deltaSeconds: 1 / 30,
    segmentDistance: 10,
    remainingDistance: 12,
  })

  assert.equal(result.speedScale, 0.5)
})

test('invalid configuration and motion input fail early', () => {
  assert.throws(
    () => createResidentLocomotion({
      ...locomotionConfig,
      avoidance: { ...locomotionConfig.avoidance, yieldRadius: 2 },
    }),
    /avoidance radii/
  )
  assert.throws(() => motion({ neighbors: 'nearby' }), /neighbors/)
  assert.throws(() => motion({ deltaSeconds: -1 }), /deltaSeconds/)
})
