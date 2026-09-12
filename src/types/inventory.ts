export type InventoryItemType =
  | 'seed'
  | 'pot'
  | 'soil'
  | 'fertilizer'
  | 'tool'

export interface InventoryItem {
  id: string
  itemType: InventoryItemType
  itemKey: string
  quantity: number
}