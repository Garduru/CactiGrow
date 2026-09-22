import type { AchievementProgress } from '../../src/types/achievement.ts'
import type { SpeciesDiscoveries, JournalStats } from '../../src/types/journal.ts'
import type { GeneticsLabState, GeneticsLabTierId, QuantitativeExtractTarget } from '../../src/types/lab.ts'
import type { MarketplaceListing } from '../../src/types/marketplace.ts'
import type { PropertyState, FarmAccessPreference } from '../../src/types/property.ts'
import type { GeneticsResearchState } from '../../src/types/research.ts'
import type { QuantitativeSeedTreatment } from '../../src/types/treatment.ts'

export interface GrowerAlphaProjectionV1 {
  projectionVersion: 1
  version: number
  player: {
    playerId: string
    tokenBalance: number
    skills: { cultivationXp: number; breedingXp: number; geneticsXp: number }
  }
  achievements: AchievementProgress[]
  discoveries: SpeciesDiscoveries
  journalStats: JournalStats
  research: GeneticsResearchState
  lab: GeneticsLabState
  property: PropertyState
  marketplaceListings: MarketplaceListing[]
  seedTreatments: Record<string, QuantitativeSeedTreatment>
}

export type GrowerAlphaCommandV1 =
  | { type: 'sell-specimen-to-npc'; commandId: string; specimenId: string }
  | { type: 'list-specimen'; commandId: string; specimenId: string; askingPrice: number }
  | { type: 'cancel-listing'; commandId: string; listingId: string }
  | { type: 'observe-specimen'; commandId: string; specimenId: string }
  | { type: 'analyze-specimen'; commandId: string; specimenId: string }
  | { type: 'compare-specimens'; commandId: string; firstSpecimenId: string; secondSpecimenId: string }
  | { type: 'collect-tissue-sample'; commandId: string; specimenId: string }
  | { type: 'extract-sample'; commandId: string; sampleId: string; target: QuantitativeExtractTarget }
  | { type: 'apply-seed-treatment'; commandId: string; extractId: string; seedId: string }
  | { type: 'upgrade-lab'; commandId: string; targetTier: GeneticsLabTierId }
  | { type: 'upgrade-property'; commandId: string; upgradeId: string }
  | { type: 'set-farm-access'; commandId: string; preference: FarmAccessPreference }

export type GrowerAlphaCommandInputV1 = GrowerAlphaCommandV1 extends infer Command
  ? Command extends { commandId: string } ? Omit<Command, 'commandId'> : never
  : never

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const farmAccess = new Set(['nobody', 'friends', 'invite', 'anyone'])
const extractTargets = new Set(['vigor', 'growthSpeed', 'size', 'flowering', 'mutationChance'])

export function isGrowerAlphaCommandV1(value: unknown): value is GrowerAlphaCommandV1 {
  if (!value || typeof value !== 'object') return false
  const command = value as Record<string, unknown>
  if (typeof command.type !== 'string' || typeof command.commandId !== 'string' || !UUID.test(command.commandId)) return false
  if (command.type === 'sell-specimen-to-npc' || command.type === 'list-specimen' || command.type === 'observe-specimen' || command.type === 'analyze-specimen' || command.type === 'collect-tissue-sample') {
    if (typeof command.specimenId !== 'string') return false
    return command.type !== 'list-specimen' || (Number.isSafeInteger(command.askingPrice) && Number(command.askingPrice) > 0 && Number(command.askingPrice) <= 1_000_000)
  }
  if (command.type === 'cancel-listing') return typeof command.listingId === 'string'
  if (command.type === 'compare-specimens') return typeof command.firstSpecimenId === 'string' && typeof command.secondSpecimenId === 'string'
  if (command.type === 'extract-sample') return typeof command.sampleId === 'string' && extractTargets.has(String(command.target))
  if (command.type === 'apply-seed-treatment') return typeof command.extractId === 'string' && typeof command.seedId === 'string'
  if (command.type === 'upgrade-lab') return Number.isInteger(command.targetTier) && Number(command.targetTier) >= 0 && Number(command.targetTier) <= 5
  if (command.type === 'upgrade-property') return typeof command.upgradeId === 'string'
  return command.type === 'set-farm-access' && farmAccess.has(String(command.preference))
}

export function isGrowerAlphaProjectionV1(value: unknown): value is GrowerAlphaProjectionV1 {
  if (!value || typeof value !== 'object') return false
  const projection = value as Record<string, unknown>
  if (projection.projectionVersion !== 1 || !Number.isInteger(projection.version)) return false
  const player = projection.player as Record<string, unknown> | undefined
  const skills = player?.skills as Record<string, unknown> | undefined
  return typeof player?.playerId === 'string'
    && Number.isInteger(player.tokenBalance)
    && Number.isInteger(skills?.cultivationXp)
    && Number.isInteger(skills?.breedingXp)
    && Number.isInteger(skills?.geneticsXp)
    && Array.isArray(projection.achievements)
    && typeof projection.discoveries === 'object'
    && typeof projection.research === 'object'
    && typeof projection.lab === 'object'
    && typeof projection.property === 'object'
    && Array.isArray(projection.marketplaceListings)
    && typeof projection.seedTreatments === 'object'
}
