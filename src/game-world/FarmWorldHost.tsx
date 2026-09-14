import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'
import type { FarmWorldProjection, WorldIntent } from './worldTypes'
import { WorldBridge } from './WorldBridge'

interface FarmWorldHostProps {
  projection: FarmWorldProjection
  onIntent: (intent: WorldIntent) => void
}

export function FarmWorldHost({ projection, onIntent }: FarmWorldHostProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [bridge] = useState(() => new WorldBridge(projection, onIntent))
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    bridge.setIntentHandler(onIntent)
  }, [bridge, onIntent])

  useEffect(() => {
    bridge.updateProjection(projection)
  }, [bridge, projection])

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return
    let cancelled = false
    void import('./createFarmWorldGame').then(({ createFarmWorldGame }) => {
      if (cancelled) return
      gameRef.current = createFarmWorldGame(parent, bridge)
    })
    return () => {
      cancelled = true
      gameRef.current?.destroy(true)
      gameRef.current = null
      parent.replaceChildren()
    }
  }, [bridge])

  return <div ref={hostRef} className="phaser-world-host" />
}
