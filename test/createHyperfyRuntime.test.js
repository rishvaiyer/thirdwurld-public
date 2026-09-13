
import assert from 'node:assert/strict'
import test from 'node:test'

import { createHyperfyRuntime } from '../src/hyperfy/createHyperfyRuntime.js'

test('Hyperfy composition synchronizes time, occupancy, and safe navigation', () => {
  let monotonicTimeMs = 500
  const movements = []
  const world = {
    entities: {
      player: {
        data: { userId: 'human:a' },
        teleportSafe(movement) { movements.push(movement); return true },
      },
    },
    network: {
      sockets: new Map([['human:a', {}], ['resident:a', {}]]),
      getWorldTimeMs: () => 10_000,
    },
  }
  const { runtime, syncOccupancy } = createHyperfyRuntime({
    world,
    residentUserIds: ['resident:a'],
    readMonotonicTimeMs: () => monotonicTimeMs,
    readWallTimeMs: () => 99,
    random: () => 0,
  })

  assert.equal(runtime.snapshot().worldTimeMs, 10_000)
  assert.equal(runtime.snapshot().humanCount, 1)
  assert.equal(runtime.travel('town-square').ok, true)
  assert.equal(movements.length, 1)

  world.network.sockets.delete('human:a')
  monotonicTimeMs += 100
  assert.equal(syncOccupancy().reason, 'empty-world-grace')
})

test('wall time initializes runtime when synchronized Hyperfy time is unavailable', () => {
  const { runtime } = createHyperfyRuntime({
    world: {},
    readMonotonicTimeMs: () => 500,
    readWallTimeMs: () => 20_000,
    random: () => 0,
  })

  assert.equal(runtime.snapshot().worldTimeMs, 20_000)
  assert.equal(runtime.snapshot().humanCount, 0)
})

test('invalid timing readers fail before runtime creation', () => {
  assert.throws(() => createHyperfyRuntime({ world: {}, readMonotonicTimeMs: 1 }), /readMonotonicTimeMs/)
  assert.throws(() => createHyperfyRuntime({ world: {}, readWallTimeMs: 1 }), /readWallTimeMs/)
})
