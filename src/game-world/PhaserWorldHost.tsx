import { useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'
import type { WorldIntent, WorldProjection } from './worldTypes'
import { WorldBridge } from './WorldBridge'

interface PhaserWorldHostProps {
  projection: WorldProjection
  onIntent: (intent: WorldIntent) => void
  createGame: (parent: HTMLElement, bridge: WorldBridge) => Phaser.Game
}

export function PhaserWorldHost({ projection, onIntent, createGame }: PhaserWorldHostProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [bridge] = useState(() => new WorldBridge(projection, onIntent))
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => bridge.setIntentHandler(onIntent), [bridge, onIntent])
  useEffect(() => bridge.updateProjection(projection), [bridge, projection])

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return
    gameRef.current = createGame(parent, bridge)
    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
      parent.replaceChildren()
    }
  }, [bridge, createGame])

  return <div ref={hostRef} className="phaser-world-host" />
}
