
import assert from 'node:assert/strict'
import test from 'node:test'

import { createHyperfyWorldAdapter } from '../src/hyperfy/hyperfyWorldAdapter.js'

test('navigation clears transient state and prefers safe teleport', () => {
  const calls = []
  const player = {
    data: { effect: { type: 'temporary' }, userId: 'human:a' },
    setEffect(value) { calls.push(['effect', value]) },
    teleportSafe(value) { calls.push(['safe', value]); return true },
    teleport() { calls.push(['fallback']); return true },
  }
  const adapter = createHyperfyWorldAdapter({ entities: { player } })
  adapter.navigation.clearTransientState()
  const result = adapter.navigation.movePlayer({ position: [1, 2, 3], rotationY: 0.5 })

  assert.deepEqual(result, { ok: true })
  assert.deepEqual(calls, [
    ['effect', null],
    ['safe', { position: [1, 2, 3], rotationY: 0.5 }],
  ])
})

test('navigation falls back to teleport and reports blocked arrivals', () => {
  const adapter = createHyperfyWorldAdapter({
    entities: { player: { teleport: () => false } },
  })

  assert.deepEqual(adapter.navigation.movePlayer({ position: [0, 0, 0], rotationY: 0 }), {
    ok: false,
    reason: 'arrival-blocked',
  })
})

test('navigation reports unavailable players without throwing', () => {
  const adapter = createHyperfyWorldAdapter({ entities: {} })

  assert.deepEqual(adapter.navigation.movePlayer({ position: [0, 0, 0], rotationY: 0 }), {
    ok: false,
    reason: 'travel-unavailable',
  })
})

test('server occupancy excludes registered resident sockets', () => {
  const adapter = createHyperfyWorldAdapter({
    network: { sockets: new Map([['human:a', {}], ['resident:a', {}], ['human:b', {}]]) },
  }, { residentUserIds: ['resident:a'] })

  assert.equal(adapter.readHumanCount(), 2)
})

test('client occupancy uses the local player when sockets are unavailable', () => {
  const human = createHyperfyWorldAdapter({ entities: { player: { data: { userId: 'human:a' } } } })
  const resident = createHyperfyWorldAdapter(
    { entities: { player: { userId: 'resident:a' } } },
    { residentUserIds: ['resident:a'] }
  )

  assert.equal(human.readHumanCount(), 1)
  assert.equal(resident.readHumanCount(), 0)
})

test('world time prefers Hyperfy synchronization and has a wall-time fallback', () => {
  const synchronized = createHyperfyWorldAdapter({ network: { getWorldTimeMs: () => 12_345 } })
  const fallback = createHyperfyWorldAdapter({})

  assert.equal(synchronized.readWorldTimeMs(() => 99), 12_345)
  assert.equal(fallback.readWorldTimeMs(() => 99), 99)
})

test('invalid adapter inputs fail early', () => {
  assert.throws(() => createHyperfyWorldAdapter(null), /Hyperfy world object/)
  assert.throws(() => createHyperfyWorldAdapter({}, { residentUserIds: 'resident:a' }), /residentUserIds/)
  assert.throws(() => createHyperfyWorldAdapter({}, { residentUserIds: [''] }), /residentUserIds\[0\]/)
})
