import { assertSpecimenNotInMail } from './specimenCommerceEligibility.ts'
import { loadStartingState, saveStartingState, TUTORIAL_ORIGIN } from '../starting/startingState.ts'
import { retiredTutorialMaterial } from '../starting/StartingResetService.ts'
import { and, isNull, eq, inArray, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { bredSeeds, bredSeedTreatments, cloneLines, cloneLineVariants, gameplayCommandReceipts, geneticProfiles, marketplaceListings, mailMessages, nurseryOccupancies, plantSpecimens, playerGrowerEvents, playerGrowerState, playerOnboarding, playerPlantLifecycleVersions, playerSeedStacks } from '../db/schema/index.ts'
import { NURSERY_SLOT_IDS, PLANT_LIFECYCLE_PROJECTION_VERSION, type CollectPlantCommandV1, type CollectPlantResultV1, type NurserySlotV1, type PlantCommoditySeedCommandV1, type PlantCommoditySeedResultV1, type PlantLifecycleProjectionV1, type PlantSpecimenV1 } from '../../shared/api/plantLifecycleV1.ts'
import { ApiError } from '../api/errors.ts'
import { ALPHA_GROWTH, shortenLegacyGrowth, GENETIC_ESTABLISHMENT_RULE_VERSION, GENETIC_REPRESENTATION_VERSION, VISUAL_DERIVATION_VERSION, establishCommoditySeedGenetics, resolvePlantGrowth, rollShiny, secureUint16, type SecureUint16 } from './plantLifecycleRules.ts'
import { createBredSeed } from '../../src/features/breeding/breedingModel.ts'
import { getSpeciesById } from '../../src/data/species.ts'
import type { Plant } from '../../src/types/plant.ts'
import type { BredSeedV2, BreedSpecimensCommandV2, BreedSpecimensResultV2, PlantBredSeedCommandV2, PlantBredSeedResultV2, PlantLifecycleProjectionV2, PlantSpecimenV2, NurserySlotV2 } from '../../shared/api/plantLifecycleV2.ts'
import { createAchievementProgress, evaluateAchievements, type ProgressionEventCounts } from '../../src/features/achievements/achievementsModel.ts'
import { discoverSpecies, getDiscoveredSpeciesCount, recordShinyDiscovery } from '../../src/features/journal/journalModel.ts'
import { resolveQuantitativeTreatment, MEANINGFUL_TREATMENT_GAIN } from '../../src/features/lab/treatmentModel.ts'
import { recordTreatmentMilestones } from '../../src/features/research/researchModel.ts'
import { NURSERY_SLOT_IDS_V3, type CollectPlantCommandV3, type CollectPlantResultV3, type NurserySlotV3, type PlantBredSeedCommandV3, type PlantBredSeedResultV3, type PlantCommoditySeedCommandV3, type PlantCommoditySeedResultV3, type PlantLifecycleProjectionV3 } from '../../shared/api/plantLifecycleV3.ts'
import { wildGeneticSeeds } from '../db/schema/index.ts'
import { projectWildLots, supportsWildGenetics, wildSeedTruth } from './wildSeedRepository.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
type Clock = () => Date
type IdFactory = () => string
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface PlantLifecycleServiceOptions { environment: string; now?: Clock; createId?: IdFactory; randomUint16?: SecureUint16 }
export interface PlantLifecycleApplication {
  getProjection(playerId: string): Promise<PlantLifecycleProjectionV1>
  getProjectionV2(playerId: string): Promise<PlantLifecycleProjectionV2>
  getProjectionV3(playerId: string): Promise<PlantLifecycleProjectionV3>
  plantCommoditySeed(playerId: string, idempotencyKey: string, command: PlantCommoditySeedCommandV1): Promise<PlantCommoditySeedResultV1>
  collectPlant(playerId: string, idempotencyKey: string, command: CollectPlantCommandV1): Promise<CollectPlantResultV1>
  breedSpecimens(playerId: string, idempotencyKey: string, command: BreedSpecimensCommandV2): Promise<BreedSpecimensResultV2>
  plantBredSeed(playerId: string, idempotencyKey: string, command: PlantBredSeedCommandV2): Promise<PlantBredSeedResultV2>
  plantCommoditySeedV3(playerId: string, idempotencyKey: string, command: PlantCommoditySeedCommandV3): Promise<PlantCommoditySeedResultV3>
  collectPlantV3(playerId: string, idempotencyKey: string, command: CollectPlantCommandV3): Promise<CollectPlantResultV3>
  plantBredSeedV3(playerId: string, idempotencyKey: string, command: PlantBredSeedCommandV3): Promise<PlantBredSeedResultV3>
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
  return JSON.stringify(value)
}
function fingerprint(commandType: string, command: object): string { return `${commandType}:${canonicalJson(command)}` }
function lifecycleVersion(value: number | bigint): string { return String(value) }
function safeConflict(code: ConstructorParameters<typeof ApiError>[0], message: string) { return new ApiError(code, 409, message) }
function databaseErrorCode(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const details = current as { code?: unknown; cause?: unknown }
    if (typeof details.code === 'string') return details.code
    current = details.cause
  }
  return undefined
}

export class PlantLifecycleService implements PlantLifecycleApplication {
  private readonly database: CactiGrowDatabase
  private readonly options: PlantLifecycleServiceOptions
  private readonly now: Clock
  private readonly createId: IdFactory
  private readonly randomUint16: SecureUint16
  constructor(database: CactiGrowDatabase, options: PlantLifecycleServiceOptions) {
    this.database = database
    this.options = options
    this.now = options.now ?? (() => new Date())
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.randomUint16 = options.randomUint16 ?? secureUint16
  }

