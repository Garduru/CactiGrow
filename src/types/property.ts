export type BuildingId = 'home' | 'nursery' | 'garden' | 'lab' | 'shop' | 'market'
export type PropertyBuildingId = Exclude<BuildingId, 'lab'>
export type DevelopedBuildingLevel = 1 | 2 | 3 | 4 | 5
export type FarmAccessPreference = 'nobody' | 'friends' | 'invite' | 'anyone'

export interface BuildingProgressionState {
  buildingId: PropertyBuildingId
  level: DevelopedBuildingLevel
  installedAt?: string
  upgradedAt?: string
}

export interface PropertyState {
  buildings: Record<PropertyBuildingId, BuildingProgressionState>
  completedUpgradeIds: string[]
  farmAccessPreference: FarmAccessPreference
}

export interface PropertySkillRequirement {
  skillId: import('./skill').SkillId
  level: number
}

export interface PropertyResourceRequirement {
  resourceId: string
  quantity: number
}

export interface PropertyUpgradeDefinition {
  id: string
  buildingId: PropertyBuildingId
  fromLevel: DevelopedBuildingLevel
  toLevel: DevelopedBuildingLevel
  name: string
  tokenCost: number | null
  skillRequirements: readonly PropertySkillRequirement[]
  resourceRequirements: readonly PropertyResourceRequirement[]
  capabilities: readonly string[]
  implemented: boolean
}
