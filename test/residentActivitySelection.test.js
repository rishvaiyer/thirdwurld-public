
import assert from 'node:assert/strict'
import test from 'node:test'

import { activityConfig } from '../src/config/activities.js'
import { createResidentActivitySelector } from '../src/simulation/residentActivitySelection.js'

function selector(config = activityConfig, random = () => 0) {
  return createResidentActivitySelector(config, { random })
}

test('the least-satisfied weighted need drives activity selection', () => {
  const result = selector()({
    needs: { energy: 0.1, social: 0.8, curiosity: 0.5 },
  })

  assert.equal(result.ok, true)
  assert.equal(result.activityId, 'rest')
  assert.equal(result.reason, 'highest-activity-score')
  assert.deepEqual(result.scores.map(score => score.id), ['rest', 'socialize', 'explore'])
  assert.ok(Math.abs(result.scores[0].score - 1.08) < Number.EPSILON)
  assert.ok(Math.abs(result.scores[1].score - 0.2) < Number.EPSILON)
  assert.ok(Math.abs(result.scores[2].score - 0.45) < Number.EPSILON)
})

test('controls can limit which activities a resident may choose', () => {
  const result = selector()({
    needs: { energy: 0, social: 0.8, curiosity: 0.8 },
    allowedActivityIds: ['socialize', 'explore'],
  })

  assert.equal(result.activityId, 'socialize')
  assert.deepEqual(result.scores.map(score => score.id), ['socialize', 'explore'])
})

test('cooldowns exclude an otherwise winning activity', () => {
  const result = selector()({
    needs: { energy: 0, social: 0.8, curiosity: 0.8 },
    cooldownUntilByActivity: { rest: 1_001 },
    nowMs: 1_000,
  })

  assert.equal(result.activityId, 'socialize')
})

test('no eligible choice produces a structured outcome', () => {
  const result = selector()({
    needs: { energy: 0, social: 0, curiosity: 0 },
    allowedActivityIds: [],
  })

  assert.deepEqual(result, { ok: false, reason: 'no-available-activity', scores: [] })
})

test('configuration changes activities without changing selection logic', () => {
  const choose = selector({
    scoreVariation: 0,
    activities: [{ id: 'create', need: 'creative-focus', weight: 2 }],
  })

  assert.equal(choose({ needs: { 'creative-focus': 0.25 } }).activityId, 'create')
})

test('injected randomness can vary close decisions predictably', () => {
  const values = [0, 1, 0]
  const result = selector(activityConfig, () => values.shift())({
    needs: { energy: 0.9, social: 0.9, curiosity: 0.9 },
  })

  assert.equal(result.activityId, 'socialize')
})

test('ties preserve configured activity order', () => {
  const result = selector()({
    needs: { energy: 1, social: 1, curiosity: 1 },
  })

  assert.equal(result.activityId, 'rest')
})

test('invalid configuration and selection input fail early', () => {
  assert.throws(
    () => selector({ scoreVariation: 0, activities: [{ id: 'rest', need: 'energy', weight: -1 }] }),
    /weight/
  )
  assert.throws(
    () => selector({
      scoreVariation: 0,
      activities: [
        { id: 'rest', need: 'energy', weight: 1 },
        { id: 'rest', need: 'social', weight: 1 },
      ],
    }),
    /unique/
  )
  assert.throws(() => selector()({ needs: { energy: 2, social: 1, curiosity: 1 } }), /needs.energy/)
  assert.throws(
    () => selector()({ needs: { energy: 1, social: 1, curiosity: 1 }, allowedActivityIds: ['unknown'] }),
    /unknown activity/
  )
})
