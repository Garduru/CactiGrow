import { and, eq, inArray, sql } from 'drizzle-orm'
import type { CactiGrowDatabase } from '../db/client/database.ts'
import { cloneLines, cloneLineVariants, gameplayCommandReceipts, geneticProfiles, nurseryOccupancies, plantSpecimens, playerPlantLifecycleVersions, playerSeedStacks } from '../db/schema/index.ts'
import { NURSERY_SLOT_IDS, PLANT_LIFECYCLE_PROJECTION_VERSION, type CollectPlantCommandV1, type CollectPlantResultV1, type NurserySlotV1, type PlantCommoditySeedCommandV1, type PlantCommoditySeedResultV1, type PlantLifecycleProjectionV1, type PlantSpecimenV1 } from '../../shared/api/plantLifecycleV1.ts'
import { ApiError } from '../api/errors.ts'
import { DEVELOPMENT_GROWTH_RULE_VERSION, GENETIC_ESTABLISHMENT_RULE_VERSION, GENETIC_REPRESENTATION_VERSION, VISUAL_DERIVATION_VERSION, establishCommoditySeedGenetics, resolveDevelopmentReadyAt, rollShiny, secureUint16, type SecureUint16 } from './plantLifecycleRules.ts'

type Transaction = Parameters<Parameters<CactiGrowDatabase['transaction']>[0]>[0]
type Clock = () => Date
type IdFactory = () => string
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface PlantLifecycleServiceOptions { environment: string; now?: Clock; createId?: IdFactory; randomUint16?: SecureUint16 }
export interface PlantLifecycleApplication {
  getProjection(playerId: string): Promise<PlantLifecycleProjectionV1>
  plantCommoditySeed(playerId: string, idempotencyKey: string, command: PlantCommoditySeedCommandV1): Promise<PlantCommoditySeedResultV1>
  collectPlant(playerId: string, idempotencyKey: string, command: CollectPlantCommandV1): Promise<CollectPlantResultV1>
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

  async getProjection(playerId: string): Promise<PlantLifecycleProjectionV1> {
    const stacks = await this.database.select().from(playerSeedStacks).where(eq(playerSeedStacks.playerId, playerId))
    const occupancies = await this.database.select().from(nurseryOccupancies).where(eq(nurseryOccupancies.playerId, playerId))
    const specimens = await this.database.select().from(plantSpecimens).where(eq(plantSpecimens.ownerPlayerId, playerId))
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
    const specimenById = new Map(specimens.map((specimen) => [specimen.id, this.projectSpecimen(specimen, lineById.get(specimen.cloneLineId), profileById.get(specimen.cloneLineId), variantsById.get(specimen.cloneLineId) ?? [])]))
    const occupancyBySlot = new Map(occupancies.map((occupancy) => [occupancy.slotId, occupancy]))
    return { projectionVersion: PLANT_LIFECYCLE_PROJECTION_VERSION, lifecycleVersion: lifecycleVersion(versionRows[0]?.version ?? 0), generatedAt: this.now().toISOString(), seedStacks: stacks.map((stack) => ({ speciesId: stack.speciesId, quantity: stack.quantity, version: stack.version })), nursery: { slots: NURSERY_SLOT_IDS.map((slotId): NurserySlotV1 => { const occupancy = occupancyBySlot.get(slotId); if (!occupancy) return { slotId, occupancy: null }; const specimen = specimenById.get(occupancy.specimenId); if (!specimen) throw new Error('Nursery occupancy references an unavailable specimen.'); return { slotId, occupancy: { specimen, plantedAt: occupancy.plantedAt.toISOString(), readyAt: occupancy.readyAt.toISOString(), growthRuleVersion: occupancy.growthRuleVersion, version: occupancy.version } } }) }, ownedSpecimens: specimens.filter((specimen) => specimen.lifecycleStatus === 'owned').map((specimen) => specimenById.get(specimen.id)!) }
  }

