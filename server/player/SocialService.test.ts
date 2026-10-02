import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicPlayerProfileV1, isSocialCommandV1, isSocialOverviewV1 } from '../../shared/api/socialV1.ts'
import { ApiError } from '../api/errors.ts'
import { normalizeCharacterName, SocialService } from './SocialService.ts'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { Client } from 'pg'
import * as schema from '../db/schema/index.ts'

const publicId = '00000000-0000-4000-8000-000000000001'
const summary = { publicId, displayName: 'Garduru', joinedAt: '2026-09-20T10:00:00.000Z', cultivationLevel: 8,
  cultivationXp: 2500, collectionCount: 4, breedingCount: 2 }

test('relationship serialization uses the granted profile rows, not UPDATE on identity rows', async () => {
  const actor = publicId, target = '00000000-0000-4000-8000-000000000002'
  const statements: string[] = []
  const database = drizzle({ query: async (config: { text: string }, parameters: unknown[]) => {
    const text = config.text
    statements.push(text)
    if (/for update/i.test(text)) {
      assert.match(text, /from "player_profiles"/)
      assert.match(text, /order by "player_profiles"\."player_id"/)
      assert.deepEqual(parameters, [actor, target])
      return { rows: [[actor], [target]] }
    }
    if (/select "player_id" from "player_profiles"/.test(text)) return { rows: [[target]] }
    return { rows: [] }
  } } as unknown as Client, { schema })
  await new SocialService(database).execute(actor, { type: 'add-friend', publicId: target })
  assert.equal(statements.filter((text) => /for update/i.test(text)).length, 1)
  assert.ok(statements.some((text) => /insert into "friend_requests"/.test(text)))
  assert.ok(statements.includes('commit'))
})

test('character names trim whitespace, retain visible spelling, and accept the specified characters', () => {
  assert.equal(normalizeCharacterName('  Garduru  '), 'Garduru')
  assert.equal(normalizeCharacterName('North_7'), 'North_7')
  assert.equal(normalizeCharacterName('Red-Crown'), 'Red-Crown')
  assert.equal(normalizeCharacterName('Sun Garden'), 'Sun Garden')
  assert.equal(normalizeCharacterName('花園7'), '花園7')
})

test('character names reject empty, invalid, reserved, and out-of-range input', () => {
  for (const name of ['', '  ', 'ab', 'a'.repeat(21), 'Good.Name', 'Admin', 'GROWER']) {
    assert.throws(() => normalizeCharacterName(name), (error: unknown) => error instanceof ApiError && error.status === 400)
  }
  assert.equal(Array.from(normalizeCharacterName('a'.repeat(20))).length, 20)
})

test('social wire projections accept only public profile fields and exact relationship shapes', () => {
  const overview = { projectionVersion: 1 as const, ownProfile: summary, friends: [summary], incomingRequests: [], outgoingRequests: [], blockedPlayers: [] }
  assert.equal(isSocialOverviewV1(overview), true)
  assert.equal(isSocialOverviewV1({ ...overview, ownProfile: { ...summary, playerId: publicId } }), false)
  assert.equal(isPublicPlayerProfileV1({ projectionVersion: 1, profile: summary,
    relationship: { isSelf: false, areFriends: true, request: null, blockedByMe: false, blocksMe: false } }), true)
  assert.equal(isPublicPlayerProfileV1({ projectionVersion: 1, profile: { ...summary, email: 'private@example.invalid' },
    relationship: { isSelf: false, areFriends: false, request: null, blockedByMe: false, blocksMe: false } }), false)
})

test('social commands reject client-supplied self identity and malformed profile identifiers', () => {
  assert.equal(isSocialCommandV1({ type: 'set-display-name', displayName: 'Garduru' }), true)
  assert.equal(isSocialCommandV1({ type: 'set-display-name', displayName: 'Garduru', playerId: publicId }), false)
  assert.equal(isSocialCommandV1({ type: 'add-friend', publicId }), true)
  assert.equal(isSocialCommandV1({ type: 'block-player', publicId: 'not-a-public-id' }), false)
  assert.equal(isSocialCommandV1({ type: 'remove-friend', publicId, extra: true }), false)
})


test('name search is bounded, parameterized, and escapes SQL wildcards before querying', async () => {
  const statements: { text: string; parameters: unknown[] }[] = []
  const database = drizzle({ query: async (config: { text: string }, parameters: unknown[]) => {
    statements.push({ text: config.text, parameters }); return { rows: [] }
  } } as unknown as Client, { schema })
  const service = new SocialService(database)
  assert.deepEqual(await service.search(publicId, '  Sun_%  '), { projectionVersion: 1, results: [] })
  assert.equal(statements.length, 1)
  assert.match(statements[0].text, /ilike \$1/)
  assert.match(statements[0].text, /order by .*display_name.*public_id.*limit \$2/)
  assert.deepEqual(statements[0].parameters, ['%Sun\\_\\%%', 12])
  for (const query of ['', 'a', 'a'.repeat(21)]) await assert.rejects(service.search(publicId, query), (error: unknown) => error instanceof ApiError && error.status === 400)
  assert.equal(statements.length, 1, 'invalid search never reaches database')
})
