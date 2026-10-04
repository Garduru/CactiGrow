import assert from 'node:assert/strict'
import test from 'node:test'
import { assertValidArea, getAreaDefinition, isEntryPoint, TOWN_AREA, TOWN_ENTRY_POINTS, type AreaDefinition } from '../../shared/realtime/areas.ts'
import { areaId, connectionGeneration, layerId, playerId, presenceId } from '../../shared/realtime/identifiers.ts'
import { TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT, TOWN_PLAYER_SPAWN, townWorldSpawns } from '../../src/game-world/townWorldLayout.ts'

test('Town is registered; unknown and inherited-property names are rejected', () => {
  assert.equal(getAreaDefinition('town'), TOWN_AREA)
  for (const id of ['forest', '', 'Town', '__proto__', 'constructor', null, 1]) assert.equal(getAreaDefinition(id), undefined)
})
test('Town shared coordinates preserve the existing world and all authored entries', () => {
  assert.equal(TOWN_WORLD_WIDTH, 2200)
  assert.equal(TOWN_WORLD_HEIGHT, 1500)
  assert.deepEqual(TOWN_AREA.bounds, { minX: 0, minY: 0, maxX: 2200, maxY: 1500 })
  assert.deepEqual(TOWN_PLAYER_SPAWN, { x: 1100, y: 1280 })
  assert.deepEqual(townWorldSpawns, { 'farm-arrival': { x: 1100, y: 1280 }, 'shop-exterior': { x: 650, y: 560 }, 'marketplace-exterior': { x: 1510, y: 590 } })
  assert.deepEqual(TOWN_AREA.entryPoints, townWorldSpawns)
  for (const id of Object.keys(TOWN_ENTRY_POINTS)) assert.equal(isEntryPoint(TOWN_AREA, id), true)
  for (const id of ['default', 'constructor', '__proto__', null]) assert.equal(isEntryPoint(TOWN_AREA, id), false)
})
test('Area configuration validates capacities, coordinates, versions, and movement settings', () => {
  assert.doesNotThrow(() => assertValidArea(TOWN_AREA))
  assert.equal(TOWN_AREA.layerCapacity, 32)
  assert.equal(TOWN_AREA.populationLimit, 128)
  const invalid: Partial<AreaDefinition>[] = [
    { coordinateVersion: 0 }, { coordinateVersion: 1.5 }, { layerCapacity: 0 }, { layerCapacity: -1 },
    { populationLimit: 0 }, { populationLimit: Infinity }, { emptyLayerRetentionMs: -1 },
    { bounds: { minX: 0, minY: 0, maxX: 0, maxY: 1 } },
    { bounds: { ...TOWN_AREA.bounds, maxX: NaN } }, { entryPoints: {} },
    { entryPoints: { bad: { x: -1, y: 0 } } }, { entryPoints: { bad: { x: 0, y: Infinity } } },
    { movement: { ...TOWN_AREA.movement, speed: 0 } },
    { movement: { ...TOWN_AREA.movement, maxUpdatesPerSecond: 0.5 } },
    { movement: { ...TOWN_AREA.movement, positionTolerance: -1 } },
  ]
  for (const patch of invalid) assert.throws(() => assertValidArea({ ...TOWN_AREA, ...patch }), /Invalid Area/)
  assert.doesNotThrow(() => assertValidArea({ ...TOWN_AREA, populationLimit: 1 }))
})
test('Identifier constructors separate opaque UUIDs from labels and validate generations', () => {
  for (const make of [layerId, playerId, presenceId]) {
    assert.throws(() => make('Layer 1'), /Invalid UUID/)
    assert.equal(make('ABCDEF00-0000-4000-8000-000000000001'), 'abcdef00-0000-4000-8000-000000000001')
  }
  assert.throws(() => areaId('Town / 1'))
  for (const generation of [0, -1, 1.1, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => connectionGeneration(generation))
  assert.equal(connectionGeneration(1), 1)
})
