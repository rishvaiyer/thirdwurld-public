// SPDX-License-Identifier: GPL-3.0-only

function humanCount(value) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError('humanCount must be a non-negative integer')
  return value
}

function timestamp(value, field) {
  if (!Number.isFinite(value)) throw new TypeError(field + ' must be finite')
  return value
}

export function createHumanOccupancyLifecycle(config) {
  const emptyGraceMs = config?.emptyGraceMs
  if (!Number.isFinite(emptyGraceMs) || emptyGraceMs < 0) {
    throw new TypeError('emptyGraceMs must be non-negative')
  }

  let count = 0
  let graceEndsAtMs = null

  function current(atMs) {
    const nowMs = timestamp(atMs, 'atMs')
    if (count > 0) {
      return { humanCount: count, mode: 'occupied', graceEndsAtMs: null }
    }
    if (graceEndsAtMs !== null && nowMs < graceEndsAtMs) {
      return { humanCount: 0, mode: 'grace', graceEndsAtMs }
    }
    graceEndsAtMs = null
    return { humanCount: 0, mode: 'empty', graceEndsAtMs: null }
  }

  function observe(nextCount, atMs) {
    const next = humanCount(nextCount)
    const nowMs = timestamp(atMs, 'atMs')
    if (next > 0) {
      count = next
      graceEndsAtMs = null
    } else if (count > 0) {
      count = 0
      graceEndsAtMs = nowMs + emptyGraceMs
    }
    return current(nowMs)
  }

  return { observe, snapshot: current }
}
