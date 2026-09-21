export interface SharedSpeciesDefinition {
  id: string
  commonName: string
  scientificName: string
  genus: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  growthTimeHours: number
  baseValue: number
  harvestValue: number
  imageKey: string
}

export const sharedSpecies = [
  { id: 'echinopsis-pachanoi', commonName: 'San Pedro', scientificName: 'Echinopsis pachanoi', genus: 'Echinopsis', rarity: 'common', growthTimeHours: 24, baseValue: 100, harvestValue: 75, imageKey: 'echinopsis-pachanoi' },
  { id: 'lophophora-williamsii', commonName: 'Peyote', scientificName: 'Lophophora williamsii', genus: 'Lophophora', rarity: 'rare', growthTimeHours: 72, baseValue: 300, harvestValue: 225, imageKey: 'lophophora-williamsii' },
] as const satisfies readonly SharedSpeciesDefinition[]

export function getSharedSpeciesById(id: string): SharedSpeciesDefinition | undefined {
  return sharedSpecies.find((species) => species.id === id)
}
