import type { InventoryItem } from './inventory'

export interface PlayerState {
  id: string
  username: string
  tokens: number
  xp: number
}

export interface PlayerProfile extends PlayerState {
  inventory: InventoryItem[]
  createdAt: string
}
