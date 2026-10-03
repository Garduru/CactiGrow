import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { PhaserWorldCanvas } from '../PhaserWorldHost'
import { useFeaturePanel } from '../../features/menu/featurePanelState'
import { getWorldEditor, type EditorWorld } from './worldEditorState'

type CanvasProps = ComponentProps<typeof PhaserWorldCanvas>

export function DevelopmentWorldHost(props: CanvasProps & { world: EditorWorld }) {
  const { world, ...canvasProps } = props
  const [editor] = useState(() => getWorldEditor(world))
  const { openFeature } = useFeaturePanel()
  useEffect(() => { editor.setMode('test'); openFeature('devtools') }, [editor, openFeature])
  return (
    <div className="phaser-world-shell">
      <PhaserWorldCanvas {...canvasProps} editor={editor} />
    </div>
  )
}
