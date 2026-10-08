import assert from 'node:assert/strict'
import test from 'node:test'
import { FIELD_SURVEY, isFieldSurveyCommandV1, isFieldSurveyDevCommandV1, isFieldSurveyProjectionV1 } from './fieldSurveyV1.ts'

const command = { v: 1, commandId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', type: 'accept', entityId: FIELD_SURVEY.npcEntityId, expectedWorldRevision: 4, position: { x: 720, y: 460 } }
test('Field Survey only accepts real NPC accept/report intents with bounded endpoints', () => {
  assert.equal(isFieldSurveyCommandV1(command), true)
  assert.equal(isFieldSurveyCommandV1({ ...command, type: 'report' }), true)
  for (const change of [{ v: 2 }, { type: 'mark-complete' }, { type: 'discover-landmark' }, { entityId: 'mara-guide' }, { expectedWorldRevision: -1 }, { playerId: command.commandId }, { reward: 25 }, { completed: true }, { objectives: {} }, { position: { x: 720, y: 460, timestamp: 0 } }, { position: { x: Infinity, y: 460 } }]) {
    assert.equal(isFieldSurveyCommandV1({ ...command, ...change }), false)
  }
})
test('Field Survey reset is revisioned and owns only the current quest', () => {
  const reset = { v: 1, commandId: command.commandId, type: 'reset-field-survey', expectedRevision: 2 }
  assert.equal(isFieldSurveyDevCommandV1(reset), true)
  for (const change of [{ type: 'reset-player' }, { expectedRevision: -1 }, { targetPlayerId: command.commandId }, { rewardClaimed: false }, { clearHistory: true }]) assert.equal(isFieldSurveyDevCommandV1({ ...reset, ...change }), false)
})
test('Field Survey projection carries exactly the selected route and authoritative objective flags', () => {
  const projection = { projectionVersion: 1, revision: 0, progressRevision: 0, status: 'available', acceptedAt: null, completedAt: null, rewardClaimed: false,
    objectives: { landmarks: FIELD_SURVEY.landmarkIds.map(landmarkId => ({ landmarkId, discoveredAt: null })), sanPedroHarvested: false, peyoteHarvested: false, caveEntered: false, caveLandmarkDiscovered: false, caveNoteInspected: false } }
  assert.equal(isFieldSurveyProjectionV1(projection), true)
  assert.equal(isFieldSurveyProjectionV1({ ...projection, status: 'complete' }), false)
  assert.equal(isFieldSurveyProjectionV1({ ...projection, objectives: { ...projection.objectives, landmarks: projection.objectives.landmarks.slice(1) } }), false)
  assert.equal(isFieldSurveyProjectionV1({ ...projection, objectives: { ...projection.objectives, sanPedroHarvested: 'yes' } }), false)
})
