
import { createWorldRuntime } from '../runtime/worldRuntime.js'
import { createHyperfyWorldAdapter } from './hyperfyWorldAdapter.js'

function defaultMonotonicTimeMs() {
  return globalThis.performance?.now?.() ?? Date.now()
}

export function createHyperfyRuntime({
  world,
  configs,
  random,
  residentUserIds,
  readMonotonicTimeMs = defaultMonotonicTimeMs,
  readWallTimeMs = Date.now,
} = {}) {
  if (typeof readMonotonicTimeMs !== 'function') throw new TypeError('readMonotonicTimeMs must be a function')
  if (typeof readWallTimeMs !== 'function') throw new TypeError('readWallTimeMs must be a function')
  const adapter = createHyperfyWorldAdapter(world, { residentUserIds })
  const observedAtMs = readMonotonicTimeMs()
  const worldEpochMs = adapter.readWorldTimeMs(readWallTimeMs)
  const runtime = createWorldRuntime({
    configs,
    random,
    navigationAdapter: adapter.navigation,
    clock: { worldEpochMs, observedAtMs, readMonotonicTimeMs },
  })

  function syncOccupancy() {
    return runtime.setHumanCount(adapter.readHumanCount())
  }

  syncOccupancy()
  return { runtime, syncOccupancy }
}
