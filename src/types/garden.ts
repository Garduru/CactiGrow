export interface GardenSpecimenOrganization {
  specimenId: string
  favorite: boolean
  tags: string[]
}

export type GardenOrganizationState = Record<string, GardenSpecimenOrganization>

export const GARDEN_DISPLAY_SLOT_IDS = [
  'garden-display-back-left', 'garden-display-back-center', 'garden-display-back-right',
  'garden-display-front-left', 'garden-display-front-center', 'garden-display-front-right',
] as const
export type GardenDisplaySlotId = typeof GARDEN_DISPLAY_SLOT_IDS[number]
export type GardenDisplayAssignments = Record<GardenDisplaySlotId, string | null>

export type GardenListingFilter = 'all' | 'listed' | 'unlisted'
export type GardenSpecialFilter = 'all' | 'shiny' | 'hybrid'
export type GardenSort = 'recent' | 'species' | 'favorite' | 'clone-line'

export interface GardenFilters {
  favoriteOnly: boolean
  speciesId: string
  tag: string
  listing: GardenListingFilter
  special: GardenSpecialFilter
}
