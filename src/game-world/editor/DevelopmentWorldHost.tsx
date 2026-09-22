import { useState } from 'react'
import type { ComponentProps } from 'react'
import { PhaserWorldCanvas } from '../PhaserWorldHost'
import { WorldEditorPanel } from './WorldEditorPanel'
import { getWorldEditor, type EditorWorld } from './worldEditorState'

type CanvasProps = ComponentProps<typeof PhaserWorldCanvas>

export function DevelopmentWorldHost(props: CanvasProps & { world: EditorWorld }) {
  const { world, ...canvasProps } = props
  const [editor] = useState(() => getWorldEditor(world))
  return (
    <div className="phaser-world-shell">
      <PhaserWorldCanvas {...canvasProps} editor={editor} />
      <WorldEditorPanel editor={editor} world={world} />
    </div>
  )
}
