// SPDX-License-Identifier: GPL-3.0-only

function finiteNumber(value, field, { minimum, exclusiveMinimum = false } = {}) {
  if (!Number.isFinite(value)) throw new TypeError(`${field} must be finite`)
  if (minimum !== undefined && (exclusiveMinimum ? value <= minimum : value < minimum)) {
    throw new TypeError(`${field} must be ${exclusiveMinimum ? 'greater than' : 'at least'} ${minimum}`)
  }
  return value
}

function vector2(value, field) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new TypeError(`${field} must contain finite x and z values`)
  }
  return { x: value.x, z: value.z }
}

function waypoint(value) {
  if (!Array.isArray(value) || value.length < 3 || !Number.isFinite(value[0]) || !Number.isFinite(value[2])) {
    throw new TypeError('waypoint must contain finite x and z values')
  }
  return value
}

function normalizeHeading(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function headingToPoint(position, target) {
  return Math.atan2(-(target[0] - position.x), -(target[2] - position.z))
}

function turnTowards(current, target, maxStep) {
  const difference = normalizeHeading(target - current)
  if (Math.abs(difference) <= maxStep) return normalizeHeading(target)
  return normalizeHeading(current + Math.sign(difference) * maxStep)
}

function stableSpeedScale(identity, minimum, maximum) {
  const value = String(identity || 'resident')
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const normalized = (hash >>> 0) / 0xffffffff
  return minimum + normalized * (maximum - minimum)
}

export function createResidentLocomotion(config) {
  const turnRate = finiteNumber(config?.turning?.radiansPerSecond, 'turning.radiansPerSecond', {
    minimum: 0,
    exclusiveMinimum: true,
  })
  const alignment = finiteNumber(config?.turning?.moveAlignmentRadians, 'turning.moveAlignmentRadians', {
    minimum: 0,
  })
  const minimumSpeed = finiteNumber(config?.movement?.minimumSpeedScale, 'movement.minimumSpeedScale', {
    minimum: 0,
  })
  const maximumSpeed = finiteNumber(config?.movement?.maximumSpeedScale, 'movement.maximumSpeedScale', {
    minimum: minimumSpeed,
  })
  const separationRadius = finiteNumber(config?.avoidance?.separationRadius, 'avoidance.separationRadius', {
    minimum: 0,
    exclusiveMinimum: true,
  })
  const yieldRadius = finiteNumber(config?.avoidance?.yieldRadius, 'avoidance.yieldRadius', {
    minimum: 0,
    exclusiveMinimum: true,
  })
  const stopRadius = finiteNumber(config?.avoidance?.stopRadius, 'avoidance.stopRadius', { minimum: 0 })
  if (!(stopRadius < yieldRadius && yieldRadius < separationRadius)) {
    throw new TypeError('avoidance radii must increase from stop to yield to separation')
  }

  const running = config?.running
  const startRemaining = finiteNumber(running?.startRemainingMeters, 'running.startRemainingMeters', {
    minimum: 0,
  })
  const stopRemaining = finiteNumber(running?.stopRemainingMeters, 'running.stopRemainingMeters', {
    minimum: 0,
  })
  const startSegment = finiteNumber(running?.startSegmentMeters, 'running.startSegmentMeters', { minimum: 0 })
  const stopSegment = finiteNumber(running?.stopSegmentMeters, 'running.stopSegmentMeters', { minimum: 0 })
  if (startRemaining < stopRemaining || startSegment < stopSegment) {
    throw new TypeError('running start thresholds must be at least their stop thresholds')
  }

  return function planResidentMotion({
    residentId,
    position,
    waypoint: target,
    currentRotationY,
    deltaSeconds,
    neighbors = [],
    sidePreference = 1,
    wasRunning = false,
    segmentDistance,
    remainingDistance,
  }) {
    const from = vector2(position, 'position')
    const to = waypoint(target)
    finiteNumber(currentRotationY, 'currentRotationY')
    finiteNumber(deltaSeconds, 'deltaSeconds', { minimum: 0 })
    finiteNumber(segmentDistance, 'segmentDistance', { minimum: 0 })
    finiteNumber(remainingDistance, 'remainingDistance', { minimum: 0 })
    if (!Array.isArray(neighbors)) throw new TypeError('neighbors must be an array')

    const targetX = to[0] - from.x
    const targetZ = to[2] - from.z
    const targetLength = Math.hypot(targetX, targetZ)
    const forwardX = targetLength === 0 ? 0 : targetX / targetLength
    const forwardZ = targetLength === 0 ? 0 : targetZ / targetLength
    let desiredX = forwardX
    let desiredZ = forwardZ
    let nearest = Infinity

    for (const [index, candidate] of neighbors.entries()) {
      const neighbor = vector2(candidate, `neighbors[${index}]`)
      const awayX = from.x - neighbor.x
      const awayZ = from.z - neighbor.z
      const distance = Math.hypot(awayX, awayZ)
      if (distance >= separationRadius) continue

      nearest = Math.min(nearest, distance)
      const weight = (separationRadius - distance) / separationRadius
      if (distance > 0.001) {
        desiredX += (awayX / distance) * weight * 1.35
        desiredZ += (awayZ / distance) * weight * 1.35
      }
      if (distance < yieldRadius) {
        desiredX += -forwardZ * Math.sign(sidePreference || 1) * weight
        desiredZ += forwardX * Math.sign(sidePreference || 1) * weight
      }
    }

    const yielding = nearest < yieldRadius
    const avoidanceScale = yielding
      ? Math.max(0, Math.min(1, (nearest - stopRadius) / (yieldRadius - stopRadius)))
      : 1
    const desiredHeading = targetLength === 0
      ? normalizeHeading(currentRotationY)
      : headingToPoint(from, [from.x + desiredX, 0, from.z + desiredZ])
    const rotationY = turnTowards(currentRotationY, desiredHeading, turnRate * deltaSeconds)
    const headingError = Math.abs(normalizeHeading(desiredHeading - rotationY))
    const aligned = targetLength > 0 && headingError <= alignment
    const runningAllowed = wasRunning
      ? remainingDistance > stopRemaining && segmentDistance > stopSegment
      : remainingDistance > startRemaining && segmentDistance > startSegment
    const runningNow = aligned && !yielding && runningAllowed

    return {
      rotationY,
      desiredHeading,
      aligned,
      yielding,
      running: runningNow,
      speedScale: aligned ? stableSpeedScale(residentId, minimumSpeed, maximumSpeed) * avoidanceScale : 0,
    }
  }
}
