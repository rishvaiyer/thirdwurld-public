
import assert from 'node:assert/strict'
import test from 'node:test'

import { relationshipConfig } from '../src/config/relationships.js'
import { createRelationshipEvidence } from '../src/relationships/relationshipEvidence.js'

test('relationships begin as neutral directional evidence', () => {
  const relationships = createRelationshipEvidence(relationshipConfig)
  const state = relationships.createState({ sourceId: 'resident:a', targetId: 'resident:b' }, 100)

  assert.equal(state.sourceId, 'resident:a')
  assert.equal(state.targetId, 'resident:b')
  assert.equal(state.scores.warmth, 0)
  assert.equal(state.interactionCount, 0)
  assert.equal(state.createdAt, 100)
})

test('evidence-backed interactions update bounded scores', () => {
  const relationships = createRelationshipEvidence(relationshipConfig)
  const state = relationships.createState({ sourceId: 'resident:a', targetId: 'resident:b' }, 100)
  const next = relationships.applyInteraction(state, {
    expressedSignals: ['supportive'],
    receivedSignals: ['friendly'],
    intensity: 2,
    evidenceIds: ['event:1'],
    occurredAt: 200,
  })

  assert.deepEqual(next.scores, {
    familiarity: 3,
    warmth: 12,
    trust: 6,
    respect: 0,
    closeness: 0,
    conflict: 0,
  })
  assert.equal(next.signalCounts.supportive, 1)
  assert.equal(next.signalCounts.friendly, 1)
  assert.deepEqual(next.evidenceIds, ['event:1'])
  assert.equal(next.lastInteractionAt, 200)
  assert.equal(state.interactionCount, 0)
})

test('relationship scores never leave their configured range', () => {
  const relationships = createRelationshipEvidence(relationshipConfig)
  let state = relationships.createState({ sourceId: 'resident:a', targetId: 'resident:b' })

  for (let index = 0; index < 20; index += 1) {
    state = relationships.applyInteraction(state, {
      expressedSignals: ['comforting'],
      intensity: 3,
      evidenceIds: [`event:${index}`],
    })
  }
  assert.equal(state.scores.warmth, 100)
  assert.equal(state.evidenceIds.length, relationshipConfig.maxEvidenceIds)

  for (let index = 20; index < 40; index += 1) {
    state = relationships.applyInteraction(state, {
      expressedSignals: ['dismissive'],
      intensity: 3,
      evidenceIds: [`event:${index}`],
    })
  }
  assert.equal(state.scores.warmth, 0)
})

test('signal weights are configurable data', () => {
  const customConfig = structuredClone(relationshipConfig)
  customConfig.signals.supportive.expressed.trust = 20
  const relationships = createRelationshipEvidence(customConfig)
  const state = relationships.createState({ sourceId: 'resident:a', targetId: 'resident:b' })
  const next = relationships.applyInteraction(state, {
    expressedSignals: ['supportive'],
    evidenceIds: ['event:1'],
  })

  assert.equal(next.scores.trust, 20)
})

test('unknown signals and missing evidence are rejected', () => {
  const relationships = createRelationshipEvidence(relationshipConfig)
  const state = relationships.createState({ sourceId: 'resident:a', targetId: 'resident:b' })

  assert.throws(
    () => relationships.applyInteraction(state, { expressedSignals: ['invented'], evidenceIds: ['event:1'] }),
    /unknown relationship signal/
  )
  assert.throws(
    () => relationships.applyInteraction(state, { expressedSignals: ['friendly'], evidenceIds: [] }),
    /at least one evidenceId/
  )
})
