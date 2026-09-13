import type { GeneticsLabTierId } from '../../types/lab'
import { geneticsLabTiers, labWorldVisualKeys } from '../lab/labConfig'

export type FarmLocationId = 'nursery' | 'garden' | 'lab' | 'shop' | 'market'
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
  { id: 'nursery', displayName: 'Nursery', route: '/nursery', description: 'Raise seeds into mature cactus specimens.', purpose: 'Plant seeds, monitor growth, and collect mature plants.', visualKey: 'nursery', bonuses: [] },
  { id: 'garden', displayName: 'Garden', route: '/garden', description: 'Your collection of cultivated and prized cactus specimens.', purpose: 'Inspect plants and begin specimen-based actions.', visualKey: 'garden', bonuses: [] },
  { id: 'lab', displayName: 'Genetics Lab', route: '/lab', description: 'Study genetic traits, manage tissue samples, and advance genetics research.', purpose: 'Research specimens, manage samples and extracts, and improve the facility.', visualKey: 'lab-site', bonuses: [] },
  { id: 'shop', displayName: 'Shop', route: '/shop', description: 'A local source for cactus seeds and growing supplies.', purpose: 'Purchase available seeds and supplies.', visualKey: 'shop', bonuses: [] },
  { id: 'market', displayName: 'Marketplace', route: '/market', description: 'A trading place for unusual player-listed specimens.', purpose: 'Browse listings and manage market activity.', visualKey: 'market', bonuses: [] },
]

export interface ResolvedWorldBuilding extends WorldBuildingDefinition {
  currentTier?: { id: number; name: string }
  capabilities: readonly string[]
}

export function resolveWorldBuilding(building: WorldBuildingDefinition, labTier: GeneticsLabTierId): ResolvedWorldBuilding {
  if (building.id !== 'lab') return { ...building, capabilities: [] }
  const tier = geneticsLabTiers.find((entry) => entry.id === labTier)!
  return { ...building, visualKey: labWorldVisualKeys[labTier], currentTier: { id: tier.id, name: tier.name }, capabilities: tier.capabilities }
}
