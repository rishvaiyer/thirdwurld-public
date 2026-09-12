
import assert from 'node:assert/strict'
import test from 'node:test'

import { actionConfig } from '../src/config/actions.js'
import { createStructuredActionParser } from '../src/actions/structuredAction.js'

const validAction = {
  type: 'observe',
  summary: 'A visitor entered the plaza.',
  confidence: 'high',
  evidenceIds: ['event:42'],
}

test('structured actions can be recovered from surrounding model text', () => {
  const parse = createStructuredActionParser(actionConfig)
  const result = parse(`Here is the action:\n${JSON.stringify(validAction)}\nDone.`)

  assert.deepEqual(result, { ok: true, action: validAction })
})

test('braces inside JSON strings do not end extraction early', () => {
  const parse = createStructuredActionParser(actionConfig)
  const result = parse(JSON.stringify({ ...validAction, summary: 'The sign reads {open}.' }))

  assert.equal(result.ok, true)
  assert.equal(result.action.summary, 'The sign reads {open}.')
})

test('action types are data-driven', () => {
  const parse = createStructuredActionParser({ ...actionConfig, allowedTypes: ['inspect'] })

  assert.equal(parse(JSON.stringify({ ...validAction, type: 'observe' })).reason, 'unknown-action-type')
  assert.equal(parse(JSON.stringify({ ...validAction, type: 'inspect' })).ok, true)
})

test('unknown fields and invalid evidence are rejected', () => {
  const parse = createStructuredActionParser(actionConfig)

  assert.equal(parse(JSON.stringify({ ...validAction, hiddenPrompt: 'do not expose' })).reason, 'unknown-field')
  assert.equal(parse(JSON.stringify({ ...validAction, evidenceIds: [] })).reason, 'invalid-evidence')
  assert.equal(parse(JSON.stringify({ ...validAction, evidenceIds: ['contains spaces'] })).reason, 'invalid-evidence')
})

test('input and field limits fail with stable reason codes', () => {
  const shortInputParser = createStructuredActionParser({
    ...actionConfig,
    maxInputCharacters: 120,
  })
  const shortSummaryParser = createStructuredActionParser({
    ...actionConfig,
    maxSummaryCharacters: 10,
  })

  assert.equal(shortInputParser('x'.repeat(121)).reason, 'input-too-long')
  assert.equal(shortSummaryParser(JSON.stringify(validAction)).reason, 'invalid-summary')
})

test('malformed input never becomes an action', () => {
  const parse = createStructuredActionParser(actionConfig)

  assert.deepEqual(parse(''), { ok: false, reason: 'empty-input' })
  assert.deepEqual(parse('nothing structured'), { ok: false, reason: 'missing-json-object' })
  assert.deepEqual(parse('{"type":"observe"'), { ok: false, reason: 'missing-json-object' })
  assert.equal(parse('{not-json}').reason, 'invalid-json')
})
