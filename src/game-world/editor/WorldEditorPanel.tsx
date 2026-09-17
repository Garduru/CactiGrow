import { useState, useSyncExternalStore } from 'react'
import { translateObject, type EditorObject, type EditorPoint, type WorldEditorController } from './worldEditorState'

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="world-editor__number">{label}<input type="number" step="any" value={value} onChange={(event) => {
    const next = Number(event.target.value)
    if (event.target.value !== '' && Number.isFinite(next)) onChange(next)
  }} /></label>
}

function PointFields({ point, update }: { point: EditorPoint; update: (key: 'x' | 'y', value: number) => void }) {
  return <div className="world-editor__row"><strong>{point.label}</strong><NumberField label="X" value={point.x} onChange={(value) => update('x', value)} /><NumberField label="Y" value={point.y} onChange={(value) => update('y', value)} /></div>
}

export function WorldEditorPanel({ editor, world }: { editor: WorldEditorController; world: string }) {
  const snapshot = useSyncExternalStore(editor.subscribe, editor.getSnapshot)
  const selected = snapshot.objects.find((object) => object.id === snapshot.selectedId)
  const [message, setMessage] = useState('')
  const update = (edit: (object: EditorObject) => void) => { if (selected) editor.update(selected.id, edit) }
  const copy = async (all: boolean) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(all ? snapshot.objects : selected, null, 2))
      setMessage(all ? 'Copied all objects' : 'Copied selected values')
    } catch { setMessage('Clipboard unavailable; use a secure localhost page') }
  }

  return <aside className="world-editor" aria-label={`${world} world editor`} onPointerDown={(event) => event.stopPropagation()}>
    <div className="world-editor__header"><strong>World Edit · {world}</strong><span>Temporary preview</span></div>
    <div className="world-editor__buttons">
      <button type="button" aria-pressed={snapshot.mode === 'edit'} onClick={() => editor.setMode('edit')}>Edit Geometry</button>
      <button type="button" aria-pressed={snapshot.mode === 'test'} onClick={() => editor.setMode('test')}>Test Movement</button>
    </div>
    <label className="world-editor__select">Object<select value={snapshot.selectedId ?? ''} onChange={(event) => editor.select(event.target.value || null)}><option value="">Select an object</option>{snapshot.objects.map((object) => <option key={object.id} value={object.id}>{object.label}</option>)}</select></label>
    {selected && <div className="world-editor__content">
      <div className="world-editor__section"><h2>Sprite · {selected.id}</h2><div className="world-editor__grid">
        {(['x', 'y', 'width', 'height', 'originX', 'originY'] as const).map((key) => <NumberField key={key} label={key} value={selected.sprite[key]} onChange={(value) => update((object) => {
          if (key === 'x') translateObject(object, value - object.sprite.x, 0, snapshot.moveAssociated)
          else if (key === 'y') translateObject(object, 0, value - object.sprite.y, snapshot.moveAssociated)
          else object.sprite[key] = value
        })} />)}
      </div><label className="world-editor__check"><input type="checkbox" checked={snapshot.moveAssociated} onChange={(event) => editor.setMoveAssociated(event.target.checked)} /> Move associated geometry with object</label></div>
      <div className="world-editor__section"><h2>Colliders</h2>{selected.colliders.map((collider) => <div className="world-editor__row" key={collider.id}><strong>{collider.label}</strong><div className="world-editor__grid">{(['x', 'y', 'width', 'height'] as const).map((key) => <NumberField key={key} label={key} value={collider[key]} onChange={(value) => update((object) => { const item = object.colliders.find((candidate) => candidate.id === collider.id); if (item) item[key] = key === 'width' || key === 'height' ? Math.max(10, value) : value })} />)}</div><button type="button" onClick={() => update((object) => { object.colliders = object.colliders.filter((item) => item.id !== collider.id) })}>Delete Collider</button></div>)}<button type="button" onClick={() => update((object) => { object.colliders.push({ id: `collider-${Date.now()}`, label: 'New collider', x: object.sprite.x, y: object.sprite.y, width: 80, height: 60 }) })}>+ Add Collider</button></div>
      <div className="world-editor__section"><h2>Points</h2>{selected.interaction && <div className="world-editor__row"><strong>Interaction</strong><div className="world-editor__grid">{(['x', 'y', 'radius'] as const).map((key) => <NumberField key={key} label={key} value={selected.interaction![key]} onChange={(value) => update((object) => { if (object.interaction) object.interaction[key] = key === 'radius' ? Math.max(1, value) : value })} />)}</div></div>}{selected.approaches.map((point) => <PointFields key={point.id} point={point} update={(key, value) => update((object) => { const item = object.approaches.find((candidate) => candidate.id === point.id); if (item) item[key] = value })} />)}{selected.returnSpawn && <PointFields point={selected.returnSpawn} update={(key, value) => update((object) => { if (object.returnSpawn) object.returnSpawn[key] = value })} />}{selected.anchors.map((point) => <PointFields key={point.id} point={point} update={(key, value) => update((object) => { const item = object.anchors.find((candidate) => candidate.id === point.id); if (item) item[key] = value })} />)}</div>
      <div className="world-editor__buttons"><button type="button" onClick={() => void copy(false)}>Copy Values</button><button type="button" onClick={() => editor.resetSelected()}>Reset Selected</button></div>
    </div>}
    <button type="button" onClick={() => void copy(true)}>Copy All Edited Objects</button><p role="status">{message}</p>
  </aside>
}
