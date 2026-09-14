import type { CloneLine, CloneLineRegistry, GeneticOriginType } from '../../types/cloneLine'
import type { Plant } from '../../types/plant'

export function createCloneLine(
  id: string,
  speciesId: string,
  establishedAt: string,
  originType: GeneticOriginType,
  originSpecimenId?: string,
  originPlayerId?: string,
  activeKnownSpecimens = 1,
): CloneLine {
  return {
    id,
    speciesId,
    establishedAt,
    originType,
    originSpecimenId,
    originPlayerId,
    localStats: {
      totalPropagated: 0,
      activeKnownSpecimens,
    },
  }
}

export function createInitialCloneLineRegistry(plants: readonly Plant[]): CloneLineRegistry {
  return Object.fromEntries(plants.map((plant) => [
    plant.cloneLineId,
    createCloneLine(
      plant.cloneLineId,
      plant.speciesId,
      plant.plantedAt,
      'unknown',
      plant.id,
      plant.ownerId,
    ),
  ]))
}

export function registerCloneLine(
  registry: CloneLineRegistry,
  cloneLine: CloneLine,
): CloneLineRegistry | null {
  if (!cloneLine.id || registry[cloneLine.id]) return null
  return { ...registry, [cloneLine.id]: cloneLine }
}

export function registerActiveSpecimen(
  registry: CloneLineRegistry,
  cloneLineId: string,
): CloneLineRegistry | null {
  const cloneLine = registry[cloneLineId]
  if (!cloneLine) return null
  return {
    ...registry,
    [cloneLineId]: {
      ...cloneLine,
      localStats: {
        ...cloneLine.localStats,
        activeKnownSpecimens: cloneLine.localStats.activeKnownSpecimens + 1,
      },
    },
  }
}

export function unregisterActiveSpecimen(registry: CloneLineRegistry, cloneLineId: string): CloneLineRegistry {
  const cloneLine = registry[cloneLineId]
  if (!cloneLine || cloneLine.localStats.activeKnownSpecimens <= 0) return registry
  return {
    ...registry,
    [cloneLineId]: {
      ...cloneLine,
      localStats: {
        ...cloneLine.localStats,
        activeKnownSpecimens: cloneLine.localStats.activeKnownSpecimens - 1,
      },
    },
  }
}
