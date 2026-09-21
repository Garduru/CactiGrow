export const PLANT_LIFECYCLE_PROJECTION_VERSION = 1 as const
export const NURSERY_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5', 'slot-6'] as const
export type NurserySlotIdV1 = typeof NURSERY_SLOT_IDS[number]

export interface PlantGeneticsV1 { vigor: number; growthSpeed: number; size: number; flowering: number; mutationChance: number }
export interface CommoditySeedStackV1 { speciesId: string; quantity: number; version: number }
export interface PlantSpecimenV1 {
  specimenId: string; cloneLineId: string; speciesId: string; lifecycleStatus: 'growing' | 'owned'
  plantedAt: string; collectedAt: string | null; genetics: PlantGeneticsV1; geneticFeatures: []
  specialVariants: Array<{ variantId: 'shiny'; origin: 'random'; establishedAt: string }>
  geneticRepresentationVersion: number; visualDerivationVersion: number; version: number
}
export type NurserySlotV1 = { slotId: NurserySlotIdV1; occupancy: null } | {
  slotId: NurserySlotIdV1; occupancy: { specimen: PlantSpecimenV1; plantedAt: string; readyAt: string; growthRuleVersion: number; version: number }
}
export interface PlantLifecycleProjectionV1 {
  projectionVersion: 1; lifecycleVersion: string; generatedAt: string
  seedStacks: CommoditySeedStackV1[]; nursery: { slots: NurserySlotV1[] }; ownedSpecimens: PlantSpecimenV1[]
}
export interface PlantCommoditySeedCommandV1 { slotId: NurserySlotIdV1; speciesId: string; expectedSeedStackVersion: number }
export interface CollectPlantCommandV1 { slotId: NurserySlotIdV1; specimenId: string; expectedOccupancyVersion: number; expectedSpecimenVersion: number }
export interface PlantCommoditySeedResultV1 { commandId: string; lifecycleVersion: string; seedStack: CommoditySeedStackV1; slot: NurserySlotV1 }
export interface CollectPlantResultV1 { commandId: string; lifecycleVersion: string; slot: NurserySlotV1; specimen: PlantSpecimenV1 }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const iso = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'
export const isNurserySlotIdV1 = (value: unknown): value is NurserySlotIdV1 => typeof value === 'string' && NURSERY_SLOT_IDS.includes(value as NurserySlotIdV1)
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value)
const genetics = (value: unknown): value is PlantGeneticsV1 => object(value) && exactKeys(value, ['vigor','growthSpeed','size','flowering','mutationChance']) && ['vigor','growthSpeed','size','flowering','mutationChance'].every((key) => Number.isInteger(value[key]) && Number(value[key]) >= 0 && Number(value[key]) <= 100)
export function isCommoditySeedStackV1(value: unknown): value is CommoditySeedStackV1 { return object(value) && exactKeys(value, ['speciesId','quantity','version']) && typeof value.speciesId === 'string' && Number.isInteger(value.quantity) && Number(value.quantity) >= 0 && Number.isInteger(value.version) && Number(value.version) >= 1 }
export function isPlantSpecimenV1(value: unknown): value is PlantSpecimenV1 {
  if (!object(value) || !exactKeys(value, ['specimenId','cloneLineId','speciesId','lifecycleStatus','plantedAt','collectedAt','genetics','geneticFeatures','specialVariants','geneticRepresentationVersion','visualDerivationVersion','version'])) return false
  return typeof value.specimenId === 'string' && UUID.test(value.specimenId) && typeof value.cloneLineId === 'string' && UUID.test(value.cloneLineId)
    && typeof value.speciesId === 'string' && (value.lifecycleStatus === 'growing' || value.lifecycleStatus === 'owned') && iso(value.plantedAt)
    && (value.collectedAt === null || iso(value.collectedAt)) && genetics(value.genetics) && Array.isArray(value.geneticFeatures) && value.geneticFeatures.length === 0
    && Array.isArray(value.specialVariants) && value.specialVariants.every((entry) => object(entry) && entry.variantId === 'shiny' && entry.origin === 'random' && iso(entry.establishedAt))
    && Number.isInteger(value.geneticRepresentationVersion) && Number.isInteger(value.visualDerivationVersion) && Number.isInteger(value.version)
}
export function isNurserySlotV1(value: unknown): value is NurserySlotV1 {
  if (!object(value) || !exactKeys(value, ['slotId','occupancy']) || !isNurserySlotIdV1(value.slotId)) return false
  if (value.occupancy === null) return true
  return object(value.occupancy) && exactKeys(value.occupancy, ['specimen','plantedAt','readyAt','growthRuleVersion','version']) && isPlantSpecimenV1(value.occupancy.specimen) && iso(value.occupancy.plantedAt) && iso(value.occupancy.readyAt) && Number.isInteger(value.occupancy.growthRuleVersion) && Number.isInteger(value.occupancy.version)
}
export function isPlantLifecycleProjectionV1(value: unknown): value is PlantLifecycleProjectionV1 {
  if (!object(value) || !exactKeys(value, ['projectionVersion','lifecycleVersion','generatedAt','seedStacks','nursery','ownedSpecimens']) || value.projectionVersion !== 1 || typeof value.lifecycleVersion !== 'string' || !iso(value.generatedAt) || !Array.isArray(value.seedStacks) || !object(value.nursery) || !exactKeys(value.nursery, ['slots']) || !Array.isArray(value.nursery.slots) || !Array.isArray(value.ownedSpecimens)) return false
  return value.seedStacks.every(isCommoditySeedStackV1)
    && value.nursery.slots.length === 6 && value.nursery.slots.every(isNurserySlotV1)
    && new Set(value.nursery.slots.map((slot) => slot.slotId)).size === NURSERY_SLOT_IDS.length
    && value.ownedSpecimens.every(isPlantSpecimenV1)
}
export function isPlantCommoditySeedCommandV1(value: unknown): value is PlantCommoditySeedCommandV1 { return object(value) && Object.keys(value).length === 3 && isNurserySlotIdV1(value.slotId) && typeof value.speciesId === 'string' && Number.isInteger(value.expectedSeedStackVersion) && Number(value.expectedSeedStackVersion) >= 1 }
export function isCollectPlantCommandV1(value: unknown): value is CollectPlantCommandV1 { return object(value) && Object.keys(value).length === 4 && isNurserySlotIdV1(value.slotId) && typeof value.specimenId === 'string' && UUID.test(value.specimenId) && Number.isInteger(value.expectedOccupancyVersion) && Number.isInteger(value.expectedSpecimenVersion) }
export function isPlantCommoditySeedResultV1(value: unknown): value is PlantCommoditySeedResultV1 { return object(value) && exactKeys(value, ['commandId','lifecycleVersion','seedStack','slot']) && typeof value.commandId === 'string' && UUID.test(value.commandId) && typeof value.lifecycleVersion === 'string' && isCommoditySeedStackV1(value.seedStack) && isNurserySlotV1(value.slot) }
export function isCollectPlantResultV1(value: unknown): value is CollectPlantResultV1 { return object(value) && exactKeys(value, ['commandId','lifecycleVersion','slot','specimen']) && typeof value.commandId === 'string' && UUID.test(value.commandId) && typeof value.lifecycleVersion === 'string' && isNurserySlotV1(value.slot) && isPlantSpecimenV1(value.specimen) }
