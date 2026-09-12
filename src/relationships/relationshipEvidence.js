
const IDENTIFIER = /^[A-Za-z0-9:_./-]+$/

function stableIdentifier(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized || !IDENTIFIER.test(normalized)) throw new TypeError(`${field} must be a stable identifier`)
  return normalized
}

function normalizeConfig(config) {
  const min = config?.scoreRange?.min
  const max = config?.scoreRange?.max
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    throw new TypeError('scoreRange must contain a finite minimum below its maximum')
  }
  if (!config.initialScores || typeof config.initialScores !== 'object' || Array.isArray(config.initialScores)) {
    throw new TypeError('initialScores must be an object')
  }

  const scoreNames = new Set(Object.keys(config.initialScores))
  if (!scoreNames.size) throw new TypeError('initialScores must contain at least one score')
  const initialScores = {}
  for (const [score, value] of Object.entries(config.initialScores)) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new TypeError(`initialScores.${score} must be inside scoreRange`)
    }
    initialScores[score] = value
  }
  if (!scoreNames.has('familiarity')) throw new TypeError('initialScores must include familiarity')
  if (!Number.isFinite(config.familiarityPerInteraction)) {
    throw new TypeError('familiarityPerInteraction must be finite')
  }
  if (!Number.isInteger(config.maxEvidenceIds) || config.maxEvidenceIds < 1) {
    throw new TypeError('maxEvidenceIds must be a positive integer')
  }
  if (!config.signals || typeof config.signals !== 'object' || Array.isArray(config.signals)) {
    throw new TypeError('signals must be an object')
  }

  const signals = new Map()
  for (const [name, signal] of Object.entries(config.signals)) {
    const directions = {}
    for (const direction of ['expressed', 'received']) {
      const deltas = signal?.[direction]
      if (!deltas || typeof deltas !== 'object' || Array.isArray(deltas)) {
        throw new TypeError(`signals.${name}.${direction} must be an object`)
      }
      directions[direction] = {}
      for (const [score, delta] of Object.entries(deltas)) {
        if (!scoreNames.has(score) || !Number.isFinite(delta)) {
          throw new TypeError(`signals.${name}.${direction}.${score} must target a known score with a finite delta`)
        }
        directions[direction][score] = delta
      }
    }
    signals.set(name, directions)
  }
  if (!signals.size) throw new TypeError('signals must contain at least one signal')

  return {
    min,
    max,
    scoreNames,
    initialScores,
    familiarityPerInteraction: config.familiarityPerInteraction,
    maxEvidenceIds: config.maxEvidenceIds,
    signals,
  }
}

export function createRelationshipEvidence(config) {
  const rules = normalizeConfig(config)
  const clamp = value => Math.max(rules.min, Math.min(rules.max, Math.round(value)))

  function createState({ sourceId, targetId }, now = Date.now()) {
    if (!Number.isFinite(now) || now < 0) throw new TypeError('now must be a non-negative timestamp')
    return {
      sourceId: stableIdentifier(sourceId, 'sourceId'),
      targetId: stableIdentifier(targetId, 'targetId'),
      scores: { ...rules.initialScores },
      signalCounts: Object.fromEntries([...rules.signals.keys()].map(signal => [signal, 0])),
      interactionCount: 0,
      evidenceIds: [],
      lastInteractionAt: null,
      createdAt: now,
      updatedAt: now,
    }
  }

  function applyInteraction(
    state,
    { expressedSignals = [], receivedSignals = [], intensity = 1, evidenceIds = [], occurredAt = Date.now() } = {}
  ) {
    if (!state || typeof state !== 'object') throw new TypeError('state is required')
    if (![1, 2, 3].includes(intensity)) throw new TypeError('intensity must be 1, 2, or 3')
    if (!Number.isFinite(occurredAt) || occurredAt < 0) throw new TypeError('occurredAt must be non-negative')
    if (!Array.isArray(expressedSignals) || !Array.isArray(receivedSignals)) {
      throw new TypeError('signals must be arrays')
    }

    const expressed = [...new Set(expressedSignals)]
    const received = [...new Set(receivedSignals)]
    for (const signal of [...expressed, ...received]) {
      if (!rules.signals.has(signal)) throw new TypeError(`unknown relationship signal: ${signal}`)
    }

    const evidence = [...new Set(evidenceIds.map(id => stableIdentifier(id, 'evidenceId')))]
    if (!evidence.length) throw new TypeError('at least one evidenceId is required')

    const next = structuredClone(state)
    for (const score of rules.scoreNames) {
      if (!Number.isFinite(next.scores?.[score])) throw new TypeError(`state.scores.${score} must be finite`)
    }
    for (const [signals, direction] of [
      [expressed, 'expressed'],
      [received, 'received'],
    ]) {
      for (const signal of signals) {
        for (const [score, delta] of Object.entries(rules.signals.get(signal)[direction])) {
          next.scores[score] = clamp(next.scores[score] + delta * intensity)
        }
        next.signalCounts[signal] = (next.signalCounts[signal] || 0) + 1
      }
    }

    next.scores.familiarity = clamp(next.scores.familiarity + rules.familiarityPerInteraction)
    next.interactionCount += 1
    next.evidenceIds = [...new Set([...next.evidenceIds, ...evidence])].slice(-rules.maxEvidenceIds)
    next.lastInteractionAt = occurredAt
    next.updatedAt = occurredAt
    return next
  }

  return { createState, applyInteraction }
}

