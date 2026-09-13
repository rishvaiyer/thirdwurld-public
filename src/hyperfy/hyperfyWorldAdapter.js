
function requireWorld(world) {
  if (!world || typeof world !== 'object') throw new TypeError('world must be a Hyperfy world object')
  return world
}

function userId(player) {
  return player?.userId || player?.data?.userId || null
}

export function createHyperfyWorldAdapter(world, { residentUserIds = [] } = {}) {
  const engine = requireWorld(world)
  if (!Array.isArray(residentUserIds)) throw new TypeError('residentUserIds must be an array')
  const residents = new Set(residentUserIds.map((id, index) => {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new TypeError('residentUserIds[' + index + '] must be a non-empty string')
    }
    return id.trim()
  }))

  function player() {
    return engine.entities?.player || null
  }

  function clearTransientState() {
    const current = player()
    if (current?.data?.effect && typeof current.setEffect === 'function') current.setEffect(null)
  }

  function movePlayer(movement) {
    const current = player()
    if (!current) return { ok: false, reason: 'travel-unavailable' }
    const move = typeof current.teleportSafe === 'function'
      ? current.teleportSafe.bind(current)
      : typeof current.teleport === 'function'
        ? current.teleport.bind(current)
        : null
    if (!move) return { ok: false, reason: 'travel-unavailable' }
    return move({
      position: [...movement.position],
      rotationY: movement.rotationY,
    }) === false
      ? { ok: false, reason: 'arrival-blocked' }
      : { ok: true }
  }

  function readHumanCount() {
    const sockets = engine.network?.sockets
    if (sockets && typeof sockets.keys === 'function') {
      let count = 0
      for (const id of sockets.keys()) if (!residents.has(id)) count += 1
      return count
    }
    const current = player()
    return current && !residents.has(userId(current)) ? 1 : 0
  }

  function readWorldTimeMs(fallback) {
    const synchronized = engine.network?.getWorldTimeMs?.()
    return Number.isFinite(synchronized) ? synchronized : fallback()
  }

  return {
    navigation: { clearTransientState, movePlayer },
    readHumanCount,
    readWorldTimeMs,
  }
}
