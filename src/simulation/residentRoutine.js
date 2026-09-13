// SPDX-License-Identifier: GPL-3.0-only

const HOURS_PER_DAY = 24

function finitePositive(value, field) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(field + ' must be greater than zero')
  return value
}

function activityId(value, field) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new TypeError(field + ' must be a lowercase identifier')
  }
  return value
}

export function createResidentRoutine(config, { knownActivityIds } = {}) {
  const dayLengthMs = finitePositive(config?.dayLengthMs, 'dayLengthMs')
  if (!Array.isArray(config?.periods) || config.periods.length === 0) {
    throw new TypeError('periods must be a non-empty array')
  }
  if (knownActivityIds !== undefined && (!Array.isArray(knownActivityIds) || knownActivityIds.length === 0)) {
    throw new TypeError('knownActivityIds must be a non-empty array when provided')
  }
  const known = knownActivityIds === undefined ? null : new Set(knownActivityIds)

  const periods = config.periods.map((period, index) => {
    const startHour = period?.startHour
    if (!Number.isInteger(startHour) || startHour < 0 || startHour >= HOURS_PER_DAY) {
      throw new TypeError('periods[' + index + '].startHour must be an integer from 0 through 23')
    }
    const id = activityId(period?.activityId, 'periods[' + index + '].activityId')
    if (known && !known.has(id)) throw new TypeError('unknown routine activity id: ' + id)
    return { startHour, activityId: id }
  })
  if (periods[0].startHour !== 0) throw new TypeError('the first routine period must start at hour 0')
  if (periods.some((period, index) => index > 0 && period.startHour <= periods[index - 1].startHour)) {
    throw new TypeError('routine periods must be ordered by unique start hour')
  }

  return function selectRoutinePeriod(worldTimeMs) {
    if (!Number.isFinite(worldTimeMs)) throw new TypeError('worldTimeMs must be finite')
    const elapsedInDay = ((worldTimeMs % dayLengthMs) + dayLengthMs) % dayLengthMs
    const hour = (elapsedInDay / dayLengthMs) * HOURS_PER_DAY
    let selected = periods[0]
    let next = periods[0]
    for (let index = 0; index < periods.length; index += 1) {
      if (periods[index].startHour <= hour) selected = periods[index]
      if (periods[index].startHour > hour) {
        next = periods[index]
        break
      }
      next = periods[0]
    }
    const nextStartHour = next === periods[0] ? HOURS_PER_DAY : next.startHour
    const endsAtMs = worldTimeMs - elapsedInDay + (nextStartHour / HOURS_PER_DAY) * dayLengthMs

    return {
      activityId: selected.activityId,
      startHour: selected.startHour,
      endsAtMs,
    }
  }
}
