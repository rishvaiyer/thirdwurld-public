
import assert from 'node:assert/strict'
import test from 'node:test'

import { worldEventConfig } from '../src/config/worldEvents.js'
import { createWorldEventEvidence } from '../src/events/worldEventEvidence.js'

function publicEvent(overrides = {}) {
  return {
    actor: { id: 'resident:a', type: 'resident' },
    action: 'visited',
    destination: 'town-square',
    participants: [],
    visibility: 'public',
    result: { status: 'succeeded', reasonCode: '' },
    evidenceIds: ['movement:42'],
    worldClock: { phase: 'day', at: 1_000 },
    retention: { policy: 'permanent' },
    idempotencyKey: 'visit:42',
    occurredAt: 1_000,
    ...overrides,
  }
}

test('valid events are normalized against the configured catalog', () => {
  const evidence = createWorldEventEvidence(worldEventConfig)
  const result = evidence.validate(publicEvent())

  assert.equal(result.ok, true)
  assert.equal(result.event.action, 'visited')
  assert.deepEqual(result.event.evidenceIds, ['movement:42'])
})

test('public projection omits private and operational fields', () => {
  const evidence = createWorldEventEvidence(worldEventConfig)
  const result = evidence.projectPublic(publicEvent(), { eventId: 'world-event:42' })

  assert.deepEqual(result, {
    ok: true,
    event: {
      id: 'world-event:42',
      actor: { type: 'resident' },
      action: 'visited',
      destination: 'town-square',
      worldClock: { phase: 'day', at: 1_000 },
      occurredAt: 1_000,
    },
  })
  assert.equal('evidenceIds' in result.event, false)
  assert.equal('idempotencyKey' in result.event, false)
})

test('privacy rules prevent accidental public disclosure', () => {
  const evidence = createWorldEventEvidence(worldEventConfig)

  assert.equal(
    evidence.validate(publicEvent({ participants: ['human:1'] })).reason,
    'public-participants-forbidden'
  )
  assert.equal(
    evidence.validate(publicEvent({ visibility: 'restricted', participants: [] })).reason,
    'restricted-participants-required'
  )
  assert.equal(
    evidence.validate(
      publicEvent({ result: { status: 'failed', reasonCode: 'movement.blocked' } })
    ).reason,
    'public-failure-forbidden'
  )
})

test('actions and destinations are configuration-driven', () => {
  const config = {
    ...worldEventConfig,
    actionCatalog: { inspected: ['reading-room'] },
  }
  const evidence = createWorldEventEvidence(config)

  assert.equal(evidence.validate(publicEvent()).reason, 'invalid-action')
  assert.equal(
    evidence.validate(publicEvent({ action: 'inspected', destination: 'reading-room' })).ok,
    true
  )
})

test('retention must be explicit and internally consistent', () => {
  const evidence = createWorldEventEvidence(worldEventConfig)

  assert.equal(
    evidence.validate(publicEvent({ retention: { policy: 'expires-at', expiresAt: 999 } })).reason,
    'invalid-retention'
  )
  assert.equal(
    evidence.validate(publicEvent({ retention: { policy: 'expires-at', expiresAt: 2_000 } })).ok,
    true
  )
})

test('fingerprints are deterministic and sensitive to event changes', () => {
  const evidence = createWorldEventEvidence(worldEventConfig)
  const first = evidence.fingerprint(publicEvent())
  const second = evidence.fingerprint(publicEvent())
  const changed = evidence.fingerprint(publicEvent({ occurredAt: 1_001 }))

  assert.equal(first.ok, true)
  assert.equal(first.fingerprint, second.fingerprint)
  assert.notEqual(first.fingerprint, changed.fingerprint)
})

test('unknown fields cannot smuggle private content into the ledger', () => {
  const evidence = createWorldEventEvidence(worldEventConfig)
  assert.equal(
    evidence.validate(publicEvent({ privateNarrative: 'hidden text' })).reason,
    'invalid-event-shape'
  )
})
