import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type Phaser from 'phaser'
import type { WorldIntent, WorldProjection } from './worldTypes'
import { WorldBridge } from './WorldBridge'
import { getWorldEditor, type EditorWorld, type WorldEditorController } from './editor/worldEditorState'

const WorldEditorPanel = lazy(() => import('./editor/WorldEditorPanel').then((module) => ({ default: module.WorldEditorPanel })))

interface PhaserWorldHostProps {
  projection: WorldProjection
  onIntent: (intent: WorldIntent) => void
  createGame: (parent: HTMLElement, bridge: WorldBridge, editor?: WorldEditorController) => Phaser.Game
  world: EditorWorld
}

export function PhaserWorldHost({ projection, onIntent, createGame, world }: PhaserWorldHostProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [bridge] = useState(() => new WorldBridge(projection, onIntent))
  const [editor] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has('worldEdit') ? getWorldEditor(world) : undefined)
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

  return <div className="phaser-world-shell"><div ref={hostRef} className="phaser-world-host" />{editor && <Suspense fallback={null}><WorldEditorPanel editor={editor} world={world} /></Suspense>}</div>
}
