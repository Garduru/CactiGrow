import { isCommoditySeedStackV1, type CommoditySeedStackV1 } from './plantLifecycleV1.ts'
import { isBredSeedV2, isPlantSpecimenV2, type BredSeedV2, type PlantSpecimenV2 } from './plantLifecycleV2.ts'

export const NURSERY_SLOT_IDS_V3 = ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5', 'slot-6', 'slot-7', 'slot-8'] as const
export type NurserySlotIdV3 = typeof NURSERY_SLOT_IDS_V3[number]
export type NurserySlotV3 = { slotId: NurserySlotIdV3; occupancy: null } | {
  slotId: NurserySlotIdV3
  occupancy: { specimen: PlantSpecimenV2; plantedAt: string; readyAt: string; growthRuleVersion: number; version: number }
}
export interface PlantLifecycleProjectionV3 {
  projectionVersion: 3
  lifecycleVersion: string
  generatedAt: string
  seedStacks: CommoditySeedStackV1[]
  bredSeeds: BredSeedV2[]
  nursery: { capacity: 6 | 8; slots: NurserySlotV3[] }
  ownedSpecimens: PlantSpecimenV2[]
}
export interface PlantCommoditySeedCommandV3 { slotId: NurserySlotIdV3; speciesId: string; expectedSeedStackVersion: number }
export interface PlantBredSeedCommandV3 { slotId: NurserySlotIdV3; seedId: string }
export interface CollectPlantCommandV3 { slotId: NurserySlotIdV3; specimenId: string; expectedOccupancyVersion: number; expectedSpecimenVersion: number }
export interface PlantCommoditySeedResultV3 { commandId: string; lifecycleVersion: string; seedStack: CommoditySeedStackV1; slot: NurserySlotV3 }
export interface PlantBredSeedResultV3 { commandId: string; lifecycleVersion: string; seedId: string; slot: NurserySlotV3 }
export interface CollectPlantResultV3 { commandId: string; lifecycleVersion: string; slot: NurserySlotV3; specimen: PlantSpecimenV2 }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const date = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every((key) => key in value)
export const isNurserySlotIdV3 = (value: unknown): value is NurserySlotIdV3 => typeof value === 'string' && NURSERY_SLOT_IDS_V3.includes(value as NurserySlotIdV3)
export function isNurserySlotV3(value: unknown): value is NurserySlotV3 {
  if (!object(value) || !keys(value, ['slotId', 'occupancy']) || !isNurserySlotIdV3(value.slotId)) return false
  if (value.occupancy === null) return true
  return object(value.occupancy) && keys(value.occupancy, ['specimen', 'plantedAt', 'readyAt', 'growthRuleVersion', 'version'])
    && isPlantSpecimenV2(value.occupancy.specimen) && date(value.occupancy.plantedAt) && date(value.occupancy.readyAt)
    && Number.isInteger(value.occupancy.growthRuleVersion) && Number.isInteger(value.occupancy.version)
}
export function isPlantLifecycleProjectionV3(value: unknown): value is PlantLifecycleProjectionV3 {
  if (!object(value) || !keys(value, ['projectionVersion', 'lifecycleVersion', 'generatedAt', 'seedStacks', 'bredSeeds', 'nursery', 'ownedSpecimens']) || value.projectionVersion !== 3 || typeof value.lifecycleVersion !== 'string' || !date(value.generatedAt)) return false
  if (!Array.isArray(value.seedStacks) || !value.seedStacks.every(isCommoditySeedStackV1) || !Array.isArray(value.bredSeeds) || !value.bredSeeds.every(isBredSeedV2) || !Array.isArray(value.ownedSpecimens) || !value.ownedSpecimens.every(isPlantSpecimenV2)) return false
  if (!object(value.nursery) || !keys(value.nursery, ['capacity', 'slots']) || (value.nursery.capacity !== 6 && value.nursery.capacity !== 8) || !Array.isArray(value.nursery.slots)) return false
  return value.nursery.slots.length === 8 && value.nursery.slots.every(isNurserySlotV3) && new Set(value.nursery.slots.map((slot) => slot.slotId)).size === 8
}
export function isPlantCommoditySeedCommandV3(value: unknown): value is PlantCommoditySeedCommandV3 { return object(value) && keys(value, ['slotId', 'speciesId', 'expectedSeedStackVersion']) && isNurserySlotIdV3(value.slotId) && typeof value.speciesId === 'string' && Number.isInteger(value.expectedSeedStackVersion) && Number(value.expectedSeedStackVersion) >= 1 }
export function isPlantBredSeedCommandV3(value: unknown): value is PlantBredSeedCommandV3 { return object(value) && keys(value, ['slotId', 'seedId']) && isNurserySlotIdV3(value.slotId) && typeof value.seedId === 'string' && UUID.test(value.seedId) }
export function isCollectPlantCommandV3(value: unknown): value is CollectPlantCommandV3 { return object(value) && keys(value, ['slotId', 'specimenId', 'expectedOccupancyVersion', 'expectedSpecimenVersion']) && isNurserySlotIdV3(value.slotId) && typeof value.specimenId === 'string' && UUID.test(value.specimenId) && Number.isInteger(value.expectedOccupancyVersion) && Number.isInteger(value.expectedSpecimenVersion) }
export function isPlantCommoditySeedResultV3(value: unknown): value is PlantCommoditySeedResultV3 { return object(value) && keys(value, ['commandId', 'lifecycleVersion', 'seedStack', 'slot']) && typeof value.commandId === 'string' && UUID.test(value.commandId) && typeof value.lifecycleVersion === 'string' && isCommoditySeedStackV1(value.seedStack) && isNurserySlotV3(value.slot) }
export function isPlantBredSeedResultV3(value: unknown): value is PlantBredSeedResultV3 { return object(value) && keys(value, ['commandId', 'lifecycleVersion', 'seedId', 'slot']) && typeof value.commandId === 'string' && UUID.test(value.commandId) && typeof value.lifecycleVersion === 'string' && typeof value.seedId === 'string' && UUID.test(value.seedId) && isNurserySlotV3(value.slot) }
export function isCollectPlantResultV3(value: unknown): value is CollectPlantResultV3 { return object(value) && keys(value, ['commandId', 'lifecycleVersion', 'slot', 'specimen']) && typeof value.commandId === 'string' && UUID.test(value.commandId) && typeof value.lifecycleVersion === 'string' && isNurserySlotV3(value.slot) && isPlantSpecimenV2(value.specimen) }
