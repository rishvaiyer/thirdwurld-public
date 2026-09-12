// SPDX-License-Identifier: GPL-3.0-only

import { actionConfig } from '../config/actions.js'
import { activityConfig } from '../config/activities.js'
import { locomotionConfig } from '../config/locomotion.js'
import { relationshipConfig } from '../config/relationships.js'
import { simulationConfig } from '../config/simulation.js'
import { worldConfig } from '../config/world.js'
import { worldEventConfig } from '../config/worldEvents.js'
import { createStructuredActionParser } from '../actions/structuredAction.js'
import { createWorldEventEvidence } from '../events/worldEventEvidence.js'
import { createWorldNavigation } from '../navigation/worldNavigation.js'
import { createRelationshipEvidence } from '../relationships/relationshipEvidence.js'
import { createResidentActivitySelector } from '../simulation/residentActivitySelection.js'
import { createResidentLocomotion } from '../simulation/residentLocomotion.js'
import { createSimulationPacePolicy } from '../simulation/simulationPace.js'
import { createSynchronizedWorldClock } from '../time/worldClock.js'

const defaultConfigs = {
  actions: actionConfig,
  activities: activityConfig,
  locomotion: locomotionConfig,
  relationships: relationshipConfig,
  simulation: simulationConfig,
  world: worldConfig,
  worldEvents: worldEventConfig,
}

function relationshipKey(sourceId, targetId) {
  return JSON.stringify([sourceId, targetId])
}

export function createWorldRuntime({ configs = {}, clock, navigationAdapter = {}, random } = {}) {
  const resolvedConfigs = { ...defaultConfigs, ...configs }
  const navigation = createWorldNavigation(resolvedConfigs.world, navigationAdapter)
  const selectPace = createSimulationPacePolicy(resolvedConfigs.simulation)
  const parseAction = createStructuredActionParser(resolvedConfigs.actions)
  const relationshipEvidence = createRelationshipEvidence(resolvedConfigs.relationships)
  const selectActivity = createResidentActivitySelector(resolvedConfigs.activities, { random })
  const planResidentMotion = createResidentLocomotion(resolvedConfigs.locomotion)
  const eventEvidence = createWorldEventEvidence(resolvedConfigs.worldEvents)
  const worldClock = createSynchronizedWorldClock(clock, clock?.readMonotonicTimeMs)

  let humanCount = 0
  let pace = selectPace({ humanCount })
  let breadcrumbTrail = []
  let lastAction = null
  let lastActivity = null
  let nextEventNumber = 1
  const relationships = new Map()
  const eventReceipts = new Map()
  const publicEvents = []

  function setHumanCount(count) {
    pace = selectPace({ humanCount: count })
    humanCount = count
    return structuredClone(pace)
  }

  function travel(destinationId) {
    const result = navigation.travel(destinationId)
    if (result.ok) breadcrumbTrail = navigation.addBreadcrumb(breadcrumbTrail, destinationId)
    return structuredClone(result)
  }

  function parseResidentAction(raw) {
    const result = parseAction(raw)
    if (result.ok) lastAction = structuredClone(result.action)
    return structuredClone(result)
  }

  function applyInteraction({ sourceId, targetId, ...interaction }) {
    const key = relationshipKey(sourceId, targetId)
    const current = relationships.get(key) ||
      relationshipEvidence.createState({ sourceId, targetId }, worldClock.now())
    const next = relationshipEvidence.applyInteraction(current, {
      ...interaction,
      occurredAt: interaction.occurredAt ?? worldClock.now(),
    })
    relationships.set(key, next)
    return structuredClone(next)
  }

  function recordWorldEvent(input) {
    const validated = eventEvidence.validate(input)
    if (!validated.ok) return validated

    const fingerprinted = eventEvidence.fingerprint(validated.event)
    const receiptKey = relationshipKey(validated.event.actor.id, validated.event.idempotencyKey)
    const previous = eventReceipts.get(receiptKey)
    if (previous) {
      if (previous.fingerprint !== fingerprinted.fingerprint) {
        return { ok: false, reason: 'idempotency-conflict' }
      }
      return { ok: true, ...structuredClone(previous), duplicate: true }
    }

    const eventId = `world-event:${nextEventNumber}`
    nextEventNumber += 1
    const receipt = {
      eventId,
      fingerprint: fingerprinted.fingerprint,
      visibility: validated.event.visibility,
    }
    eventReceipts.set(receiptKey, receipt)

    const projection = eventEvidence.projectPublic(validated.event, { eventId })
    if (projection.ok) publicEvents.push(projection.event)
    return { ok: true, ...structuredClone(receipt), duplicate: false }
  }

  function selectResidentActivity(input) {
    const result = selectActivity({ ...input, nowMs: input.nowMs ?? worldClock.now() })
    if (result.ok) lastActivity = structuredClone(result)
    return structuredClone(result)
  }

  function snapshot() {
    return structuredClone({
      worldTimeMs: worldClock.now(),
      humanCount,
      pace,
      destinations: navigation.listDestinations(),
      breadcrumbTrail,
      lastAction,
      lastActivity,
      relationships: [...relationships.values()],
      publicEvents,
    })
  }

  return {
    setHumanCount,
    travel,
    parseResidentAction,
    applyInteraction,
    recordWorldEvent,
    planResidentMotion,
    selectResidentActivity,
    snapshot,
  }
}
