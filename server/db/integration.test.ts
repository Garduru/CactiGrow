import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { and, count, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client } from 'pg'
import type { WorkerEnv } from '../env.ts'
import { DEVELOPMENT_IDENTITY_HEADER } from '../identity/DevelopmentIdentityProvider.ts'
import { PostgresPlayerIdentityResolver } from '../identity/PostgresPlayerIdentityResolver.ts'
import { handleApiRequest } from '../api/handler.ts'
import { createApiRouter } from '../api/router.ts'
import type { ApiFailure, ApiSuccess } from '../api/response.ts'
import { PostgresPlayerIdentityRepository } from './repositories/PostgresPlayerIdentityRepository.ts'
import { playerExternalIdentities, players } from './schema/index.ts'
import * as schema from './schema/index.ts'
import { playerSeedStacks } from './schema/index.ts'
import { PlantLifecycleService } from '../gameplay/PlantLifecycleService.ts'

const testDatabaseUrl = process.env.TEST_DATABASE_URL
const databaseTestsEnabled = process.env.CACTIGROW_DATABASE_TESTS === '1'
const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

function databaseErrorCode(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const metadata = current as { code?: unknown; cause?: unknown }
    if (typeof metadata.code === 'string') return metadata.code
    current = metadata.cause
  }
  return undefined
}

function developmentMeRequest(subject?: string) {
  const headers = new Headers()
  if (subject) headers.set(DEVELOPMENT_IDENTITY_HEADER, subject)
  return new Request('http://localhost/api/me', { headers })
}

function developmentBootstrapRequest(subject?: string) {
  const headers = new Headers()
  if (subject) headers.set(DEVELOPMENT_IDENTITY_HEADER, subject)
  return new Request('http://localhost/api/v1/me/bootstrap', { headers })
}

