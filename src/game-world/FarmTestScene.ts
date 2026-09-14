import Phaser from 'phaser'
import { FARM_PLAYER_SPAWN, FARM_WORLD_HEIGHT, FARM_WORLD_WIDTH, farmWorldLayout, type FarmLocationLayout } from './farmWorldLayout'
import type { WorldBridge } from './WorldBridge'
import type { FarmWorldLocationProjection } from './worldTypes'

const PLAYER_SPEED = 245
const INTERACTION_DISTANCE = 165
// The dynamic overview minimum may approach this floor only on pathological viewport shapes.
const CAMERA_ZOOM_FLOOR = 0.1
const MAX_CAMERA_ZOOM = 1.5
const WORLD_OVERVIEW_MARGIN_SCALE = 0.94

const DEPTH = {
  ground: 0,
  paths: 10,
  landscaping: 20,
  buildings: 40,
  player: 50,
  foreground: 60,
  prompts: 100,
  debug: 200,
} as const

interface InteractionTarget {
  location: FarmWorldLocationProjection
  layout: FarmLocationLayout
  progressLabel: Phaser.GameObjects.Text | null
  prompt: Phaser.GameObjects.Text
}

interface PendingWorldTap {
  pointerId: number
  worldX: number
  worldY: number
}

export class FarmTestScene extends Phaser.Scene {
  private readonly bridge: WorldBridge
  private readonly debugWorld: boolean
  private player!: Phaser.GameObjects.Arc
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<'up' | 'down' | 'left' | 'right' | 'interact', Phaser.Input.Keyboard.Key>
  private movementTarget: Phaser.Math.Vector2 | null = null
  private readonly interactionTargets: InteractionTarget[] = []
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

  constructor(bridge: WorldBridge, debugWorld = false) {
    super('farm-graybox')
    this.bridge = bridge
    this.debugWorld = debugWorld
  }

