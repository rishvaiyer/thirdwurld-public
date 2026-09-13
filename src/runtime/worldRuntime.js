
import { actionConfig } from '../config/actions.js'
import { activityConfig } from '../config/activities.js'
import { interactionConfig } from '../config/interactions.js'
import { locomotionConfig } from '../config/locomotion.js'
import { relationshipConfig } from '../config/relationships.js'
import { routineConfig } from '../config/routines.js'
import { simulationConfig } from '../config/simulation.js'
import { worldConfig } from '../config/world.js'
import { worldEventConfig } from '../config/worldEvents.js'
import { createStructuredActionParser } from '../actions/structuredAction.js'
import { createWorldEventEvidence } from '../events/worldEventEvidence.js'
import { createWorldNavigation } from '../navigation/worldNavigation.js'
import { createRelationshipEvidence } from '../relationships/relationshipEvidence.js'
import { createInteractionPointReservations } from '../simulation/interactionPointReservations.js'
import { createHumanOccupancyLifecycle } from '../simulation/humanOccupancyLifecycle.js'
import { createResidentActivitySelector } from '../simulation/residentActivitySelection.js'
import { createResidentLocomotion } from '../simulation/residentLocomotion.js'
import { createResidentRoutine } from '../simulation/residentRoutine.js'
import { createSimulationPacePolicy } from '../simulation/simulationPace.js'
import { createSynchronizedWorldClock } from '../time/worldClock.js'

const defaultConfigs = {
  actions: actionConfig,
  activities: activityConfig,
  interactions: interactionConfig,
  locomotion: locomotionConfig,
  relationships: relationshipConfig,
  routines: routineConfig,
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
  const interactionPoints = createInteractionPointReservations(resolvedConfigs.interactions)
  const selectActivity = createResidentActivitySelector(resolvedConfigs.activities, { random })
  const selectRoutinePeriod = createResidentRoutine(resolvedConfigs.routines, {
    knownActivityIds: resolvedConfigs.activities.activities.map(activity => activity.id),
  })
  const planResidentMotion = createResidentLocomotion(resolvedConfigs.locomotion)
  const eventEvidence = createWorldEventEvidence(resolvedConfigs.worldEvents)
  const worldClock = createSynchronizedWorldClock(clock, clock?.readMonotonicTimeMs)
  const occupancy = createHumanOccupancyLifecycle(resolvedConfigs.simulation.occupancy)

  let presence = occupancy.snapshot(worldClock.now())
  let pace = selectPace({ humanCount: presence.humanCount })
  let breadcrumbTrail = []
  let lastAction = null
  let lastActivity = null
  let nextEventNumber = 1
  const relationships = new Map()
  const eventReceipts = new Map()
  const publicEvents = []

  function setHumanCount(count) {
    presence = occupancy.observe(count, worldClock.now())
    pace = selectPace({
      humanCount: presence.humanCount,
      emptyGraceActive: presence.mode === 'grace',
    })
    return structuredClone(pace)
  }

  function refreshPresence() {
    const worldTimeMs = worldClock.now()
    presence = occupancy.snapshot(worldTimeMs)
    pace = selectPace({
      humanCount: presence.humanCount,
      emptyGraceActive: presence.mode === 'grace',
    })
    return worldTimeMs
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

  function currentResidentRoutine() {
    return structuredClone(selectRoutinePeriod(worldClock.now()))
  }

  function reserveInteractionPoint(input) {
    return interactionPoints.reserve(input)
  }

  function releaseInteractionPoint(residentId) {
    return interactionPoints.release(residentId)
  }

  function snapshot() {
    const worldTimeMs = refreshPresence()
    return structuredClone({
      worldTimeMs,
      humanCount: presence.humanCount,
      presence,
      pace,
      destinations: navigation.listDestinations(),
      breadcrumbTrail,
      lastAction,
      lastActivity,
      interactionPointReservations: interactionPoints.snapshot(),
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
    currentResidentRoutine,
    reserveInteractionPoint,
    releaseInteractionPoint,
    snapshot,
  }
}
