
import { createHash } from 'node:crypto'

const IDENTIFIER = /^[A-Za-z0-9:_./-]+$/
const EVENT_FIELDS = new Set([
  'actor',
  'action',
  'destination',
  'participants',
  'visibility',
  'result',
  'evidenceIds',
  'worldClock',
  'retention',
  'idempotencyKey',
  'occurredAt',
])

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyFields(value, fields) {
  return isPlainObject(value) && Object.keys(value).every(field => fields.has(field))
}

function identifier(value, max = 120) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized && normalized.length <= max && IDENTIFIER.test(normalized) ? normalized : null
}

function uniqueIdentifiers(value, maximum) {
  if (!Array.isArray(value)) return null
  const normalized = [...new Set(value.map(item => identifier(item)).filter(Boolean))]
  return normalized.length === value.length && normalized.length <= maximum ? normalized : null
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]))
}

function normalizeConfig(config) {
  const stringSet = (value, field) => {
    if (!Array.isArray(value) || value.length === 0 || value.some(item => !identifier(item))) {
      throw new TypeError(`${field} must contain stable identifiers`)
    }
    return new Set(value)
  }
  const positiveInteger = (value, field) => {
    if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer`)
    return value
  }

  if (!isPlainObject(config?.actionCatalog)) throw new TypeError('actionCatalog must be an object')
  const actionCatalog = new Map()
  for (const [action, destinations] of Object.entries(config.actionCatalog)) {
    const actionId = identifier(action, 80)
    if (!actionId) throw new TypeError('actionCatalog keys must be stable identifiers')
    actionCatalog.set(actionId, stringSet(destinations, `actionCatalog.${action}`))
  }
  if (!actionCatalog.size) throw new TypeError('actionCatalog must contain at least one action')
  if (typeof config.includeActorIdInPublicProjection !== 'boolean') {
    throw new TypeError('includeActorIdInPublicProjection must be a boolean')
  }

  return {
    actorTypes: stringSet(config.actorTypes, 'actorTypes'),
    clockPhases: stringSet(config.clockPhases, 'clockPhases'),
    actionCatalog,
    maxParticipants: positiveInteger(config.maxParticipants, 'maxParticipants'),
    maxEvidenceIds: positiveInteger(config.maxEvidenceIds, 'maxEvidenceIds'),
    includeActorIdInPublicProjection: config.includeActorIdInPublicProjection,
  }
}

export function createWorldEventEvidence(config) {
  const rules = normalizeConfig(config)

  function validate(input) {
    if (!hasOnlyFields(input, EVENT_FIELDS)) return { ok: false, reason: 'invalid-event-shape' }
    if (!hasOnlyFields(input.actor, new Set(['id', 'type']))) return { ok: false, reason: 'invalid-actor' }
    const actor = { id: identifier(input.actor.id), type: identifier(input.actor.type, 40) }
    if (!actor.id || !rules.actorTypes.has(actor.type)) return { ok: false, reason: 'invalid-actor' }

    const action = identifier(input.action, 80)
    const destination = identifier(input.destination)
    if (!action || !destination || !rules.actionCatalog.get(action)?.has(destination)) {
      return { ok: false, reason: 'invalid-action' }
    }

    const participants = uniqueIdentifiers(input.participants, rules.maxParticipants)
    if (!participants) return { ok: false, reason: 'invalid-participants' }
    if (!['public', 'restricted'].includes(input.visibility)) return { ok: false, reason: 'invalid-visibility' }
    if (input.visibility === 'public' && participants.length) return { ok: false, reason: 'public-participants-forbidden' }
    if (input.visibility === 'restricted' && !participants.length) {
      return { ok: false, reason: 'restricted-participants-required' }
    }

    if (!hasOnlyFields(input.result, new Set(['status', 'reasonCode']))) {
      return { ok: false, reason: 'invalid-result' }
    }
    if (!['succeeded', 'failed'].includes(input.result.status)) return { ok: false, reason: 'invalid-result' }
    const reasonCode = input.result.reasonCode === '' ? '' : identifier(input.result.reasonCode, 160)
    if (input.result.status === 'failed' && !reasonCode) return { ok: false, reason: 'failure-reason-required' }
    if (input.result.status === 'succeeded' && input.result.reasonCode !== '') {
      return { ok: false, reason: 'success-reason-forbidden' }
    }
    if (input.result.status === 'failed' && input.visibility === 'public') {
      return { ok: false, reason: 'public-failure-forbidden' }
    }

    const evidenceIds = uniqueIdentifiers(input.evidenceIds, rules.maxEvidenceIds)
    if (!evidenceIds?.length) return { ok: false, reason: 'evidence-required' }
    if (!hasOnlyFields(input.worldClock, new Set(['phase', 'at']))) {
      return { ok: false, reason: 'invalid-world-clock' }
    }
    if (!rules.clockPhases.has(input.worldClock.phase) || !Number.isInteger(input.worldClock.at) || input.worldClock.at < 0) {
      return { ok: false, reason: 'invalid-world-clock' }
    }

    if (!hasOnlyFields(input.retention, new Set(['policy', 'expiresAt']))) {
      return { ok: false, reason: 'invalid-retention' }
    }
    if (!['permanent', 'expires-at'].includes(input.retention.policy)) {
      return { ok: false, reason: 'invalid-retention' }
    }
    if (!Number.isInteger(input.occurredAt) || input.occurredAt < 0) {
      return { ok: false, reason: 'invalid-occurred-at' }
    }
    if (
      input.retention.policy === 'expires-at' &&
      (!Number.isInteger(input.retention.expiresAt) || input.retention.expiresAt <= input.occurredAt)
    ) {
      return { ok: false, reason: 'invalid-retention' }
    }
    if (input.retention.policy === 'permanent' && 'expiresAt' in input.retention) {
      return { ok: false, reason: 'invalid-retention' }
    }

    const idempotencyKey = identifier(input.idempotencyKey, 160)
    if (!idempotencyKey) return { ok: false, reason: 'invalid-idempotency-key' }

    return {
      ok: true,
      event: {
        actor,
        action,
        destination,
        participants,
        visibility: input.visibility,
        result: { status: input.result.status, reasonCode: reasonCode || '' },
        evidenceIds,
        worldClock: { phase: input.worldClock.phase, at: input.worldClock.at },
        retention: { ...input.retention },
        idempotencyKey,
        occurredAt: input.occurredAt,
      },
    }
  }

  function fingerprint(input) {
    const validated = validate(input)
    if (!validated.ok) return validated
    const value = JSON.stringify(canonicalize(validated.event))
    return { ok: true, fingerprint: createHash('sha256').update(value).digest('hex') }
  }

  function projectPublic(input, { eventId } = {}) {
    const validated = validate(input)
    if (!validated.ok) return validated
    if (validated.event.visibility !== 'public' || validated.event.result.status !== 'succeeded') {
      return { ok: false, reason: 'event-not-public' }
    }
    const id = identifier(eventId, 160)
    if (!id) return { ok: false, reason: 'invalid-event-id' }

    const actor = rules.includeActorIdInPublicProjection
      ? { ...validated.event.actor }
      : { type: validated.event.actor.type }
    return {
      ok: true,
      event: {
        id,
        actor,
        action: validated.event.action,
        destination: validated.event.destination,
        worldClock: { ...validated.event.worldClock },
        occurredAt: validated.event.occurredAt,
      },
    }
  }

  return { validate, fingerprint, projectPublic }
}

