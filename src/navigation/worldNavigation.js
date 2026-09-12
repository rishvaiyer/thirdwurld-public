// SPDX-License-Identifier: GPL-3.0-only

const DESTINATION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function assertVector3(value, field) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${field} must contain three finite numbers`)
  }
  return [...value]
}

function assertText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function headingFromTo(from, to) {
  const heading = Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]))
  return Object.is(heading, -0) ? 0 : heading
}

function normalizeConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('world config must be an object')
  }

  const breadcrumbLimit = config.navigation?.breadcrumbLimit
  if (!Number.isInteger(breadcrumbLimit) || breadcrumbLimit < 1) {
    throw new TypeError('navigation.breadcrumbLimit must be a positive integer')
  }
  if (!Array.isArray(config.destinations) || config.destinations.length === 0) {
    throw new TypeError('destinations must contain at least one destination')
  }

  const ids = new Set()
  const destinations = config.destinations.map((value, index) => {
    const field = `destinations[${index}]`
    const id = assertText(value?.id, `${field}.id`)
    if (!DESTINATION_ID.test(id)) {
      throw new TypeError(`${field}.id must use lowercase kebab-case`)
    }
    if (ids.has(id)) throw new TypeError(`${field}.id must be unique`)
    ids.add(id)

    const approach = assertVector3(value.approach, `${field}.approach`)
    const entrance = assertVector3(value.entrance, `${field}.entrance`)
    return {
      id,
      label: assertText(value.label, `${field}.label`),
      category: assertText(value.category, `${field}.category`),
      accent: assertText(value.accent, `${field}.accent`),
      approach,
      entrance,
      rotationY: headingFromTo(approach, entrance),
    }
  })

  return { breadcrumbLimit, destinations }
}

function copyDestination(destination) {
  return {
    ...destination,
    approach: [...destination.approach],
    entrance: [...destination.entrance],
  }
}

export function createWorldNavigation(config, adapter = {}) {
  const { breadcrumbLimit, destinations } = normalizeConfig(config)
  const destinationsById = new Map(destinations.map(destination => [destination.id, destination]))

  function travel(destinationId) {
    const destination = destinationsById.get(destinationId)
    if (!destination) return { ok: false, reason: 'unknown-destination' }
    if (typeof adapter.movePlayer !== 'function') {
      return { ok: false, reason: 'travel-unavailable', destination: copyDestination(destination) }
    }

    const movement = {
      position: [...destination.approach],
      rotationY: destination.rotationY,
    }

    try {
      adapter.clearTransientState?.()
      if (adapter.movePlayer(movement) === false) {
        return { ok: false, reason: 'arrival-blocked', destination: copyDestination(destination) }
      }
    } catch {
      return { ok: false, reason: 'travel-failed', destination: copyDestination(destination) }
    }

    return { ok: true, destination: copyDestination(destination) }
  }

  function addBreadcrumb(trail, destinationId) {
    const current = Array.isArray(trail) ? trail.filter(id => destinationsById.has(id)) : []
    if (!destinationsById.has(destinationId) || current.at(-1) === destinationId) return current
    return [...current, destinationId].slice(-breadcrumbLimit)
  }

  function retrace(trail) {
    const current = Array.isArray(trail) ? [...trail] : []
    const destinationId = current.length > 1 ? current.at(-2) : null
    if (!destinationId) return { ok: false, reason: 'no-previous-destination', trail: current }

    const result = travel(destinationId)
    return result.ok ? { ...result, trail: current.slice(0, -1) } : { ...result, trail: current }
  }

  return {
    listDestinations: () => destinations.map(copyDestination),
    travel,
    addBreadcrumb,
    retrace,
  }
}
