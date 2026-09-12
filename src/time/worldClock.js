
function assertFinite(value, field) {
  if (!Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`)
  return value
}

export function createSynchronizedWorldClock({ worldEpochMs, observedAtMs }, readMonotonicTimeMs) {
  const offsetMs = assertFinite(worldEpochMs, 'worldEpochMs') - assertFinite(observedAtMs, 'observedAtMs')
  if (typeof readMonotonicTimeMs !== 'function') {
    throw new TypeError('readMonotonicTimeMs must be a function')
  }

  function at(monotonicTimeMs) {
    return assertFinite(monotonicTimeMs, 'monotonicTimeMs') + offsetMs
  }

  return {
    now: () => at(readMonotonicTimeMs()),
    at,
  }
}

