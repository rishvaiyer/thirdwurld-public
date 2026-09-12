
import { worldConfig } from './world.js'

const destinationIds = worldConfig.destinations.map(destination => destination.id)

export const worldEventConfig = {
  actorTypes: ['human', 'resident'],
  clockPhases: ['dawn', 'day', 'dusk', 'night'],
  actionCatalog: {
    visited: destinationIds,
    interacted: destinationIds,
    created: ['workshop'],
  },
  maxParticipants: 12,
  maxEvidenceIds: 24,
  includeActorIdInPublicProjection: false,
}

