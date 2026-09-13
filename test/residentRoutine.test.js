// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import { activityConfig } from '../src/config/activities.js'
import { routineConfig } from '../src/config/routines.js'
import { createResidentRoutine } from '../src/simulation/residentRoutine.js'

const HOUR_MS = 60 * 60 * 1_000
const selectPeriod = createResidentRoutine(routineConfig, {
  knownActivityIds: activityConfig.activities.map(activity => activity.id),
})

test('routine periods follow configured world hours', () => {
  assert.equal(selectPeriod(6 * HOUR_MS).activityId, 'rest')
  assert.equal(selectPeriod(7 * HOUR_MS).activityId, 'socialize')
  assert.equal(selectPeriod(12 * HOUR_MS).activityId, 'explore')
  assert.equal(selectPeriod(21 * HOUR_MS).activityId, 'rest')
})

test('the selected period includes its next transition time', () => {
  assert.deepEqual(selectPeriod(8 * HOUR_MS), {
    activityId: 'socialize',
    startHour: 7,
    endsAtMs: 9 * HOUR_MS,
  })
  assert.equal(selectPeriod(23 * HOUR_MS).endsAtMs, 24 * HOUR_MS)
})

test('world time wraps cleanly across days and before the epoch', () => {
  assert.equal(selectPeriod(31 * HOUR_MS).activityId, 'socialize')
  assert.equal(selectPeriod(-HOUR_MS).activityId, 'rest')
  assert.equal(selectPeriod(-HOUR_MS).endsAtMs, 0)
})

test('a different world-day length needs no behavior changes', () => {
  const fastRoutine = createResidentRoutine({
    dayLengthMs: 24_000,
    periods: [
      { startHour: 0, activityId: 'rest' },
      { startHour: 12, activityId: 'explore' },
    ],
  })

  assert.equal(fastRoutine(11_999).activityId, 'rest')
  assert.equal(fastRoutine(12_000).activityId, 'explore')
})

test('invalid routine configuration fails at creation', () => {
  assert.throws(() => createResidentRoutine({ dayLengthMs: 0, periods: [] }), /dayLengthMs/)
  assert.throws(
    () => createResidentRoutine({ dayLengthMs: 1, periods: [{ startHour: 2, activityId: 'rest' }] }),
    /first routine period/
  )
  assert.throws(
    () => createResidentRoutine({
      dayLengthMs: 1,
      periods: [
        { startHour: 0, activityId: 'rest' },
        { startHour: 0, activityId: 'explore' },
      ],
    }),
    /ordered by unique start hour/
  )
  assert.throws(
    () => createResidentRoutine(routineConfig, { knownActivityIds: ['rest'] }),
    /unknown routine activity/
  )
})

test('invalid world time fails at selection', () => {
  assert.throws(() => selectPeriod(Number.NaN), /worldTimeMs/)
})
