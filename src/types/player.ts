import type { InventoryItem } from './inventory'
import type { PlayerSkills } from './skill'

export interface PlayerState {
  id: string
  username: string
  tokens: number
  skills: PlayerSkills
}

export interface PlayerProfile extends PlayerState {
  inventory: InventoryItem[]
  createdAt: string
}
