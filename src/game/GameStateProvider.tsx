import { useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { InventoryItem } from '../types/inventory'
import { GameStateContext, type GameStateContextValue } from './GameStateContext'
import {
  canCollectPlant,
  canPlantSeed,
  createInitialGameState,
  gameStateReducer,
  getSeedQuantity,
} from './gameState'

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameStateReducer, undefined, () => createInitialGameState())

  const value = useMemo<GameStateContextValue>(() => ({
    state,
    plantSeed(slotId, speciesId) {
      if (!canPlantSeed(state, slotId, speciesId)) return false
      dispatch({ type: 'seed/planted', slotId, speciesId, now: Date.now() })
      return true
    },
    collectPlant(slotId) {
      const now = Date.now()
      if (!canCollectPlant(state, slotId, now)) return false
      dispatch({ type: 'plant/collected', slotId, now })
      return true
    },
    addInventoryItem(item: InventoryItem) {
      dispatch({ type: 'inventory/added', item })
    },
    removeInventoryItem(itemId, quantity) {
      const item = state.inventory.find((entry) => entry.id === itemId)
      if (!item || !Number.isFinite(quantity) || quantity <= 0 || item.quantity < quantity) return false
      dispatch({ type: 'inventory/removed', itemId, quantity })
      return true
    },
    getSeedQuantity(speciesId) {
      return getSeedQuantity(state, speciesId)
    },
  }), [state])

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>
}
