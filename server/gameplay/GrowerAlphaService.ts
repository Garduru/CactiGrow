import { buyShopSeeds, buyMarketplaceListing, cancelMarketplaceListing } from './commerceTransactions.ts'
import { assertSpecimenUnprotected } from './specimenCommerceEligibility.ts'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import {
  bredSeeds, bredSeedTreatments, cloneLines, cloneLineVariants, gameplayCommandReceipts, geneticProfiles, marketplaceListings,
  plantSpecimens, playerGardenDisplays, playerGardenSpecimens, playerGrowerEvents,
  playerGrowerState, playerOnboarding, playerSeedStacks,
} from '../db/schema/index.ts'
import type { GrowerAlphaCommandV1, GrowerAlphaProjectionV1 } from '../../shared/api/growerAlphaV1.ts'
import { ApiError } from '../api/errors.ts'
import { getSpeciesById } from '../../src/data/species.ts'
import { geneticsLabTiers } from '../../src/features/lab/labConfig.ts'
import { getNpcSaleValue } from '../../src/features/marketplace/sellModel.ts'
import { getPropertyUpgradeStatus } from '../../src/features/property/propertyModel.ts'
import type { CollectedPlant } from '../../src/game/gameState.ts'
import type { MarketplaceListing } from '../../src/types/marketplace.ts'
import { getLevelFromXp } from '../../src/features/progression/progressionModel.ts'
import { analyzeCloneLine, compareCloneLines, observeCloneLine, recordExtractionMilestones, recordTissueSamplingMilestones } from '../../src/features/research/researchModel.ts'
import { addTissueSample, createTissueSample, getTissueSamplingStatus, normalizeTissueSample } from '../../src/features/lab/labModel.ts'
import { createExtractionAttempt } from '../../src/features/lab/extractionModel.ts'
import { createQuantitativeSeedTreatment } from '../../src/features/lab/treatmentModel.ts'
import { recordTreatmentMilestones } from '../../src/features/research/researchModel.ts'
import { canUseBulkResearch, isEligibleForResearch, MAX_RESEARCH_BATCH } from '../../src/features/garden/collectionManagement.ts'
import { createAchievementProgress, evaluateAchievements, type ProgressionEventCounts } from '../../src/features/achievements/achievementsModel.ts'
import { getDiscoveredSpeciesCount } from '../../src/features/journal/journalModel.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
  return JSON.stringify(value)
}

function conflict(code: ConstructorParameters<typeof ApiError>[0], message: string) { return new ApiError(code, 409, message) }
function databaseErrorCode(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth += 1) {
    const details = current as { code?: unknown; cause?: unknown }
    if (typeof details.code === 'string') return details.code
    current = details.cause
  }
  return undefined
}

export class GrowerAlphaService {
  private readonly database: CactiGrowDatabase
  private readonly now: () => Date

  constructor(database: CactiGrowDatabase, now: () => Date = () => new Date()) {
    this.database = database
    this.now = now
  }

