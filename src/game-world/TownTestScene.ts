import Phaser from 'phaser'
import type { WorldBridge } from './WorldBridge'
import { TOWN_WORLD_HEIGHT, TOWN_WORLD_WIDTH, townWorldLayout, townWorldSpawns, type TownLocationLayout } from './townWorldLayout'
import type { TownWorldLocationProjection, TownWorldSpawnId } from './worldTypes'
import { WORLD_DEPTH } from './worldDepth'

const PLAYER_SPEED = 245
const CAMERA_ZOOM_FLOOR = 0.1
const MAX_CAMERA_ZOOM = 1.5
const WORLD_OVERVIEW_MARGIN_SCALE = 0.94

interface TownInteractionTarget {
  location: TownWorldLocationProjection
  layout: TownLocationLayout
  prompt: Phaser.GameObjects.Text
}

interface PendingWorldTap {
  pointerId: number
  worldX: number
  worldY: number
}

export class TownTestScene extends Phaser.Scene {
  private readonly bridge: WorldBridge
  private readonly debugWorld: boolean
  private readonly playerSpawn: Readonly<{ x: number; y: number }>
  private player!: Phaser.GameObjects.Container
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<'up' | 'down' | 'left' | 'right' | 'interact', Phaser.Input.Keyboard.Key>
  private movementTarget: Phaser.Math.Vector2 | null = null
  private readonly interactionTargets: TownInteractionTarget[] = []
  private readonly staticColliders: Phaser.GameObjects.Rectangle[] = []
  private unsubscribeProjection: (() => void) | null = null
  private baseCameraZoom = 1
  private fitCameraZoom = CAMERA_ZOOM_FLOOR
  private targetCameraZoom = 1
  private cameraConfigured = false
  private pendingWorldTap: PendingWorldTap | null = null
  private pinchActive = false
  private suppressWorldTap = false
  private pinchStartDistance = 0
  private pinchStartZoom = 1
  private cameraDebugText: Phaser.GameObjects.Text | null = null

  constructor(bridge: WorldBridge, debugWorld = false, options: { spawnId: TownWorldSpawnId }) {
    super('town-graybox')
    this.bridge = bridge
    this.debugWorld = debugWorld
    this.playerSpawn = townWorldSpawns[options.spawnId]
  }

  create() {
    this.physics.world.setBounds(0, 0, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT)
    this.drawGroundAndPaths()
    this.drawBoundary()
    this.createLocations(this.bridge.getProjection().locations.filter((location): location is TownWorldLocationProjection => location.id === 'shop' || location.id === 'market' || location.id === 'farm'))
    this.createPlayer()
    this.createInput()
    this.configureCamera()
    if (this.debugWorld) this.drawDebugOverlay()

    this.unsubscribeProjection = this.bridge.subscribeToProjection((projection) => {
      projection.locations.forEach((location) => {
        const target = this.interactionTargets.find((candidate) => candidate.location.id === location.id)
        if (!target || (location.id !== 'shop' && location.id !== 'market' && location.id !== 'farm')) return
        target.location = location as TownWorldLocationProjection
        target.prompt.setText(this.getPromptText(target.location))
      })
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribeProjection?.())
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    this.updateCameraZoom()
    if (!this.canAcceptKeyboardInput()) {
      body.setVelocity(0)
      return
    }
    const horizontal = Number(this.cursors.right.isDown || this.wasd.right.isDown) - Number(this.cursors.left.isDown || this.wasd.left.isDown)
    const vertical = Number(this.cursors.down.isDown || this.wasd.down.isDown) - Number(this.cursors.up.isDown || this.wasd.up.isDown)
    if (horizontal || vertical) {
      this.movementTarget = null
      const velocity = new Phaser.Math.Vector2(horizontal, vertical).normalize().scale(PLAYER_SPEED)
      body.setVelocity(velocity.x, velocity.y)
    } else if (this.movementTarget) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.movementTarget.x, this.movementTarget.y)
      if (distance < 10) {
        body.setVelocity(0)
        this.movementTarget = null
      } else {
        const velocity = new Phaser.Math.Vector2(this.movementTarget.x - this.player.x, this.movementTarget.y - this.player.y).normalize().scale(PLAYER_SPEED)
        body.setVelocity(velocity.x, velocity.y)
      }
    } else body.setVelocity(0)