  // Lazy, owner-scoped data upgrade: existing production rule 2 only. The
  // original planting time, specimen, genetics and already faster dates survive.
  private async upgradeAlphaSchedules(playerId: string): Promise<void> {
    if (this.options.environment !== 'production') return
    await this.database.transaction(async tx => {
      const candidates = await tx.select({ occupancy: nurseryOccupancies, speciesId: cloneLines.speciesId })
        .from(nurseryOccupancies)
        .innerJoin(plantSpecimens, and(eq(plantSpecimens.id, nurseryOccupancies.specimenId), eq(plantSpecimens.ownerPlayerId, playerId)))
        .innerJoin(cloneLines, eq(cloneLines.id, plantSpecimens.cloneLineId))
        .where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.growthRuleVersion, 2)))
        .orderBy(nurseryOccupancies.slotId).for('update', { of: nurseryOccupancies })
      if (!candidates.length) return
      const updatedAt = this.now()
      for (const { occupancy, speciesId } of candidates) {
        await tx.update(nurseryOccupancies).set({
          readyAt: shortenLegacyGrowth(occupancy.plantedAt, occupancy.readyAt, speciesId),
          growthRuleVersion: ALPHA_GROWTH.version, version: occupancy.version + 1, updatedAt,
        }).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.slotId, occupancy.slotId)))
      }
      await this.incrementVersion(tx, playerId, updatedAt)
    })
  }

  async getProjection(playerId: string, retired?: { retiredSpecimenIds: string[]; retiredSeedIds: string[] }): Promise<PlantLifecycleProjectionV1> {
    await this.upgradeAlphaSchedules(playerId)
    retired ??= ['staging', 'production', 'development', 'test'].includes(this.options.environment ?? '') ? await retiredTutorialMaterial(this.database, playerId) : { retiredSpecimenIds: [], retiredSeedIds: [] }
    const stacks = await this.database.select().from(playerSeedStacks).where(eq(playerSeedStacks.playerId, playerId))
    const occupancies = await this.database.select().from(nurseryOccupancies).where(eq(nurseryOccupancies.playerId, playerId))
    const reserved = await this.database.select({ id: mailMessages.specimenId }).from(mailMessages).where(and(eq(mailMessages.senderPlayerId, playerId), isNull(mailMessages.claimedAt)))
    const reservedIds = new Set(reserved.map(row => row.id))
    const specimens = (await this.database.select().from(plantSpecimens).where(eq(plantSpecimens.ownerPlayerId, playerId))).filter(row => !reservedIds.has(row.id) && !retired.retiredSpecimenIds.includes(row.id))
    const versionRows = await this.database.select().from(playerPlantLifecycleVersions).where(eq(playerPlantLifecycleVersions.playerId, playerId)).limit(1)
    const cloneIdList = [...new Set(specimens.map((specimen) => specimen.cloneLineId))]
    const lines = cloneIdList.length ? await this.database.select().from(cloneLines).where(inArray(cloneLines.id, cloneIdList)) : []
    const profiles = cloneIdList.length ? await this.database.select().from(geneticProfiles).where(inArray(geneticProfiles.cloneLineId, cloneIdList)) : []
    const variants = cloneIdList.length ? await this.database.select().from(cloneLineVariants).where(inArray(cloneLineVariants.cloneLineId, cloneIdList)) : []
    const cloneIds = new Set(cloneIdList)
    const lineById = new Map(lines.map((line) => [line.id, line]))
    const profileById = new Map(profiles.map((profile) => [profile.cloneLineId, profile]))
    const variantsById = new Map<string, typeof variants>()
    for (const variant of variants) if (cloneIds.has(variant.cloneLineId)) variantsById.set(variant.cloneLineId, [...(variantsById.get(variant.cloneLineId) ?? []), variant])
    const activeSpecimens = specimens.filter((specimen) => specimen.lifecycleStatus === 'growing' || specimen.lifecycleStatus === 'owned')
    const specimenById = new Map(activeSpecimens.map((specimen) => [specimen.id, this.projectSpecimen(specimen, lineById.get(specimen.cloneLineId), profileById.get(specimen.cloneLineId), variantsById.get(specimen.cloneLineId) ?? [])]))
    const occupancyBySlot = new Map(occupancies.map((occupancy) => [occupancy.slotId, occupancy]))
    return { projectionVersion: PLANT_LIFECYCLE_PROJECTION_VERSION, lifecycleVersion: lifecycleVersion(versionRows[0]?.version ?? 0), generatedAt: this.now().toISOString(), seedStacks: stacks.map((stack) => ({ speciesId: stack.speciesId, quantity: stack.quantity, version: stack.version })), nursery: { slots: NURSERY_SLOT_IDS.map((slotId): NurserySlotV1 => { const occupancy = occupancyBySlot.get(slotId); if (!occupancy) return { slotId, occupancy: null }; const specimen = specimenById.get(occupancy.specimenId); if (!specimen) throw new Error('Nursery occupancy references an unavailable specimen.'); return { slotId, occupancy: { specimen, plantedAt: occupancy.plantedAt.toISOString(), readyAt: occupancy.readyAt.toISOString(), growthRuleVersion: occupancy.growthRuleVersion, version: occupancy.version } } }) }, ownedSpecimens: specimens.filter((specimen) => specimen.lifecycleStatus === 'owned').map((specimen) => specimenById.get(specimen.id)!) }
  }

  async getProjectionV2(playerId: string): Promise<PlantLifecycleProjectionV2> {
    const retired = ['staging', 'production', 'development', 'test'].includes(this.options.environment ?? '') ? await retiredTutorialMaterial(this.database, playerId) : { retiredSpecimenIds: [], retiredSeedIds: [] }
    const base = await this.getProjection(playerId, retired)
    const seeds = (await this.database.select().from(bredSeeds).where(eq(bredSeeds.ownerPlayerId, playerId))).filter(seed => !retired.retiredSeedIds.includes(seed.id))
    const cloneIds = seeds.map((seed) => seed.cloneLineId)
    const profiles = cloneIds.length ? await this.database.select().from(geneticProfiles).where(inArray(geneticProfiles.cloneLineId, cloneIds)) : []
    const variants = cloneIds.length ? await this.database.select().from(cloneLineVariants).where(inArray(cloneLineVariants.cloneLineId, cloneIds)) : []
    const profileByClone = new Map(profiles.map((profile) => [profile.cloneLineId, profile]))
    // A purchased specimen retains its original bred-seed provenance, regardless of seed owner.
    const specimenCloneIds = [...new Set([...base.ownedSpecimens.map((plant) => plant.cloneLineId), ...base.nursery.slots.flatMap((slot) => slot.occupancy ? [slot.occupancy.specimen.cloneLineId] : [])])]
    const lineage = specimenCloneIds.length ? await this.database.select().from(bredSeeds).where(inArray(bredSeeds.cloneLineId, specimenCloneIds)) : []
    const lineageByClone = new Map(lineage.map((seed) => [seed.cloneLineId, seed]))
    const wild = await wildSeedTruth(this.database, specimenCloneIds, supportsWildGenetics(this.options.environment))
    const enrich = (specimen: PlantSpecimenV1): PlantSpecimenV2 => {
      const lineage = lineageByClone.get(specimen.cloneLineId)
      const wildSeed = wild.find(s => s.cloneLineId === specimen.cloneLineId)
      return { ...specimen, geneticFeatures: lineage?.geneticFeatures ?? wildSeed?.geneticFeatures ?? [], parentPlantIds: lineage ? [lineage.parent1SpecimenId, lineage.parent2SpecimenId] : null, parentSpeciesIds: lineage ? [lineage.parent1SpeciesId, lineage.parent2SpeciesId] : null, isHybrid: lineage?.isHybrid ?? false, sourceBredSeedId: lineage?.id ?? null, ...(wildSeed ? { wildOrigin: wildSeed.provenance } : {}) }
    }
    const slots: NurserySlotV2[] = base.nursery.slots.map((slot) => slot.occupancy ? { slotId: slot.slotId, occupancy: { ...slot.occupancy, specimen: enrich(slot.occupancy.specimen) } } : { slotId: slot.slotId, occupancy: null })
    return { ...base, projectionVersion: 2, nursery: { slots }, ownedSpecimens: base.ownedSpecimens.map(enrich), bredSeeds: seeds.filter((seed) => seed.status === 'available').map((seed) => this.projectBredSeed(seed, profileByClone.get(seed.cloneLineId), variants.filter((variant) => variant.cloneLineId === seed.cloneLineId))) }
  }

  async getProjectionV3(playerId: string): Promise<PlantLifecycleProjectionV3> {
    const base = await this.getProjectionV2(playerId)
    const [[grower], extraOccupancies] = await Promise.all([
      this.database.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).limit(1),
      this.database.select().from(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, playerId), inArray(nurseryOccupancies.slotId, ['slot-7', 'slot-8']))),
    ])
    if (!grower) throw new Error('The Grower state is not initialized.')
    const capacity: 6 | 8 = grower.property.buildings.nursery.level >= 2 ? 8 : 6
    const extraSpecimenIds = extraOccupancies.map((occupancy) => occupancy.specimenId)
    const extraSpecimens = extraSpecimenIds.length ? await this.database.select().from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, playerId), inArray(plantSpecimens.id, extraSpecimenIds))) : []
    const cloneIds = [...new Set(extraSpecimens.map((specimen) => specimen.cloneLineId))]
    const [lines, profiles, variants, lineage] = await Promise.all([
      cloneIds.length ? this.database.select().from(cloneLines).where(inArray(cloneLines.id, cloneIds)) : [],
      cloneIds.length ? this.database.select().from(geneticProfiles).where(inArray(geneticProfiles.cloneLineId, cloneIds)) : [],
      cloneIds.length ? this.database.select().from(cloneLineVariants).where(inArray(cloneLineVariants.cloneLineId, cloneIds)) : [],
      cloneIds.length ? this.database.select().from(bredSeeds).where(inArray(bredSeeds.cloneLineId, cloneIds)) : [],
    ])
    const extraBySlot = new Map(extraOccupancies.map((occupancy) => [occupancy.slotId, occupancy]))
    const wild = await wildSeedTruth(this.database, cloneIds, supportsWildGenetics(this.options.environment))
    const specimenById = new Map(extraSpecimens.map((specimen) => [specimen.id, specimen]))
    const slots: NurserySlotV3[] = NURSERY_SLOT_IDS_V3.map((slotId) => {
      const existing = base.nursery.slots.find((slot) => slot.slotId === slotId)
      if (existing) return existing as NurserySlotV3
      const occupancy = extraBySlot.get(slotId)
      if (!occupancy) return { slotId, occupancy: null }
      const specimenRow = specimenById.get(occupancy.specimenId)
      if (!specimenRow) throw new Error('Nursery occupancy references an unavailable specimen.')
      const line = lines.find((entry) => entry.id === specimenRow.cloneLineId)
      const profile = profiles.find((entry) => entry.cloneLineId === specimenRow.cloneLineId)
      const seed = lineage.find((entry) => entry.cloneLineId === specimenRow.cloneLineId)
      const projected = this.projectSpecimen(specimenRow, line, profile, variants.filter((entry) => entry.cloneLineId === specimenRow.cloneLineId))
      const wildSeed = wild.find(s => s.cloneLineId === specimenRow.cloneLineId)
      const specimen: PlantSpecimenV2 = { ...projected, geneticFeatures: seed?.geneticFeatures ?? wildSeed?.geneticFeatures ?? [], parentPlantIds: seed ? [seed.parent1SpecimenId, seed.parent2SpecimenId] : null, parentSpeciesIds: seed ? [seed.parent1SpeciesId, seed.parent2SpeciesId] : null, isHybrid: seed?.isHybrid ?? false, sourceBredSeedId: seed?.id ?? null, ...(wildSeed ? { wildOrigin: wildSeed.provenance } : {}) }
      return { slotId, occupancy: { specimen, plantedAt: occupancy.plantedAt.toISOString(), readyAt: occupancy.readyAt.toISOString(), growthRuleVersion: occupancy.growthRuleVersion, version: occupancy.version } }
    })
    return { ...base, projectionVersion: 3, nursery: { capacity, slots }, ...(supportsWildGenetics(this.options.environment) ? { wildSeedLots: await projectWildLots(this.database, playerId) } : {}) }
  }

  async plantCommoditySeedV3(playerId: string, idempotencyKey: string, command: PlantCommoditySeedCommandV3): Promise<PlantCommoditySeedResultV3> {
    await this.assertNurserySlotAvailable(playerId, command.slotId)
    const result = await this.plantCommoditySeed(playerId, idempotencyKey, command as PlantCommoditySeedCommandV1)
    const slot = (await this.getProjectionV3(playerId)).nursery.slots.find((entry) => entry.slotId === command.slotId)
    if (!slot) throw new Error('The planted Nursery position could not be projected.')
    return { commandId: result.commandId, lifecycleVersion: result.lifecycleVersion, seedStack: result.seedStack, slot }
  }

  async plantBredSeedV3(playerId: string, idempotencyKey: string, command: PlantBredSeedCommandV3): Promise<PlantBredSeedResultV3> {
    await this.assertNurserySlotAvailable(playerId, command.slotId)
    const result = await this.plantBredSeed(playerId, idempotencyKey, command as PlantBredSeedCommandV2)
    return { ...result, slot: result.slot as NurserySlotV3 }
  }

  async collectPlantV3(playerId: string, idempotencyKey: string, command: CollectPlantCommandV3): Promise<CollectPlantResultV3> {
    await this.assertNurserySlotAvailable(playerId, command.slotId)
    const result = await this.collectPlant(playerId, idempotencyKey, command as CollectPlantCommandV1)
    const specimen = (await this.getProjectionV3(playerId)).ownedSpecimens.find((entry) => entry.specimenId === command.specimenId)
    if (!specimen) throw new Error('The collected specimen could not be projected.')
    return { commandId: result.commandId, lifecycleVersion: result.lifecycleVersion, slot: { slotId: command.slotId, occupancy: null }, specimen }
  }

  private async assertNurserySlotAvailable(playerId: string, slotId: string): Promise<void> {
    const [state] = await this.database.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).limit(1)
    if (!state) throw new Error('The Grower state is not initialized.')
    const capacity = state.property.buildings.nursery.level >= 2 ? 8 : 6
    if (NURSERY_SLOT_IDS_V3.indexOf(slotId as typeof NURSERY_SLOT_IDS_V3[number]) >= capacity) throw new ApiError('INVALID_NURSERY_SLOT', 400, 'That Nursery position is not unlocked.')
  }

  private projectBredSeed(seed: typeof bredSeeds.$inferSelect, profile: typeof geneticProfiles.$inferSelect | undefined, variants: Array<typeof cloneLineVariants.$inferSelect>): BredSeedV2 {
    if (!profile) throw new Error('A bred seed has no genetic profile.')
    return { seedId: seed.id, cloneLineId: seed.cloneLineId, speciesId: seed.parent1SpeciesId, parentPlantIds: [seed.parent1SpecimenId, seed.parent2SpecimenId], parentSpeciesIds: [seed.parent1SpeciesId, seed.parent2SpeciesId], isHybrid: seed.isHybrid, createdAt: seed.createdAt.toISOString(), genetics: { vigor: profile.vigor, growthSpeed: profile.growthSpeed, size: profile.size, flowering: profile.flowering, mutationChance: profile.mutationChance }, geneticFeatures: seed.geneticFeatures, specialVariants: variants.filter((variant) => variant.variantId === 'shiny').map((variant) => ({ variantId: 'shiny', origin: 'random', establishedAt: variant.establishedAt.toISOString() })) }
  }

  async breedSpecimens(playerId: string, idempotencyKey: string, command: BreedSpecimensCommandV2): Promise<BreedSpecimensResultV2> {
    return this.runIdempotent(playerId, idempotencyKey, 'breed-specimens-v2', command, async (tx) => {
      if (command.parent1SpecimenId === command.parent2SpecimenId) throw new ApiError('INVALID_COMMAND', 400, 'Choose two different parent specimens.')
      const parents = await tx.select().from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, playerId), inArray(plantSpecimens.id, [command.parent1SpecimenId, command.parent2SpecimenId]))).orderBy(plantSpecimens.id).for('update')
      if (parents.length !== 2) throw new ApiError('SPECIMEN_NOT_FOUND', 404, 'Both parent specimens must be owned by the player.')
      const first = parents.find((parent) => parent.id === command.parent1SpecimenId)!
      const second = parents.find((parent) => parent.id === command.parent2SpecimenId)!
      if (first.version !== command.expectedParent1Version || second.version !== command.expectedParent2Version) throw safeConflict('STALE_VERSION', 'A parent specimen changed. Refresh and try again.')
      await assertSpecimenNotInMail(tx, first.id)
      await assertSpecimenNotInMail(tx, second.id)
      if (first.lifecycleStatus !== 'owned' || second.lifecycleStatus !== 'owned' || !first.collectedAt || !second.collectedAt) throw safeConflict('PLANT_NOT_READY', 'Both parents must be mature and collected.')
      const activeListings = await tx.select({ specimenId: marketplaceListings.specimenId }).from(marketplaceListings).where(and(inArray(marketplaceListings.specimenId, [first.id, second.id]), eq(marketplaceListings.status, 'active')))
      if (activeListings.length) throw safeConflict('CONFLICT', 'Listed specimens cannot breed.')
      const lines = await tx.select().from(cloneLines).where(inArray(cloneLines.id, [first.cloneLineId, second.cloneLineId]))
      const tutorialParents = lines.filter(line => line.originType === TUTORIAL_ORIGIN)
      if (tutorialParents.length) {
        const [owner] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1)
        if (!owner) throw safeConflict('CONFLICT', 'Tutorial onboarding is unavailable.')
        const tutorial = await loadStartingState(tx, playerId, owner.profileId)
        if (tutorial.farmStage !== 'breeding' || tutorialParents.length !== 2 || tutorial.tutorialParentIds[0] !== first.id || tutorial.tutorialParentIds[1] !== second.id) throw safeConflict('CONFLICT', 'Choose the two guided tutorial parents in the shown order.')
        const [previous] = await tx.select({ id: bredSeeds.id }).from(bredSeeds).where(and(eq(bredSeeds.ownerPlayerId, playerId), eq(bredSeeds.parent1SpecimenId, first.id), eq(bredSeeds.parent2SpecimenId, second.id))).limit(1)
        if (previous) throw safeConflict('CONFLICT', 'Tutorial breeding has already produced its one practice seed.')
      }
      const profiles = await tx.select().from(geneticProfiles).where(inArray(geneticProfiles.cloneLineId, [first.cloneLineId, second.cloneLineId]))
      const previousSeeds = await tx.select().from(bredSeeds).where(inArray(bredSeeds.cloneLineId, [first.cloneLineId, second.cloneLineId]))
      const wildParents = await wildSeedTruth(tx, [first.cloneLineId, second.cloneLineId], supportsWildGenetics(this.options.environment))
      const variants = await tx.select().from(cloneLineVariants).where(inArray(cloneLineVariants.cloneLineId, [first.cloneLineId, second.cloneLineId]))
      const toParent = (specimen: typeof first): Plant => {
        const line = lines.find((entry) => entry.id === specimen.cloneLineId)
        const profile = profiles.find((entry) => entry.cloneLineId === specimen.cloneLineId)
        if (!line || !profile) throw new Error('A parent specimen has incomplete genetic identity.')
        const previous = previousSeeds.find((entry) => entry.cloneLineId === specimen.cloneLineId) ?? wildParents.find(entry => entry.cloneLineId === specimen.cloneLineId)
        return { id: specimen.id, ownerId: playerId, speciesId: line.speciesId, cloneLineId: line.id, stage: 'mature', plantedAt: specimen.plantedAt.toISOString(), lastUpdatedAt: specimen.updatedAt.toISOString(), genetics: { vigor: profile.vigor, growthSpeed: profile.growthSpeed, size: profile.size, flowering: profile.flowering, mutationChance: profile.mutationChance }, geneticFeatures: previous?.geneticFeatures ?? [], specialVariants: variants.filter((entry) => entry.cloneLineId === line.id && entry.variantId === 'shiny').map((entry) => ({ variantId: 'shiny', origin: 'random', establishedAt: entry.establishedAt.toISOString() })), isHarvestable: false, isListedForSale: false }
      }
      const firstParent = toParent(first); const secondParent = toParent(second)
      const createdAt = this.now()
      const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
      const offspring = createBredSeed(firstParent, secondParent, createdAt.getTime(), random, this.createId, this.createId)
      if (!offspring) throw safeConflict('INVALID_COMMAND', 'The selected parents are not eligible or genus-compatible.')
      if (!getSpeciesById(firstParent.speciesId) || !getSpeciesById(secondParent.speciesId)) throw new ApiError('UNKNOWN_SPECIES', 400, 'The parent species are unavailable.')
      await tx.insert(cloneLines).values({ id: offspring.cloneLineId, speciesId: offspring.speciesId, originType: tutorialParents.length ? TUTORIAL_ORIGIN : 'bred-seed', originPlayerId: playerId, establishedAt: createdAt, geneticRepresentationVersion: GENETIC_REPRESENTATION_VERSION, visualDerivationVersion: VISUAL_DERIVATION_VERSION, createdAt })
      await tx.insert(geneticProfiles).values({ cloneLineId: offspring.cloneLineId, ...offspring.genetics, establishmentRuleVersion: GENETIC_ESTABLISHMENT_RULE_VERSION, createdAt })
      for (const variant of offspring.specialVariants) await tx.insert(cloneLineVariants).values({ cloneLineId: offspring.cloneLineId, variantId: variant.variantId, origin: variant.origin, establishedAt: createdAt })
      await tx.insert(bredSeeds).values({ id: offspring.id, ownerPlayerId: playerId, cloneLineId: offspring.cloneLineId, parent1SpecimenId: first.id, parent2SpecimenId: second.id, parent1SpeciesId: firstParent.speciesId, parent2SpeciesId: secondParent.speciesId, isHybrid: offspring.isHybrid, geneticFeatures: offspring.geneticFeatures, status: 'available', createdAt })
      const version = await this.incrementVersion(tx, playerId, createdAt)
      await this.awardXp(tx, playerId, 'breeding', 40)
      await this.recordProgress(tx, playerId, idempotencyKey, 'breedPlant', firstParent.speciesId, offspring.cloneLineId, offspring.specialVariants.some((variant) => variant.variantId === 'shiny'), createdAt)
      return { commandId: idempotencyKey, lifecycleVersion: lifecycleVersion(version), seed: { seedId: offspring.id, cloneLineId: offspring.cloneLineId, speciesId: offspring.speciesId, parentPlantIds: offspring.parentPlantIds, parentSpeciesIds: offspring.parentSpeciesIds, isHybrid: offspring.isHybrid, createdAt: offspring.createdAt, genetics: offspring.genetics, geneticFeatures: offspring.geneticFeatures, specialVariants: offspring.specialVariants.map((variant) => { if (variant.origin !== 'random') throw new Error('The offspring has an unsupported special-variant origin.'); return { variantId: variant.variantId, origin: variant.origin, establishedAt: variant.establishedAt } }) } }
    })
  }

  async plantWildSeedV3(playerId: string, idempotencyKey: string, command: PlantBredSeedCommandV3): Promise<PlantBredSeedResultV3> {
    if (!supportsWildGenetics(this.options.environment)) throw ApiError.notFound()
    await this.assertNurserySlotAvailable(playerId, command.slotId)
    return this.runIdempotent(playerId, idempotencyKey, 'plant-wild-seed-v1', command, async tx => {
      const [seed] = await tx.select().from(wildGeneticSeeds).where(and(eq(wildGeneticSeeds.ownerPlayerId, playerId), eq(wildGeneticSeeds.id, command.seedId))).for('update').limit(1)
      if (!seed) throw ApiError.notFound('This wild genetic seed is not owned.')
      if (seed.status !== 'available') throw safeConflict('SEED_UNAVAILABLE', 'That wild genetic seed has already been planted.')
      const [occupied] = await tx.select().from(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.slotId, command.slotId))).limit(1)
      if (occupied) throw safeConflict('SLOT_OCCUPIED', 'That Nursery position is already occupied.')
      const [line] = await tx.select().from(cloneLines).where(eq(cloneLines.id, seed.cloneLineId)).limit(1)
      const [profile] = await tx.select().from(geneticProfiles).where(eq(geneticProfiles.cloneLineId, seed.cloneLineId)).limit(1)
      const variants = await tx.select().from(cloneLineVariants).where(eq(cloneLineVariants.cloneLineId, seed.cloneLineId))
      if (!line || !profile || line.originType !== 'wild-genetic-seed') throw new Error('Wild seed genetic identity is incomplete.')
      const plantedAt = this.now(), specimenId = this.createId(), { readyAt, growthRuleVersion } = resolvePlantGrowth(plantedAt, this.options.environment, line.speciesId)
      if (!UUID.test(specimenId) || specimenId === seed.id || specimenId === seed.cloneLineId) throw new Error('Invalid specimen identity.')
      const row = { id: specimenId, ownerPlayerId: playerId, cloneLineId: seed.cloneLineId, sourceType: 'wild-genetic-seed', lifecycleStatus: 'growing', plantedAt, collectedAt: null, visualDerivationVersion: line.visualDerivationVersion, version: 1, createdAt: plantedAt, updatedAt: plantedAt }
      await tx.insert(plantSpecimens).values(row)
      await tx.insert(nurseryOccupancies).values({ playerId, slotId: command.slotId, specimenId, plantedAt, readyAt, growthRuleVersion, version: 1, createdAt: plantedAt, updatedAt: plantedAt })
      await tx.update(wildGeneticSeeds).set({ status: 'planted', plantedAt, plantedSpecimenId: specimenId }).where(eq(wildGeneticSeeds.id, seed.id))
      const version = await this.incrementVersion(tx, playerId, plantedAt)
      await this.awardXp(tx, playerId, 'cultivation', 15)
      await this.recordProgress(tx, playerId, idempotencyKey, 'plantBredSeed', line.speciesId, seed.cloneLineId, variants.some(v => v.variantId === 'shiny'), plantedAt)
      const specimen: PlantSpecimenV2 = { ...this.projectSpecimen(row, line, profile, variants), geneticFeatures: seed.geneticFeatures, parentPlantIds: null, parentSpeciesIds: null, isHybrid: false, sourceBredSeedId: null, wildOrigin: seed.provenance }
      return { commandId: idempotencyKey, lifecycleVersion: lifecycleVersion(version), seedId: seed.id, slot: { slotId: command.slotId, occupancy: { specimen, plantedAt: plantedAt.toISOString(), readyAt: readyAt.toISOString(), growthRuleVersion, version: 1 } } }
    })
  }

  async plantBredSeed(playerId: string, idempotencyKey: string, command: PlantBredSeedCommandV2): Promise<PlantBredSeedResultV2> {
    return this.runIdempotent(playerId, idempotencyKey, 'plant-bred-seed-v2', command, async (tx) => {
      const [seed] = await tx.select().from(bredSeeds).where(and(eq(bredSeeds.ownerPlayerId, playerId), eq(bredSeeds.id, command.seedId))).for('update').limit(1)
      if (!seed) throw new ApiError('SEED_STACK_NOT_FOUND', 404, 'The bred seed was not found.')
      if (seed.status !== 'available') throw safeConflict('SEED_UNAVAILABLE', 'That bred seed has already been planted.')
      const [occupied] = await tx.select({ specimenId: nurseryOccupancies.specimenId }).from(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.slotId, command.slotId))).limit(1)
      if (occupied) throw safeConflict('SLOT_OCCUPIED', 'That Nursery position is already occupied.')
      const [line] = await tx.select().from(cloneLines).where(eq(cloneLines.id, seed.cloneLineId)).limit(1)
      // The owned seed lock serializes planting and treatment application. Reading
      // established genetics must not require UPDATE privileges for untreated seeds.
      const [profile] = await tx.select().from(geneticProfiles).where(eq(geneticProfiles.cloneLineId, seed.cloneLineId)).limit(1)
      const variants = await tx.select().from(cloneLineVariants).where(eq(cloneLineVariants.cloneLineId, seed.cloneLineId))
      if (!line || !profile) throw new Error('The bred seed has incomplete genetic identity.')
      if (line.originType === TUTORIAL_ORIGIN) throw safeConflict('CONFLICT', 'This practice offspring demonstrates inheritance. Use normal seeds for continued cultivation.')
      const [treatmentRow] = await tx.select().from(bredSeedTreatments).where(and(eq(bredSeedTreatments.ownerPlayerId, playerId), eq(bredSeedTreatments.seedId, seed.id))).for('update').limit(1)
      let effectiveProfile = profile
      if (treatmentRow) {
        const target = treatmentRow.treatment.target
        const resolved = resolveQuantitativeTreatment(treatmentRow.treatment, profile[target], this.now().getTime(), crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000, crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000)
        if (!resolved?.resolution) throw new Error('The stored quantitative treatment could not be resolved.')
        await tx.update(bredSeedTreatments).set({ treatment: resolved }).where(eq(bredSeedTreatments.seedId, seed.id))
        await tx.update(geneticProfiles).set({ [target]: resolved.resolution.finalValue }).where(eq(geneticProfiles.cloneLineId, seed.cloneLineId))
        effectiveProfile = { ...profile, [target]: resolved.resolution.finalValue }
        const [grower] = await tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1)
        if (grower) {
          const milestone = recordTreatmentMilestones(grower.research, target, resolved.resolution.gain, MEANINGFUL_TREATMENT_GAIN)
          await tx.update(playerGrowerState).set({ research: milestone.research, version: grower.version + 1, updatedAt: new Date(resolved.resolution.resolvedAt) }).where(eq(playerGrowerState.playerId, playerId))
          if (milestone.xpAwarded) await tx.update(playerOnboarding).set({ geneticsXp: sql`${playerOnboarding.geneticsXp} + ${milestone.xpAwarded}`, version: sql`${playerOnboarding.version} + 1` }).where(eq(playerOnboarding.playerId, playerId))
        }
      }
      const plantedAt = this.now(); const { readyAt, growthRuleVersion } = resolvePlantGrowth(plantedAt, this.options.environment, line.speciesId)
      const specimenId = this.createId()
      if (!UUID.test(specimenId) || specimenId === seed.id || specimenId === seed.cloneLineId) throw new Error('The server generated an invalid specimen identity.')
      await tx.insert(plantSpecimens).values({ id: specimenId, ownerPlayerId: playerId, cloneLineId: seed.cloneLineId, sourceType: 'bred-seed', lifecycleStatus: 'growing', plantedAt, collectedAt: null, visualDerivationVersion: line.visualDerivationVersion, version: 1, createdAt: plantedAt, updatedAt: plantedAt })
      await tx.insert(nurseryOccupancies).values({ playerId, slotId: command.slotId, specimenId, plantedAt, readyAt, growthRuleVersion, version: 1, createdAt: plantedAt, updatedAt: plantedAt })
      await tx.update(bredSeeds).set({ status: 'planted', plantedAt, plantedSpecimenId: specimenId }).where(eq(bredSeeds.id, seed.id))
      const version = await this.incrementVersion(tx, playerId, plantedAt)
      await this.awardXp(tx, playerId, 'cultivation', 15)
      await this.recordProgress(tx, playerId, idempotencyKey, 'plantBredSeed', line.speciesId, seed.cloneLineId, variants.some((variant) => variant.variantId === 'shiny'), plantedAt)
      const base = this.projectSpecimen({ id: specimenId, ownerPlayerId: playerId, cloneLineId: seed.cloneLineId, sourceType: 'bred-seed', lifecycleStatus: 'growing', plantedAt, collectedAt: null, visualDerivationVersion: line.visualDerivationVersion, version: 1, createdAt: plantedAt, updatedAt: plantedAt }, line, effectiveProfile, variants)
      const specimen: PlantSpecimenV2 = { ...base, geneticFeatures: seed.geneticFeatures, parentPlantIds: [seed.parent1SpecimenId, seed.parent2SpecimenId], parentSpeciesIds: [seed.parent1SpeciesId, seed.parent2SpeciesId], isHybrid: seed.isHybrid, sourceBredSeedId: seed.id }
      return { commandId: idempotencyKey, lifecycleVersion: lifecycleVersion(version), seedId: seed.id, slot: { slotId: command.slotId, occupancy: { specimen, plantedAt: plantedAt.toISOString(), readyAt: readyAt.toISOString(), growthRuleVersion, version: 1 } } }
    })
  }

  async plantCommoditySeed(playerId: string, idempotencyKey: string, command: PlantCommoditySeedCommandV1 & { tutorial?: true }): Promise<PlantCommoditySeedResultV1> {
    if (command.tutorial && !['staging', 'production', 'test'].includes(this.options.environment ?? '')) throw ApiError.notFound()
    return this.runIdempotent(playerId, idempotencyKey, 'plant-commodity-seed', command, async (tx) => {
      let tutorial
      if (command.tutorial) {
        if (!['staging', 'production', 'test'].includes(this.options.environment ?? '')) throw ApiError.notFound()
        const [owner] = await tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1)
        if (!owner) throw safeConflict('CONFLICT', 'Tutorial onboarding is unavailable.')
        tutorial = await loadStartingState(tx, playerId, owner.profileId)
        const [location] = await tx.select({ payload: playerGrowerEvents.payload }).from(playerGrowerEvents).where(and(eq(playerGrowerEvents.playerId, playerId), eq(playerGrowerEvents.eventType, 'world-foundation-location-v1'))).orderBy(sql`(${playerGrowerEvents.payload}->>'revision')::integer DESC`).limit(1)
        if (command.speciesId !== 'echinopsis-pachanoi' || tutorial.compatibilityComplete || tutorial.farmStage !== 'nursery' || !tutorial.farmSeedAvailable || (location?.payload as { areaId?: string } | undefined)?.areaId !== 'player-farm') throw safeConflict('SEED_UNAVAILABLE', 'The reserved Farm tutorial seed is unavailable here.')
        await tx.insert(playerSeedStacks).values({ playerId, speciesId: command.speciesId, quantity: 0 }).onConflictDoNothing()
      }
      const genetics = establishCommoditySeedGenetics(command.speciesId)
      if (!genetics) throw new ApiError('UNKNOWN_SPECIES', 400, 'The selected seed species is unavailable.')
      const [stack] = await tx.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, command.speciesId))).for('update').limit(1)
      if (!stack) throw new ApiError('SEED_STACK_NOT_FOUND', 404, 'The requested seed stack was not found.')
      if (stack.version !== command.expectedSeedStackVersion) throw safeConflict('STALE_VERSION', 'The seed inventory changed. Refresh and try again.')
      if (!tutorial && stack.quantity < 1) throw safeConflict('SEED_UNAVAILABLE', 'No seeds remain in this stack.')
      const [occupied] = await tx.select({ specimenId: nurseryOccupancies.specimenId }).from(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.slotId, command.slotId))).limit(1)
      if (occupied) throw safeConflict('SLOT_OCCUPIED', 'That Nursery position is already occupied.')
      const plantedAt = this.now(); const { readyAt, growthRuleVersion } = resolvePlantGrowth(plantedAt, this.options.environment, command.speciesId)
      const cloneLineId = this.createId(); const specimenId = this.createId()
      if (!UUID.test(cloneLineId) || !UUID.test(specimenId) || cloneLineId === specimenId) throw new Error('The server generated an invalid entity identity.')
      const shiny = tutorial ? false : rollShiny(this.randomUint16)
      if (!tutorial) await tx.update(playerSeedStacks).set({ quantity: stack.quantity - 1, version: stack.version + 1, updatedAt: plantedAt }).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, command.speciesId)))
      else { tutorial.farmSeedAvailable = false; await saveStartingState(tx, playerId, tutorial, idempotencyKey, plantedAt) }
      await tx.insert(cloneLines).values({ id: cloneLineId, speciesId: command.speciesId, originType: tutorial ? TUTORIAL_ORIGIN : 'commodity-seed', originPlayerId: playerId, establishedAt: plantedAt, geneticRepresentationVersion: GENETIC_REPRESENTATION_VERSION, visualDerivationVersion: VISUAL_DERIVATION_VERSION, createdAt: plantedAt })
      await tx.insert(geneticProfiles).values({ cloneLineId, ...genetics, establishmentRuleVersion: GENETIC_ESTABLISHMENT_RULE_VERSION, createdAt: plantedAt })
      if (shiny) await tx.insert(cloneLineVariants).values({ cloneLineId, variantId: 'shiny', origin: 'random', establishedAt: plantedAt })
      await tx.insert(plantSpecimens).values({ id: specimenId, ownerPlayerId: playerId, cloneLineId, sourceType: tutorial ? TUTORIAL_ORIGIN : 'commodity-seed', lifecycleStatus: 'growing', plantedAt, collectedAt: null, visualDerivationVersion: VISUAL_DERIVATION_VERSION, version: 1, createdAt: plantedAt, updatedAt: plantedAt })
      await tx.insert(nurseryOccupancies).values({ playerId, slotId: command.slotId, specimenId, plantedAt, readyAt, growthRuleVersion, version: 1, createdAt: plantedAt, updatedAt: plantedAt })
      const version = await this.incrementVersion(tx, playerId, plantedAt)
      await this.awardXp(tx, playerId, 'cultivation', 10)
      await this.recordProgress(tx, playerId, idempotencyKey, 'plantSeed', command.speciesId, cloneLineId, shiny, plantedAt)
      const specimen: PlantSpecimenV1 = { specimenId, cloneLineId, speciesId: command.speciesId, lifecycleStatus: 'growing', plantedAt: plantedAt.toISOString(), collectedAt: null, genetics, geneticFeatures: [], specialVariants: shiny ? [{ variantId: 'shiny', origin: 'random', establishedAt: plantedAt.toISOString() }] : [], geneticRepresentationVersion: GENETIC_REPRESENTATION_VERSION, visualDerivationVersion: VISUAL_DERIVATION_VERSION, version: 1 }
      return { commandId: idempotencyKey, lifecycleVersion: lifecycleVersion(version), seedStack: { speciesId: command.speciesId, quantity: stack.quantity - (tutorial ? 0 : 1), version: stack.version + (tutorial ? 0 : 1) }, slot: { slotId: command.slotId, occupancy: { specimen, plantedAt: plantedAt.toISOString(), readyAt: readyAt.toISOString(), growthRuleVersion, version: 1 } } }
    })
  }

  async collectPlant(playerId: string, idempotencyKey: string, command: CollectPlantCommandV1): Promise<CollectPlantResultV1> {
    await this.upgradeAlphaSchedules(playerId)
    return this.runIdempotent(playerId, idempotencyKey, 'collect-plant', command, async (tx) => {
      const [occupancy] = await tx.select().from(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.slotId, command.slotId))).for('update').limit(1)
      if (!occupancy) throw new ApiError('OCCUPANCY_NOT_FOUND', 404, 'The Nursery position is empty.')
      if (occupancy.specimenId !== command.specimenId) throw new ApiError('SPECIMEN_NOT_FOUND', 404, 'The requested specimen was not found.')
      if (occupancy.version !== command.expectedOccupancyVersion) throw safeConflict('STALE_VERSION', 'The Nursery position changed. Refresh and try again.')
      const [specimen] = await tx.select().from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, playerId), eq(plantSpecimens.id, command.specimenId))).for('update').limit(1)
      if (!specimen || specimen.lifecycleStatus !== 'growing') throw new ApiError('SPECIMEN_NOT_FOUND', 404, 'The requested specimen was not found.')
      if (specimen.version !== command.expectedSpecimenVersion) throw safeConflict('STALE_VERSION', 'The specimen changed. Refresh and try again.')
      const collectedAt = this.now()
      if (collectedAt < occupancy.readyAt) throw safeConflict('PLANT_NOT_READY', 'This plant is not ready to collect.')
      await tx.update(plantSpecimens).set({ lifecycleStatus: 'owned', collectedAt, updatedAt: collectedAt, version: specimen.version + 1 }).where(eq(plantSpecimens.id, specimen.id))
      await tx.delete(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.slotId, command.slotId)))
      const version = await this.incrementVersion(tx, playerId, collectedAt)
      await this.awardXp(tx, playerId, 'cultivation', 25)
      const [line] = await tx.select().from(cloneLines).where(eq(cloneLines.id, specimen.cloneLineId)).limit(1); const [profile] = await tx.select().from(geneticProfiles).where(eq(geneticProfiles.cloneLineId, specimen.cloneLineId)).limit(1); const variants = await tx.select().from(cloneLineVariants).where(eq(cloneLineVariants.cloneLineId, specimen.cloneLineId))
      const projected = this.projectSpecimen({ ...specimen, lifecycleStatus: 'owned', collectedAt, updatedAt: collectedAt, version: specimen.version + 1 }, line, profile, variants)
      await this.recordProgress(tx, playerId, idempotencyKey, 'collectPlant', projected.speciesId, projected.cloneLineId, projected.specialVariants.some((variant) => variant.variantId === 'shiny'), collectedAt)
      return { commandId: idempotencyKey, lifecycleVersion: lifecycleVersion(version), slot: { slotId: command.slotId, occupancy: null }, specimen: projected }
    })
  }

  private projectSpecimen(specimen: typeof plantSpecimens.$inferSelect, line: typeof cloneLines.$inferSelect | undefined, profile: typeof geneticProfiles.$inferSelect | undefined, variants: Array<typeof cloneLineVariants.$inferSelect>): PlantSpecimenV1 {
    if (!line || !profile || (specimen.lifecycleStatus !== 'growing' && specimen.lifecycleStatus !== 'owned')) throw new Error('A persisted specimen has incomplete lifecycle data.')
    return { specimenId: specimen.id, cloneLineId: specimen.cloneLineId, speciesId: line.speciesId, lifecycleStatus: specimen.lifecycleStatus, plantedAt: specimen.plantedAt.toISOString(), collectedAt: specimen.collectedAt?.toISOString() ?? null, genetics: { vigor: profile.vigor, growthSpeed: profile.growthSpeed, size: profile.size, flowering: profile.flowering, mutationChance: profile.mutationChance }, geneticFeatures: [], specialVariants: variants.filter((variant) => variant.variantId === 'shiny').map((variant) => ({ variantId: 'shiny', origin: 'random', establishedAt: variant.establishedAt.toISOString() })), geneticRepresentationVersion: line.geneticRepresentationVersion, visualDerivationVersion: specimen.visualDerivationVersion, version: specimen.version }
  }
  private async incrementVersion(tx: Transaction, playerId: string, now: Date): Promise<number> { const [row] = await tx.insert(playerPlantLifecycleVersions).values({ playerId, version: 1, updatedAt: now }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: now } }).returning({ version: playerPlantLifecycleVersions.version }); return row.version }
  private async awardXp(tx: Transaction, playerId: string, skill: 'cultivation' | 'breeding', amount: number): Promise<void> {
    const set = skill === 'cultivation'
      ? { cultivationXp: sql`${playerOnboarding.cultivationXp} + ${amount}`, version: sql`${playerOnboarding.version} + 1` }
      : { breedingXp: sql`${playerOnboarding.breedingXp} + ${amount}`, version: sql`${playerOnboarding.version} + 1` }
    const updated = await tx.update(playerOnboarding).set(set).where(eq(playerOnboarding.playerId, playerId)).returning({ playerId: playerOnboarding.playerId })
    if (!updated.length) throw new Error('The Grower profile is not initialized.')
  }
  private async recordProgress(tx: Transaction, playerId: string, commandId: string, eventType: keyof ProgressionEventCounts, speciesId: string, cloneLineId: string, shiny: boolean, occurredAt: Date): Promise<void> {
    await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType, sourceCommandId: commandId, occurredAt, payload: { speciesId, cloneLineId, shiny } })
    const [[grower], [profile], events] = await Promise.all([
      tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).limit(1),
      tx.select({ eventType: playerGrowerEvents.eventType }).from(playerGrowerEvents).where(eq(playerGrowerEvents.playerId, playerId)),
    ])
    if (!grower || !profile) throw new Error('The Grower state is not initialized.')
    const counts: ProgressionEventCounts = { plantSeed: 0, plantBredSeed: 0, collectPlant: 0, breedPlant: 0, npcSale: 0, marketplaceListing: 0 }
    for (const event of events) if (event.eventType in counts) counts[event.eventType as keyof ProgressionEventCounts] += 1
    const discoveries = discoverSpecies(grower.discoveries, { speciesId, source: eventType === 'breedPlant' ? 'breeding' : 'unknown', sourceRef: cloneLineId }, occurredAt.getTime())
    const journalStats = shiny ? recordShinyDiscovery(grower.journalStats, cloneLineId, [{ variantId: 'shiny', origin: 'random', establishedAt: occurredAt.toISOString() }]) : grower.journalStats
    const skills = { cultivation: { xp: profile.cultivationXp }, breeding: { xp: profile.breedingXp }, genetics: { xp: profile.geneticsXp } }
    const achievements = evaluateAchievements(grower.achievements.length ? grower.achievements : createAchievementProgress(), counts, skills, getDiscoveredSpeciesCount(discoveries), occurredAt.toISOString())
    await tx.update(playerGrowerState).set({ achievements, discoveries, journalStats, version: grower.version + 1, updatedAt: occurredAt }).where(eq(playerGrowerState.playerId, playerId))
  }
  private async runIdempotent<T extends object>(playerId: string, key: string, type: string, command: object, operation: (tx: Transaction) => Promise<T>): Promise<T> {
    if (!UUID.test(key)) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key header is required.')
    const requestFingerprint = fingerprint(type, command)
    const existing = await this.database.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, key))).limit(1)
    if (existing[0]) { if (existing[0].commandType !== type || existing[0].requestFingerprint !== requestFingerprint) throw safeConflict('IDEMPOTENCY_KEY_REUSED', 'The idempotency key was already used for another request.'); if (existing[0].status === 'completed') return existing[0].responsePayload as T }
    try { return await this.database.transaction(async (tx) => {
      // Staging resets and cultivation share the canonical owner lock before inventory/body locks.
      if (['staging', 'production', 'development', 'test'].includes(this.options.environment ?? '')) await tx.select({ playerId: playerOnboarding.playerId }).from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1)
      await tx.insert(gameplayCommandReceipts).values({ playerId, idempotencyKey: key, commandType: type, requestFingerprint, status: 'processing' }); const response = await operation(tx); await tx.update(gameplayCommandReceipts).set({ status: 'completed', responsePayload: response, completedAt: this.now() }).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, key))); return response }) } catch (error) { if (databaseErrorCode(error) === '23505') { const [receipt] = await this.database.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, key))).limit(1); if (receipt?.status === 'completed' && receipt.commandType === type && receipt.requestFingerprint === requestFingerprint) return receipt.responsePayload as T } throw error }
  }
}
