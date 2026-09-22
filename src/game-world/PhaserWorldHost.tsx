import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'
import type { WorldIntent, WorldProjection } from './worldTypes'
import { WorldBridge } from './WorldBridge'
import type { EditorWorld, WorldEditorController } from './editor/worldEditorState'

const DevelopmentWorldHost = import.meta.env.DEV
  ? lazy(() => import('./editor/DevelopmentWorldHost').then((module) => ({ default: module.DevelopmentWorldHost })))
  : null

interface PhaserWorldHostProps {
  projection: WorldProjection
  onIntent: (intent: WorldIntent) => void
  createGame: (parent: HTMLElement, bridge: WorldBridge, editor?: WorldEditorController) => Phaser.Game
  world: EditorWorld
}

export function PhaserWorldHost({ projection, onIntent, createGame, world }: PhaserWorldHostProps) {
  const editorRequested = import.meta.env.DEV && new URLSearchParams(window.location.search).has('worldEdit')
  if (editorRequested && DevelopmentWorldHost) {
    return <Suspense fallback={null}><DevelopmentWorldHost projection={projection} onIntent={onIntent} createGame={createGame} world={world} /></Suspense>
  }
  return <div className="phaser-world-shell"><PhaserWorldCanvas projection={projection} onIntent={onIntent} createGame={createGame} /></div>
}

export function PhaserWorldCanvas({ projection, onIntent, createGame, editor }: Omit<PhaserWorldHostProps, 'world'> & { editor?: WorldEditorController }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [bridge] = useState(() => new WorldBridge(projection, onIntent))
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => bridge.setIntentHandler(onIntent), [bridge, onIntent])
  useEffect(() => bridge.updateProjection(projection), [bridge, projection])

  useEffect(() => {
    const parent = hostRef.current
    if (!parent) return
    gameRef.current = createGame(parent, bridge, editor)
    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
      parent.replaceChildren()
    }
  }, [bridge, createGame, editor])

  return <div ref={hostRef} className="phaser-world-host" />
}
