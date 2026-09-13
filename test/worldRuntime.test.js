// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import { createWorldRuntime } from '../src/runtime/worldRuntime.js'

function createRuntime(overrides = {}) {
  let monotonicTimeMs = 500
  const movements = []
  const runtime = createWorldRuntime({
    clock: {
      worldEpochMs: 10_000,
      observedAtMs: monotonicTimeMs,
      readMonotonicTimeMs: () => monotonicTimeMs,
    },
    navigationAdapter: {
      movePlayer(movement) {
        movements.push(movement)
        return true
      },
    },
    random: () => 0,
    ...overrides,
  })
  return {
    runtime,
    movements,
    advanceTime(milliseconds) {
      monotonicTimeMs += milliseconds
    },
  }
}

function event(overrides = {}) {
  return {
    actor: { id: 'resident:a', type: 'resident' },
    action: 'visited',
    destination: 'town-square',
    participants: [],
    visibility: 'public',
    result: { status: 'succeeded', reasonCode: '' },
    evidenceIds: ['movement:1'],
    worldClock: { phase: 'day', at: 10_000 },
    retention: { policy: 'permanent' },
    idempotencyKey: 'visit:1',
    occurredAt: 10_000,
    ...overrides,
  }
}

test('a new runtime exposes a safe idle snapshot', () => {
  const { runtime } = createRuntime()
  const snapshot = runtime.snapshot()

  assert.equal(snapshot.worldTimeMs, 10_000)
  assert.equal(snapshot.humanCount, 0)
  assert.equal(snapshot.pace.mode, 'idle')
  assert.equal(snapshot.destinations.length, 3)
  assert.deepEqual(snapshot.publicEvents, [])
})

test('occupancy updates simulation pace through one interface', () => {
  const { runtime } = createRuntime()

  assert.equal(runtime.setHumanCount(1).mode, 'active')
  assert.equal(runtime.snapshot().humanCount, 1)
  assert.equal(runtime.setHumanCount(0).autonomousWorkAllowed, false)
})

test('resident motion is planned through the runtime interface', () => {
  const { runtime } = createRuntime()
  const result = runtime.planResidentMotion({
    residentId: 'resident:a',
    position: { x: 0, z: 0 },
    waypoint: [0, 0, -10],
    currentRotationY: 0,
    deltaSeconds: 1 / 30,
    segmentDistance: 10,
    remainingDistance: 12,
  })

  assert.equal(result.aligned, true)
  assert.equal(result.running, true)
})

test('resident activity is selected through the runtime interface', () => {
  const { runtime } = createRuntime()
  const result = runtime.selectResidentActivity({
    needs: { energy: 0.9, social: 0.1, curiosity: 0.8 },
  })

  assert.equal(result.ok, true)
  assert.equal(result.activityId, 'socialize')
  assert.equal(runtime.snapshot().lastActivity.activityId, 'socialize')
})

test('resident routine follows synchronized world time', () => {
  const { runtime, advanceTime } = createRuntime()

  assert.equal(runtime.currentResidentRoutine().activityId, 'rest')
  advanceTime(9 * 60 * 60 * 1_000)
  assert.equal(runtime.currentResidentRoutine().activityId, 'explore')
})

test('interaction points are reserved and released through the runtime', () => {
  const { runtime } = createRuntime()
  const result = runtime.reserveInteractionPoint({
    residentId: 'resident:a',
    locationId: 'town-square',
    candidates: [[0, 0, 0]],
  })

  assert.equal(result.ok, true)
  assert.equal(runtime.snapshot().interactionPointReservations.length, 1)
  assert.equal(runtime.releaseInteractionPoint('resident:a'), true)
  assert.equal(runtime.snapshot().interactionPointReservations.length, 0)
})

test('successful travel updates movement and breadcrumb state', () => {
  const { runtime, movements } = createRuntime()

  assert.equal(runtime.travel('town-square').ok, true)
  assert.equal(runtime.travel('workshop').ok, true)
  assert.deepEqual(runtime.snapshot().breadcrumbTrail, ['town-square', 'workshop'])
  assert.equal(movements.length, 2)
})

test('failed travel does not enter breadcrumb history', () => {
  const { runtime } = createRuntime({
    navigationAdapter: { movePlayer: () => false },
  })

  assert.equal(runtime.travel('town-square').reason, 'arrival-blocked')
  assert.deepEqual(runtime.snapshot().breadcrumbTrail, [])
})

test('only valid resident actions become current runtime state', () => {
  const { runtime } = createRuntime()
  const action = {
    type: 'observe',
    summary: 'The plaza is active.',
    confidence: 'high',
    evidenceIds: ['event:1'],
  }

  assert.equal(runtime.parseResidentAction(JSON.stringify(action)).ok, true)
  assert.deepEqual(runtime.snapshot().lastAction, action)
  assert.equal(runtime.parseResidentAction('{bad json}').ok, false)
  assert.deepEqual(runtime.snapshot().lastAction, action)
})

test('relationship changes remain directional and evidence-backed', () => {
  const { runtime, advanceTime } = createRuntime()
  advanceTime(250)
  const relationship = runtime.applyInteraction({
    sourceId: 'resident:a',
    targetId: 'resident:b',
    expressedSignals: ['supportive'],
    evidenceIds: ['event:1'],
  })

  assert.equal(relationship.scores.trust, 3)
  assert.equal(relationship.lastInteractionAt, 10_250)
  assert.equal(runtime.snapshot().relationships.length, 1)
})

test('public event projections exclude evidence and idempotency details', () => {
  const { runtime } = createRuntime()
  const receipt = runtime.recordWorldEvent(event())
  const snapshot = runtime.snapshot()

  assert.equal(receipt.ok, true)
  assert.equal(receipt.duplicate, false)
  assert.equal(snapshot.publicEvents.length, 1)
  assert.equal('evidenceIds' in snapshot.publicEvents[0], false)
  assert.equal('idempotencyKey' in snapshot.publicEvents[0], false)
})

test('event idempotency accepts retries and rejects changed payloads', () => {
  const { runtime } = createRuntime()

  const first = runtime.recordWorldEvent(event())
  const repeated = runtime.recordWorldEvent(event())
  const conflict = runtime.recordWorldEvent(event({ evidenceIds: ['movement:2'] }))

  assert.equal(first.duplicate, false)
  assert.equal(repeated.duplicate, true)
  assert.equal(repeated.eventId, first.eventId)
  assert.deepEqual(conflict, { ok: false, reason: 'idempotency-conflict' })
})

test('restricted events never enter the public snapshot', () => {
  const { runtime } = createRuntime()
  const result = runtime.recordWorldEvent(
    event({
      participants: ['human:1'],
      visibility: 'restricted',
    })
  )

  assert.equal(result.ok, true)
  assert.equal(result.visibility, 'restricted')
  assert.deepEqual(runtime.snapshot().publicEvents, [])
})
