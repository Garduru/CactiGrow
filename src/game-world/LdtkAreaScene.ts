import Phaser from 'phaser'
import { NavigationMap } from './navigation/NavigationMap'
import { NavigationController } from './navigation/NavigationController'
import { bindWorldKeyboardFocus, canUseWorldKeyboard } from './worldKeyboardFocus'
import { AreaExitController, drawFoundationExitDebug, type FoundationSceneOptions } from './AreaExitController'
import { createPlayerCharacter } from './PlayerCharacter'
import { configureGameplayCamera } from './gameplayCamera'

/** Rough terrain presentation; uses the existing obstacle-aware route planner unchanged. */
export class LdtkAreaScene extends Phaser.Scene {
  private readonly options: FoundationSceneOptions
  private player!: Phaser.GameObjects.Container
  private navigation!: NavigationController
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private exits!: AreaExitController
  private touch: { id: number; x: number; y: number; worldX: number; worldY: number } | null = null
  constructor(options: FoundationSceneOptions) { super('ldtk-area'); this.options = options }
  create() {
    const { area, position, onExit } = this.options
    this.physics.world.setBounds(0, 0, area.width, area.height)
    this.cameras.main.setBounds(0, 0, area.width, area.height)
    this.add.rectangle(area.width / 2, area.height / 2, area.width, area.height, 0x65523d)
    const walls = this.physics.add.staticGroup()
    for (const o of area.collision) {
      const rect = this.add.rectangle(o.x, o.y, o.width, o.height, 0x29231e)
      this.physics.add.existing(rect, true); walls.add(rect)
    }
    this.player = createPlayerCharacter(this, position.x, position.y)
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    // Normalized geometry uses the established Farm/Town gameplay body and speed.
    body.setCircle(27); body.setCollideWorldBounds(true)
    if (this.options.debug) this.player.add(this.add.circle(0, 0, 27, 0xf5d18a).setName('player-debug-body'))
    this.physics.add.collider(this.player, walls)
    this.navigation = new NavigationController(new NavigationMap(area.width, area.height, area.collision))
    this.exits = new AreaExitController(area, onExit)
    drawFoundationExitDebug(this, this.options)
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>
    const release = bindWorldKeyboardFocus(this.game.canvas, this.input.keyboard!)
    this.events.once('shutdown', release); this.events.once('destroy', release)
    this.game.canvas.tabIndex = 0
    const accept = (x: number, y: number) => {
      if (!this.options.pending()) this.navigation.move(this.player, { x, y })
    }
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.game.canvas.focus()
      if (!p.wasTouch) { accept(p.worldX, p.worldY); return }
      if (this.input.manager.pointers.filter(p => p.isDown).length > 1) { this.touch = null; return }
      this.touch = { id: p.pointerId, x: p.x, y: p.y, worldX: p.worldX, worldY: p.worldY }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.touch && Math.hypot(p.x - this.touch.x, p.y - this.touch.y) > 12) this.touch = null })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => { const t = this.touch; this.touch = null; if (t?.id === p.pointerId) accept(t.worldX, t.worldY) })
    const cancel = () => { this.touch = null }
    this.input.on('pointerupoutside', cancel)
    this.game.canvas.addEventListener('touchcancel', cancel); this.game.canvas.addEventListener('pointercancel', cancel)
    const cleanup = () => { this.game.canvas.removeEventListener('touchcancel', cancel); this.game.canvas.removeEventListener('pointercancel', cancel) }
    this.events.once('shutdown', cleanup); this.events.once('destroy', cleanup)
    configureGameplayCamera(this, this.player, this.options.camera ?? {})
    this.game.canvas.setAttribute('aria-label', `Interactive ${area.displayName}. Use arrow keys or WASD to move.`)
  }
  update(time: number, delta = 1000 / 60) {
    if (!this.player) return
    const body = this.player.body as Phaser.Physics.Arcade.Body
    if (this.options.pending() || !canUseWorldKeyboard(this.game.canvas)) { body.setVelocity(0); return }
    const x = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown)
    const y = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown)
    if (x || y) { this.navigation.cancel(); const v = new Phaser.Math.Vector2(x, y).normalize().scale(245); body.setVelocity(v.x, v.y) }
    else { const v = this.navigation.update(this.player, delta, 245, time); body.setVelocity(v.x, v.y) }
    this.exits.update(this.player)
  }
}
