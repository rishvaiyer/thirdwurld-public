
function identifier(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(field + ' must be a non-empty string')
  return value.trim()
}

function point(value, field) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(field + ' must contain three finite numbers')
  }
  return [...value]
}

export function createInteractionPointReservations(config) {
  const clearance = config?.reservationClearanceMeters
  if (!Number.isFinite(clearance) || clearance <= 0) {
    throw new TypeError('reservationClearanceMeters must be greater than zero')
  }
  const claims = new Map()

  function release(residentId) {
    return claims.delete(identifier(residentId, 'residentId'))
  }

  function reserve({ residentId, locationId, candidates = [], occupied = [] }) {
    const resident = identifier(residentId, 'residentId')
    const location = identifier(locationId, 'locationId')
    if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array')
    if (!Array.isArray(occupied)) throw new TypeError('occupied must be an array')
    const available = candidates.map((candidate, index) => point(candidate, 'candidates[' + index + ']'))
    const blockers = [
      ...[...claims.entries()]
        .filter(([claimedBy]) => claimedBy !== resident)
        .map(([, claim]) => claim.point),
      ...occupied.map((position, index) => point(position, 'occupied[' + index + ']')),
    ]
    const selected = available.find(candidate => blockers.every(blocker => (
      Math.hypot(candidate[0] - blocker[0], candidate[2] - blocker[2]) >= clearance
    )))
    if (!selected) return { ok: false, reason: 'no-safe-point' }

    claims.set(resident, { residentId: resident, locationId: location, point: selected })
    return { ok: true, point: [...selected] }
  }

  function snapshot() {
    return structuredClone([...claims.values()])
  }

  return { reserve, release, snapshot }
}
