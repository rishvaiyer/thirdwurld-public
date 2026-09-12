// SPDX-License-Identifier: GPL-3.0-only

import assert from 'node:assert/strict'
import test from 'node:test'

import { createSynchronizedWorldClock } from '../src/time/worldClock.js'

test('the synchronized clock advances from one shared world epoch', () => {
  let localTime = 12_500
  const clock = createSynchronizedWorldClock(
    { worldEpochMs: 1_786_089_600_000, observedAtMs: localTime },
    () => localTime
  )

  assert.equal(clock.now(), 1_786_089_600_000)
  localTime += 250
  assert.equal(clock.now(), 1_786_089_600_250)
  assert.equal(clock.at(13_000), 1_786_089_600_500)
})

test('invalid timestamps and clock readers fail at the module interface', () => {
  assert.throws(
    () => createSynchronizedWorldClock({ worldEpochMs: Number.NaN, observedAtMs: 10 }, () => 10),
    /worldEpochMs/
  )
  assert.throws(
    () => createSynchronizedWorldClock({ worldEpochMs: 20, observedAtMs: 10 }, null),
    /readMonotonicTimeMs/
  )

  const clock = createSynchronizedWorldClock({ worldEpochMs: 20, observedAtMs: 10 }, () => Infinity)
  assert.throws(() => clock.now(), /monotonicTimeMs/)
})