  async project(playerId: string): Promise<GrowerAlphaProjectionV1> {
    const [[profile], [state], listings, treatments] = await Promise.all([
      this.database.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).limit(1),
      this.database.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).limit(1),
      this.database.select().from(marketplaceListings).where(eq(marketplaceListings.sellerPlayerId, playerId)),
      this.database.select().from(bredSeedTreatments).where(eq(bredSeedTreatments.ownerPlayerId, playerId)),
    ])
    if (!profile || !state) throw new Error('The Grower profile is not initialized.')
    const projectedListings: MarketplaceListing[] = listings.filter((listing) => listing.status !== 'sold').map((listing) => ({
      id: listing.id,
      sellerId: listing.sellerPlayerId,
      plantId: listing.specimenId,
      askingPrice: listing.askingPrice,
      createdAt: listing.createdAt.toISOString(),
      status: listing.status as 'active' | 'cancelled',
      ...(listing.completedAt ? { cancelledAt: listing.completedAt.toISOString() } : {}),
    }))
    return {
      projectionVersion: 1,
      version: Math.max(profile.version, state.version),
      player: { playerId, tokenBalance: profile.tokenBalance, skills: { cultivationXp: profile.cultivationXp, breedingXp: profile.breedingXp, geneticsXp: profile.geneticsXp } },
      achievements: state.achievements,
      discoveries: state.discoveries,
      journalStats: state.journalStats,
      research: state.research,
      lab: state.lab,
      property: state.property,
      marketplaceListings: projectedListings,
      seedTreatments: Object.fromEntries(treatments.map((row) => [row.seedId, row.treatment])),
    }
  }

  async execute(playerId: string, command: GrowerAlphaCommandV1): Promise<GrowerAlphaProjectionV1> {
    const type = `grower-alpha-v1:${command.type}`
    const fingerprint = `${type}:${canonicalJson(command)}`
    const [existing] = await this.database.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId))).limit(1)
    if (existing) {
      if (existing.commandType !== type || existing.requestFingerprint !== fingerprint) throw conflict('IDEMPOTENCY_KEY_REUSED', 'The command ID was already used for another request.')
      if (existing.status === 'completed') return existing.responsePayload as GrowerAlphaProjectionV1
    }
    try {
      return await this.database.transaction(async (tx) => {
        await tx.insert(gameplayCommandReceipts).values({ playerId, idempotencyKey: command.commandId, commandType: type, requestFingerprint: fingerprint, status: 'processing' })
        const researchBatch = await this.apply(tx, playerId, command)
        const result = await this.projectWith(tx, playerId)
        if (researchBatch) result.researchBatch = researchBatch
        if (command.type === 'buy-shop-seeds' || command.type === 'buy-marketplace-listing') {
          const [stacks, specimens] = await Promise.all([
            tx.select({ speciesId: playerSeedStacks.speciesId, quantity: playerSeedStacks.quantity, version: playerSeedStacks.version }).from(playerSeedStacks).where(eq(playerSeedStacks.playerId, playerId)),
            tx.select({ id: plantSpecimens.id }).from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, playerId), eq(plantSpecimens.lifecycleStatus, 'owned'))),
          ])
          result.commerceInventory = { seedStacks: stacks, ownedSpecimenIds: specimens.map((row) => row.id) }
        }
        await tx.update(gameplayCommandReceipts).set({ status: 'completed', responsePayload: result, completedAt: this.now() }).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId)))
        return result
      })
    } catch (error) {
      if (databaseErrorCode(error) === '23505') {
        const [receipt] = await this.database.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, command.commandId))).limit(1)
        if (receipt?.status === 'completed' && receipt.commandType === type && receipt.requestFingerprint === fingerprint) return receipt.responsePayload as GrowerAlphaProjectionV1
        throw conflict('CONFLICT', 'The Grower state changed concurrently. Refresh and try again.')
      }
      throw error
    }
  }

  private async apply(tx: Transaction, playerId: string, command: GrowerAlphaCommandV1): Promise<GrowerAlphaProjectionV1['researchBatch']> {
    const now = this.now()
    if (command.type === 'research-specimens') {
      if (!command.specimenIds.length || command.specimenIds.length > MAX_RESEARCH_BATCH || new Set(command.specimenIds).size !== command.specimenIds.length) throw new ApiError('INVALID_COMMAND', 400, 'Choose between 1 and 100 different specimens.')
      // Lock specimens in stable order before account state, matching single research/commerce.
      const specimens = await tx.select().from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, playerId), inArray(plantSpecimens.id, command.specimenIds))).orderBy(plantSpecimens.id).for('update')
      const [[profile], [state]] = await Promise.all([
        tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1),
        tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      ])
      if (!profile || !state) throw new Error('The Grower state is not initialized.')
      if (!canUseBulkResearch(state.property)) throw new ApiError('FORBIDDEN', 403, 'Organized Beds is required for batch research.')
      const cloneIds = [...new Set(specimens.map((specimen) => specimen.cloneLineId))]
      const [lines, profiles, seeds, variants] = cloneIds.length ? await Promise.all([
        tx.select().from(cloneLines).where(inArray(cloneLines.id, cloneIds)),
        tx.select().from(geneticProfiles).where(inArray(geneticProfiles.cloneLineId, cloneIds)),
        tx.select().from(bredSeeds).where(inArray(bredSeeds.cloneLineId, cloneIds)),
        tx.select().from(cloneLineVariants).where(inArray(cloneLineVariants.cloneLineId, cloneIds)),
      ]) : [[], [], [], []]
      const byId = new Map(specimens.map((specimen) => [specimen.id, specimen]))
      const byLine = new Map(lines.map((line) => [line.id, line]))
      const byProfile = new Map(profiles.map((entry) => [entry.cloneLineId, entry]))
      const bySeed = new Map(seeds.map((seed) => [seed.cloneLineId, seed]))
      const result: NonNullable<GrowerAlphaProjectionV1['researchBatch']> = { succeeded: [], skipped: [] }
      const seen = new Set<string>()
      let research = state.research
      let xp = 0
      // Eligibility is evaluated at the starting level; new XP cannot silently expand this batch.
      const level = getLevelFromXp(profile.geneticsXp)
      for (const specimenId of command.specimenIds) {
        const specimen = byId.get(specimenId)
        if (!specimen || specimen.lifecycleStatus !== 'owned' || !specimen.collectedAt) { result.skipped.push({ specimenId, reason: 'Not an owned mature specimen.' }); continue }
        const line = byLine.get(specimen.cloneLineId), genetics = byProfile.get(specimen.cloneLineId), seed = bySeed.get(specimen.cloneLineId)
        if (!line || !genetics || !getSpeciesById(line.speciesId)) throw new Error('The specimen has incomplete genetic identity.')
        const plant: CollectedPlant = { id: specimenId, ownerId: playerId, cloneLineId: line.id, speciesId: line.speciesId, stage: 'mature', plantedAt: specimen.plantedAt.toISOString(), collectedAt: specimen.collectedAt.toISOString(), lastUpdatedAt: specimen.updatedAt.toISOString(), genetics: { vigor: genetics.vigor, growthSpeed: genetics.growthSpeed, size: genetics.size, flowering: genetics.flowering, mutationChance: genetics.mutationChance }, geneticFeatures: seed?.geneticFeatures ?? [], specialVariants: variants.filter((variant) => variant.cloneLineId === line.id && variant.variantId === 'shiny').map((variant) => ({ variantId: 'shiny', origin: 'random', establishedAt: variant.establishedAt.toISOString() })), isHybrid: seed?.isHybrid ?? false, isHarvestable: false, isListedForSale: false }
        if (seen.has(line.id)) { result.skipped.push({ specimenId, reason: 'This clone line is already included.' }); continue }
        seen.add(line.id)
        const record = research.records[line.id]
        if (!isEligibleForResearch(plant, record, level)) { result.skipped.push({ specimenId, reason: record?.analysisDepth === 'fully-characterized' ? 'Research complete.' : 'Next milestone requires a higher Genetics level.' }); continue }
        const step = record ? analyzeCloneLine(research, plant, level, now.getTime()) : observeCloneLine(research, plant, now.getTime())
        if (!step.changed) { result.skipped.push({ specimenId, reason: 'No available milestone.' }); continue }
        research = step.research; xp += step.xpAwarded; result.succeeded.push(specimenId)
      }
      if (result.succeeded.length) {
        await this.persistResearchResult(tx, playerId, profile, state, research, xp, now)
        await this.recordEvent(tx, playerId, command.commandId, 'specimens-researched', now, { specimenIds: result.succeeded })
      }
      return result
    }
    if (command.type === 'buy-shop-seeds') {
      await buyShopSeeds(tx, playerId, command.itemId, command.quantity, now)
      await this.recordEvent(tx, playerId, command.commandId, 'shop-purchase', now, { itemId: command.itemId, quantity: command.quantity })
      return
    }
    if (command.type === 'buy-marketplace-listing') {
      await buyMarketplaceListing(tx, playerId, command.listingId, now)
      await this.recordEvent(tx, playerId, command.commandId, 'marketplace-purchase', now, { listingId: command.listingId })
      return
    }
    if (command.type === 'sell-specimen-to-npc') {
      const plant = await this.loadOwnedPlant(tx, playerId, command.specimenId)
      await assertSpecimenUnprotected(tx, playerId, command.specimenId)
      const [active] = await tx.select().from(marketplaceListings).where(and(eq(marketplaceListings.specimenId, command.specimenId), eq(marketplaceListings.status, 'active'))).limit(1)
      if (active) throw conflict('CONFLICT', 'Cancel the Marketplace listing before selling this specimen.')
      const value = getNpcSaleValue(plant)
      if (value === null) throw new ApiError('INVALID_COMMAND', 400, 'The specimen has no configured NPC sale value.')
      await tx.update(plantSpecimens).set({ lifecycleStatus: 'sold', version: sql`${plantSpecimens.version} + 1`, updatedAt: now }).where(and(eq(plantSpecimens.ownerPlayerId, playerId), eq(plantSpecimens.id, command.specimenId)))
      await tx.update(playerOnboarding).set({ tokenBalance: sql`${playerOnboarding.tokenBalance} + ${value}`, version: sql`${playerOnboarding.version} + 1` }).where(eq(playerOnboarding.playerId, playerId))
      await tx.delete(playerGardenDisplays).where(and(eq(playerGardenDisplays.playerId, playerId), eq(playerGardenDisplays.specimenId, command.specimenId)))
      await tx.delete(playerGardenSpecimens).where(and(eq(playerGardenSpecimens.playerId, playerId), eq(playerGardenSpecimens.specimenId, command.specimenId)))
      await this.recordEvent(tx, playerId, command.commandId, 'npcSale', now, { specimenId: command.specimenId, tokenValue: value })
      return
    }
    if (command.type === 'list-specimen') {
      await this.loadOwnedPlant(tx, playerId, command.specimenId)
      await assertSpecimenUnprotected(tx, playerId, command.specimenId)
      await tx.insert(marketplaceListings).values({ id: crypto.randomUUID(), sellerPlayerId: playerId, specimenId: command.specimenId, askingPrice: command.askingPrice, status: 'active', createdAt: now, version: 1 })
      await this.recordEvent(tx, playerId, command.commandId, 'marketplaceListing', now, { specimenId: command.specimenId })
      return
    }
    if (command.type === 'cancel-listing') {
      const listing = await cancelMarketplaceListing(tx, command.listingId, now, playerId)
      await this.recordEvent(tx, playerId, command.commandId, 'listing-cancelled', now, { listingId: listing.id })
      return
    }
    if (command.type === 'set-farm-access') {
      const [state] = await tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1)
      if (!state) throw new Error('The Grower state is not initialized.')
      await tx.update(playerGrowerState).set({ property: { ...state.property, farmAccessPreference: command.preference }, version: state.version + 1, updatedAt: now }).where(eq(playerGrowerState.playerId, playerId))
      await this.recordEvent(tx, playerId, command.commandId, 'farm-access-changed', now, {})
      return
    }
    if (command.type === 'upgrade-property') {
      const [[profile], [state]] = await Promise.all([
        tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1),
        tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      ])
      if (!profile || !state) throw new Error('The Grower state is not initialized.')
      const player = { id: playerId, username: 'Grower', tokens: profile.tokenBalance, skills: { cultivation: { xp: profile.cultivationXp }, breeding: { xp: profile.breedingXp }, genetics: { xp: profile.geneticsXp } } }
      const status = getPropertyUpgradeStatus(state.property, player, command.upgradeId)
      if (!status.eligible || !status.definition || status.definition.tokenCost === null) throw conflict('CONFLICT', status.reasons.join(' ') || 'That property upgrade is unavailable.')
      const definition = status.definition
      const tokenCost = definition.tokenCost
      if (tokenCost === null) throw conflict('CONFLICT', 'That property upgrade has no configured cost.')
      const property = { ...state.property, buildings: { ...state.property.buildings, [definition.buildingId]: { ...state.property.buildings[definition.buildingId], level: definition.toLevel, upgradedAt: now.toISOString() } }, completedUpgradeIds: [...state.property.completedUpgradeIds, definition.id] }
      await tx.update(playerOnboarding).set({ tokenBalance: profile.tokenBalance - tokenCost, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
      await tx.update(playerGrowerState).set({ property, version: state.version + 1, updatedAt: now }).where(eq(playerGrowerState.playerId, playerId))
      await this.recordEvent(tx, playerId, command.commandId, 'property-upgraded', now, { upgradeId: definition.id })
      return
    }
    if (command.type === 'upgrade-lab') {
      const [[profile], [state]] = await Promise.all([
        tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1),
        tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      ])
      const tier = geneticsLabTiers.find((entry) => entry.id === command.targetTier)
      if (!profile || !state || !tier || command.targetTier !== state.lab.tier + 1 || profile.tokenBalance < tier.cost) throw conflict('CONFLICT', 'That Lab upgrade is unavailable.')
      const lab = { ...state.lab, tier: command.targetTier, installedAt: state.lab.installedAt ?? now.toISOString(), upgradedAt: now.toISOString() }
      await tx.update(playerOnboarding).set({ tokenBalance: profile.tokenBalance - tier.cost, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
      await tx.update(playerGrowerState).set({ lab, version: state.version + 1, updatedAt: now }).where(eq(playerGrowerState.playerId, playerId))
      await this.recordEvent(tx, playerId, command.commandId, 'lab-upgraded', now, { targetTier: command.targetTier })
      return
    }
    if (command.type === 'observe-specimen' || command.type === 'analyze-specimen') {
      const plant = await this.loadOwnedPlant(tx, playerId, command.specimenId)
      const [[profile], [state]] = await Promise.all([
        tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1),
        tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      ])
      if (!profile || !state) throw new Error('The Grower state is not initialized.')
      const result = command.type === 'observe-specimen'
        ? observeCloneLine(state.research, plant, now.getTime())
        : analyzeCloneLine(state.research, plant, getLevelFromXp(profile.geneticsXp), now.getTime())
      if (!result.changed) throw conflict('CONFLICT', 'No research milestone is currently available for this specimen.')
      await this.persistResearchResult(tx, playerId, profile, state, result.research, result.xpAwarded, now)
      await this.recordEvent(tx, playerId, command.commandId, command.type === 'observe-specimen' ? 'specimen-observed' : 'specimen-analyzed', now, { specimenId: command.specimenId })
      return
    }
    if (command.type === 'compare-specimens') {
      const [first, second] = await Promise.all([this.loadOwnedPlant(tx, playerId, command.firstSpecimenId), this.loadOwnedPlant(tx, playerId, command.secondSpecimenId)])
      const [[profile], [state]] = await Promise.all([
        tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1),
        tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      ])
      if (!profile || !state) throw new Error('The Grower state is not initialized.')
      const result = compareCloneLines(state.research, first, second, getLevelFromXp(profile.geneticsXp))
      if (!result.changed) throw conflict('CONFLICT', 'This comparison does not unlock new research.')
      await this.persistResearchResult(tx, playerId, profile, state, result.research, result.xpAwarded, now)
      await this.recordEvent(tx, playerId, command.commandId, 'specimens-compared', now, { specimenIds: [first.id, second.id] })
      return
    }
    if (command.type === 'collect-tissue-sample') {
      const plant = await this.loadOwnedPlant(tx, playerId, command.specimenId)
      const [[profile], [state]] = await Promise.all([
        tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1),
        tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      ])
      if (!profile || !state) throw new Error('The Grower state is not initialized.')
      const level = getLevelFromXp(profile.geneticsXp)
      if (!getTissueSamplingStatus(state.lab, level, plant.id, now.getTime()).available) throw conflict('CONFLICT', 'This specimen is not currently eligible for tissue sampling.')
      const sample = createTissueSample(plant, playerId, level, state.lab.tier, now.getTime())
      const lab = sample ? addTissueSample(state.lab, sample) : null
      if (!sample || !lab) throw conflict('CONFLICT', 'The tissue sample could not be created.')
      const milestone = recordTissueSamplingMilestones(state.research, plant.cloneLineId, sample.qualityBand)
      await tx.update(playerGrowerState).set({ lab, research: milestone.research, version: state.version + 1, updatedAt: now }).where(eq(playerGrowerState.playerId, playerId))
      if (milestone.xpAwarded) await tx.update(playerOnboarding).set({ geneticsXp: profile.geneticsXp + milestone.xpAwarded, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
      await this.recordEvent(tx, playerId, command.commandId, 'tissue-sample-collected', now, { specimenId: plant.id, sampleId: sample.id })
      return
    }
    if (command.type === 'extract-sample') {
      const [[profile], [state]] = await Promise.all([
        tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1),
        tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      ])
      if (!profile || !state) throw new Error('The Grower state is not initialized.')
      const attempt = createExtractionAttempt(state.lab, command.sampleId, command.target, getLevelFromXp(profile.geneticsXp), playerId, now.getTime())
      if (!attempt) throw conflict('CONFLICT', 'This extraction is not currently available.')
      const stored = state.lab.tissueSamples.find((sample) => sample.id === command.sampleId)
      const sample = stored ? normalizeTissueSample(stored) : null
      if (!sample) throw new ApiError('NOT_FOUND', 404, 'The tissue sample was not found.')
      const remainingUses = sample.remainingUses - 1
      const lab = { ...state.lab, tissueSamples: state.lab.tissueSamples.map((entry) => entry.id === sample.id ? { ...sample, remainingUses, status: remainingUses === 0 ? 'depleted' as const : 'stored' as const, depletedAt: remainingUses === 0 ? attempt.attemptedAt : undefined } : entry), geneticExtracts: attempt.extract ? [...state.lab.geneticExtracts, attempt.extract] : state.lab.geneticExtracts, extractionAttemptIds: [...state.lab.extractionAttemptIds, attempt.id] }
      const milestone = attempt.extract ? recordExtractionMilestones(state.research, attempt.extract.target, attempt.extract.outcome, attempt.extract.extractionQualityBand) : { research: state.research, xpAwarded: 0, changed: false }
      await tx.update(playerGrowerState).set({ lab, research: milestone.research, version: state.version + 1, updatedAt: now }).where(eq(playerGrowerState.playerId, playerId))
      if (milestone.xpAwarded) await tx.update(playerOnboarding).set({ geneticsXp: profile.geneticsXp + milestone.xpAwarded, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
      await this.recordEvent(tx, playerId, command.commandId, 'genetic-extraction-attempted', now, { sampleId: sample.id, outcome: attempt.outcome })
      return
    }
    if (command.type === 'apply-seed-treatment') {
      const [[profile], [state], [seed], existingTreatments] = await Promise.all([
        tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).for('update').limit(1),
        tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
        tx.select().from(bredSeeds).where(and(eq(bredSeeds.ownerPlayerId, playerId), eq(bredSeeds.id, command.seedId))).for('update').limit(1),
        tx.select().from(bredSeedTreatments).where(eq(bredSeedTreatments.seedId, command.seedId)),
      ])
      if (!profile || !state || !seed || seed.status !== 'available') throw new ApiError('NOT_FOUND', 404, 'The available bred seed was not found.')
      if (existingTreatments.length) throw conflict('CONFLICT', 'That bred seed already has a quantitative treatment.')
      const [genetics] = await tx.select().from(geneticProfiles).where(eq(geneticProfiles.cloneLineId, seed.cloneLineId)).limit(1)
      const extract = state.lab.geneticExtracts.find((entry) => entry.id === command.extractId)
      if (!genetics || !extract) throw new ApiError('NOT_FOUND', 404, 'The seed or genetic extract was not found.')
      const player = { id: playerId, username: 'Grower', tokens: profile.tokenBalance, skills: { cultivation: { xp: profile.cultivationXp }, breeding: { xp: profile.breedingXp }, genetics: { xp: profile.geneticsXp } } }
      const seedModel = { id: seed.id, speciesId: seed.parent1SpeciesId, cloneLineId: seed.cloneLineId, createdAt: seed.createdAt.toISOString(), genetics: { vigor: genetics.vigor, growthSpeed: genetics.growthSpeed, size: genetics.size, flowering: genetics.flowering, mutationChance: genetics.mutationChance }, parentPlantIds: [seed.parent1SpecimenId, seed.parent2SpecimenId] as [string, string], parentSpeciesIds: [seed.parent1SpeciesId, seed.parent2SpeciesId] as [string, string], isHybrid: seed.isHybrid, geneticFeatures: seed.geneticFeatures, specialVariants: [] }
      const treatment = createQuantitativeSeedTreatment(state.lab, player, seedModel, extract, now.getTime())
      if (!treatment) throw conflict('CONFLICT', 'This seed treatment is not currently available.')
      const lab = { ...state.lab, geneticExtracts: state.lab.geneticExtracts.map((entry) => entry.id === extract.id ? { ...entry, status: 'consumed' as const, consumedAt: treatment.appliedAt, consumedBySeedId: seed.id } : entry) }
      const milestone = recordTreatmentMilestones(state.research, treatment.target)
      await tx.insert(bredSeedTreatments).values({ seedId: seed.id, ownerPlayerId: playerId, treatment, createdAt: now })
      await tx.update(playerGrowerState).set({ lab, research: milestone.research, version: state.version + 1, updatedAt: now }).where(eq(playerGrowerState.playerId, playerId))
      if (milestone.xpAwarded) await tx.update(playerOnboarding).set({ geneticsXp: profile.geneticsXp + milestone.xpAwarded, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
      await this.recordEvent(tx, playerId, command.commandId, 'seed-treated', now, { seedId: seed.id, treatmentId: treatment.id })
      return
    }
    throw new ApiError('INVALID_COMMAND', 400, 'This Grower command has not been migrated yet.')
  }

  private async loadOwnedPlant(tx: Transaction, playerId: string, specimenId: string): Promise<CollectedPlant> {
    const [specimen] = await tx.select().from(plantSpecimens).where(and(eq(plantSpecimens.ownerPlayerId, playerId), eq(plantSpecimens.id, specimenId))).for('update').limit(1)
    if (!specimen || specimen.lifecycleStatus !== 'owned' || !specimen.collectedAt) throw new ApiError('SPECIMEN_NOT_FOUND', 404, 'The owned specimen was not found.')
    const [[line], [profile], seedRows, variants] = await Promise.all([
      tx.select().from(cloneLines).where(eq(cloneLines.id, specimen.cloneLineId)).limit(1),
      tx.select().from(geneticProfiles).where(eq(geneticProfiles.cloneLineId, specimen.cloneLineId)).limit(1),
      tx.select().from(bredSeeds).where(eq(bredSeeds.cloneLineId, specimen.cloneLineId)).limit(1),
      tx.select().from(cloneLineVariants).where(eq(cloneLineVariants.cloneLineId, specimen.cloneLineId)),
    ])
    if (!line || !profile || !getSpeciesById(line.speciesId)) throw new Error('The specimen has incomplete genetic identity.')
    const seed = seedRows[0]
    return { id: specimen.id, ownerId: playerId, speciesId: line.speciesId, cloneLineId: line.id, stage: 'mature', plantedAt: specimen.plantedAt.toISOString(), lastUpdatedAt: specimen.updatedAt.toISOString(), collectedAt: specimen.collectedAt.toISOString(), genetics: { vigor: profile.vigor, growthSpeed: profile.growthSpeed, size: profile.size, flowering: profile.flowering, mutationChance: profile.mutationChance }, geneticFeatures: seed?.geneticFeatures ?? [], specialVariants: variants.filter((entry) => entry.variantId === 'shiny').map((entry) => ({ variantId: 'shiny' as const, origin: 'random' as const, establishedAt: entry.establishedAt.toISOString() })), isHarvestable: false, isListedForSale: false, isHybrid: seed?.isHybrid ?? false }
  }

  private async persistResearchResult(tx: Transaction, playerId: string, profile: typeof playerOnboarding.$inferSelect, state: typeof playerGrowerState.$inferSelect, research: typeof state.research, xpAwarded: number, now: Date) {
    await tx.update(playerGrowerState).set({ research, version: state.version + 1, updatedAt: now }).where(eq(playerGrowerState.playerId, playerId))
    if (xpAwarded > 0) await tx.update(playerOnboarding).set({ geneticsXp: profile.geneticsXp + xpAwarded, version: profile.version + 1 }).where(eq(playerOnboarding.playerId, playerId))
  }

  private async recordEvent(tx: Transaction, playerId: string, commandId: string, eventType: string, occurredAt: Date, payload: object) {
    await tx.insert(playerGrowerEvents).values({ id: crypto.randomUUID(), playerId, eventType, sourceCommandId: commandId, occurredAt, payload })
    if (!['plantSeed', 'plantBredSeed', 'collectPlant', 'breedPlant', 'npcSale', 'marketplaceListing'].includes(eventType)) return
    const [[state], [profile], events] = await Promise.all([
      tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).for('update').limit(1),
      tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).limit(1),
      tx.select({ eventType: playerGrowerEvents.eventType }).from(playerGrowerEvents).where(eq(playerGrowerEvents.playerId, playerId)),
    ])
    if (!state || !profile) throw new Error('The Grower state is not initialized.')
    const counts: ProgressionEventCounts = { plantSeed: 0, plantBredSeed: 0, collectPlant: 0, breedPlant: 0, npcSale: 0, marketplaceListing: 0 }
    for (const event of events) if (event.eventType in counts) counts[event.eventType as keyof ProgressionEventCounts] += 1
    const achievements = evaluateAchievements(state.achievements.length ? state.achievements : createAchievementProgress(), counts, { cultivation: { xp: profile.cultivationXp }, breeding: { xp: profile.breedingXp }, genetics: { xp: profile.geneticsXp } }, getDiscoveredSpeciesCount(state.discoveries), occurredAt.toISOString())
    await tx.update(playerGrowerState).set({ achievements, version: state.version + 1, updatedAt: occurredAt }).where(eq(playerGrowerState.playerId, playerId))
  }

  private async projectWith(tx: Transaction, playerId: string): Promise<GrowerAlphaProjectionV1> {
    const [[profile], [state], listings, treatments] = await Promise.all([
      tx.select().from(playerOnboarding).where(eq(playerOnboarding.playerId, playerId)).limit(1),
      tx.select().from(playerGrowerState).where(eq(playerGrowerState.playerId, playerId)).limit(1),
      tx.select().from(marketplaceListings).where(eq(marketplaceListings.sellerPlayerId, playerId)),
      tx.select().from(bredSeedTreatments).where(eq(bredSeedTreatments.ownerPlayerId, playerId)),
    ])
    if (!profile || !state) throw new Error('The Grower profile is not initialized.')
    return { projectionVersion: 1, version: Math.max(profile.version, state.version), player: { playerId, tokenBalance: profile.tokenBalance, skills: { cultivationXp: profile.cultivationXp, breedingXp: profile.breedingXp, geneticsXp: profile.geneticsXp } }, achievements: state.achievements, discoveries: state.discoveries, journalStats: state.journalStats, research: state.research, lab: state.lab, property: state.property, marketplaceListings: listings.filter((row) => row.status !== 'sold').map((row) => ({ id: row.id, sellerId: row.sellerPlayerId, plantId: row.specimenId, askingPrice: row.askingPrice, createdAt: row.createdAt.toISOString(), status: row.status as 'active' | 'cancelled', ...(row.completedAt ? { cancelledAt: row.completedAt.toISOString() } : {}) })), seedTreatments: Object.fromEntries(treatments.map((row) => [row.seedId, row.treatment])) }
  }
}
