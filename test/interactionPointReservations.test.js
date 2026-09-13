// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import { interactionConfig } from '../src/config/interactions.js'
import { createInteractionPointReservations } from '../src/simulation/interactionPointReservations.js'

test('residents receive the first interaction point with safe clearance', () => {
  const reservations = createInteractionPointReservations(interactionConfig)

  assert.deepEqual(reservations.reserve({
    residentId: 'resident:a',
    locationId: 'town-square',
    candidates: [[0, 0, 0], [3, 0, 0]],
  }), { ok: true, point: [0, 0, 0] })
  assert.deepEqual(reservations.reserve({
    residentId: 'resident:b',
    locationId: 'town-square',
    candidates: [[1, 0, 0], [3, 0, 0]],
  }), { ok: true, point: [3, 0, 0] })
})

test('current occupants block unsafe candidate points', () => {
  const reservations = createInteractionPointReservations(interactionConfig)
  const result = reservations.reserve({
    residentId: 'resident:a',
    locationId: 'workshop',
    candidates: [[0, 0, 0], [4, 0, 0]],
    occupied: [[0.5, 0, 0]],
  })

  assert.deepEqual(result, { ok: true, point: [4, 0, 0] })
})

test("failed replacement keeps the resident's existing claim", () => {
  const reservations = createInteractionPointReservations(interactionConfig)
  reservations.reserve({ residentId: 'resident:a', locationId: 'town-square', candidates: [[0, 0, 0]] })

  assert.deepEqual(reservations.reserve({
    residentId: 'resident:a',
    locationId: 'workshop',
    candidates: [[1, 0, 0]],
    occupied: [[1, 0, 0]],
  }), { ok: false, reason: 'no-safe-point' })
  assert.deepEqual(reservations.snapshot(), [
    { residentId: 'resident:a', locationId: 'town-square', point: [0, 0, 0] },
  ])
})

test('successful replacement moves one resident claim', () => {
  const reservations = createInteractionPointReservations(interactionConfig)
  reservations.reserve({ residentId: 'resident:a', locationId: 'town-square', candidates: [[0, 0, 0]] })
  reservations.reserve({ residentId: 'resident:a', locationId: 'workshop', candidates: [[5, 0, 0]] })

  assert.deepEqual(reservations.snapshot(), [
    { residentId: 'resident:a', locationId: 'workshop', point: [5, 0, 0] },
  ])
})

test('release reports whether a claim existed', () => {
  const reservations = createInteractionPointReservations(interactionConfig)
  reservations.reserve({ residentId: 'resident:a', locationId: 'town-square', candidates: [[0, 0, 0]] })

  assert.equal(reservations.release('resident:a'), true)
  assert.equal(reservations.release('resident:a'), false)
  assert.deepEqual(reservations.snapshot(), [])
})

test('returned points and snapshots cannot mutate stored claims', () => {
  const reservations = createInteractionPointReservations(interactionConfig)
  const result = reservations.reserve({
    residentId: 'resident:a',
    locationId: 'town-square',
    candidates: [[0, 0, 0]],
  })
  result.point[0] = 99
  const snapshot = reservations.snapshot()
  snapshot[0].point[0] = 88

  assert.equal(reservations.snapshot()[0].point[0], 0)
})

test('invalid configuration and points fail early', () => {
  assert.throws(() => createInteractionPointReservations({ reservationClearanceMeters: 0 }), /greater than zero/)
  const reservations = createInteractionPointReservations(interactionConfig)
  assert.throws(
    () => reservations.reserve({ residentId: 'resident:a', locationId: 'square', candidates: [[0, 0]] }),
    /candidates\[0\]/
  )
})
