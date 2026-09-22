import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { and, count, eq, inArray } from 'drizzle-orm'
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
import { bredSeeds, cloneLines, geneticProfiles, plantSpecimens, playerGrowerState, playerOnboarding, playerSeedStacks } from './schema/index.ts'
import { PlantLifecycleService } from '../gameplay/PlantLifecycleService.ts'
import { initializeStagingGrower } from '../staging/initializeGrower.ts'
import { PostgresPlayerBootstrapRepository } from './repositories/PostgresPlayerBootstrapRepository.ts'
import { PlayerBootstrapService } from '../player/PlayerBootstrapService.ts'
import { createGeneticsLabState } from '../../src/features/lab/labModel.ts'
import { createPropertyState } from '../../src/features/property/propertyModel.ts'
import { createAchievementProgress } from '../../src/features/achievements/achievementsModel.ts'
import { GardenService } from '../gameplay/GardenService.ts'
import { GrowerAlphaService } from '../gameplay/GrowerAlphaService.ts'
import { XP_THRESHOLDS } from '../../src/features/progression/progressionModel.ts'

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

    await database.insert(playerOnboarding).values([firstA.playerId, firstB.playerId].map((playerId) => ({ playerId, profileId: 'grower-alpha-v1' })))
    await database.insert(playerGrowerState).values([firstA.playerId, firstB.playerId].map((playerId) => ({ playerId, achievements: createAchievementProgress(), lab: createGeneticsLabState(), property: createPropertyState(Date.now()) })))

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

    // The two collected San Pedro specimens are durable parents; breeding creates a
    // separate genetic individual and never updates either parent row.
    const parentA = collected.specimen
    const parentB = duplicateCollection[0].specimen
    const parentRowsBefore = await database.select().from(plantSpecimens).where(inArray(plantSpecimens.id, [parentA.specimenId, parentB.specimenId]))
    const gardenService = new GardenService(database)
    const displayCommand = { type: 'assign-display' as const, commandId: crypto.randomUUID(), slotId: 'garden-display-back-left' as const, specimenId: parentA.specimenId }
    const displayed = await gardenService.execute(firstA.playerId, displayCommand)
    assert.equal(displayed.displayAssignments['garden-display-back-left'], parentA.specimenId)
    assert.deepEqual(await gardenService.execute(firstA.playerId, displayCommand), displayed)
    await assert.rejects(gardenService.execute(firstB.playerId, { ...displayCommand, commandId: crypto.randomUUID() }))
    assert.equal((await gardenService.project(firstB.playerId)).displayAssignments['garden-display-back-left'], null)
    const growerService = new GrowerAlphaService(database, () => raceNow)
    const listingCommandId = crypto.randomUUID()
    const listed = await growerService.execute(firstA.playerId, { type: 'list-specimen', commandId: listingCommandId, specimenId: parentA.specimenId, askingPrice: 123 })
    const listing = listed.marketplaceListings.find((entry) => entry.plantId === parentA.specimenId && entry.status === 'active')
    assert.ok(listing)
    assert.deepEqual(await growerService.execute(firstA.playerId, { type: 'list-specimen', commandId: listingCommandId, specimenId: parentA.specimenId, askingPrice: 123 }), listed)
    await assert.rejects(raceOne.breedSpecimens(firstA.playerId, crypto.randomUUID(), { parent1SpecimenId: parentA.specimenId, parent2SpecimenId: parentB.specimenId, expectedParent1Version: parentA.version, expectedParent2Version: parentB.version }))
    await growerService.execute(firstA.playerId, { type: 'cancel-listing', commandId: crypto.randomUUID(), listingId: listing.id })
    const breedCommand = { parent1SpecimenId: parentA.specimenId, parent2SpecimenId: parentB.specimenId, expectedParent1Version: parentA.version, expectedParent2Version: parentB.version }
    const breedKey = crypto.randomUUID()
    const [offspring, duplicateOffspring] = await Promise.all([
      raceOne.breedSpecimens(firstA.playerId, breedKey, breedCommand),
      raceTwo.breedSpecimens(firstA.playerId, breedKey, breedCommand),
    ])
    assert.deepEqual(offspring, duplicateOffspring)
    assert.deepEqual(offspring.seed.parentPlantIds, [parentA.specimenId, parentB.specimenId])
    assert.equal(offspring.seed.cloneLineId === parentA.cloneLineId || offspring.seed.cloneLineId === parentB.cloneLineId, false)
    assert.deepEqual(await database.select().from(plantSpecimens).where(inArray(plantSpecimens.id, [parentA.specimenId, parentB.specimenId])), parentRowsBefore)
    const repeatedOffspring = await raceOne.breedSpecimens(firstA.playerId, crypto.randomUUID(), breedCommand)
    assert.notEqual(repeatedOffspring.seed.seedId, offspring.seed.seedId)
    assert.notEqual(repeatedOffspring.seed.cloneLineId, offspring.seed.cloneLineId)
    assert.deepEqual(await database.select().from(plantSpecimens).where(inArray(plantSpecimens.id, [parentA.specimenId, parentB.specimenId])), parentRowsBefore)
    const persistedSeed = (await lifecycle.getProjectionV2(firstA.playerId)).bredSeeds.find((seed) => seed.seedId === offspring.seed.seedId)
    assert.deepEqual(persistedSeed, offspring.seed)
    const independentProjection = await new PlantLifecycleService(drizzle(concurrentClients[0], { schema }), { environment: 'test' }).getProjectionV2(firstA.playerId)
    assert.deepEqual(independentProjection.bredSeeds.find((seed) => seed.seedId === offspring.seed.seedId), offspring.seed)
    assert.equal((await lifecycle.getProjectionV2(firstB.playerId)).bredSeeds.length, 0)
    assert.equal((await database.select().from(bredSeeds).where(eq(bredSeeds.id, offspring.seed.seedId))).length, 1)
    await assert.rejects(raceOne.breedSpecimens(firstA.playerId, crypto.randomUUID(), { ...breedCommand, parent2SpecimenId: parentA.specimenId }))
    await assert.rejects(raceOne.breedSpecimens(firstB.playerId, crypto.randomUUID(), breedCommand))
    const growingParent = independent[0].slot.occupancy!.specimen
    await assert.rejects(raceOne.breedSpecimens(firstA.playerId, crypto.randomUUID(), { ...breedCommand, parent2SpecimenId: growingParent.specimenId, expectedParent2Version: growingParent.version }))

    const plantBredKey = crypto.randomUUID()
    const bredPlantCommand = { slotId: 'slot-1' as const, seedId: offspring.seed.seedId }
    const [bredPlant, bredPlantReplay] = await Promise.all([
      raceOne.plantBredSeed(firstA.playerId, plantBredKey, bredPlantCommand),
      raceTwo.plantBredSeed(firstA.playerId, plantBredKey, bredPlantCommand),
    ])
    assert.deepEqual(bredPlantReplay, bredPlant)
    assert.equal(bredPlant.slot.occupancy?.specimen.cloneLineId, offspring.seed.cloneLineId)
    assert.deepEqual(bredPlant.slot.occupancy?.specimen.genetics, offspring.seed.genetics)
    assert.deepEqual(bredPlant.slot.occupancy?.specimen.geneticFeatures, offspring.seed.geneticFeatures)
    assert.deepEqual(bredPlant.slot.occupancy?.specimen.specialVariants, offspring.seed.specialVariants)
    assert.deepEqual(bredPlant.slot.occupancy?.specimen.parentPlantIds, offspring.seed.parentPlantIds)
    assert.equal((await lifecycle.getProjectionV2(firstA.playerId)).bredSeeds.some((seed) => seed.seedId === offspring.seed.seedId), false)
    assert.equal((await database.select().from(cloneLines).where(eq(cloneLines.id, offspring.seed.cloneLineId))).length, 1)
    assert.equal((await database.select().from(geneticProfiles).where(eq(geneticProfiles.cloneLineId, offspring.seed.cloneLineId))).length, 1)
    await assert.rejects(raceOne.plantBredSeed(firstA.playerId, crypto.randomUUID(), { ...bredPlantCommand, slotId: 'slot-6' }))
    await assert.rejects(raceOne.plantBredSeed(firstB.playerId, crypto.randomUUID(), { ...bredPlantCommand, slotId: 'slot-2' }))
    raceNow = new Date(bredPlant.slot.occupancy!.readyAt)
    const bredCollected = await raceOne.collectPlant(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-1', specimenId: bredPlant.slot.occupancy!.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 })
    assert.equal(bredCollected.specimen.cloneLineId, offspring.seed.cloneLineId)
    const collectedV2 = (await lifecycle.getProjectionV2(firstA.playerId)).ownedSpecimens.find((specimen) => specimen.specimenId === bredCollected.specimen.specimenId)
    assert.deepEqual(collectedV2?.parentPlantIds, offspring.seed.parentPlantIds)
    assert.deepEqual(collectedV2?.geneticFeatures, offspring.seed.geneticFeatures)
    assert.deepEqual(await database.select().from(plantSpecimens).where(inArray(plantSpecimens.id, [parentA.specimenId, parentB.specimenId])), parentRowsBefore)
    const peyoteGrowing = independent[1].slot.occupancy!
    raceNow = new Date(Math.max(raceNow.getTime(), new Date(peyoteGrowing.readyAt).getTime()))
    const peyoteCollected = await raceOne.collectPlant(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-5', specimenId: peyoteGrowing.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 })
    await assert.rejects(raceOne.breedSpecimens(firstA.playerId, crypto.randomUUID(), { ...breedCommand, parent2SpecimenId: peyoteCollected.specimen.specimenId, expectedParent2Version: peyoteCollected.specimen.version }))
    await database.update(playerSeedStacks).set({ quantity: 1, version: 2 }).where(and(eq(playerSeedStacks.playerId, firstA.playerId), eq(playerSeedStacks.speciesId, 'lophophora-williamsii')))
    const secondPeyote = await raceOne.plantCommoditySeed(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-1', speciesId: 'lophophora-williamsii', expectedSeedStackVersion: 2 })
    raceNow = new Date(secondPeyote.slot.occupancy!.readyAt)
    const secondPeyoteCollected = await raceOne.collectPlant(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-1', specimenId: secondPeyote.slot.occupancy!.specimen.specimenId, expectedOccupancyVersion: 1, expectedSpecimenVersion: 1 })
    const peyoteOffspring = await raceOne.breedSpecimens(firstA.playerId, crypto.randomUUID(), { parent1SpecimenId: peyoteCollected.specimen.specimenId, parent2SpecimenId: secondPeyoteCollected.specimen.specimenId, expectedParent1Version: peyoteCollected.specimen.version, expectedParent2Version: secondPeyoteCollected.specimen.version })
    assert.equal(peyoteOffspring.seed.speciesId, 'lophophora-williamsii')

    const saleCommandId = crypto.randomUUID()
    const beforeSale = await growerService.project(firstA.playerId)
    const sold = await growerService.execute(firstA.playerId, { type: 'sell-specimen-to-npc', commandId: saleCommandId, specimenId: bredCollected.specimen.specimenId })
    assert.ok(sold.player.tokenBalance > beforeSale.player.tokenBalance)
    assert.deepEqual(await growerService.execute(firstA.playerId, { type: 'sell-specimen-to-npc', commandId: saleCommandId, specimenId: bredCollected.specimen.specimenId }), sold)
    assert.equal((await lifecycle.getProjectionV2(firstA.playerId)).ownedSpecimens.some((entry) => entry.specimenId === bredCollected.specimen.specimenId), false)
    assert.equal((await growerService.project(firstB.playerId)).player.tokenBalance, 0)
    assert.ok((await growerService.project(firstA.playerId)).player.skills.cultivationXp > 0)
    assert.ok((await growerService.project(firstA.playerId)).player.skills.breedingXp > 0)

    // Remaining Grower Alpha state uses the same ownership, replay, and account
    // isolation boundaries as the lifecycle. Seed controlled prerequisite values
    // directly so this integration test can exercise the established upgrade and
    // research rules without inventing an economy acquisition path.
    await database.update(playerOnboarding).set({ tokenBalance: 10_000, cultivationXp: XP_THRESHOLDS[9], geneticsXp: XP_THRESHOLDS[49], version: 20 }).where(eq(playerOnboarding.playerId, firstA.playerId))
    const organizedBedsCommand = { type: 'upgrade-property' as const, commandId: crypto.randomUUID(), upgradeId: 'garden-organized-beds' }
    const organizedBeds = await growerService.execute(firstA.playerId, organizedBedsCommand)
    assert.equal(organizedBeds.property.buildings.garden.level, 2)
    assert.deepEqual(await growerService.execute(firstA.playerId, organizedBedsCommand), organizedBeds)
    const favoriteCommand = { type: 'favorite' as const, commandId: crypto.randomUUID(), specimenId: parentA.specimenId, favorite: true }
    const favorite = await gardenService.execute(firstA.playerId, favoriteCommand)
    assert.equal(favorite.organization[parentA.specimenId]?.favorite, true)
    assert.deepEqual(await gardenService.execute(firstA.playerId, favoriteCommand), favorite)
    const tagged = await gardenService.execute(firstA.playerId, { type: 'add-tag', commandId: crypto.randomUUID(), specimenId: parentA.specimenId, tag: 'breeder' })
    assert.deepEqual(tagged.organization[parentA.specimenId]?.tags, ['breeder'])

    const expanded = await growerService.execute(firstA.playerId, { type: 'upgrade-property', commandId: crypto.randomUUID(), upgradeId: 'nursery-expanded-benches' })
    assert.equal(expanded.property.buildings.nursery.level, 2)
    await assert.rejects(raceOne.plantCommoditySeedV3(firstB.playerId, crypto.randomUUID(), { slotId: 'slot-7', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 1 }))
    const [currentStack] = await database.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, firstA.playerId), eq(playerSeedStacks.speciesId, 'echinopsis-pachanoi'))).limit(1)
    await database.update(playerSeedStacks).set({ quantity: 1, version: currentStack.version + 1 }).where(and(eq(playerSeedStacks.playerId, firstA.playerId), eq(playerSeedStacks.speciesId, 'echinopsis-pachanoi')))
    const expandedPlant = await raceOne.plantCommoditySeedV3(firstA.playerId, crypto.randomUUID(), { slotId: 'slot-7', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: currentStack.version + 1 })
    assert.equal(expandedPlant.slot.slotId, 'slot-7')
    const expandedProjection = await raceOne.getProjectionV3(firstA.playerId)
    assert.equal(expandedProjection.nursery.capacity, 8)
    assert.equal(expandedProjection.nursery.slots.length, 8)
    assert.ok(expandedProjection.nursery.slots.find((slot) => slot.slotId === 'slot-7')?.occupancy)

    const farmAccessCommand = { type: 'set-farm-access' as const, commandId: crypto.randomUUID(), preference: 'friends' as const }
    const farmAccess = await growerService.execute(firstA.playerId, farmAccessCommand)
    assert.equal(farmAccess.property.farmAccessPreference, 'friends')
    assert.deepEqual(await growerService.execute(firstA.playerId, farmAccessCommand), farmAccess)
    const observedCommand = { type: 'observe-specimen' as const, commandId: crypto.randomUUID(), specimenId: parentA.specimenId }
    const observed = await growerService.execute(firstA.playerId, observedCommand)
    assert.ok(observed.research.records[parentA.cloneLineId])
    assert.deepEqual(await growerService.execute(firstA.playerId, observedCommand), observed)
    const analyzed = await growerService.execute(firstA.playerId, { type: 'analyze-specimen', commandId: crypto.randomUUID(), specimenId: parentA.specimenId })
    assert.equal(analyzed.research.records[parentA.cloneLineId]?.analysisDepth, 'basic-analysis')

    let labProjection = await growerService.project(firstA.playerId)
    for (const targetTier of [1, 2, 3] as const) {
      labProjection = await growerService.execute(firstA.playerId, { type: 'upgrade-lab', commandId: crypto.randomUUID(), targetTier })
      assert.equal(labProjection.lab.tier, targetTier)
    }
    const sampleCommand = { type: 'collect-tissue-sample' as const, commandId: crypto.randomUUID(), specimenId: parentA.specimenId }
    const sampled = await growerService.execute(firstA.playerId, sampleCommand)
    assert.equal(sampled.lab.tissueSamples.length, 1)
    assert.deepEqual(await growerService.execute(firstA.playerId, sampleCommand), sampled)
    const sample = sampled.lab.tissueSamples[0]!
    const extractionCommand = { type: 'extract-sample' as const, commandId: crypto.randomUUID(), sampleId: sample.id, target: 'vigor' as const }
    const extracted = await growerService.execute(firstA.playerId, extractionCommand)
    assert.equal(extracted.lab.extractionAttemptIds.length, 1)
    assert.deepEqual(await growerService.execute(firstA.playerId, extractionCommand), extracted)
    assert.equal((await growerService.project(firstB.playerId)).research.records[parentA.cloneLineId], undefined)
    assert.equal((await gardenService.project(firstB.playerId)).organization[parentA.specimenId], undefined)

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

    const stagingTester = await resolver.resolve({ provider: 'cloudflare-access', subject: 'verified-test-subject-c' })
    const repeatedStagingTester = await resolver.resolve({ provider: 'cloudflare-access', subject: 'verified-test-subject-c' })
    const otherStagingTester = await resolver.resolve({ provider: 'cloudflare-access', subject: 'verified-test-subject-d' })
    assert.equal(stagingTester.playerId, repeatedStagingTester.playerId)
    assert.notEqual(stagingTester.playerId, otherStagingTester.playerId)
    assert.notEqual(stagingTester.playerId, firstA.playerId)
    await Promise.all([
      initializeStagingGrower(database, stagingTester.playerId),
      initializeStagingGrower(drizzle(concurrentClients[0], { schema }), stagingTester.playerId),
    ])
    const bootstrapService = new PlayerBootstrapService(new PostgresPlayerBootstrapRepository(database))
    const freshBootstrap = await bootstrapService.getGrowerForPlayer(stagingTester.playerId)
    assert.equal(freshBootstrap.projectionVersion, 2)
    assert.equal(freshBootstrap.grower.profileId, 'grower-alpha-v1')
    assert.deepEqual(freshBootstrap.grower.skills, { cultivationXp: 0, breedingXp: 0, geneticsXp: 0 })
    assert.equal(freshBootstrap.grower.tokenBalance, 0)
    assert.ok(freshBootstrap.grower.starterGrantedAt)
    const starterRows = await database.select().from(playerSeedStacks).where(eq(playerSeedStacks.playerId, stagingTester.playerId))
    assert.deepEqual(starterRows.map(({ speciesId, quantity }) => ({ speciesId, quantity })).sort((left, right) => left.speciesId.localeCompare(right.speciesId)), [
      { speciesId: 'echinopsis-pachanoi', quantity: 4 },
      { speciesId: 'lophophora-williamsii', quantity: 2 },
    ])
    await database.update(playerSeedStacks).set({ quantity: 0 }).where(and(eq(playerSeedStacks.playerId, stagingTester.playerId), eq(playerSeedStacks.speciesId, 'echinopsis-pachanoi')))
    await initializeStagingGrower(database, stagingTester.playerId)
    const depleted = await database.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, stagingTester.playerId), eq(playerSeedStacks.speciesId, 'echinopsis-pachanoi')))
    assert.equal(depleted[0]?.quantity, 0)
    assert.equal((await database.select().from(playerSeedStacks).where(eq(playerSeedStacks.playerId, otherStagingTester.playerId))).length, 0)
    await initializeStagingGrower(database, otherStagingTester.playerId)
    assert.notEqual((await bootstrapService.getGrowerForPlayer(otherStagingTester.playerId)).player.playerId, freshBootstrap.player.playerId)
    const existingSpecimens = await database.select().from(plantSpecimens).where(eq(plantSpecimens.ownerPlayerId, firstA.playerId))
    const existingBredSeeds = await database.select().from(bredSeeds).where(eq(bredSeeds.ownerPlayerId, firstA.playerId))
    const existingStacks = await database.select().from(playerSeedStacks).where(eq(playerSeedStacks.playerId, firstA.playerId))
    await initializeStagingGrower(database, firstA.playerId)
    const preservedExisting = await bootstrapService.getGrowerForPlayer(firstA.playerId)
    assert.equal(preservedExisting.grower.starterGrantedAt, null)
    assert.equal((await database.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, firstA.playerId))).length, 1)
    assert.deepEqual(await database.select().from(plantSpecimens).where(eq(plantSpecimens.ownerPlayerId, firstA.playerId)), existingSpecimens)
    assert.deepEqual(await database.select().from(bredSeeds).where(eq(bredSeeds.ownerPlayerId, firstA.playerId)), existingBredSeeds)
    assert.deepEqual(await database.select().from(playerSeedStacks).where(eq(playerSeedStacks.playerId, firstA.playerId)), existingStacks)
    const otherBefore = await lifecycle.getProjectionV2(otherStagingTester.playerId)
    const ownPlanted = await raceOne.plantCommoditySeed(stagingTester.playerId, crypto.randomUUID(), { slotId: 'slot-1', speciesId: 'lophophora-williamsii', expectedSeedStackVersion: 1 })
    assert.equal(ownPlanted.slot.occupancy?.specimen.speciesId, 'lophophora-williamsii')
    await initializeStagingGrower(database, stagingTester.playerId)
    assert.equal((await database.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, stagingTester.playerId), eq(playerSeedStacks.speciesId, 'lophophora-williamsii'))))[0]?.quantity, 1)
    const otherAfter = await lifecycle.getProjectionV2(otherStagingTester.playerId)
    assert.deepEqual(otherAfter.seedStacks, otherBefore.seedStacks)
    assert.deepEqual(otherAfter.nursery, otherBefore.nursery)
    assert.deepEqual(otherAfter.ownedSpecimens, otherBefore.ownedSpecimens)

    const router = createApiRouter()
    const workerEnv = {
      CACTIGROW_ENVIRONMENT: 'development',
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
      await primaryClient.query('drop table if exists bred_seed_treatments, marketplace_listings, player_garden_displays, player_garden_specimens, player_grower_events, player_grower_state, player_onboarding, bred_seeds, gameplay_command_receipts, nursery_occupancies, player_plant_lifecycle_versions, player_seed_stacks, plant_specimens, clone_line_variants, genetic_profiles, clone_lines cascade')
      await primaryClient.query('drop table if exists player_external_identities cascade')
      await primaryClient.query('drop table if exists players cascade')
      await primaryClient.query('drop schema if exists drizzle cascade')
    }
    await primaryClient.end()
  }
})
