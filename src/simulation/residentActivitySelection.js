// SPDX-License-Identifier: GPL-3.0-only

function finiteNumber(value, field, { minimum, maximum } = {}) {
  if (!Number.isFinite(value)) throw new TypeError(`${field} must be finite`)
  if (minimum !== undefined && value < minimum) throw new TypeError(`${field} must be at least ${minimum}`)
  if (maximum !== undefined && value > maximum) throw new TypeError(`${field} must be at most ${maximum}`)
  return value
}

function identifier(value, field) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new TypeError(`${field} must be a lowercase identifier`)
  }
  return value
}

export function createResidentActivitySelector(config, { random = Math.random } = {}) {
  if (typeof random !== 'function') throw new TypeError('random must be a function')
  const scoreVariation = finiteNumber(config?.scoreVariation, 'scoreVariation', { minimum: 0 })
  if (!Array.isArray(config?.activities) || config.activities.length === 0) {
    throw new TypeError('activities must be a non-empty array')
  }

  const ids = new Set()
  const activities = config.activities.map((activity, index) => {
    const field = `activities[${index}]`
    const id = identifier(activity?.id, `${field}.id`)
    const need = identifier(activity?.need, `${field}.need`)
    const weight = finiteNumber(activity?.weight, `${field}.weight`, { minimum: 0 })
    if (ids.has(id)) throw new TypeError(`activity id ${id} must be unique`)
    ids.add(id)
    return { id, need, weight }
  })

  return function selectResidentActivity({
    needs,
    allowedActivityIds = activities.map(activity => activity.id),
    cooldownUntilByActivity = {},
    nowMs = 0,
  }) {
    if (!needs || typeof needs !== 'object' || Array.isArray(needs)) {
      throw new TypeError('needs must be an object')
    }
    if (!Array.isArray(allowedActivityIds)) throw new TypeError('allowedActivityIds must be an array')
    if (!cooldownUntilByActivity || typeof cooldownUntilByActivity !== 'object' || Array.isArray(cooldownUntilByActivity)) {
      throw new TypeError('cooldownUntilByActivity must be an object')
    }
    finiteNumber(nowMs, 'nowMs')

    const allowed = new Set(allowedActivityIds.map((id, index) => {
      const normalized = identifier(id, `allowedActivityIds[${index}]`)
      if (!ids.has(normalized)) throw new TypeError(`unknown activity id: ${normalized}`)
      return normalized
    }))
    const candidates = []

    for (const activity of activities) {
      if (!allowed.has(activity.id)) continue
      const cooldownUntil = cooldownUntilByActivity[activity.id] ?? 0
      finiteNumber(cooldownUntil, `cooldownUntilByActivity.${activity.id}`)
      if (cooldownUntil > nowMs) continue

      const needLevel = finiteNumber(needs[activity.need], `needs.${activity.need}`, { minimum: 0, maximum: 1 })
      const variation = finiteNumber(random(), 'random result', { minimum: 0, maximum: 1 }) * scoreVariation
      candidates.push({
        id: activity.id,
        need: activity.need,
        score: (1 - needLevel) * activity.weight + variation,
      })
    }

    if (candidates.length === 0) return { ok: false, reason: 'no-available-activity', scores: [] }
    const selected = candidates.reduce((best, candidate) => candidate.score > best.score ? candidate : best)
    return {
      ok: true,
      activityId: selected.id,
      reason: 'highest-activity-score',
      scores: candidates.map(candidate => ({ id: candidate.id, score: candidate.score })),
    }
  }
}