test('PostgreSQL identity integration', {
  skip: !databaseTestsEnabled || !testDatabaseUrl
    ? 'Set CACTIGROW_DATABASE_TESTS=1 and TEST_DATABASE_URL for an isolated test database.'
    : false,
}, async () => {
  assert.ok(testDatabaseUrl)

  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1)).toLowerCase()
  assert.match(databaseName, /test/, 'TEST_DATABASE_URL must name a database containing "test".')

  const primaryClient = new Client({ connectionString: testDatabaseUrl })
  const concurrentClients: Client[] = []
  let ownsIdentitySchema = false

  await primaryClient.connect()

  try {
    const existing = await primaryClient.query<{ players: string | null; identities: string | null }>(
      `select to_regclass('public.players')::text as players,
              to_regclass('public.player_external_identities')::text as identities`,
    )
    assert.deepEqual(existing.rows[0], { players: null, identities: null })
    ownsIdentitySchema = true

    const database = drizzle(primaryClient, { schema })
    await migrate(database, { migrationsFolder })

    const migrated = await primaryClient.query<{ players: string | null; identities: string | null }>(
      `select to_regclass('public.players')::text as players,
              to_regclass('public.player_external_identities')::text as identities`,
    )
    assert.deepEqual(migrated.rows[0], {
      players: 'players',
      identities: 'player_external_identities',
    })

    const repository = new PostgresPlayerIdentityRepository(database)
    const resolver = new PostgresPlayerIdentityResolver(repository)
    const accountA = { provider: 'development', subject: 'account-a' }
    const accountB = { provider: 'development', subject: 'account-b' }

    const firstA = await resolver.resolve(accountA)
    const repeatedA = await resolver.resolve(accountA)
    const firstB = await resolver.resolve(accountB)

    assert.equal(firstA.playerId, repeatedA.playerId)
    assert.notEqual(firstA.playerId, firstB.playerId)

    await database.insert(playerSeedStacks).values({ playerId: firstA.playerId, speciesId: 'echinopsis-pachanoi', quantity: 1, version: 1 })
    let serverNow = new Date('2026-01-01T00:00:00.000Z')
    const ids = ['10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002']
    const lifecycle = new PlantLifecycleService(database, { environment: 'test', now: () => serverNow, createId: () => ids.shift()!, randomUint16: () => 0 })
    const plantKey = '30000000-0000-4000-8000-000000000003'
    const planted = await lifecycle.plantCommoditySeed(firstA.playerId, plantKey, { slotId: 'slot-1', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 1 })
    const replayed = await lifecycle.plantCommoditySeed(firstA.playerId, plantKey, { slotId: 'slot-1', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 1 })
    assert.deepEqual(replayed, planted)
    assert.notEqual(planted.slot.occupancy && planted.slot.occupancy.specimen.specimenId, planted.slot.occupancy && planted.slot.occupancy.specimen.cloneLineId)
    assert.deepEqual(planted.slot.occupancy && planted.slot.occupancy.specimen.specialVariants.map((variant) => variant.variantId), ['shiny'])
    const accountBProjection = await lifecycle.getProjection(firstB.playerId)
    assert.equal(accountBProjection.nursery.slots.every((slot) => slot.occupancy === null), true)
    const occupancy = planted.slot.occupancy
    assert.ok(occupancy)
    await assert.rejects(lifecycle.collectPlant(firstA.playerId, '40000000-0000-4000-8000-000000000004', { slotId: 'slot-1', specimenId: occupancy.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 }), (error: unknown) => error instanceof Error && error.message.includes('not ready'))
    serverNow = new Date(occupancy.readyAt)
    const collected = await lifecycle.collectPlant(firstA.playerId, '50000000-0000-4000-8000-000000000005', { slotId: 'slot-1', specimenId: occupancy.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 })
    assert.equal(collected.specimen.specimenId, occupancy.specimen.specimenId)
    assert.equal(collected.specimen.cloneLineId, occupancy.specimen.cloneLineId)
    assert.equal((await lifecycle.getProjection(firstA.playerId)).ownedSpecimens.length, 1)

    let raceNow = new Date('2026-01-01T01:00:00.000Z')
    const createConcurrentLifecycle = async () => {
      const client = new Client({ connectionString: testDatabaseUrl })
      concurrentClients.push(client)
      await client.connect()
      return new PlantLifecycleService(drizzle(client, { schema }), { environment: 'test', now: () => raceNow })
    }
    const [raceOne, raceTwo] = await Promise.all([createConcurrentLifecycle(), createConcurrentLifecycle()])
    await database.update(playerSeedStacks).set({ quantity: 3, version: 3 }).where(and(eq(playerSeedStacks.playerId, firstA.playerId), eq(playerSeedStacks.speciesId, 'echinopsis-pachanoi')))

    const sameSlotRace = await Promise.allSettled([
      raceOne.plantCommoditySeed(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-2', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 3 }),
      raceTwo.plantCommoditySeed(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-2', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 3 }),
    ])
    assert.equal(sameSlotRace.filter((result) => result.status === 'fulfilled').length, 1)

    const afterSlotRace = await lifecycle.getProjection(firstA.playerId)
    const stackAfterSlotRace = afterSlotRace.seedStacks.find((stack) => stack.speciesId === 'echinopsis-pachanoi')!
    const retryKey = crypto.randomUUID()
    const identicalRetry = await Promise.all([
      raceOne.plantCommoditySeed(firstA.playerId, retryKey, { slotId: 'slot-3', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: stackAfterSlotRace.version }),
      raceTwo.plantCommoditySeed(firstA.playerId, retryKey, { slotId: 'slot-3', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: stackAfterSlotRace.version }),
    ])
    assert.deepEqual(identicalRetry[0], identicalRetry[1])

    await database.insert(playerSeedStacks).values({ playerId: firstA.playerId, speciesId: 'lophophora-williamsii', quantity: 1, version: 1 })
    const afterRetry = await lifecycle.getProjection(firstA.playerId)
    const sanPedroAfterRetry = afterRetry.seedStacks.find((stack) => stack.speciesId === 'echinopsis-pachanoi')!
    const independent = await Promise.all([
      raceOne.plantCommoditySeed(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-4', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: sanPedroAfterRetry.version }),
      raceTwo.plantCommoditySeed(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-5', speciesId: 'lophophora-williamsii', expectedSeedStackVersion: 1 }),
    ])
    assert.equal(independent.length, 2)

    const slotThree = (await lifecycle.getProjection(firstA.playerId)).nursery.slots.find((slot) => slot.slotId === 'slot-3')!
    assert.ok(slotThree.occupancy)
    raceNow = new Date(slotThree.occupancy.readyAt)
    const collectRetryKey = crypto.randomUUID()
    const duplicateCollection = await Promise.all([
      raceOne.collectPlant(firstA.playerId, collectRetryKey, { slotId: 'slot-3', specimenId: slotThree.occupancy.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 }),
      raceTwo.collectPlant(firstA.playerId, collectRetryKey, { slotId: 'slot-3', specimenId: slotThree.occupancy.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 }),
    ])
    assert.deepEqual(duplicateCollection[0], duplicateCollection[1])

    await database.insert(playerSeedStacks).values({ playerId: firstB.playerId, speciesId: 'echinopsis-pachanoi', quantity: 1, version: 1 })
    const sharedAcrossPlayersKey = retryKey
    const accountBPlant = await raceOne.plantCommoditySeed(firstB.playerId, sharedAcrossPlayersKey, { slotId: 'slot-1', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 1 })
    assert.equal(accountBPlant.commandId, sharedAcrossPlayersKey)
    assert.notEqual(accountBPlant.slot.occupancy && accountBPlant.slot.occupancy.specimen.specimenId, identicalRetry[0].slot.occupancy && identicalRetry[0].slot.occupancy.specimen.specimenId)

    const concurrentIdentity = { provider: 'development', subject: 'concurrent-first-login' }
    const concurrentResolvers = await Promise.all(Array.from({ length: 4 }, async () => {
      const client = new Client({ connectionString: testDatabaseUrl })
      concurrentClients.push(client)
      await client.connect()
      return new PostgresPlayerIdentityResolver(
        new PostgresPlayerIdentityRepository(
          drizzle(client, { schema: { players, playerExternalIdentities } }),
        ),
      )
    }))
    const concurrentResults = await Promise.all(
      concurrentResolvers.map((concurrentResolver) => concurrentResolver.resolve(concurrentIdentity)),
    )
    assert.equal(new Set(concurrentResults.map(({ playerId }) => playerId)).size, 1)

    const [concurrentMappingCount] = await database
      .select({ value: count() })
      .from(playerExternalIdentities)
      .where(and(
        eq(playerExternalIdentities.provider, concurrentIdentity.provider),
        eq(playerExternalIdentities.subject, concurrentIdentity.subject),
      ))
    assert.equal(concurrentMappingCount?.value, 1)

    await assert.rejects(
      database.insert(playerExternalIdentities).values({
        playerId: firstB.playerId,
        provider: accountA.provider,
        subject: accountA.subject,
      }),
      (error) => databaseErrorCode(error) === '23505',
    )

    await assert.rejects(
      database.insert(playerExternalIdentities).values({
        playerId: crypto.randomUUID(),
        provider: 'development',
        subject: 'orphaned-identity',
      }),
      (error) => databaseErrorCode(error) === '23503',
    )

    const router = createApiRouter()
    const workerEnv = {
      CACTIGROW_ENVIRONMENT: 'test',
      CACTIGROW_VERSION: 'database-integration-test',
      HYPERDRIVE: { connectionString: testDatabaseUrl } as Hyperdrive,
    } as WorkerEnv

    const firstMeResponse = await handleApiRequest(
      developmentMeRequest('account-a'),
      workerEnv,
      undefined,
      { router, createRequestId: () => 'database-test-request-1' },
    )
    const firstMe = await firstMeResponse.json() as ApiSuccess<{ playerId: string }>
    const repeatedMeResponse = await handleApiRequest(
      developmentMeRequest('account-a'),
      workerEnv,
      undefined,
      { router, createRequestId: () => 'database-test-request-2' },
    )
    const repeatedMe = await repeatedMeResponse.json() as ApiSuccess<{ playerId: string }>

    assert.equal(firstMeResponse.status, 200)
    assert.equal(repeatedMeResponse.status, 200)
    assert.equal(firstMe.data.playerId, firstA.playerId)
    assert.equal(repeatedMe.data.playerId, firstA.playerId)

    const [persistedA] = await database
      .select({ playerId: players.id, createdAt: players.createdAt })
      .from(players)
      .where(eq(players.id, firstA.playerId))
      .limit(1)
    assert.ok(persistedA)

    const desktopBootstrapResponse = await handleApiRequest(
      developmentBootstrapRequest('account-a'),
      workerEnv,
      undefined,
      { router, createRequestId: () => 'desktop-bootstrap-request' },
    )
    const phoneBootstrapResponse = await handleApiRequest(
      developmentBootstrapRequest('account-a'),
      workerEnv,
      undefined,
      { router, createRequestId: () => 'phone-bootstrap-request' },
    )
    const accountBBootstrapResponse = await handleApiRequest(
      developmentBootstrapRequest('account-b'),
      workerEnv,
      undefined,
      { router, createRequestId: () => 'account-b-bootstrap-request' },
    )
    const desktopBootstrap = await desktopBootstrapResponse.json() as ApiSuccess<{
      projectionVersion: 1
      player: { playerId: string; createdAt: string }
    }>
    const phoneBootstrap = await phoneBootstrapResponse.json() as typeof desktopBootstrap
    const accountBBootstrap = await accountBBootstrapResponse.json() as typeof desktopBootstrap

    assert.equal(desktopBootstrapResponse.status, 200)
    assert.equal(phoneBootstrapResponse.status, 200)
    assert.deepEqual(desktopBootstrap.data, phoneBootstrap.data)
    assert.equal(desktopBootstrap.data.player.playerId, persistedA.playerId)
    assert.equal(desktopBootstrap.data.player.createdAt, persistedA.createdAt.toISOString())
    assert.notEqual(desktopBootstrap.meta.requestId, phoneBootstrap.meta.requestId)
    assert.notEqual(
      desktopBootstrap.data.player.playerId,
      accountBBootstrap.data.player.playerId,
    )

    for (const subject of [undefined, 'invalid-account']) {
      const response = await handleApiRequest(
        developmentMeRequest(subject),
        workerEnv,
        undefined,
        { router, createRequestId: () => 'database-test-rejected-request' },
      )
      const body = await response.json() as ApiFailure
      assert.equal(response.status, 401)
      assert.equal(body.error.code, 'UNAUTHENTICATED')
    }
  } finally {
    await Promise.allSettled(concurrentClients.map((client) => client.end()))
    if (ownsIdentitySchema) {
      await primaryClient.query('drop table if exists gameplay_command_receipts, nursery_occupancies, player_plant_lifecycle_versions, player_seed_stacks, plant_specimens, clone_line_variants, genetic_profiles, clone_lines cascade')
      await primaryClient.query('drop table if exists player_external_identities cascade')
      await primaryClient.query('drop table if exists players cascade')
      await primaryClient.query('drop schema if exists drizzle cascade')
    }
    await primaryClient.end()
  }
})
