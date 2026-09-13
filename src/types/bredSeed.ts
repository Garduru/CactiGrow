import type { PlantGenetics } from './genetics'

export interface BredSeed {
  id: string
  speciesId: string
  createdAt: string
  genetics: PlantGenetics
  parentPlantIds: [string, string]
}
