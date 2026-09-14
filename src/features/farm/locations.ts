import type { BuildingId } from '../../types/property'
import type { GeneticsLabState } from '../../types/lab'
import type { PropertyState } from '../../types/property'
import { geneticsLabTiers, labWorldVisualKeys } from '../lab/labConfig'
import { getWorldBuildingLevel } from '../property/propertyModel'

export type FarmLocationId = BuildingId
export type BuildingBonusValueType = 'percent' | 'flat' | 'capacity' | 'unlock'

export interface BuildingBonusDefinition {
  id: string
  buildingId: FarmLocationId
  category: string
  displayName: string
  description: string
  value: number | string
  valueType: BuildingBonusValueType
  sourceTier?: number
  affectedSystem: string
}

export interface WorldBuildingDefinition {
  id: FarmLocationId
  displayName: string
  route: string
  description: string
  purpose: string
  visualKey: string
  bonuses: readonly BuildingBonusDefinition[]
}

export const farmLocations: readonly WorldBuildingDefinition[] = [
  { id: 'home', displayName: 'Home', route: '/home', description: 'The player homestead and center of the growing property.', purpose: 'Review property progress and future homestead features.', visualKey: 'home', bonuses: [] },
  { id: 'nursery', displayName: 'Nursery', route: '/nursery', description: 'Raise seeds into mature cactus specimens.', purpose: 'Plant seeds, monitor growth, and collect mature plants.', visualKey: 'nursery', bonuses: [] },
  { id: 'garden', displayName: 'Garden', route: '/garden', description: 'Your collection of cultivated and prized cactus specimens.', purpose: 'Inspect plants and begin specimen-based actions.', visualKey: 'garden', bonuses: [] },
  { id: 'lab', displayName: 'Genetics Lab', route: '/lab', description: 'Study genetic traits, manage tissue samples, and advance genetics research.', purpose: 'Research specimens, manage samples and extracts, and improve the facility.', visualKey: 'lab-site', bonuses: [] },
  { id: 'shop', displayName: 'Shop', route: '/shop', description: 'A local source for cactus seeds and growing supplies.', purpose: 'Purchase available seeds and supplies.', visualKey: 'shop', bonuses: [] },
  { id: 'market', displayName: 'Marketplace', route: '/market', description: 'A trading place for unusual player-listed specimens.', purpose: 'Browse listings and manage market activity.', visualKey: 'market', bonuses: [] },
]

export interface ResolvedWorldBuilding extends WorldBuildingDefinition {
  level: number
  label: string
  currentTier?: { id: number; name: string }
  capabilities: readonly string[]
}

export function resolveWorldBuilding(building: WorldBuildingDefinition, property: PropertyState, lab: GeneticsLabState): ResolvedWorldBuilding {
  const level = getWorldBuildingLevel(building.id, property, lab)
  if (building.id !== 'lab') return { ...building, level, label: `${building.displayName} · Lv. ${level}`, capabilities: [] }
  const tier = geneticsLabTiers.find((entry) => entry.id === lab.tier)!
  return { ...building, level, label: `${building.displayName} · Tier ${tier.id}`, visualKey: labWorldVisualKeys[lab.tier], currentTier: { id: tier.id, name: tier.name }, capabilities: tier.capabilities }
}
