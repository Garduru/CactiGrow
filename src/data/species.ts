import { sharedSpecies } from '../../shared/gameplay/species.ts'
import type { Species } from '../types/species'

export const species: Species[] = sharedSpecies.map((entry) => ({ ...entry }))

export function getSpeciesById(id: string): Species | undefined {
  return species.find((entry) => entry.id === id)
}
