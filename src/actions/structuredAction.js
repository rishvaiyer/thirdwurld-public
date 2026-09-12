
const IDENTIFIER = /^[A-Za-z0-9:_./-]+$/
const ACTION_FIELDS = new Set(['type', 'summary', 'confidence', 'evidenceIds'])

function extractFirstJsonObject(text) {
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character === '{') {
      if (depth === 0) start = index
      depth += 1
    } else if (character === '}' && depth > 0) {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return null
}

function normalizeRules(config) {
  const list = (value, field) => {
    if (!Array.isArray(value) || value.length === 0 || value.some(item => typeof item !== 'string' || !item.trim())) {
      throw new TypeError(`${field} must contain non-empty strings`)
    }
    return new Set(value.map(item => item.trim()))
  }
  const positiveInteger = (value, field) => {
    if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer`)
    return value
  }

  return {
    allowedTypes: list(config?.allowedTypes, 'allowedTypes'),
    confidenceLevels: list(config?.confidenceLevels, 'confidenceLevels'),
    maxInputCharacters: positiveInteger(config?.maxInputCharacters, 'maxInputCharacters'),
    maxSummaryCharacters: positiveInteger(config?.maxSummaryCharacters, 'maxSummaryCharacters'),
    maxEvidenceIds: positiveInteger(config?.maxEvidenceIds, 'maxEvidenceIds'),
  }
}

export function createStructuredActionParser(config) {
  const rules = normalizeRules(config)

  return function parseStructuredAction(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return { ok: false, reason: 'empty-input' }
    if (raw.length > rules.maxInputCharacters) return { ok: false, reason: 'input-too-long' }

    const json = extractFirstJsonObject(raw)
    if (!json) return { ok: false, reason: 'missing-json-object' }

    let value
    try {
      value = JSON.parse(json)
    } catch {
      return { ok: false, reason: 'invalid-json' }
    }
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return { ok: false, reason: 'invalid-action' }
    }
    if (Object.keys(value).some(field => !ACTION_FIELDS.has(field))) {
      return { ok: false, reason: 'unknown-field' }
    }

    const type = typeof value.type === 'string' ? value.type.trim() : ''
    const summary = typeof value.summary === 'string' ? value.summary.replace(/\s+/g, ' ').trim() : ''
    const confidence = typeof value.confidence === 'string' ? value.confidence.trim() : ''
    const evidenceIds = Array.isArray(value.evidenceIds)
      ? [...new Set(value.evidenceIds.map(item => (typeof item === 'string' ? item.trim() : '')))]
      : []

    if (!rules.allowedTypes.has(type)) return { ok: false, reason: 'unknown-action-type' }
    if (!summary || summary.length > rules.maxSummaryCharacters) return { ok: false, reason: 'invalid-summary' }
    if (!rules.confidenceLevels.has(confidence)) return { ok: false, reason: 'invalid-confidence' }
    if (
      evidenceIds.length === 0 ||
      evidenceIds.length > rules.maxEvidenceIds ||
      evidenceIds.some(id => !id || !IDENTIFIER.test(id))
    ) {
      return { ok: false, reason: 'invalid-evidence' }
    }

    return {
      ok: true,
      action: { type, summary, confidence, evidenceIds },
    }
  }
}

