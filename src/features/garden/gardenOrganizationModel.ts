import type { CollectedPlant } from '../../game/gameState'
import type { GardenFilters, GardenOrganizationState, GardenSort } from '../../types/garden'

export const MAX_GARDEN_TAG_LENGTH = 24
export const MAX_GARDEN_TAGS_PER_SPECIMEN = 6

export function normalizeGardenTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ')
}

function tagKey(tag: string): string {
  return normalizeGardenTag(tag).toLocaleLowerCase()
}

export function setGardenFavorite(state: GardenOrganizationState, specimenId: string, favorite: boolean): GardenOrganizationState {
  const current = state[specimenId]
  if ((current?.favorite ?? false) === favorite) return state
  return { ...state, [specimenId]: { specimenId, favorite, tags: current?.tags ?? [] } }
}

export function addGardenTag(state: GardenOrganizationState, specimenId: string, input: string): GardenOrganizationState {
  const tag = normalizeGardenTag(input)
  const current = state[specimenId]
  const tags = current?.tags ?? []
  if (!tag || tag.length > MAX_GARDEN_TAG_LENGTH || tags.length >= MAX_GARDEN_TAGS_PER_SPECIMEN || tags.some((entry) => tagKey(entry) === tagKey(tag))) return state
  return { ...state, [specimenId]: { specimenId, favorite: current?.favorite ?? false, tags: [...tags, tag] } }
}

export function removeGardenTag(state: GardenOrganizationState, specimenId: string, input: string): GardenOrganizationState {
  const current = state[specimenId]
  if (!current) return state
  const tags = current.tags.filter((tag) => tagKey(tag) !== tagKey(input))
  if (tags.length === current.tags.length) return state
  if (!current.favorite && tags.length === 0) {
    const remaining = { ...state }
    delete remaining[specimenId]
    return remaining
  }
  return { ...state, [specimenId]: { ...current, tags } }
}

export function removeGardenOrganization(state: GardenOrganizationState, specimenId: string): GardenOrganizationState {
  if (!state[specimenId]) return state
  const remaining = { ...state }
  delete remaining[specimenId]
  return remaining
}

export function getGardenTags(state: GardenOrganizationState): string[] {
  const tags = Object.values(state).flatMap((entry) => entry.tags)
  return [...new Map(tags.map((tag) => [tagKey(tag), tag])).values()].sort((a, b) => a.localeCompare(b))
}

export function filterAndSortGardenPlants(plants: readonly CollectedPlant[], organization: GardenOrganizationState, filters: GardenFilters, sort: GardenSort): CollectedPlant[] {
  const filtered = plants.filter((plant) => {
    const metadata = organization[plant.id]
    if (filters.favoriteOnly && !metadata?.favorite) return false
    if (filters.speciesId && plant.speciesId !== filters.speciesId) return false
    if (filters.tag && !metadata?.tags.some((tag) => tagKey(tag) === tagKey(filters.tag))) return false
    if (filters.listing === 'listed' && !plant.isListedForSale) return false
    if (filters.listing === 'unlisted' && plant.isListedForSale) return false
    if (filters.special === 'shiny' && !plant.specialVariants.some((variant) => variant.variantId === 'shiny')) return false
    if (filters.special === 'hybrid' && !plant.isHybrid) return false
    return true
  })
  return filtered.map((plant, index) => ({ plant, index })).sort((a, b) => {
    let comparison = 0
    if (sort === 'recent') comparison = Date.parse(b.plant.collectedAt) - Date.parse(a.plant.collectedAt)
    if (sort === 'species') comparison = a.plant.speciesId.localeCompare(b.plant.speciesId)
    if (sort === 'favorite') comparison = Number(Boolean(organization[b.plant.id]?.favorite)) - Number(Boolean(organization[a.plant.id]?.favorite))
    if (sort === 'clone-line') comparison = a.plant.cloneLineId.localeCompare(b.plant.cloneLineId)
    return comparison || a.index - b.index || a.plant.id.localeCompare(b.plant.id)
  }).map(({ plant }) => plant)
}
