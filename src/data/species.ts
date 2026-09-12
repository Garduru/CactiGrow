import type { Species } from '../types/species'

export const species: Species[] = [
  {
    id: 'echinopsis-pachanoi',
    commonName: 'San Pedro',
    scientificName: 'Echinopsis pachanoi',
    rarity: 'common',
    growthTimeHours: 24,
    baseValue: 100,
    harvestValue: 75,
    imageKey: 'echinopsis-pachanoi',
  },
  {
    id: 'lophophora-williamsii',
    commonName: 'Peyote',
    scientificName: 'Lophophora williamsii',
    rarity: 'rare',
    growthTimeHours: 72,
    baseValue: 300,
    harvestValue: 225,
    imageKey: 'lophophora-williamsii',
  },
]

export function getSpeciesById(id: string): Species | undefined {
  return species.find((entry) => entry.id === id)
}