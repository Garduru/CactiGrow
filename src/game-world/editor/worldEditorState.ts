export type EditorWorld = 'farm' | 'town'
export type EditorMode = 'edit' | 'test'

export interface EditorPoint { id: string; label: string; x: number; y: number; relative?: boolean }
export interface EditorCollider { id: string; label: string; x: number; y: number; width: number; height: number }
export interface EditorObject {
  id: string
  label: string
  sprite: { x: number; y: number; width: number; height: number; originX: number; originY: number }
  colliders: EditorCollider[]
  interaction?: { x: number; y: number; radius: number }
  approaches: EditorPoint[]
  returnSpawn?: EditorPoint
  anchors: EditorPoint[]
}

export interface EditorSnapshot {
  objects: EditorObject[]
  selectedId: string | null
  mode: EditorMode
  moveAssociated: boolean
}

const clone = <T,>(value: T): T => structuredClone(value)

export class WorldEditorController {
  private source: EditorObject[] = []
  private state: EditorSnapshot = { objects: [], selectedId: null, mode: 'edit', moveAssociated: true }
  private listeners = new Set<() => void>()

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private publish(next: EditorSnapshot) { this.state = next; this.listeners.forEach((listener) => listener()) }

  initialize(objects: EditorObject[]) {
    this.source = clone(objects)
    const drafts = new Map(this.state.objects.map((object) => [object.id, object]))
    this.publish({ ...this.state, objects: objects.map((object) => drafts.get(object.id) ?? clone(object)) })
  }

  select(id: string | null) { this.publish({ ...this.state, selectedId: id }) }
  setMode(mode: EditorMode) { this.publish({ ...this.state, mode }) }
  setMoveAssociated(moveAssociated: boolean) { this.publish({ ...this.state, moveAssociated }) }

  update(id: string, edit: (object: EditorObject) => void) {
    this.publish({ ...this.state, objects: this.state.objects.map((object) => {
      if (object.id !== id) return object
      const next = clone(object)
      edit(next)
      return next
    }) })
  }

  resetSelected() {
    const id = this.state.selectedId
    const original = this.source.find((object) => object.id === id)
    if (id && original) this.publish({ ...this.state, objects: this.state.objects.map((object) => object.id === id ? clone(original) : object) })
  }
}

const controllers: Partial<Record<EditorWorld, WorldEditorController>> = {}
export function getWorldEditor(world: EditorWorld) {
  return controllers[world] ??= new WorldEditorController()
}

export function translateObject(object: EditorObject, dx: number, dy: number, associated: boolean) {
  object.sprite.x += dx
  object.sprite.y += dy
  if (!associated) return
  object.colliders.forEach((collider) => { collider.x += dx; collider.y += dy })
  if (object.interaction) { object.interaction.x += dx; object.interaction.y += dy }
  object.approaches.forEach((point) => { point.x += dx; point.y += dy })
  object.anchors.forEach((point) => { point.x += dx; point.y += dy })
  if (object.returnSpawn?.relative) { object.returnSpawn.x += dx; object.returnSpawn.y += dy }
}
