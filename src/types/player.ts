import type { InventoryItem } from './inventory'

export interface PlayerProfile {
  id: string
  username: string

  tokens: number

  inventory: InventoryItem[]

  createdAt: string
}