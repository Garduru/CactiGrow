import assert from 'node:assert/strict'
import test from 'node:test'
import { BODY_STYLES, HAIR_STYLES, characterAppearanceKey, isCharacterAppearance, NPC_APPEARANCES, resolveCharacterAppearance } from './appearance.ts'
import { isStartingCommand } from '../api/startingExperienceV1.ts'
import { isPublicPresenceV1 } from '../realtime/protocolV1.ts'
import { createAreaPresenceState, joinPresence, toPublicPresence } from '../../server/realtime/presenceState.ts'
import { TOWN_AREA } from '../realtime/areas.ts'
import { layerId, playerId, presenceId } from '../realtime/identifiers.ts'
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
test('body presentation is bounded appearance data and legacy checkpoints keep the masculine fallback', () => {
  assert.deepEqual(BODY_STYLES, ['Masculine', 'Feminine'])
  for (const body of [0, 1]) {
    const appearance = { skin: 1, shirt: 2, body, hair: 1, hairColor: 2, pants: 2, hat: 2, accessory: 1 }
    assert.ok(isCharacterAppearance(appearance))
    assert.ok(isStartingCommand({ type: 'save-appearance', commandId: uuid(body + 10), appearance }))
    assert.equal(resolveCharacterAppearance(appearance).body, body)
  }
  assert.equal(isCharacterAppearance({ skin: 0, shirt: 0, body: 2 }), false)
  assert.equal(isCharacterAppearance({ skin: 0, shirt: 0, gender: 'feminine' }), false)
  assert.equal(resolveCharacterAppearance({ skin: 2, shirt: 1 }).body, 0)
  assert.notEqual(characterAppearanceKey({ skin: 1, shirt: 2, body: 0 }), characterAppearanceKey({ skin: 1, shirt: 2, body: 1 }))
})
test('V2 hair choices append authored styles without remapping the two existing indices', () => {
  assert.deepEqual(HAIR_STYLES, ['Cropped', 'Tied back', 'Wavy crop', 'Long braid'])
  for (const body of [0, 1]) for (const hair of [0, 1, 2, 3]) assert.ok(isCharacterAppearance({ skin: 1, shirt: 2, body, hair }))
  assert.equal(isCharacterAppearance({ skin: 1, shirt: 2, hair: 4 }), false)
  assert.equal(resolveCharacterAppearance({ skin: 1, shirt: 2, hair: 1 }).hair, 1)
})
test('modular looks remain exact bounded public presentation data with legacy defaults', () => {
  const legacy = { skin: 2, shirt: 1 }
  assert.ok(isCharacterAppearance(legacy))
  assert.deepEqual(resolveCharacterAppearance(legacy), { skin: 2, shirt: 1, body: 0, hair: 0, hairColor: 0, pants: 0, hat: 0, accessory: 0 })
  assert.equal(characterAppearanceKey(legacy), characterAppearanceKey(resolveCharacterAppearance(legacy)))
  assert.ok(isCharacterAppearance(NPC_APPEARANCES.mara.appearance))
  for (const key of ['body', 'hair', 'hairColor', 'pants', 'hat', 'accessory']) {
    for (const value of [-1, 999, .5, null, 'invented']) assert.equal(isCharacterAppearance({ ...legacy, [key]: value }), false)
  }
  assert.equal(isCharacterAppearance({ ...legacy, tool: 'field-knife' }), false)
  assert.equal(isCharacterAppearance({ hair: 0 }), false)
  assert.ok(isStartingCommand({ type: 'save-appearance', commandId: uuid(9), appearance: NPC_APPEARANCES.mara.appearance }))
})
test('the existing multiplayer projection retains modular looks without private checkpoint fields', () => {
  const appearance = NPC_APPEARANCES.mara.appearance
  const joined = joinPresence(createAreaPresenceState(TOWN_AREA, 0), { playerId: playerId(uuid(1)), presenceId: presenceId(uuid(2)), newLayerId: layerId(uuid(3)), entryPointId: 'farm-arrival', appearance }, 1)
  assert.ok(joined.ok)
  const publicPresence = toPublicPresence({ ...joined.membership, ...{ harvestingXp: 99, equipment: { tool: 'field-knife' } } })
  assert.deepEqual(publicPresence.appearance, appearance)
  assert.ok(isPublicPresenceV1(publicPresence))
  assert.equal(Object.hasOwn(publicPresence, 'equipment'), false)
  assert.equal(Object.hasOwn(publicPresence, 'harvestingXp'), false)
  for (const body of [0, 1]) assert.ok(isPublicPresenceV1({ ...publicPresence, appearance: { ...appearance, body } }))
  assert.equal(isPublicPresenceV1({ ...publicPresence, appearance: { ...appearance, body: 2 } }), false)
  assert.equal(isCharacterAppearance({ ...appearance, npcId: 'mara' }), false)
  assert.equal(NPC_APPEARANCES.mara.appearance.body, 1)
})
test('both body types and new hairstyles round-trip through public presence without NPC or identity metadata', () => {
  for (const body of [0, 1]) for (const hair of [2, 3]) {
    const appearance = { body, skin: 2, shirt: 1, hair, hairColor: 3, pants: 1, hat: 1, accessory: 1 }
    const joined = joinPresence(createAreaPresenceState(TOWN_AREA, 0), { playerId: playerId(uuid(1)), presenceId: presenceId(uuid(2)), newLayerId: layerId(uuid(3)), entryPointId: 'farm-arrival', appearance }, 1)
    assert.ok(joined.ok)
    const publicPresence = toPublicPresence({ ...joined.membership, ...{ npcId: 'mara', gender: 'feminine', equipment: { tool: 'field-knife' } } })
    assert.deepEqual(publicPresence.appearance, appearance)
    assert.ok(isPublicPresenceV1(publicPresence))
    for (const privateField of ['npcId', 'gender', 'equipment']) assert.equal(Object.hasOwn(publicPresence, privateField), false)
    assert.equal(isPublicPresenceV1({ ...publicPresence, appearance: { ...appearance, npcId: 'mara' } }), false)
    assert.equal(isPublicPresenceV1({ ...publicPresence, appearance: { ...appearance, gender: 'feminine' } }), false)
  }
})
