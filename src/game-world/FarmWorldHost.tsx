import { useCallback } from 'react'
import type { FarmWorldProjection, FarmWorldSpawnId, WorldIntent } from './worldTypes'
import { createFarmWorldGame } from './createFarmWorldGame'
import { PhaserWorldHost } from './PhaserWorldHost'

interface FarmWorldHostProps {
  projection: FarmWorldProjection
  onIntent: (intent: WorldIntent) => void
  spawnId: FarmWorldSpawnId
}

export function FarmWorldHost({ projection, onIntent, spawnId }: FarmWorldHostProps) {
  const createGame = useCallback((parent: HTMLElement, bridge: Parameters<typeof createFarmWorldGame>[1], editor?: Parameters<typeof createFarmWorldGame>[2]['editor']) => (
    createFarmWorldGame(parent, bridge, { spawnId, editor })
  ), [spawnId])
  return <PhaserWorldHost projection={projection} onIntent={onIntent} createGame={createGame} world="farm" />
}
