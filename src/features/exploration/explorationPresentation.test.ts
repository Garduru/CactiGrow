import assert from 'node:assert/strict'
import test from 'node:test'
import { WORLD, findArea } from '../../../shared/world/world.ts'
import type { ExplorationProjectionV1 } from '../../../shared/api/explorationV1.ts'
import { explorationJournalEntries, explorationJournalNotes, LandmarkEntryController, wildNodeAvailable } from './explorationPresentation.ts'

function projection(): ExplorationProjectionV1 {
  return { projectionVersion: 1, revision: 0, harvestingXp: 0, serverNow: '2026-10-07T00:00:00Z',
    nodes: WORLD.areas.flatMap(area => (area.interactables ?? []).filter(entity => entity.resourceType).map(entity => ({ entityId: entity.entityId, areaId: area.areaId, readyAt: null }))),
    landmarks: WORLD.areas.flatMap(area => (area.landmarks ?? []).map(landmark => ({ landmarkId: landmark.landmarkId, areaId: area.areaId, discoveredAt: null }))),
    notes: WORLD.areas.flatMap(area => (area.interactables ?? []).filter(entity => entity.noteId).map(entity => ({ noteId: entity.noteId!, areaId: area.areaId, discoveredAt: null }))) }
}
test('Journal hides authored landmark names until that player discovers them and reveals actual cave notes', () => {
  const state = projection(), unknown = explorationJournalEntries(state)
  assert.equal(unknown.length, 6)
  assert.ok(unknown.every(entry => entry.name === 'Unknown landmark' && !entry.discoveredAt))
  for (const landmark of WORLD.areas.flatMap(area => area.landmarks ?? [])) assert.equal(JSON.stringify(unknown).includes(landmark.displayName), false)
  const basin = findArea('the-first-basin')!, first = basin.landmarks![0]
  state.landmarks.find(record => record.landmarkId === first.landmarkId)!.discoveredAt = state.serverNow
  const revealed = explorationJournalEntries(state).find(entry => entry.id === first.landmarkId)!
  assert.equal(revealed.name, first.displayName); assert.equal(revealed.area, basin.displayName); assert.equal(revealed.description, first.description)
  assert.equal(explorationJournalEntries(projection()).find(entry => entry.id === first.landmarkId)!.name, 'Unknown landmark')
  const cave = findArea('basin-cave')!, formation = cave.interactables!.find(entity => entity.kind === 'inspectable')!
  state.notes.find(record => record.noteId === formation.noteId)!.discoveredAt = state.serverNow
  assert.deepEqual(explorationJournalNotes(state).map(note => [note.name, note.area, note.description]), [[formation.displayName, cave.displayName, formation.description]])
})
test('physical regions emit one request per entry, retain moving presentation, and retry an unaccepted busy entry', () => {
  const area = findArea('the-first-basin')!, landmark = area.landmarks![0], state = projection(), controller = new LandmarkEntryController(), emitted: string[] = []
  const accept = (id: string) => { emitted.push(id); return true }
  controller.update(area, landmark, null, accept); assert.equal(emitted.length, 0)
  controller.update(area, landmark, state, () => false); controller.update(area, landmark, state, accept)
  controller.update(area, landmark, state, accept); assert.deepEqual(emitted, [landmark.landmarkId])
  controller.update(area, { x: 0, y: 0 }, state, accept); controller.update(area, landmark, state, accept)
  assert.equal(emitted.length, 2)
  state.landmarks.find(record => record.landmarkId === landmark.landmarkId)!.discoveredAt = state.serverNow
  controller.update(area, { x: 0, y: 0 }, state, accept); controller.update(area, landmark, state, accept)
  assert.equal(emitted.length, 2)
})
test('wild availability uses the server projection deadline without changing personal state or tutorial nodes', () => {
  const state = projection(), node = state.nodes[0], now = Date.parse(state.serverNow)
  node.readyAt = new Date(now + 60000).toISOString()
  assert.equal(wildNodeAvailable(state, node.entityId, now), false)
  assert.equal(wildNodeAvailable(state, node.entityId, now + 59999), false)
  assert.equal(wildNodeAvailable(state, node.entityId, now + 60000), true)
  assert.equal(wildNodeAvailable(null, node.entityId, now), false)
  assert.equal(wildNodeAvailable(state, 'tutorial-cactus', now), false)
  assert.equal(wildNodeAvailable(projection(), node.entityId, now), true)
  assert.equal(node.readyAt, new Date(now + 60000).toISOString())
})
