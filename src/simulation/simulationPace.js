
function assertPositive(value, field) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${field} must be greater than zero`)
  return value
}

export function createSimulationPacePolicy(config) {
  const pace = config?.pace
  const activeTickIntervalSeconds = assertPositive(
    pace?.activeTickIntervalSeconds,
    'pace.activeTickIntervalSeconds'
  )
  const idleTickIntervalSeconds = assertPositive(
    pace?.idleTickIntervalSeconds,
    'pace.idleTickIntervalSeconds'
  )
  if (typeof pace?.liveWhileEmpty !== 'boolean') {
    throw new TypeError('pace.liveWhileEmpty must be a boolean')
  }

  return function selectSimulationPace({ humanCount }) {
    if (!Number.isInteger(humanCount) || humanCount < 0) {
      throw new TypeError('humanCount must be a non-negative integer')
    }

    const occupied = humanCount > 0
    const active = occupied || pace.liveWhileEmpty
    return {
      mode: active ? 'active' : 'idle',
      tickIntervalSeconds: active ? activeTickIntervalSeconds : idleTickIntervalSeconds,
      autonomousWorkAllowed: active,
      reason: occupied ? 'human-present' : pace.liveWhileEmpty ? 'configured-always-live' : 'empty-world',
    }
  }
}

