import type { PlayerState } from '../../types/player'
import type { BuildingId, DevelopedBuildingLevel, PropertyBuildingId, PropertyState, PropertyUpgradeDefinition } from '../../types/property'
import type { GeneticsLabState } from '../../types/lab'
import { getLevelFromXp } from '../progression/progressionModel'
import { getNurseryLevelDefinition, propertyUpgrades } from './propertyConfig'

export const MAX_DEVELOPED_BUILDING_LEVEL: DevelopedBuildingLevel = 5
export const DEFAULT_DEVELOPED_BUILDING_LEVEL: DevelopedBuildingLevel = 1
export const propertyBuildingIds: readonly PropertyBuildingId[] = ['home', 'nursery', 'garden', 'shop', 'market']

export function createPropertyState(now: number): PropertyState {
  const installedAt = new Date(now).toISOString()
  return {
    buildings: Object.fromEntries(propertyBuildingIds.map((buildingId) => [buildingId, { buildingId, level: DEFAULT_DEVELOPED_BUILDING_LEVEL, installedAt }])) as PropertyState['buildings'],
    completedUpgradeIds: [],
    farmAccessPreference: 'nobody',
  }
}

export function getWorldBuildingLevel(buildingId: BuildingId, property: PropertyState, lab: GeneticsLabState): number {
  return buildingId === 'lab' ? lab.tier : property.buildings[buildingId].level
}

export interface PropertyUpgradeStatus {
  definition: PropertyUpgradeDefinition | null
  eligible: boolean
  reasons: string[]
}

export function getPropertyUpgradeDefinition(upgradeId: string): PropertyUpgradeDefinition | null {
  return propertyUpgrades.find((upgrade) => upgrade.id === upgradeId) ?? null
}

export function getNextPropertyUpgrade(buildingId: PropertyBuildingId, level: DevelopedBuildingLevel): PropertyUpgradeDefinition | null {
  return propertyUpgrades.find((upgrade) => upgrade.buildingId === buildingId && upgrade.fromLevel === level) ?? null
}

export function getPropertyUpgradeStatus(property: PropertyState, player: PlayerState, upgradeId: string): PropertyUpgradeStatus {
  const definition = getPropertyUpgradeDefinition(upgradeId)
  if (!definition) return { definition: null, eligible: false, reasons: ['Unknown property upgrade.'] }
  const reasons: string[] = []
  const building = property.buildings[definition.buildingId]
  if (!definition.implemented) reasons.push('This upgrade is not implemented yet.')
  if (definition.toLevel !== definition.fromLevel + 1) reasons.push('Upgrade levels must be sequential.')
  if (building.level !== definition.fromLevel) reasons.push(`Requires ${definition.buildingId} Level ${definition.fromLevel}.`)
  if (property.completedUpgradeIds.includes(definition.id)) reasons.push('This upgrade is already installed.')
  if (definition.tokenCost === null || !Number.isSafeInteger(definition.tokenCost) || definition.tokenCost < 0) reasons.push('This upgrade has no valid Token cost.')
  else if (player.tokens < definition.tokenCost) reasons.push(`Requires ${definition.tokenCost.toLocaleString()} Tokens.`)
  for (const requirement of definition.skillRequirements) {
    if (!Number.isInteger(requirement.level) || requirement.level < 1) reasons.push('This upgrade has a malformed skill requirement.')
    else if (getLevelFromXp(player.skills[requirement.skillId].xp) < requirement.level) reasons.push(`Requires ${requirement.skillId[0].toUpperCase()}${requirement.skillId.slice(1)} Level ${requirement.level}.`)
  }
  if (definition.resourceRequirements.length > 0) reasons.push('Required property resources are not implemented yet.')
  return { definition, eligible: reasons.length === 0, reasons }
}

export function getNurseryCapacity(property: PropertyState): number {
  return getNurseryLevelDefinition(property.buildings.nursery.level).growSlotCapacity
}
