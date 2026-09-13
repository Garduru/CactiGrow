export type DiscoverySource = 'starter' | 'shop' | 'breeding' | 'unknown' | 'expedition'

export interface SpeciesDiscovery {
  speciesId: string
  firstDiscoveredAt: string
  discoverySource: DiscoverySource
  firstSourceRef?: string
}

export type SpeciesDiscoveries = Record<string, SpeciesDiscovery>

export interface JournalStats {
  shinyCloneLineIds: string[]
}
