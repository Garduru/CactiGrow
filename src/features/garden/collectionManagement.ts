import type { CollectedPlant } from '../../game/gameState.ts'
import type { GardenOrganizationState } from '../../types/garden.ts'
import type { CloneResearchRecord, GeneticsResearchState } from '../../types/research.ts'
import { getSpeciesById } from '../../data/species.ts'
import { getNextResearchStep } from '../research/researchModel.ts'
import { getResearchDepthDefinition } from '../research/researchConfig.ts'

export const MAX_RESEARCH_BATCH = 100
export const COLLECTION_PAGE_SIZE = 60
export type CollectionSort = 'newest' | 'oldest' | 'name' | 'favorites' | 'clone-line'
export interface CollectionFilters {
  favorite: boolean
  research: 'all' | 'unresearched' | 'researched' | 'available' | 'complete'
  species: string
  search: string
  breeding: boolean
  listing: 'all' | 'listed' | 'unlisted'
}
export const DEFAULT_COLLECTION_FILTERS: CollectionFilters = { favorite: false, research: 'all', species: '', search: '', breeding: false, listing: 'all' }

export function isProtectedFromTransfer(metadata: { favorite: boolean } | undefined): boolean {
  return Boolean(metadata?.favorite)
}
export function isEligibleForBreeding(plant: CollectedPlant): boolean {
  return plant.stage === 'mature' && !plant.isListedForSale && Boolean(getSpeciesById(plant.speciesId)?.genus)
}
export function isEligibleForResearch(plant: CollectedPlant, record: CloneResearchRecord | undefined, level: number): boolean {
  return plant.stage === 'mature' && record?.analysisDepth !== 'fully-characterized' && level >= getNextResearchStep(record).requiredLevel
}
// Reuse the existing organization upgrade; no new skill threshold or XP curve.
export function canUseBulkResearch(property: { buildings: { garden: { level: number } } }): boolean {
  return property.buildings.garden.level >= 2
}
export const canUseBulkBreeding = canUseBulkResearch

export function researchStatus(record: CloneResearchRecord | undefined): string {
  return !record ? 'Unresearched' : record.analysisDepth === 'fully-characterized' ? 'Research complete' : `Studied · ${getResearchDepthDefinition(record.analysisDepth).label}`
}

export function reviewResearchBatch(plants: readonly CollectedPlant[], research: GeneticsResearchState, level: number) {
  const seen = new Set<string>()
  const eligible: CollectedPlant[] = []
  let skipped = 0
  for (const plant of plants) {
    if (seen.has(plant.cloneLineId) || !isEligibleForResearch(plant, research.records[plant.cloneLineId], level)) skipped += 1
    else { seen.add(plant.cloneLineId); eligible.push(plant) }
  }
  return { eligible, skipped }
}

export function manageCollection(plants: readonly CollectedPlant[], organization: GardenOrganizationState, research: GeneticsResearchState, level: number, filters: CollectionFilters, sort: CollectionSort): CollectedPlant[] {
  const query = filters.search.trim().toLocaleLowerCase()
  const names = new Map<string, string>()
  const name = (id: string) => {
    if (!names.has(id)) { const species = getSpeciesById(id); names.set(id, `${species?.commonName ?? id} ${species?.scientificName ?? ''}`.toLocaleLowerCase()) }
    return names.get(id)!
  }
  const result = plants.filter((plant) => {
    const record = research.records[plant.cloneLineId]
    if (filters.favorite && !isProtectedFromTransfer(organization[plant.id])) return false
    if (filters.species && filters.species !== plant.speciesId) return false
    if (filters.breeding && !isEligibleForBreeding(plant)) return false
    if (filters.listing === 'listed' && !plant.isListedForSale || filters.listing === 'unlisted' && plant.isListedForSale) return false
    if (filters.research === 'unresearched' && record || filters.research === 'researched' && !record) return false
    if (filters.research === 'complete' && record?.analysisDepth !== 'fully-characterized') return false
    if (filters.research === 'available' && !isEligibleForResearch(plant, record, level)) return false
    // Only public identity and player-entered tags; never raw genetic values.
    return !query || `${plant.nickname ?? ""} ${name(plant.speciesId)} ${plant.id} ${(organization[plant.id]?.tags ?? []).join(' ')}`.toLocaleLowerCase().includes(query)
  })
  return result.sort((a, b) => {
    let order = 0
    if (sort === 'newest' || sort === 'oldest') order = (Date.parse(a.collectedAt) - Date.parse(b.collectedAt)) * (sort === 'newest' ? -1 : 1)
    if (sort === 'name') order = name(a.speciesId).localeCompare(name(b.speciesId))
    if (sort === 'clone-line') order = a.cloneLineId.localeCompare(b.cloneLineId)
    if (sort === 'favorites') order = Number(isProtectedFromTransfer(organization[b.id])) - Number(isProtectedFromTransfer(organization[a.id]))
    return order || a.id.localeCompare(b.id)
  })
}