  create() {
    this.physics.world.setBounds(0, 0, FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT)
    this.drawGroundAndPaths()
    this.drawPropertyBoundary()
    this.drawLandscaping()
    this.createLocations(this.bridge.getProjection().locations)
    this.createPlayer()
    this.createInput()
    this.configureCamera()
    if (this.debugWorld) this.drawDebugOverlay()

    this.unsubscribeProjection = this.bridge.subscribeToProjection((projection) => {
      projection.locations.forEach((location) => {
        const target = this.interactionTargets.find((candidate) => candidate.location.id === location.id)
        if (!target) return
        target.location = location
        target.progressLabel?.setText(this.getProgressText(location))
        target.prompt.setText(this.getPromptText(location))
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
    } else {
      body.setVelocity(0)
    }

    const nearby = this.getNearestInteraction()
    this.interactionTargets.forEach((target) => target.prompt.setVisible(target === nearby))
  }

  private drawGroundAndPaths() {
    this.add.rectangle(FARM_WORLD_WIDTH / 2, FARM_WORLD_HEIGHT / 2, FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT, 0x30271f).setDepth(DEPTH.ground)
    const ground = this.add.graphics().setDepth(DEPTH.ground)
    ground.fillStyle(0x5c4b37).fillRoundedRect(70, 60, FARM_WORLD_WIDTH - 140, FARM_WORLD_HEIGHT - 120, 80)
    ground.fillStyle(0x69734a, 0.24).fillEllipse(560, 430, 980, 650)
    ground.fillStyle(0x8a633e, 0.18).fillEllipse(2400, 430, 940, 650)
    ground.fillStyle(0x4e5c3b, 0.18).fillEllipse(2330, 1250, 900, 650)

    const paths = this.add.graphics().setDepth(DEPTH.paths)
    paths.lineStyle(118, 0xb58b5d, 0.48)
    const branches: readonly (readonly [number, number])[][] = [
      [[1500, 1900], [1500, 1100], [1500, 870]],
      [[1500, 1050], [940, 860], [650, 580]],
      [[1500, 1050], [2060, 850], [2390, 630]],
      [[1500, 1080], [1940, 1200], [2180, 1210]],
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
    this.add.ellipse(1500, 1500, 520, 240, 0x9c815e, 0.18).setStrokeStyle(3, 0xc4a478, 0.26).setDepth(DEPTH.paths)
    this.add.text(1500, 1510, 'VISITOR ARRIVAL', { color: '#d6b98e', fontFamily: 'system-ui', fontSize: '14px', letterSpacing: 2 }).setOrigin(0.5).setAlpha(0.55).setDepth(DEPTH.landscaping)
    this.add.ellipse(1500, 1050, 590, 390, 0x98724b, 0.52).setStrokeStyle(5, 0xc69a63, 0.35).setDepth(DEPTH.paths)
  }

  private drawPropertyBoundary() {
    const fence = this.add.graphics().setDepth(DEPTH.foreground)
    fence.lineStyle(18, 0x694b32, 1)
    fence.beginPath().moveTo(90, 90).lineTo(2910, 90).lineTo(2910, 1810).strokePath()
    fence.beginPath().moveTo(90, 1810).lineTo(90, 90).strokePath()
    fence.beginPath().moveTo(90, 1810).lineTo(1320, 1810).strokePath()
    fence.beginPath().moveTo(1680, 1810).lineTo(2910, 1810).strokePath()
    for (let x = 120; x <= 2880; x += 120) {
      fence.fillStyle(0x8b6846).fillRect(x - 7, 70, 14, 54).fillRect(x - 7, 1780, 14, 54)
    }
    for (let y = 150; y <= 1750; y += 120) {
      fence.fillStyle(0x8b6846).fillRect(63, y - 7, 54, 14).fillRect(2883, y - 7, 54, 14)
    }
    this.addStaticCollider(1500, 90, 2820, 34)
    this.addStaticCollider(90, 950, 34, 1720)
    this.addStaticCollider(2910, 950, 34, 1720)
    this.addStaticCollider(705, 1810, 1230, 34)
    this.addStaticCollider(2295, 1810, 1230, 34)
  }

  private drawLandscaping() {
    const props = this.add.graphics().setDepth(DEPTH.landscaping)
    const cactusClusters = [[250, 330], [280, 900], [2700, 280], [2730, 930], [340, 1590], [2640, 1610], [1050, 300], [1980, 330]]
    cactusClusters.forEach(([x, y]) => {
      props.fillStyle(0x52683e).fillRoundedRect(x - 13, y - 48, 26, 74, 12)
      props.fillStyle(0x6f8550).fillCircle(x + 20, y + 5, 18)
      props.fillStyle(0x394b31).fillCircle(x - 23, y + 13, 13)
    })
    ;[[1080, 1110], [1880, 460], [970, 1570], [2490, 1660], [2750, 1280]].forEach(([x, y], index) => {
      props.fillStyle(index === 0 ? 0x59636a : 0x766756).fillEllipse(x, y, index === 0 ? 115 : 68, index === 0 ? 115 : 42)
      if (index === 0) this.addStaticCollider(x, y, 100, 100)
    })
    ;[[430, 760], [2550, 760], [420, 1100], [2580, 1070], [1180, 1450], [1840, 1450]].forEach(([x, y]) => {
      props.fillStyle(0x7a6747, 0.85).fillCircle(x, y, 19)
      props.fillStyle(0x59623b, 0.9).fillCircle(x + 22, y + 4, 13)
    })
  }

  private createLocations(locations: readonly FarmWorldLocationProjection[]) {
    farmWorldLayout.forEach((layout) => {
      const location = locations.find((candidate) => candidate.id === layout.id)
      if (!location) return
      const progressLabel = this.drawLocationGraybox(layout, location)
      const prompt = this.add.text(layout.approachX, layout.approachY + 74, this.getPromptText(location), {
        color: '#fff3dc', backgroundColor: '#211710ee', fontFamily: 'system-ui', fontSize: '18px',
        padding: { x: 14, y: 9 }, align: 'center',
      }).setOrigin(0.5).setDepth(DEPTH.prompts).setVisible(false)
      this.interactionTargets.push({ location, layout, progressLabel, prompt })
    })
  }

  private drawLocationGraybox(layout: FarmLocationLayout, location: FarmWorldLocationProjection) {
    const { x, y, width, height } = layout
    this.add.ellipse(x, y + height * 0.38, width * 1.05, height * 0.34, 0x150f0b, 0.48).setDepth(DEPTH.landscaping)

    if (layout.visualKind === 'garden') {
      this.add.rectangle(x, y, width, height, 0x65563c, 0.72).setStrokeStyle(8, 0x7f6847).setDepth(DEPTH.buildings)
      for (let row = -1; row <= 1; row += 1) {
        this.add.rectangle(x, y + row * 72, width - 90, 43, 0x34281e).setStrokeStyle(3, 0x8b6d45).setDepth(DEPTH.buildings)
        for (let plant = -4; plant <= 4; plant += 1) this.add.circle(x + plant * 50, y + row * 72, 10, 0x72864e).setDepth(DEPTH.foreground)
      }
      this.addStaticCollider(x, y - 72, width - 90, 43)
      this.addStaticCollider(x, y, width - 90, 43)
      this.addStaticCollider(x, y + 72, width - 90, 43)
    } else if (layout.visualKind === 'mailbox') {
      this.add.rectangle(x, y + 28, 16, 100, 0x6a4a32).setDepth(DEPTH.buildings)
      this.add.rectangle(x, y - 20, width, 58, 0x9b5938).setStrokeStyle(4, 0x352219).setDepth(DEPTH.foreground)
      this.add.rectangle(x + 22, y - 7, 24, 6, 0xd9b56e).setDepth(DEPTH.foreground)
      this.addStaticCollider(x, y + 12, width, height)
    } else if (layout.visualKind === 'town-exit') {
      this.add.rectangle(x - 135, y, 24, 118, 0x745237).setDepth(DEPTH.foreground)
      this.add.rectangle(x + 135, y, 24, 118, 0x745237).setDepth(DEPTH.foreground)
      this.add.rectangle(x, y - 45, 290, 56, 0x4e3828).setStrokeStyle(4, 0xa27a51).setDepth(DEPTH.foreground)
      this.add.text(x, y - 45, 'ROAD TO TOWN', { color: '#f0d7b3', fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.foreground)
      this.addStaticCollider(x - 135, y, 24, 118)
      this.addStaticCollider(x + 135, y, 24, 118)
    } else {
      const colors = { home: 0x8c6545, greenhouse: 0x65876f, lab: 0x596979 } as const
      const body = this.add.rectangle(x, y, width, height, colors[layout.visualKind]).setStrokeStyle(6, 0x302218).setDepth(DEPTH.buildings)
      if (layout.visualKind === 'greenhouse') {
        body.setAlpha(0.76)
        for (let offset = -width / 2 + 70; offset < width / 2; offset += 85) this.add.line(x + offset, y, 0, -height / 2, 0, height / 2, 0xb9d0bb, 0.45).setLineWidth(3).setDepth(DEPTH.foreground)
        this.add.ellipse(x, y - height / 2, width, 105, 0x8aa692, 0.7).setStrokeStyle(5, 0x30483b).setDepth(DEPTH.foreground)
      } else {
        const roofColor = layout.visualKind === 'lab' ? 0x394858 : 0xa95f38
        this.add.triangle(x, y - height * 0.68, -width * 0.58, height * 0.32, 0, -height * 0.18, width * 0.58, height * 0.32, roofColor).setStrokeStyle(6, 0x302218).setDepth(DEPTH.foreground)
        if (layout.visualKind === 'lab') {
          this.add.circle(x + width * 0.29, y - height * 0.63, 30, 0xb7c7c9).setStrokeStyle(5, 0x36434d).setDepth(DEPTH.foreground)
          this.add.line(x + width * 0.29, y - height * 0.63, 0, 25, 44, 62, 0x36434d).setLineWidth(5).setDepth(DEPTH.foreground)
        }
      }
      this.addStaticCollider(x, y, width, height)
    }

    if (layout.visualKind === 'town-exit') return null
    const nameY = layout.visualKind === 'mailbox' ? y - 82 : y - 8
    this.add.text(x, nameY, location.displayName, { color: '#fff0d7', fontFamily: 'Georgia, serif', fontSize: layout.visualKind === 'mailbox' ? '22px' : '30px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.foreground)
    const progress = this.getProgressText(location)
    return progress ? this.add.text(x, y + 31, progress, { color: '#ead4b1', fontFamily: 'system-ui', fontSize: '16px' }).setOrigin(0.5).setDepth(DEPTH.foreground) : null
  }

  private createPlayer() {
    // Position and click destination are renderer state only; gameplay truth remains outside Phaser.
    this.player = this.add.circle(FARM_PLAYER_SPAWN.x, FARM_PLAYER_SPAWN.y, 27, 0xe47a45).setStrokeStyle(5, 0x2b1a13).setDepth(DEPTH.player)
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setCircle(27).setCollideWorldBounds(true)
    this.staticColliders.forEach((collider) => this.physics.add.collider(this.player, collider))
  }

  private createInput() {
    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable')
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', interact: 'E' }) as typeof this.wasd
    this.wasd.interact.on('down', () => {
      if (this.canAcceptKeyboardInput()) this.activateNearestInteraction()
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.game.canvas.focus()
      if (this.getActiveTouchPointers().length >= 2) {
        this.beginPinch()
        return
      }
      this.pendingWorldTap = { pointerId: pointer.pointerId, worldX: pointer.worldX, worldY: pointer.worldY }
    })
    this.input.on('pointermove', () => this.updatePinch())
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.finishPointerGesture(pointer))
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => this.finishPointerGesture(pointer))
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _currentlyOver: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      this.setUserZoom(this.targetCameraZoom * Math.exp(-deltaY * 0.0012))
    })
    this.game.canvas.tabIndex = 0
    this.game.canvas.setAttribute('aria-label', 'Interactive Farm graybox. Use arrow keys or WASD to move and E to enter a nearby location.')
  }

  private configureCamera() {
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    const resize = (size: Phaser.Structs.Size) => {
      const shortestSide = Math.min(size.width, size.height)
      this.baseCameraZoom = Phaser.Math.Clamp(shortestSide / 720, 0.72, 1.18)
      const fitWidthZoom = size.width / FARM_WORLD_WIDTH
      const fitHeightZoom = size.height / FARM_WORLD_HEIGHT
      this.fitCameraZoom = Math.max(CAMERA_ZOOM_FLOOR, Math.min(fitWidthZoom, fitHeightZoom) * WORLD_OVERVIEW_MARGIN_SCALE)
      this.targetCameraZoom = this.cameraConfigured
        ? Phaser.Math.Clamp(this.targetCameraZoom, this.fitCameraZoom, MAX_CAMERA_ZOOM)
        : this.baseCameraZoom
      this.cameraConfigured = true
      this.cameras.main.setZoom(this.targetCameraZoom)
    }
    resize(this.scale.gameSize)
    this.scale.on(Phaser.Scale.Events.RESIZE, resize)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, resize))
  }

  private drawDebugOverlay() {
    const debug = this.add.graphics().setDepth(DEPTH.debug)
    debug.lineStyle(5, 0xffcc66, 0.9).strokeRect(0, 0, FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT)
    debug.lineStyle(3, 0x45c88a, 0.8)
    this.interactionTargets.forEach((target) => {
      debug.strokeCircle(target.layout.approachX, target.layout.approachY, INTERACTION_DISTANCE)
      this.add.text(target.layout.x, target.layout.y - target.layout.height / 2 - 85, target.location.id, { color: '#8dffd2', backgroundColor: '#10251ddd', fontSize: '14px', padding: { x: 6, y: 4 } }).setOrigin(0.5).setDepth(DEPTH.debug)
    })
    debug.fillStyle(0xff7f50, 0.9).fillCircle(FARM_PLAYER_SPAWN.x, FARM_PLAYER_SPAWN.y, 12)
    this.cameraDebugText = this.add.text(14, 14, '', { color: '#fff2c7', backgroundColor: '#1a120ddd', fontSize: '13px', padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(DEPTH.debug)
  }

  private getActiveTouchPointers() {
    return this.input.manager.pointers.filter((pointer) => pointer.wasTouch && pointer.isDown)
  }

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
    const target = this.interactionTargets.find((candidate) => Phaser.Math.Distance.Between(worldX, worldY, candidate.layout.x, candidate.layout.y) <= candidate.layout.tapRadius)
    if (target) {
      if (this.isInInteractionRange(target)) this.enterLocation(target)
      else this.movementTarget = new Phaser.Math.Vector2(target.layout.approachX, target.layout.approachY)
      return
    }
    this.movementTarget = new Phaser.Math.Vector2(worldX, worldY)
  }

  private setUserZoom(zoom: number) {
    this.targetCameraZoom = Phaser.Math.Clamp(zoom, this.fitCameraZoom, MAX_CAMERA_ZOOM)
  }

  private updateCameraZoom() {
    const camera = this.cameras.main
    if (Math.abs(camera.zoom - this.targetCameraZoom) > 0.001) camera.setZoom(Phaser.Math.Linear(camera.zoom, this.targetCameraZoom, 0.18))
    if (this.cameraDebugText) this.cameraDebugText.setText(`Zoom ${camera.zoom.toFixed(2)}  Default ${this.baseCameraZoom.toFixed(2)}  Fit ${this.fitCameraZoom.toFixed(2)}  Max ${MAX_CAMERA_ZOOM.toFixed(2)}`)
  }

  private addStaticCollider(x: number, y: number, width: number, height: number) {
    const collider = this.add.rectangle(x, y, width, height, 0xffffff, 0)
    this.physics.add.existing(collider, true)
    this.staticColliders.push(collider)
    return collider
  }

  private canAcceptKeyboardInput() {
    return this.game.canvas.contains(document.activeElement) || document.activeElement === document.body
  }

  private isInInteractionRange(target: InteractionTarget) {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, target.layout.approachX, target.layout.approachY) <= INTERACTION_DISTANCE
  }

  private getNearestInteraction() {
    return this.interactionTargets
      .filter((target) => this.isInInteractionRange(target))
      .sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.layout.approachX, a.layout.approachY) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.layout.approachX, b.layout.approachY))[0] ?? null
  }

  private activateNearestInteraction() {
    const target = this.getNearestInteraction()
    if (target) this.enterLocation(target)
  }

  private enterLocation(target: InteractionTarget) {
    this.bridge.emitIntent({ type: 'ENTER_LOCATION', locationId: target.location.id })
  }

  private getProgressText(location: FarmWorldLocationProjection) {
    if (location.progressionKind === undefined || location.progressionValue === undefined) return ''
    const label = location.progressionKind === 'tier' ? 'Tier' : 'Level'
    return `${label} ${location.progressionValue}`
  }

  private getPromptText(location: FarmWorldLocationProjection) {
    const progress = this.getProgressText(location)
    return `${location.displayName}${progress ? ` · ${progress}` : ''}\n${location.interactionLabel}`
  }
}
