export type GeneticOriginType = 'starter' | 'shop' | 'bred' | 'wild' | 'expedition' | 'unknown'

export interface CloneLineLocalStats {
  totalPropagated: number
  activeKnownSpecimens: number
}

export interface CloneLineEcosystemStats {
  totalPropagated: number
  activeKnownSpecimens: number
  uniqueOwnerCount: number
  authoritativeAsOf: string
}

export interface CloneLine {
  id: string
  speciesId: string
  originSpecimenId?: string
  originPlayerId?: string
  establishedAt: string
  originType: GeneticOriginType
  localStats: CloneLineLocalStats
  ecosystemStats?: CloneLineEcosystemStats
}

export type CloneLineRegistry = Record<string, CloneLine>
