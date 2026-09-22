import { getSpeciesById } from '../../data/species.ts'
import type { DiscoverySource, SpeciesDiscoveries } from '../../types/journal'
import type { JournalStats } from '../../types/journal'
import type { SpecialVariantState } from '../../types/geneticFeature'

export const discoverySourceLabels: Record<DiscoverySource, string> = {
  starter: 'Starter',
  shop: 'Shop',
  breeding: 'Breeding',
  unknown: 'Unknown prototype source',
  expedition: 'Expedition',
}

export interface SpeciesDiscoveryObservation {
  speciesId: string
  source: DiscoverySource
  sourceRef?: string
}

export function discoverSpecies(
  discoveries: SpeciesDiscoveries,
  observation: SpeciesDiscoveryObservation,
  discoveredAt: number,
): SpeciesDiscoveries {
  if (!Number.isFinite(discoveredAt)
    || discoveries[observation.speciesId]
    || !getSpeciesById(observation.speciesId)) return discoveries

  return {
    ...discoveries,
    [observation.speciesId]: {
      speciesId: observation.speciesId,
      firstDiscoveredAt: new Date(discoveredAt).toISOString(),
      discoverySource: observation.source,
      firstSourceRef: observation.sourceRef,
    },
  }
}

export function createSpeciesDiscoveries(
  observations: readonly SpeciesDiscoveryObservation[],
  discoveredAt: number,
): SpeciesDiscoveries {
  return observations.reduce(
    (discoveries, observation) => discoverSpecies(discoveries, observation, discoveredAt),
    {} as SpeciesDiscoveries,
  )
}

export function getDiscoveredSpeciesCount(discoveries: SpeciesDiscoveries): number {
  return Object.keys(discoveries).length
}

export function getJournalCompletion(discoveredCount: number, catalogCount: number): number {
  if (catalogCount <= 0) return 0
  return Math.round((Math.min(discoveredCount, catalogCount) / catalogCount) * 100)
}

export function recordShinyDiscovery(
  stats: JournalStats,
  cloneLineId: string,
  variants: readonly SpecialVariantState[],
): JournalStats {
  if (!variants.some((variant) => variant.variantId === 'shiny')
    || stats.shinyCloneLineIds.includes(cloneLineId)) return stats
  return { shinyCloneLineIds: [...stats.shinyCloneLineIds, cloneLineId] }
}

export function getShinyDiscoveryCount(stats: JournalStats): number {
  return stats.shinyCloneLineIds.length
}
