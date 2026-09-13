export type GrowthStage =
  | 'seed'
  | 'seedling'
  | 'juvenile'
  | 'mature'
  | 'flowering'

export interface Species {
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
