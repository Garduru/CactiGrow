import Phaser from 'phaser'
import { translateObject, type EditorCollider, type EditorObject, type WorldEditorController } from './worldEditorState'

type DragTarget =
  | { kind: 'sprite' }
  | { kind: 'collider'; id: string; edges: string }
  | { kind: 'point'; group: 'interaction' | 'approaches' | 'returnSpawn' | 'anchors'; id: string }

export class WorldEditorOverlay {
  private scene: Phaser.Scene
  private editor: WorldEditorController
  private graphics: Phaser.GameObjects.Graphics
  private labels: Phaser.GameObjects.Text[] = []
  private unsubscribe: () => void
  private drag: { object: EditorObject; target: DragTarget; x: number; y: number } | null = null

  constructor(scene: Phaser.Scene, editor: WorldEditorController) {
    this.scene = scene
    this.editor = editor
    this.graphics = scene.add.graphics().setDepth(250)
    this.unsubscribe = editor.subscribe(() => this.draw())
    scene.input.on('pointerdown', this.pointerDown, this)
    scene.input.on('pointermove', this.pointerMove, this)
    scene.input.on('pointerup', this.pointerUp, this)
    scene.input.on('pointerupoutside', this.pointerUp, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe()
      scene.input.off('pointerdown', this.pointerDown, this)
      scene.input.off('pointermove', this.pointerMove, this)
      scene.input.off('pointerup', this.pointerUp, this)
      scene.input.off('pointerupoutside', this.pointerUp, this)
      this.labels.forEach((label) => label.destroy())
      this.graphics.destroy()
    })
    this.draw()
  }

  private getPoints(object: EditorObject) {
    return [
      ...(object.interaction ? [{ group: 'interaction' as const, id: 'interaction', label: 'Interaction', x: object.interaction.x, y: object.interaction.y }] : []),
      ...object.approaches.map((point) => ({ group: 'approaches' as const, ...point })),
      ...(object.returnSpawn ? [{ group: 'returnSpawn' as const, ...object.returnSpawn }] : []),
      ...object.anchors.map((point) => ({ group: 'anchors' as const, ...point })),
    ]
  }

  private label(x: number, y: number, value: string, color: string) {
    this.labels.push(this.scene.add.text(x, y, value, { fontSize: '12px', color, backgroundColor: '#1b1715dd', padding: { x: 3, y: 2 } }).setOrigin(0.5).setDepth(251))
  }

  private draw() {
    const state = this.editor.getSnapshot()
    const g = this.graphics
    g.clear()
    this.labels.forEach((label) => label.destroy())
    this.labels = []
    state.objects.forEach((object) => {
      const { sprite } = object
      const left = sprite.x - sprite.width * sprite.originX
      const top = sprite.y - sprite.height * sprite.originY
      const selected = state.selectedId === object.id
      g.lineStyle(selected ? 3 : 1, selected ? 0x52f2e0 : 0x52f2e0, selected ? 1 : 0.42).strokeRect(left, top, sprite.width, sprite.height)
      if (!selected) return
      this.label(sprite.x, top - 18, object.label, '#aafbf0')
      g.fillStyle(0x52f2e0, 1).fillCircle(sprite.x, sprite.y, 6)
      object.colliders.forEach((collider) => {
        const x = collider.x - collider.width / 2
        const y = collider.y - collider.height / 2
        g.fillStyle(0xff577e, 0.13).fillRect(x, y, collider.width, collider.height)
        g.lineStyle(3, 0xff577e, 1).strokeRect(x, y, collider.width, collider.height)
        this.label(collider.x, y - 18, collider.label, '#ffb0c0')
        for (const hx of [x, collider.x, x + collider.width]) for (const hy of [y, collider.y, y + collider.height]) {
          if (hx === collider.x && hy === collider.y) continue
          g.fillStyle(0xffffff, 1).fillRect(hx - 5, hy - 5, 10, 10)
        }
      })
      if (object.interaction) g.lineStyle(2, 0x60e1a0, 0.9).strokeCircle(object.interaction.x, object.interaction.y, object.interaction.radius)
      this.getPoints(object).forEach((point) => {
        g.fillStyle(point.group === 'interaction' ? 0x60e1a0 : point.group === 'returnSpawn' ? 0xffb36b : 0x78bdff, 1).fillCircle(point.x, point.y, 8)
        this.label(point.x, point.y - 18, point.label, '#f5e9d7')
      })
    })
  }

  private pickCollider(collider: EditorCollider, x: number, y: number, tolerance: number): DragTarget | null {
    const left = collider.x - collider.width / 2
    const right = collider.x + collider.width / 2
    const top = collider.y - collider.height / 2
    const bottom = collider.y + collider.height / 2
    if (x < left - tolerance || x > right + tolerance || y < top - tolerance || y > bottom + tolerance) return null
    const horizontal = Math.abs(x - left) <= tolerance ? 'left' : Math.abs(x - right) <= tolerance ? 'right' : ''
    const vertical = Math.abs(y - top) <= tolerance ? 'top' : Math.abs(y - bottom) <= tolerance ? 'bottom' : ''
    return { kind: 'collider', id: collider.id, edges: [horizontal, vertical].filter(Boolean).join(' ') }
  }

  private pointerDown(pointer: Phaser.Input.Pointer) {
    if (this.editor.getSnapshot().mode !== 'edit') return
    if (pointer.wasTouch && this.scene.input.manager.pointers.filter((p) => p.wasTouch && p.isDown).length > 1) { this.drag = null; return }
    const x = pointer.worldX; const y = pointer.worldY
    const state = this.editor.getSnapshot()
    const selected = state.objects.find((object) => object.id === state.selectedId)
    let target: DragTarget | null = null
    if (selected) {
      const tolerance = 12 / this.scene.cameras.main.zoom
      const point = this.getPoints(selected).find((item) => Phaser.Math.Distance.Between(x, y, item.x, item.y) <= tolerance)
      if (point) target = { kind: 'point', group: point.group, id: point.id }
      if (!target) for (const collider of [...selected.colliders].reverse()) {
        target = this.pickCollider(collider, x, y, tolerance)
        if (target) break
      }
    }
    let object = selected
    if (!target) {
      object = [...state.objects].reverse().find((candidate) => {
        const { sprite } = candidate
        return x >= sprite.x - sprite.width * sprite.originX && x <= sprite.x + sprite.width * (1 - sprite.originX)
          && y >= sprite.y - sprite.height * sprite.originY && y <= sprite.y + sprite.height * (1 - sprite.originY)
      })
      if (!object) { this.editor.select(null); return }
      this.editor.select(object.id)
      target = { kind: 'sprite' }
    }
    this.drag = { object: structuredClone(object!), target, x, y }
  }

  private pointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.drag || this.editor.getSnapshot().mode !== 'edit') return
    if (pointer.wasTouch && this.scene.input.manager.pointers.filter((p) => p.wasTouch && p.isDown).length > 1) { this.drag = null; return }
    const { object: start, target } = this.drag
    const dx = pointer.worldX - this.drag.x
    const dy = pointer.worldY - this.drag.y
    this.editor.update(start.id, (object) => {
      Object.assign(object, structuredClone(start))
      if (target.kind === 'sprite') translateObject(object, dx, dy, this.editor.getSnapshot().moveAssociated)
      else if (target.kind === 'point') {
        const point = target.group === 'interaction' ? object.interaction : target.group === 'returnSpawn' ? object.returnSpawn : object[target.group].find((item) => item.id === target.id)
        if (point) { point.x += dx; point.y += dy }
      } else {
        const collider = object.colliders.find((item) => item.id === target.id)
        if (!collider) return
        if (!target.edges) { collider.x += dx; collider.y += dy; return }
        let left = collider.x - collider.width / 2
        let right = collider.x + collider.width / 2
        let top = collider.y - collider.height / 2
        let bottom = collider.y + collider.height / 2
        if (target.edges.includes('left')) left = Math.min(right - 10, left + dx)
        if (target.edges.includes('right')) right = Math.max(left + 10, right + dx)
        if (target.edges.includes('top')) top = Math.min(bottom - 10, top + dy)
        if (target.edges.includes('bottom')) bottom = Math.max(top + 10, bottom + dy)
        collider.x = (left + right) / 2; collider.y = (top + bottom) / 2
        collider.width = right - left; collider.height = bottom - top
      }
    })
  }

  private pointerUp() { this.drag = null }
}