  async plantCommoditySeed(playerId: string, idempotencyKey: string, command: PlantCommoditySeedCommandV1): Promise<PlantCommoditySeedResultV1> {
    return this.runIdempotent(playerId, idempotencyKey, 'plant-commodity-seed', command, async (tx) => {
      const genetics = establishCommoditySeedGenetics(command.speciesId)
      if (!genetics) throw new ApiError('UNKNOWN_SPECIES', 400, 'The selected seed species is unavailable.')
      const [stack] = await tx.select().from(playerSeedStacks).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, command.speciesId))).for('update').limit(1)
      if (!stack) throw new ApiError('SEED_STACK_NOT_FOUND', 404, 'The requested seed stack was not found.')
      if (stack.version !== command.expectedSeedStackVersion) throw safeConflict('STALE_VERSION', 'The seed inventory changed. Refresh and try again.')
      if (stack.quantity < 1) throw safeConflict('SEED_UNAVAILABLE', 'No seeds remain in this stack.')
      const [occupied] = await tx.select({ specimenId: nurseryOccupancies.specimenId }).from(nurseryOccupancies).where(and(eq(nurseryOccupancies.playerId, playerId), eq(nurseryOccupancies.slotId, command.slotId))).limit(1)
      if (occupied) throw safeConflict('SLOT_OCCUPIED', 'That Nursery position is already occupied.')
      const plantedAt = this.now(); const readyAt = resolveDevelopmentReadyAt(plantedAt, this.options.environment)
      const cloneLineId = this.createId(); const specimenId = this.createId()
      if (!UUID.test(cloneLineId) || !UUID.test(specimenId) || cloneLineId === specimenId) throw new Error('The server generated an invalid entity identity.')
      const shiny = rollShiny(this.randomUint16)
      await tx.update(playerSeedStacks).set({ quantity: stack.quantity - 1, version: stack.version + 1, updatedAt: plantedAt }).where(and(eq(playerSeedStacks.playerId, playerId), eq(playerSeedStacks.speciesId, command.speciesId)))
      await tx.insert(cloneLines).values({ id: cloneLineId, speciesId: command.speciesId, originType: 'commodity-seed', originPlayerId: playerId, establishedAt: plantedAt, geneticRepresentationVersion: GENETIC_REPRESENTATION_VERSION, visualDerivationVersion: VISUAL_DERIVATION_VERSION, createdAt: plantedAt })
      await tx.insert(geneticProfiles).values({ cloneLineId, ...genetics, establishmentRuleVersion: GENETIC_ESTABLISHMENT_RULE_VERSION, createdAt: plantedAt })
      if (shiny) await tx.insert(cloneLineVariants).values({ cloneLineId, variantId: 'shiny', origin: 'random', establishedAt: plantedAt })
      await tx.insert(plantSpecimens).values({ id: specimenId, ownerPlayerId: playerId, cloneLineId, sourceType: 'commodity-seed', lifecycleStatus: 'growing', plantedAt, collectedAt: null, visualDerivationVersion: VISUAL_DERIVATION_VERSION, version: 1, createdAt: plantedAt, updatedAt: plantedAt })
      await tx.insert(nurseryOccupancies).values({ playerId, slotId: command.slotId, specimenId, plantedAt, readyAt, growthRuleVersion: DEVELOPMENT_GROWTH_RULE_VERSION, version: 1, createdAt: plantedAt, updatedAt: plantedAt })
      const version = await this.incrementVersion(tx, playerId, plantedAt)
      const specimen: PlantSpecimenV1 = { specimenId, cloneLineId, speciesId: command.speciesId, lifecycleStatus: 'growing', plantedAt: plantedAt.toISOString(), collectedAt: null, genetics, geneticFeatures: [], specialVariants: shiny ? [{ variantId: 'shiny', origin: 'random', establishedAt: plantedAt.toISOString() }] : [], geneticRepresentationVersion: GENETIC_REPRESENTATION_VERSION, visualDerivationVersion: VISUAL_DERIVATION_VERSION, version: 1 }
      return { commandId: idempotencyKey, lifecycleVersion: lifecycleVersion(version), seedStack: { speciesId: command.speciesId, quantity: stack.quantity - 1, version: stack.version + 1 }, slot: { slotId: command.slotId, occupancy: { specimen, plantedAt: plantedAt.toISOString(), readyAt: readyAt.toISOString(), growthRuleVersion: DEVELOPMENT_GROWTH_RULE_VERSION, version: 1 } } }
    })
  }

  async collectPlant(playerId: string, idempotencyKey: string, command: CollectPlantCommandV1): Promise<CollectPlantResultV1> {
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
      const [line] = await tx.select().from(cloneLines).where(eq(cloneLines.id, specimen.cloneLineId)).limit(1); const [profile] = await tx.select().from(geneticProfiles).where(eq(geneticProfiles.cloneLineId, specimen.cloneLineId)).limit(1); const variants = await tx.select().from(cloneLineVariants).where(eq(cloneLineVariants.cloneLineId, specimen.cloneLineId))
      const projected = this.projectSpecimen({ ...specimen, lifecycleStatus: 'owned', collectedAt, updatedAt: collectedAt, version: specimen.version + 1 }, line, profile, variants)
      return { commandId: idempotencyKey, lifecycleVersion: lifecycleVersion(version), slot: { slotId: command.slotId, occupancy: null }, specimen: projected }
    })
  }

  private projectSpecimen(specimen: typeof plantSpecimens.$inferSelect, line: typeof cloneLines.$inferSelect | undefined, profile: typeof geneticProfiles.$inferSelect | undefined, variants: Array<typeof cloneLineVariants.$inferSelect>): PlantSpecimenV1 {
    if (!line || !profile || (specimen.lifecycleStatus !== 'growing' && specimen.lifecycleStatus !== 'owned')) throw new Error('A persisted specimen has incomplete lifecycle data.')
    return { specimenId: specimen.id, cloneLineId: specimen.cloneLineId, speciesId: line.speciesId, lifecycleStatus: specimen.lifecycleStatus, plantedAt: specimen.plantedAt.toISOString(), collectedAt: specimen.collectedAt?.toISOString() ?? null, genetics: { vigor: profile.vigor, growthSpeed: profile.growthSpeed, size: profile.size, flowering: profile.flowering, mutationChance: profile.mutationChance }, geneticFeatures: [], specialVariants: variants.filter((variant) => variant.variantId === 'shiny').map((variant) => ({ variantId: 'shiny', origin: 'random', establishedAt: variant.establishedAt.toISOString() })), geneticRepresentationVersion: line.geneticRepresentationVersion, visualDerivationVersion: specimen.visualDerivationVersion, version: specimen.version }
  }
  private async incrementVersion(tx: Transaction, playerId: string, now: Date): Promise<number> { const [row] = await tx.insert(playerPlantLifecycleVersions).values({ playerId, version: 1, updatedAt: now }).onConflictDoUpdate({ target: playerPlantLifecycleVersions.playerId, set: { version: sql`${playerPlantLifecycleVersions.version} + 1`, updatedAt: now } }).returning({ version: playerPlantLifecycleVersions.version }); return row.version }
  private async runIdempotent<T extends object>(playerId: string, key: string, type: string, command: object, operation: (tx: Transaction) => Promise<T>): Promise<T> {
    if (!UUID.test(key)) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key header is required.')
    const requestFingerprint = fingerprint(type, command)
    const existing = await this.database.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, key))).limit(1)
    if (existing[0]) { if (existing[0].commandType !== type || existing[0].requestFingerprint !== requestFingerprint) throw safeConflict('IDEMPOTENCY_KEY_REUSED', 'The idempotency key was already used for another request.'); if (existing[0].status === 'completed') return existing[0].responsePayload as T }
    try { return await this.database.transaction(async (tx) => { await tx.insert(gameplayCommandReceipts).values({ playerId, idempotencyKey: key, commandType: type, requestFingerprint, status: 'processing' }); const response = await operation(tx); await tx.update(gameplayCommandReceipts).set({ status: 'completed', responsePayload: response, completedAt: this.now() }).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, key))); return response }) } catch (error) { if (databaseErrorCode(error) === '23505') { const [receipt] = await this.database.select().from(gameplayCommandReceipts).where(and(eq(gameplayCommandReceipts.playerId, playerId), eq(gameplayCommandReceipts.idempotencyKey, key))).limit(1); if (receipt?.status === 'completed' && receipt.commandType === type && receipt.requestFingerprint === requestFingerprint) return receipt.responsePayload as T } throw error }
  }
}
