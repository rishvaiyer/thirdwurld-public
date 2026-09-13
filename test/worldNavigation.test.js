
import assert from 'node:assert/strict'
import test from 'node:test'

import { worldConfig } from '../src/config/world.js'
import { createWorldNavigation } from '../src/navigation/worldNavigation.js'

function config(overrides = {}) {
  return {
    navigation: { breadcrumbLimit: 3 },
    destinations: [
      {
        id: 'plaza',
        label: 'Plaza',
        category: 'Social',
        accent: '#789abc',
        approach: [0, 0, 0],
        entrance: [0, 0, -4],
      },
      {
        id: 'studio',
        label: 'Studio',
        category: 'Create',
        accent: '#c0a060',
        approach: [4, 0, 2],
        entrance: [0, 0, 2],
      },
      {
        id: 'garden',
        label: 'Garden',
        category: 'Explore',
        accent: '#608060',
        approach: [-4, 0, 2],
        entrance: [0, 0, 2],
      },
    ],
    ...overrides,
  }
}

test('world content can change without changing navigation behavior', () => {
  const navigation = createWorldNavigation(
    config({
      destinations: [
        {
          id: 'reading-room',
          label: 'Reading Room',
          category: 'Quiet',
          accent: '#445566',
          approach: [2, 0, 3],
          entrance: [2, 0, -1],
        },
      ],
    })
  )

  const [destination] = navigation.listDestinations()
  assert.equal(destination.label, 'Reading Room')
  assert.equal(destination.rotationY, 0)

  destination.approach[0] = 999
  assert.deepEqual(navigation.listDestinations()[0].approach, [2, 0, 3])
})

test('the default public configuration is valid', () => {
  const navigation = createWorldNavigation(worldConfig)
  assert.deepEqual(
    navigation.listDestinations().map(destination => destination.id),
    ['town-square', 'workshop', 'pollinator-garden']
  )
})

test('invalid configuration fails immediately with a useful location', () => {
  assert.throws(
    () => createWorldNavigation(config({ navigation: { breadcrumbLimit: 0 } })),
    /navigation\.breadcrumbLimit/
  )
  assert.throws(
    () =>
      createWorldNavigation(
        config({
          destinations: [config().destinations[0], config().destinations[0]],
        })
      ),
    /destinations\[1\]\.id must be unique/
  )
  assert.throws(
    () =>
      createWorldNavigation(
        config({
          destinations: [{ ...config().destinations[0], approach: [0, Number.NaN, 0] }],
        })
      ),
    /destinations\[0\]\.approach/
  )
})

test('travel returns structured outcomes through a small adapter seam', () => {
  const movements = []
  let cleared = 0
  const navigation = createWorldNavigation(config(), {
    clearTransientState() {
      cleared += 1
    },
    movePlayer(movement) {
      movements.push(movement)
      return true
    },
  })

  assert.deepEqual(navigation.travel('missing'), {
    ok: false,
    reason: 'unknown-destination',
  })
  assert.equal(navigation.travel('plaza').ok, true)
  assert.equal(cleared, 1)
  assert.deepEqual(movements, [{ position: [0, 0, 0], rotationY: 0 }])
})

test('travel distinguishes unavailable, blocked, and failed movement', () => {
  assert.equal(createWorldNavigation(config()).travel('plaza').reason, 'travel-unavailable')
  assert.equal(
    createWorldNavigation(config(), { movePlayer: () => false }).travel('plaza').reason,
    'arrival-blocked'
  )
  assert.equal(
    createWorldNavigation(config(), {
      movePlayer: () => ({ ok: false, reason: 'travel-unavailable' }),
    }).travel('plaza').reason,
    'travel-unavailable'
  )
  assert.equal(
    createWorldNavigation(config(), {
      movePlayer: () => ({ ok: false, reason: 'adapter-private-detail' }),
    }).travel('plaza').reason,
    'travel-failed'
  )
  assert.equal(
    createWorldNavigation(config(), {
      movePlayer() {
        throw new Error('adapter failed')
      },
    }).travel('plaza').reason,
    'travel-failed'
  )
})

test('breadcrumbs are deduplicated, validated, and bounded', () => {
  const navigation = createWorldNavigation(config({ navigation: { breadcrumbLimit: 2 } }))
  const original = ['plaza']

  assert.deepEqual(navigation.addBreadcrumb(original, 'plaza'), ['plaza'])
  assert.deepEqual(navigation.addBreadcrumb(original, 'missing'), ['plaza'])
  assert.deepEqual(navigation.addBreadcrumb(['missing', 'plaza'], 'studio'), ['plaza', 'studio'])
  assert.deepEqual(navigation.addBreadcrumb(['plaza', 'studio'], 'garden'), ['studio', 'garden'])
  assert.deepEqual(original, ['plaza'])
})

test('retrace only removes the current stop after successful travel', () => {
  const completed = createWorldNavigation(config(), { movePlayer: () => true }).retrace([
    'plaza',
    'studio',
    'garden',
  ])
  assert.equal(completed.ok, true)
  assert.equal(completed.destination.id, 'studio')
  assert.deepEqual(completed.trail, ['plaza', 'studio'])

  const blocked = createWorldNavigation(config(), { movePlayer: () => false }).retrace([
    'plaza',
    'studio',
  ])
  assert.equal(blocked.reason, 'arrival-blocked')
  assert.deepEqual(blocked.trail, ['plaza', 'studio'])

  assert.deepEqual(createWorldNavigation(config()).retrace(['plaza']), {
    ok: false,
    reason: 'no-previous-destination',
    trail: ['plaza'],
  })
})