    const nearby = this.getNearestInteraction()
    this.interactionTargets.forEach((target) => target.prompt.setVisible(target === nearby))
  }

  private drawGroundAndPaths() {
    this.add.rectangle(TOWN_WORLD_WIDTH / 2, TOWN_WORLD_HEIGHT / 2, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT, 0x2b2520).setDepth(WORLD_DEPTH.ground)
    const ground = this.add.graphics().setDepth(WORLD_DEPTH.ground)
    ground.fillStyle(0x65523d).fillRoundedRect(60, 50, TOWN_WORLD_WIDTH - 120, TOWN_WORLD_HEIGHT - 100, 70)

    const paths = this.add.graphics().setDepth(WORLD_DEPTH.paths)
    paths.lineStyle(110, 0xb58b5d, 0.5)
    const branches: readonly (readonly [number, number])[][] = [
      [[1100, 1500], [1100, 1140], [1100, 850]],
      [[1100, 850], [850, 690], [650, 560]],
      [[1100, 850], [1320, 700], [1545, 590]],
    ]
    branches.forEach((points) => {
      paths.beginPath().moveTo(points[0][0], points[0][1])
      points.slice(1).forEach(([x, y]) => paths.lineTo(x, y))
      paths.strokePath()
    })
    paths.lineStyle(4, 0xe0b879, 0.28)
    branches.forEach((points) => {
      paths.beginPath().moveTo(points[0][0], points[0][1])
      points.slice(1).forEach(([x, y]) => paths.lineTo(x, y))
      paths.strokePath()
    })
  }

  private drawBoundary() {
    const wall = this.add.graphics().setDepth(WORLD_DEPTH.foreground)
    wall.lineStyle(18, 0x584432, 1).strokeRect(60, 50, TOWN_WORLD_WIDTH - 120, TOWN_WORLD_HEIGHT - 100)
    this.addStaticCollider(TOWN_WORLD_WIDTH / 2, 58, TOWN_WORLD_WIDTH - 120, 30)
    this.addStaticCollider(68, TOWN_WORLD_HEIGHT / 2, 30, TOWN_WORLD_HEIGHT - 100)
    this.addStaticCollider(TOWN_WORLD_WIDTH - 68, TOWN_WORLD_HEIGHT / 2, 30, TOWN_WORLD_HEIGHT - 100)
    this.addStaticCollider(475, TOWN_WORLD_HEIGHT - 58, 820, 30)
    this.addStaticCollider(1725, TOWN_WORLD_HEIGHT - 58, 820, 30)
  }

  private createLocations(locations: readonly TownWorldLocationProjection[]) {
    townWorldLayout.forEach((layout) => {
      const location = locations.find((candidate) => candidate.id === layout.id)
      if (!location) return
      this.drawLocation(layout)
      const prompt = this.add.text(layout.approachX, layout.approachY + 66, this.getPromptText(location), {
        color: '#fff3dc', backgroundColor: '#211710ee', fontFamily: 'system-ui', fontSize: '18px', padding: { x: 14, y: 9 }, align: 'center',
      }).setOrigin(0.5).setDepth(WORLD_DEPTH.prompts).setVisible(false)
      this.interactionTargets.push({ location, layout, prompt })
    })
  }

  private drawLocation(layout: TownLocationLayout) {
    if (layout.visualKind === 'farm-exit') {
      this.add.rectangle(layout.x - 135, layout.y, 24, 118, 0x745237).setDepth(WORLD_DEPTH.foreground)
      this.add.rectangle(layout.x + 135, layout.y, 24, 118, 0x745237).setDepth(WORLD_DEPTH.foreground)
      this.add.rectangle(layout.x, layout.y - 45, 290, 56, 0x4e3828).setStrokeStyle(4, 0xa27a51).setDepth(WORLD_DEPTH.foreground)
      this.addStaticCollider(layout.x - 135, layout.y, 24, 118)
      this.addStaticCollider(layout.x + 135, layout.y, 24, 118)
      return
    }

    const bodyColor = layout.visualKind === 'shop' ? 0x8c6545 : 0x656273
    const foundationColor = layout.visualKind === 'shop' ? 0x49352a : 0x3e3a49
    const doorColor = layout.visualKind === 'shop' ? 0x65422e : 0x454052
    this.add.rectangle(layout.x, layout.y, layout.width, layout.height, bodyColor).setStrokeStyle(7, 0x302218).setDepth(WORLD_DEPTH.buildings)
    this.add.rectangle(layout.x, layout.y + layout.height / 2 - 24, layout.width, 48, foundationColor).setStrokeStyle(3, 0x2b2019).setDepth(WORLD_DEPTH.buildings)
    this.add.rectangle(layout.interactionX, layout.y + layout.height / 2 - 68, 88, 136, doorColor).setStrokeStyle(5, 0x2c211b).setDepth(WORLD_DEPTH.foreground)
    if (layout.visualKind === 'shop') {
      this.add.rectangle(layout.x - 105, layout.y - 34, 96, 72, 0xd6b879, 0.35).setStrokeStyle(4, 0x5a402d).setDepth(WORLD_DEPTH.foreground)
      this.add.rectangle(layout.x + 105, layout.y - 34, 96, 72, 0xd6b879, 0.35).setStrokeStyle(4, 0x5a402d).setDepth(WORLD_DEPTH.foreground)
    } else {
      for (let windowX = layout.x - 180; windowX <= layout.x + 180; windowX += 120) this.add.rectangle(windowX, layout.y - 36, 78, 74, 0x9da5ab, 0.34).setStrokeStyle(4, 0x454052).setDepth(WORLD_DEPTH.foreground)
    }
    if (layout.colliderX !== undefined && layout.colliderY !== undefined && layout.colliderWidth !== undefined && layout.colliderHeight !== undefined) {
      this.addStaticCollider(layout.colliderX, layout.colliderY, layout.colliderWidth, layout.colliderHeight)
    }
  }

  private createPlayer() {
    const visuals: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, -18, 34, 62, 0xb85e3d).setStrokeStyle(4, 0x2b1a13),
      this.add.circle(0, -61, 20, 0xd39a6b).setStrokeStyle(4, 0x2b1a13),
    ]
    this.player = this.add.container(this.playerSpawn.x, this.playerSpawn.y, visuals).setSize(54, 54).setDepth(WORLD_DEPTH.localPlayer)
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setCircle(27).setCollideWorldBounds(true)
    this.staticColliders.forEach((collider) => this.physics.add.collider(this.player, collider))
  }

  private createInput() {
    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable')
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', interact: 'E' }) as typeof this.wasd
    this.wasd.interact.on('down', () => { if (this.canAcceptKeyboardInput()) this.activateNearestInteraction() })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.focus()
      if (this.getActiveTouchPointers().length >= 2) return this.beginPinch()
      this.pendingWorldTap = { pointerId: pointer.pointerId, worldX: pointer.worldX, worldY: pointer.worldY }
    })
    this.input.on('pointermove', () => this.updatePinch())
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.finishPointerGesture(pointer))
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.finishPointerGesture(pointer))
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: Phaser.GameObjects.GameObject[], _dx: number, deltaY: number) => this.setUserZoom(this.targetCameraZoom * Math.exp(-deltaY * 0.0012)))
    this.game.canvas.tabIndex = 0
    this.game.canvas.setAttribute('aria-label', 'Interactive Town graybox. Use arrow keys or WASD to move and E to enter a nearby location.')
  }

  private configureCamera() {
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    const resize = (size: Phaser.Structs.Size) => {
      const shortestSide = Math.min(size.width, size.height)
      this.baseCameraZoom = Phaser.Math.Clamp(shortestSide / 720, 0.72, 1.18)
      this.fitCameraZoom = Math.max(CAMERA_ZOOM_FLOOR, Math.min(size.width / TOWN_WORLD_WIDTH, size.height / TOWN_WORLD_HEIGHT) * WORLD_OVERVIEW_MARGIN_SCALE)
      this.targetCameraZoom = this.cameraConfigured ? Phaser.Math.Clamp(this.targetCameraZoom, this.fitCameraZoom, MAX_CAMERA_ZOOM) : this.baseCameraZoom
      this.cameraConfigured = true
      this.cameras.main.setZoom(this.targetCameraZoom)
    }
    resize(this.scale.gameSize)
    this.scale.on(Phaser.Scale.Events.RESIZE, resize)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, resize))
  }

  private drawDebugOverlay() {
    const debug = this.add.graphics().setDepth(WORLD_DEPTH.debug)
    debug.lineStyle(5, 0xffcc66, 0.9).strokeRect(0, 0, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT)
    townWorldLayout.forEach((layout) => {
      debug.lineStyle(3, 0x45c88a, 0.9).strokeCircle(layout.interactionX, layout.interactionY, layout.interactionRadius)
      debug.lineStyle(2, 0xffa84a, 0.85).strokeCircle(layout.interactionX, layout.interactionY, layout.tapRadius)
      debug.fillStyle(0x5ac8ff, 1).fillCircle(layout.approachX, layout.approachY, 8)
      if (layout.colliderX !== undefined && layout.colliderY !== undefined && layout.colliderWidth !== undefined && layout.colliderHeight !== undefined) {
        debug.lineStyle(3, 0xff5c8a, 0.95).strokeRect(layout.colliderX - layout.colliderWidth / 2, layout.colliderY - layout.colliderHeight / 2, layout.colliderWidth, layout.colliderHeight)
      }
      this.add.text(layout.x, layout.y - layout.height / 2 - 45, layout.id, { color: '#8dffd2', backgroundColor: '#10251ddd', fontSize: '14px', padding: { x: 6, y: 4 } }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    })
    Object.entries(townWorldSpawns).forEach(([id, spawn]) => {
      debug.fillStyle(0xff7f50, 1).fillCircle(spawn.x, spawn.y, 10)
      this.add.text(spawn.x, spawn.y + 25, `SPAWN: ${id}`, { color: '#ffd5c5', backgroundColor: '#2a1711dd', fontSize: '11px', padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    })
    this.cameraDebugText = this.add.text(14, 14, '', { color: '#fff2c7', backgroundColor: '#1a120ddd', fontSize: '13px', padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(WORLD_DEPTH.debug)
  }

  private getActiveTouchPointers() { return this.input.manager.pointers.filter((pointer) => pointer.wasTouch && pointer.isDown) }

  private beginPinch() {
    const pointers = this.getActiveTouchPointers()
    if (pointers.length < 2) return
    this.pinchActive = true
    this.suppressWorldTap = true
    this.pendingWorldTap = null
    this.movementTarget = null
    this.pinchStartDistance = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y)
    this.pinchStartZoom = this.targetCameraZoom
  }

  private updatePinch() {
    const pointers = this.getActiveTouchPointers()
    if (pointers.length < 2) return
    if (!this.pinchActive) this.beginPinch()
    const distance = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y)
    if (this.pinchStartDistance > 0) this.setUserZoom(this.pinchStartZoom * (distance / this.pinchStartDistance))
  }

  private finishPointerGesture(pointer: Phaser.Input.Pointer) {
    const activeTouches = this.getActiveTouchPointers().length
    if (this.pinchActive || this.suppressWorldTap) {
      this.pinchActive = activeTouches >= 2
      this.pendingWorldTap = null
      if (activeTouches === 0) this.suppressWorldTap = false
      return
    }
    if (!this.pendingWorldTap || this.pendingWorldTap.pointerId !== pointer.pointerId) return
    const tap = this.pendingWorldTap
    this.pendingWorldTap = null
    this.handleWorldTap(tap.worldX, tap.worldY)
  }

  private handleWorldTap(worldX: number, worldY: number) {
    const target = this.interactionTargets.find((candidate) => Phaser.Math.Distance.Between(worldX, worldY, candidate.layout.interactionX, candidate.layout.interactionY) <= candidate.layout.tapRadius)
    if (!target) {
      this.movementTarget = new Phaser.Math.Vector2(worldX, worldY)
      return
    }
    if (this.isInInteractionRange(target)) this.enterLocation(target)
    else this.movementTarget = new Phaser.Math.Vector2(target.layout.approachX, target.layout.approachY)
  }

  private setUserZoom(zoom: number) { this.targetCameraZoom = Phaser.Math.Clamp(zoom, this.fitCameraZoom, MAX_CAMERA_ZOOM) }

  private updateCameraZoom() {
    const camera = this.cameras.main
    if (Math.abs(camera.zoom - this.targetCameraZoom) > 0.001) camera.setZoom(Phaser.Math.Linear(camera.zoom, this.targetCameraZoom, 0.18))
    if (this.cameraDebugText) this.cameraDebugText.setText(`Zoom ${camera.zoom.toFixed(2)}  Default ${this.baseCameraZoom.toFixed(2)}  Fit ${this.fitCameraZoom.toFixed(2)}  Max ${MAX_CAMERA_ZOOM.toFixed(2)}`)
  }

  private addStaticCollider(x: number, y: number, width: number, height: number) {
    const collider = this.add.rectangle(x, y, width, height, 0xffffff, 0)
    this.physics.add.existing(collider, true)
    this.staticColliders.push(collider)
  }

  private canAcceptKeyboardInput() { return this.game.canvas.contains(document.activeElement) || document.activeElement === document.body }
  private isInInteractionRange(target: TownInteractionTarget) { return Phaser.Math.Distance.Between(this.player.x, this.player.y, target.layout.interactionX, target.layout.interactionY) <= target.layout.interactionRadius }
  private getNearestInteraction() { return this.interactionTargets.filter((target) => this.isInInteractionRange(target)).sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.layout.interactionX, a.layout.interactionY) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.layout.interactionX, b.layout.interactionY))[0] ?? null }
  private activateNearestInteraction() { const target = this.getNearestInteraction(); if (target) this.enterLocation(target) }
  private enterLocation(target: TownInteractionTarget) { this.bridge.emitIntent({ type: 'ENTER_LOCATION', locationId: target.location.id }) }
  private getPromptText(location: TownWorldLocationProjection) { return `${location.displayName}\n${location.interactionLabel}` }
}
