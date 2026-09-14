export interface GardenSpecimenOrganization {
  specimenId: string
  favorite: boolean
  tags: string[]
}

export type GardenOrganizationState = Record<string, GardenSpecimenOrganization>

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
