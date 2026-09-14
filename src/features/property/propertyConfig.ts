import type { DevelopedBuildingLevel, PropertyUpgradeDefinition } from '../../types/property'

export interface NurseryLevelDefinition {
  level: DevelopedBuildingLevel
  name: string
  growSlotCapacity: number
  futureCapabilities: readonly string[]
}

export const NURSERY_EXPANDED_BENCHES_UPGRADE_ID = 'nursery-expanded-benches'
export const GARDEN_ORGANIZED_BEDS_UPGRADE_ID = 'garden-organized-beds'

export const gardenLevels = [
  { level: 1, name: 'Cactus Garden', capabilities: ['Basic mature specimen interactions'] },
  { level: 2, name: 'Organized Beds', capabilities: ['Favorites', 'Tags', 'Collection filters', 'Sorting and grouping'] },
  { level: 3, name: "Breeder's Garden", capabilities: ['Future parent shortlists, comparison sets, and lineage shortcuts'] },
  { level: 4, name: 'Clone Grove', capabilities: ['Future clone-line grouping and propagation-history tools'] },
  { level: 5, name: 'Exhibition Garden', capabilities: ['Future curated display zones'] },
] as const

export const nurseryLevels: readonly NurseryLevelDefinition[] = [
  { level: 1, name: 'Starter Greenhouse', growSlotCapacity: 6, futureCapabilities: [] },
  { level: 2, name: 'Expanded Benches', growSlotCapacity: 8, futureCapabilities: [] },
  { level: 3, name: 'Propagation House', growSlotCapacity: 12, futureCapabilities: ['Future batch planting'] },
  { level: 4, name: 'Climate Nursery', growSlotCapacity: 16, futureCapabilities: ['Future cultivation efficiency'] },
  { level: 5, name: 'Master Greenhouse', growSlotCapacity: 20, futureCapabilities: ['Future advanced growing support'] },
]

export const propertyUpgrades: readonly PropertyUpgradeDefinition[] = [
  {
    id: NURSERY_EXPANDED_BENCHES_UPGRADE_ID,
    buildingId: 'nursery',
    fromLevel: 1,
    toLevel: 2,
    name: 'Expanded Benches',
    tokenCost: 500,
    skillRequirements: [{ skillId: 'cultivation', level: 10 }],
    resourceRequirements: [],
    capabilities: ['8 grow slots'],
    implemented: true,
  },
  {
    id: 'nursery-propagation-house', buildingId: 'nursery', fromLevel: 2, toLevel: 3,
    name: 'Propagation House', tokenCost: null, skillRequirements: [], resourceRequirements: [],
    capabilities: ['12 grow slots', 'Future batch planting'], implemented: false,
  },
  {
    id: 'nursery-climate-nursery', buildingId: 'nursery', fromLevel: 3, toLevel: 4,
    name: 'Climate Nursery', tokenCost: null, skillRequirements: [], resourceRequirements: [],
    capabilities: ['16 grow slots', 'Future cultivation efficiency'], implemented: false,
  },
  {
    id: 'nursery-master-greenhouse', buildingId: 'nursery', fromLevel: 4, toLevel: 5,
    name: 'Master Greenhouse', tokenCost: null, skillRequirements: [], resourceRequirements: [],
    capabilities: ['20 grow slots', 'Future advanced growing support'], implemented: false,
  },
  {
    id: GARDEN_ORGANIZED_BEDS_UPGRADE_ID,
    buildingId: 'garden', fromLevel: 1, toLevel: 2, name: 'Organized Beds', tokenCost: 550,
    skillRequirements: [{ skillId: 'cultivation', level: 10 }], resourceRequirements: [],
    capabilities: ['Favorites', 'Tags', 'Collection filters', 'Sorting and grouping'], implemented: true,
  },
  {
    id: 'garden-breeders-garden', buildingId: 'garden', fromLevel: 2, toLevel: 3,
    name: "Breeder's Garden", tokenCost: null, skillRequirements: [], resourceRequirements: [],
    capabilities: ['Future parent shortlists, comparison sets, and lineage shortcuts'], implemented: false,
  },
]

export function getNurseryLevelDefinition(level: DevelopedBuildingLevel): NurseryLevelDefinition {
  return nurseryLevels.find((entry) => entry.level === level)!
}

export function getGardenLevelDefinition(level: DevelopedBuildingLevel) {
  return gardenLevels.find((entry) => entry.level === level)!
}
