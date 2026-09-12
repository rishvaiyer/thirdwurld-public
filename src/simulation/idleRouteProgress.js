// SPDX-License-Identifier: GPL-3.0-only

function assertPositive(value, field, { allowZero = false } = {}) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new TypeError(`${field} must be ${allowZero ? 'non-negative' : 'greater than zero'}`)
  }
  return value
}

function assertVector3(value, field) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${field} must contain three finite numbers`)
  }
  return [...value]
}

function headingToPoint(from, to) {
  const heading = Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]))
  return Object.is(heading, -0) ? 0 : heading
}

export function createIdleRouteProgress(config) {
  const metersPerSecond = assertPositive(config?.idleMovement?.metersPerSecond, 'idleMovement.metersPerSecond')
  const maxStepMeters = assertPositive(config?.idleMovement?.maxStepMeters, 'idleMovement.maxStepMeters')

  return function advanceIdleRoute({
    position,
    rotationY = 0,
    waypoints = [],
    nextWaypointIndex = 0,
    elapsedMs,
    speedScale = 1,
  }) {
    const nextPosition = assertVector3(position, 'position')
    if (!Array.isArray(waypoints)) throw new TypeError('waypoints must be an array')
    const route = waypoints.map((waypoint, index) => assertVector3(waypoint, `waypoints[${index}]`))
    if (!Number.isInteger(nextWaypointIndex) || nextWaypointIndex < 0 || nextWaypointIndex > route.length) {
      throw new TypeError('nextWaypointIndex must point into the route')
    }
    assertPositive(elapsedMs, 'elapsedMs', { allowZero: true })
    assertPositive(speedScale, 'speedScale', { allowZero: true })
    if (!Number.isFinite(rotationY)) throw new TypeError('rotationY must be finite')

    let budget = Math.min(maxStepMeters, (elapsedMs / 1000) * metersPerSecond * speedScale)
    let index = nextWaypointIndex
    let heading = rotationY
    let distanceMoved = 0

    while (budget > 0 && index < route.length) {
      const waypoint = route[index]
      const dx = waypoint[0] - nextPosition[0]
      const dz = waypoint[2] - nextPosition[2]
      const distance = Math.hypot(dx, dz)
      heading = headingToPoint(nextPosition, waypoint)

      if (distance > budget) {
        nextPosition[0] += (dx / distance) * budget
        nextPosition[2] += (dz / distance) * budget
        distanceMoved += budget
        budget = 0
        break
      }

      nextPosition[0] = waypoint[0]
      nextPosition[1] = waypoint[1]
      nextPosition[2] = waypoint[2]
      distanceMoved += distance
      budget -= distance
      index += 1
    }

    return {
      position: nextPosition,
      rotationY: heading,
      nextWaypointIndex: index,
      arrived: route.length > 0 && index === route.length,
      distanceMoved,
    }
  }
}
