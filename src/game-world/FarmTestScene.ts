import { NavigationMap } from './navigation/NavigationMap'
import { registerWorldDiagnostics } from '../features/devtools/worldDiagnostics'
import { getWorldEditor } from './editor/worldEditorState'
import { NavigationController } from './navigation/NavigationController'
import { bindWorldKeyboardFocus, canUseWorldKeyboard } from './worldKeyboardFocus'
import Phaser from 'phaser'
import { FARM_WORLD_HEIGHT, FARM_WORLD_WIDTH, MAILBOX_APPROACH_POINTS, MAILBOX_V1_COLLIDERS, NURSERY_PATH_ENDPOINT, farmWorldLayout, farmWorldSpawns, type FarmLocationLayout } from './farmWorldLayout'
import type { WorldBridge } from './WorldBridge'
import type { FarmWorldLocationProjection, FarmWorldSpawnId } from './worldTypes'
import { WORLD_DEPTH } from './worldDepth'
import { GARDEN_V1_MAIN_ART, GENETICS_LAB_V1_MAIN_ART, HOME_V1_MAIN_ART, MAILBOX_V1_MAIN_ART, NURSERY_V2_MAIN_ART } from './farmArtAssets'
import { GARDEN_DISPLAY_ANCHORS } from './gardenDisplayAnchors'
import { createPlantWorldVisual } from './PlantWorldVisual'
import { registeredPlantPigmentationAssets, registeredPlantStageAssets } from '../data/plantVisualAssets'
import type { GardenDisplayProjection } from './worldTypes'
import type { EditorObject, WorldEditorController } from './editor/worldEditorState'

const PLAYER_SPEED = 245
const INTERACTION_DISTANCE = 165
const NURSERY_V2_PRODUCTION_COLLIDER = { x: 650, y: 420, width: 500, height: 150 } as const
const NURSERY_COLLIDER_BOUNDS = { left: 395, right: 935, top: 310, bottom: 455 } as const
const NURSERY_ACTIVE_COLLIDER = {
  x: (NURSERY_COLLIDER_BOUNDS.left + NURSERY_COLLIDER_BOUNDS.right) / 2,
  y: (NURSERY_COLLIDER_BOUNDS.top + NURSERY_COLLIDER_BOUNDS.bottom) / 2,
  width: NURSERY_COLLIDER_BOUNDS.right - NURSERY_COLLIDER_BOUNDS.left,
  height: NURSERY_COLLIDER_BOUNDS.bottom - NURSERY_COLLIDER_BOUNDS.top,
} as const
const HOME_COLLIDERS = [
  { name: 'main body', x: 1500, y: 702.5, width: 508, height: 115 },
  { name: 'left wing', x: 1328, y: 632.5, width: 164, height: 35 },
  { name: 'right wing', x: 1672, y: 632.5, width: 164, height: 35 },
  { name: 'upper gable', x: 1500, y: 612.5, width: 240, height: 75 },
  { name: 'chimney', x: 1588, y: 565, width: 56, height: 50 },
] as const
const LAB_PROVISIONAL_COLLIDERS = [
  { name: 'lower body', x: 2382, y: 1257.5, width: 460, height: 135 },
  { name: 'central dome', x: 2412.5, y: 1145, width: 205, height: 110 },
  { name: 'right technical', x: 2558.5, y: 1148, width: 107, height: 104 },
  { name: 'left AC', x: 2224, y: 1174, width: 72, height: 52 },
] as const
const GARDEN_V1_EXTERIOR_COLLIDER = { x: 2390, y: 420, width: 600, height: 220 } as const
// The dynamic overview minimum may approach this floor only on pathological viewport shapes.
const CAMERA_ZOOM_FLOOR = 0.1
const MAX_CAMERA_ZOOM = 1.5
const WORLD_OVERVIEW_MARGIN_SCALE = 0.94

interface InteractionTarget {
  location: FarmWorldLocationProjection
  layout: FarmLocationLayout
  progressLabel: Phaser.GameObjects.Text | null
  prompt: Phaser.GameObjects.Text
}

interface PendingWorldTap {
  screenX: number
  screenY: number
  pointerId: number
  worldX: number
  worldY: number
}

function isFarmWorldLocation(location: { id: string }): location is FarmWorldLocationProjection {
  return location.id === 'home' || location.id === 'nursery' || location.id === 'garden' || location.id === 'lab' || location.id === 'mail' || location.id === 'town'
}

export class FarmTestScene extends Phaser.Scene {
  private readonly bridge: WorldBridge
  private readonly debugWorld: boolean
  private devDebugObjects: Phaser.GameObjects.GameObject[] = []
  private readonly playerSpawn: { x: number; y: number }
  private editor?: WorldEditorController
  private readonly editorVisuals = new Map<string, { main: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; extras: { object: Phaser.GameObjects.Rectangle; x: number; y: number }[]; x: number; y: number }>()
  private readonly ownedColliders = new Map<string, Phaser.GameObjects.Rectangle[]>()
  private readonly gardenPlantVisuals = new Map<string, { revision: string; visual: Phaser.GameObjects.Container }>()
  private readonly colliderHandles = new Map<Phaser.GameObjects.Rectangle, Phaser.Physics.Arcade.Collider>()
  private player!: Phaser.GameObjects.Container
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<'up' | 'down' | 'left' | 'right' | 'interact', Phaser.Input.Keyboard.Key>
  private navigation = new NavigationController(new NavigationMap(FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT, []))
  private pathDebug: Phaser.GameObjects.Graphics | null = null
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

  constructor(bridge: WorldBridge, debugWorld = false, options: { spawnId: FarmWorldSpawnId; editor?: WorldEditorController }) {
    super('farm-graybox')
    this.bridge = bridge
    this.debugWorld = debugWorld
    this.playerSpawn = options.editor?.getSnapshot().objects.flatMap((object) => object.returnSpawn?.id === options.spawnId ? [object.returnSpawn] : [])[0] ?? farmWorldSpawns[options.spawnId]
    this.editor = options.editor
  }

  preload() {
    registeredPlantStageAssets.forEach(({ key, path }) => this.load.image(key, path))
    registeredPlantPigmentationAssets.forEach(({ key, path }) => this.load.image(key, path))
    this.load.image(NURSERY_V2_MAIN_ART.key, NURSERY_V2_MAIN_ART.path)
    this.load.image(HOME_V1_MAIN_ART.key, HOME_V1_MAIN_ART.path)
    this.load.image(GENETICS_LAB_V1_MAIN_ART.key, GENETICS_LAB_V1_MAIN_ART.path)
    this.load.image(GARDEN_V1_MAIN_ART.key, GARDEN_V1_MAIN_ART.path)
    this.load.image(MAILBOX_V1_MAIN_ART.key, MAILBOX_V1_MAIN_ART.path)
  }

  create() {
    this.physics.world.setBounds(0, 0, FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT)
    this.drawGroundAndPaths()
    this.drawPropertyBoundary()
    this.drawLandscaping()
    this.createLocations(this.bridge.getProjection().locations.filter(isFarmWorldLocation))
    this.updateGardenDisplays(this.bridge.getProjection().gardenDisplays ?? [])
    this.createPlayer()
    this.createInput()
    this.configureCamera()
    if (this.editor) this.setupEditor()
    this.rebuildNavigation()
    if (this.debugWorld) this.setDevelopmentDebug(true)

    this.unsubscribeProjection = this.bridge.subscribeToProjection((projection) => {
      this.updateGardenDisplays(projection.gardenDisplays ?? [])
      projection.locations.filter(isFarmWorldLocation).forEach((location) => {
        const target = this.interactionTargets.find((candidate) => candidate.location.id === location.id)
        if (!target) return
        target.location = location
        target.progressLabel?.setText(this.getProgressText(location))
        target.prompt.setText(this.getPromptText(location))
      })
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribeProjection?.())
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'staging') {
      const sessionId = crypto.randomUUID()
      const unregister = registerWorldDiagnostics({
        read: () => ({ world: 'Farm', area: null, sessionId, position: { x: this.player.x, y: this.player.y }, destination: this.navigation.destination, waypoints: this.navigation.path.length, multiplayer: null }),
        resetPosition: () => {
          const spawn = farmWorldSpawns.default
          if (!this.navigation.map.walkable(spawn)) return false
          this.navigation.cancel(); (this.player.body as Phaser.Physics.Arcade.Body).reset(spawn.x, spawn.y)
          return true
        },
        enableEditor: () => { if (!this.editor) { this.editor = getWorldEditor('farm'); this.editor.setMode('test'); this.setupEditor() }; return this.editor },
        setDebugVisible: visible => this.setDevelopmentDebug(visible),
      })
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unregister)
    }
  }

  private updateGardenDisplays(displays: readonly GardenDisplayProjection[]) {
    const active = new Set<string>(displays.map((display) => display.slotId))
    for (const [slotId, entry] of this.gardenPlantVisuals) {
      if (active.has(slotId)) continue
      entry.visual.destroy()
      this.gardenPlantVisuals.delete(slotId)
    }
    displays.forEach((display) => {
      const revision = `${display.specimenId}:${display.visual.visualRevision}`
      const current = this.gardenPlantVisuals.get(display.slotId)
      if (current?.revision === revision) return
      current?.visual.destroy()
      this.gardenPlantVisuals.set(display.slotId, { revision, visual: createPlantWorldVisual(this, display) })
    })
  }

  private setDevelopmentDebug(visible: boolean) {
    if (import.meta.env.MODE !== 'development' && import.meta.env.MODE !== 'staging') return
    this.devDebugObjects.forEach(object => object.destroy()); this.devDebugObjects = []
    this.pathDebug?.destroy(); this.pathDebug = null
    this.cameraDebugText = null
    this.physics.world.drawDebug = visible
    if (visible && !this.physics.world.debugGraphic) this.physics.world.createDebugGraphic()
    this.physics.world.debugGraphic?.setVisible(visible)
    if (!visible) return
    this.pathDebug = this.add.graphics().setDepth(WORLD_DEPTH.debug)
    const before = new Set(this.children.list)
    this.drawDebugOverlay()
    this.devDebugObjects = this.children.list.filter(object => !before.has(object))
  }

  update(time: number, delta = 1000 / 60) {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    this.updateCameraZoom()
    if (this.editor?.getSnapshot().mode === 'edit') { body.setVelocity(0); this.navigation.cancel(); return }
    if (!this.canAcceptKeyboardInput()) {
      body.setVelocity(0)
      return
    }

    const horizontal = Number(this.cursors.right.isDown || this.wasd.right.isDown) - Number(this.cursors.left.isDown || this.wasd.left.isDown)
    const vertical = Number(this.cursors.down.isDown || this.wasd.down.isDown) - Number(this.cursors.up.isDown || this.wasd.up.isDown)
    if (horizontal || vertical) {
      this.navigation.cancel()
      const velocity = new Phaser.Math.Vector2(horizontal, vertical).normalize().scale(PLAYER_SPEED)
      body.setVelocity(velocity.x, velocity.y)
    } else {
      const velocity = this.navigation.update(this.player, delta, PLAYER_SPEED, time)
      body.setVelocity(velocity.x, velocity.y)
    }
    this.drawNavigationPath()

    const nearby = this.getNearestInteraction()
    this.interactionTargets.forEach((target) => {
      target.prompt.setVisible(target === nearby)
      if (target === nearby && target.location.id === 'mail') target.prompt.setPosition(this.player.x, this.player.y - 90)
    })
  }

  private drawGroundAndPaths() {
    this.add.rectangle(FARM_WORLD_WIDTH / 2, FARM_WORLD_HEIGHT / 2, FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT, 0x30271f).setDepth(WORLD_DEPTH.ground)
    const ground = this.add.graphics().setDepth(WORLD_DEPTH.ground)
    ground.fillStyle(0x5c4b37).fillRoundedRect(70, 60, FARM_WORLD_WIDTH - 140, FARM_WORLD_HEIGHT - 120, 80)

    const paths = this.add.graphics().setDepth(WORLD_DEPTH.paths)
    paths.lineStyle(118, 0xb58b5d, 0.48)
    const branches: readonly (readonly [number, number])[][] = [
      [[1500, 1900], [1500, 1100], [1500, 870]],
      [[1500, 1050], [940, 860], [650, 580], [NURSERY_PATH_ENDPOINT.x, NURSERY_PATH_ENDPOINT.y]],
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
  }

  private drawPropertyBoundary() {
    const fence = this.add.graphics().setDepth(WORLD_DEPTH.foreground)
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
    const props = this.add.graphics().setDepth(WORLD_DEPTH.landscaping)
    const cactusClusters = [[250, 330], [280, 900], [2700, 280], [2730, 930], [340, 1590], [2640, 1610], [1050, 300], [1980, 330]]
    cactusClusters.forEach(([x, y]) => {
      props.fillStyle(0x52683e).fillRoundedRect(x - 13, y - 48, 26, 74, 12)
      props.fillStyle(0x6f8550).fillCircle(x + 20, y + 5, 18)
      props.fillStyle(0x394b31).fillCircle(x - 23, y + 13, 13)
    })
    ;[[1880, 460], [970, 1570], [2490, 1660], [2750, 1280]].forEach(([x, y]) => {
      props.fillStyle(0x766756).fillEllipse(x, y, 68, 42)
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
      const progressLabel = this.drawLocationGraybox(layout)
      const prompt = this.add.text(layout.approachX, layout.approachY + 74, this.getPromptText(location), {
        color: '#fff3dc', backgroundColor: '#211710ee', fontFamily: 'system-ui', fontSize: '18px',
        padding: { x: 14, y: 9 }, align: 'center',
      }).setOrigin(0.5).setDepth(WORLD_DEPTH.prompts).setVisible(false)
      this.interactionTargets.push({ location, layout, progressLabel, prompt })
    })
  }

  private drawLocationGraybox(layout: FarmLocationLayout) {
    const { x, y } = layout
    if (layout.visualKind === 'garden') {
      const visual = this.add.image(GARDEN_V1_MAIN_ART.anchorX, GARDEN_V1_MAIN_ART.anchorY, GARDEN_V1_MAIN_ART.key)
        .setOrigin(GARDEN_V1_MAIN_ART.originX, GARDEN_V1_MAIN_ART.originY)
        .setDisplaySize(GARDEN_V1_MAIN_ART.width, GARDEN_V1_MAIN_ART.height)
        .setDepth(GARDEN_V1_MAIN_ART.depth)
      this.rememberVisual(layout.id, visual)
      this.addStaticCollider(
        GARDEN_V1_EXTERIOR_COLLIDER.x,
        GARDEN_V1_EXTERIOR_COLLIDER.y,
        GARDEN_V1_EXTERIOR_COLLIDER.width,
        GARDEN_V1_EXTERIOR_COLLIDER.height,
        layout.id,
      )
    } else if (layout.visualKind === 'mailbox') {
      const visual = this.add.image(MAILBOX_V1_MAIN_ART.anchorX, MAILBOX_V1_MAIN_ART.anchorY, MAILBOX_V1_MAIN_ART.key)
        .setOrigin(MAILBOX_V1_MAIN_ART.originX, MAILBOX_V1_MAIN_ART.originY)
        .setDisplaySize(MAILBOX_V1_MAIN_ART.width, MAILBOX_V1_MAIN_ART.height)
        .setDepth(MAILBOX_V1_MAIN_ART.depth)
      this.rememberVisual(layout.id, visual)
      MAILBOX_V1_COLLIDERS.forEach(({ x, y, width, height }) => this.addStaticCollider(x, y, width, height, layout.id))
    } else if (layout.visualKind === 'town-exit') {
      const left = this.add.rectangle(x - 135, y, 24, 118, 0x745237).setDepth(WORLD_DEPTH.foreground)
      const right = this.add.rectangle(x + 135, y, 24, 118, 0x745237).setDepth(WORLD_DEPTH.foreground)
      const visual = this.add.rectangle(x, y - 45, 290, 56, 0x4e3828).setStrokeStyle(4, 0xa27a51).setDepth(WORLD_DEPTH.foreground)
      this.rememberVisual(layout.id, visual, [left, right])
      this.addStaticCollider(x - 135, y, 24, 118, layout.id)
      this.addStaticCollider(x + 135, y, 24, 118, layout.id)
    } else {
      if (layout.visualKind === 'greenhouse') {
        const visual = this.add.image(NURSERY_V2_MAIN_ART.anchorX, NURSERY_V2_MAIN_ART.anchorY, NURSERY_V2_MAIN_ART.key)
          .setOrigin(NURSERY_V2_MAIN_ART.originX, NURSERY_V2_MAIN_ART.originY)
          .setDisplaySize(NURSERY_V2_MAIN_ART.width, NURSERY_V2_MAIN_ART.height)
          .setDepth(NURSERY_V2_MAIN_ART.depth)
        this.rememberVisual(layout.id, visual)
        this.addStaticCollider(
          NURSERY_ACTIVE_COLLIDER.x,
          NURSERY_ACTIVE_COLLIDER.y,
          NURSERY_ACTIVE_COLLIDER.width,
          NURSERY_ACTIVE_COLLIDER.height,
          layout.id,
        )
      } else if (layout.visualKind === 'home') {
        const visual = this.add.image(HOME_V1_MAIN_ART.anchorX, HOME_V1_MAIN_ART.anchorY, HOME_V1_MAIN_ART.key)
          .setOrigin(HOME_V1_MAIN_ART.originX, HOME_V1_MAIN_ART.originY)
          .setDisplaySize(HOME_V1_MAIN_ART.width, HOME_V1_MAIN_ART.height)
          .setDepth(HOME_V1_MAIN_ART.depth)
        this.rememberVisual(layout.id, visual)
        HOME_COLLIDERS.forEach(({ x, y, width, height }) => this.addStaticCollider(x, y, width, height, layout.id))
      } else if (layout.visualKind === 'lab') {
        const visual = this.add.image(GENETICS_LAB_V1_MAIN_ART.anchorX, GENETICS_LAB_V1_MAIN_ART.anchorY, GENETICS_LAB_V1_MAIN_ART.key)
          .setOrigin(GENETICS_LAB_V1_MAIN_ART.originX, GENETICS_LAB_V1_MAIN_ART.originY)
          .setDisplaySize(GENETICS_LAB_V1_MAIN_ART.width, GENETICS_LAB_V1_MAIN_ART.height)
          .setDepth(GENETICS_LAB_V1_MAIN_ART.depth)
        this.rememberVisual(layout.id, visual)
        LAB_PROVISIONAL_COLLIDERS.forEach(({ x, y, width, height }) => this.addStaticCollider(x, y, width, height, layout.id))
      }
    }

    return null
  }

  private createPlayer() {
    // This development silhouette communicates art scale; its 27px gameplay body is unchanged.
    const visuals: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, -18, 34, 62, 0xb85e3d).setStrokeStyle(4, 0x2b1a13),
      this.add.circle(0, -61, 20, 0xd39a6b).setStrokeStyle(4, 0x2b1a13),
    ]
    this.player = this.add.container(this.playerSpawn.x, this.playerSpawn.y, visuals).setSize(54, 54).setDepth(WORLD_DEPTH.localPlayer)
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setCircle(27).setCollideWorldBounds(true)
    this.staticColliders.forEach((collider) => this.attachCollider(collider))
  }

  private createInput() {
    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable')
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', interact: 'E' }) as typeof this.wasd
    const releaseKeyboardFocus = bindWorldKeyboardFocus(this.game.canvas, this.input.keyboard)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseKeyboardFocus)
    this.events.once(Phaser.Scenes.Events.DESTROY, releaseKeyboardFocus)
    this.wasd.interact.on('down', () => {
      if (this.editor?.getSnapshot().mode !== 'edit' && this.canAcceptKeyboardInput()) this.activateNearestInteraction()
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.editor?.getSnapshot().mode === 'edit') {
        if (this.getActiveTouchPointers().length >= 2) this.beginPinch()
        return
      }
      this.game.canvas.focus()
      if (this.getActiveTouchPointers().length >= 2) {
        this.beginPinch()
        return
      }
      if (!pointer.wasTouch) {
        this.pendingWorldTap = null
        this.handleWorldTap(pointer.worldX, pointer.worldY)
        return
      }
      this.pendingWorldTap = { pointerId: pointer.pointerId, worldX: pointer.worldX, worldY: pointer.worldY, screenX: pointer.x, screenY: pointer.y }
    })
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.pendingWorldTap?.pointerId === pointer.pointerId
        && Math.hypot(pointer.x - this.pendingWorldTap.screenX, pointer.y - this.pendingWorldTap.screenY) > 12) this.pendingWorldTap = null
      if (this.editor?.getSnapshot().mode !== 'edit' || this.pinchActive) this.updatePinch()
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => { if (this.editor?.getSnapshot().mode !== 'edit' || this.pinchActive) this.finishPointerGesture(pointer) })
    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => { this.pendingWorldTap = null; this.finishPointerGesture(pointer) })
    const cancelGesture = () => { this.pendingWorldTap = null; this.pinchActive = false; this.suppressWorldTap = false }
    this.game.canvas.addEventListener('touchcancel', cancelGesture)
    this.game.canvas.addEventListener('pointercancel', cancelGesture)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cancelGesture()
      this.game.canvas.removeEventListener('touchcancel', cancelGesture)
      this.game.canvas.removeEventListener('pointercancel', cancelGesture)
    })
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
    const debug = this.add.graphics().setDepth(WORLD_DEPTH.debug)
    debug.lineStyle(5, 0xffcc66, 0.9).strokeRect(0, 0, FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT)
    debug.lineStyle(3, 0x45c88a, 0.8)
    this.interactionTargets.forEach((target) => {
      const interaction = this.getInteractionCenter(target.layout)
      const interactionRadius = this.getInteractionRadius(target.layout)
      debug.lineStyle(3, 0x45c88a, 0.8).strokeCircle(interaction.x, interaction.y, interactionRadius)
      debug.lineStyle(2, 0xffa84a, 0.85).strokeCircle(interaction.x, interaction.y, target.layout.tapRadius)
      debug.fillStyle(0x45c88a, 0.95).fillCircle(interaction.x, interaction.y, 8)
      debug.fillStyle(0x5ac8ff, 0.95).fillCircle(target.layout.approachX, target.layout.approachY, 8)
      debug.lineBetween(target.layout.x - 14, target.layout.y, target.layout.x + 14, target.layout.y)
      debug.lineBetween(target.layout.x, target.layout.y - 14, target.layout.x, target.layout.y + 14)
      debug.lineBetween(target.layout.x, target.layout.y, target.layout.approachX, target.layout.approachY)
      this.add.text(target.layout.x, target.layout.y - target.layout.height / 2 - 85, target.location.id, { color: '#8dffd2', backgroundColor: '#10251ddd', fontSize: '14px', padding: { x: 6, y: 4 } }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
      this.drawLocationColliderDebug(debug, target.layout)
      if (target.layout.visualKind === 'greenhouse') this.drawNurseryDebug(debug, target.layout)
      if (target.layout.visualKind === 'home') this.drawHomeDebug(debug)
      if (target.layout.visualKind === 'lab') this.drawLabDebug(debug)
      if (target.layout.visualKind === 'garden') this.drawGardenDebug(debug)
      if (target.layout.visualKind === 'mailbox') this.drawMailboxDebug(debug, target.layout)
    })
    Object.entries(farmWorldSpawns).forEach(([id, spawn]) => {
      debug.fillStyle(0xff7f50, 0.95).fillCircle(spawn.x, spawn.y, 10)
      this.add.text(spawn.x, spawn.y + 25, `SPAWN: ${id}`, { color: '#ffd5c5', backgroundColor: '#2a1711dd', fontSize: '11px', padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    })
    this.cameraDebugText = this.add.text(14, 14, '', { color: '#fff2c7', backgroundColor: '#1a120ddd', fontSize: '13px', padding: { x: 8, y: 6 } }).setScrollFactor(0).setDepth(WORLD_DEPTH.debug)
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
    this.navigation.cancel()
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
    if (Math.hypot(pointer.x - tap.screenX, pointer.y - tap.screenY) > 12) return
    this.handleWorldTap(tap.worldX, tap.worldY)
  }

  private handleWorldTap(worldX: number, worldY: number) {
    const target = this.interactionTargets.find((candidate) => {
      const point = this.getTapCenter(candidate.layout)
      const onBody = this.ownedColliders.get(candidate.location.id)?.some((collider) => {
        const body = collider.body as Phaser.Physics.Arcade.StaticBody
        return worldX >= body.x && worldX <= body.right && worldY >= body.y && worldY <= body.bottom
      })
      return onBody || Phaser.Math.Distance.Between(worldX, worldY, point.x, point.y) <= candidate.layout.tapRadius
    })
    if (!target) { this.navigation.move(this.player, { x: worldX, y: worldY }); return }
    const authored = this.editor?.getSnapshot().objects.find((object) => object.id === target.location.id)?.approaches[0]
    const approach = target.location.id === 'mail' ? this.getNearestMailboxApproach() :
      authored ?? { x: target.layout.approachX, y: target.layout.approachY }
    this.navigation.approach(this.player, {
      id: target.location.id, position: () => this.getInteractionCenter(target.layout),
      radius: this.getInteractionRadius(target.layout), approach, activate: () => this.enterLocation(target),
    }, performance.now())
  }

  private setUserZoom(zoom: number) {
    this.targetCameraZoom = Phaser.Math.Clamp(zoom, this.fitCameraZoom, MAX_CAMERA_ZOOM)
  }

  private updateCameraZoom() {
    const camera = this.cameras.main
    if (Math.abs(camera.zoom - this.targetCameraZoom) > 0.001) camera.setZoom(Phaser.Math.Linear(camera.zoom, this.targetCameraZoom, 0.18))
    if (this.cameraDebugText) this.cameraDebugText.setText(`Zoom ${camera.zoom.toFixed(2)}  Default ${this.baseCameraZoom.toFixed(2)}  Fit ${this.fitCameraZoom.toFixed(2)}  Max ${MAX_CAMERA_ZOOM.toFixed(2)}`)
  }

  private addStaticCollider(x: number, y: number, width: number, height: number, ownerId?: string) {
    const collider = this.add.rectangle(x, y, width, height, 0xffffff, 0)
    this.physics.add.existing(collider, true)
    this.staticColliders.push(collider)
    if (ownerId) this.ownedColliders.set(ownerId, [...(this.ownedColliders.get(ownerId) ?? []), collider])
    if (this.player?.body) this.attachCollider(collider)
    return collider
  }

  private attachCollider(collider: Phaser.GameObjects.Rectangle) {
    this.colliderHandles.set(collider, this.physics.add.collider(this.player, collider))
  }

  private rememberVisual(id: string, main: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, extras: Phaser.GameObjects.Rectangle[] = []) {
    this.editorVisuals.set(id, { main, extras: extras.map((object) => ({ object, x: object.x, y: object.y })), x: main.x, y: main.y })
  }

  private setupEditor() {
    if (!this.editor) return
    const returnIds: Record<string, FarmWorldSpawnId> = {
      home: 'home-exterior', nursery: 'nursery-exterior', garden: 'garden-exterior',
      lab: 'lab-exterior', mail: 'mailbox-exterior', town: 'road-from-town',
    }
    const objects: EditorObject[] = farmWorldLayout.flatMap((layout) => {
      const visual = this.editorVisuals.get(layout.id)?.main
      if (!visual) return []
      const returnSpawn = farmWorldSpawns[returnIds[layout.id]]
      const interaction = { x: layout.interactionX ?? layout.approachX, y: layout.interactionY ?? layout.approachY }
      return [{
        id: layout.id,
        label: this.interactionTargets.find((target) => target.location.id === layout.id)?.location.displayName ?? layout.id,
        sprite: { x: visual.x, y: visual.y, width: visual.displayWidth, height: visual.displayHeight, originX: visual.originX, originY: visual.originY },
        colliders: this.getLocationDebugColliders(layout).map((collider, index) => ({ id: `${layout.id}-${index}`, label: collider.label, x: collider.x, y: collider.y, width: collider.width, height: collider.height })),
        interaction: { x: interaction.x, y: interaction.y, radius: layout.interactionRadius ?? INTERACTION_DISTANCE },
        approaches: layout.id === 'mail' ? MAILBOX_APPROACH_POINTS.map((point) => ({ id: point.name, label: `Approach ${point.name}`, x: point.x, y: point.y })) : [{ id: 'approach', label: 'Approach', x: layout.approachX, y: layout.approachY }],
        returnSpawn: { id: returnIds[layout.id], label: 'Return spawn', x: returnSpawn.x, y: returnSpawn.y },
        anchors: layout.id === 'garden' ? GARDEN_DISPLAY_ANCHORS.map((point) => ({ id: point.id, label: point.id, x: point.x, y: point.y })) : [],
      }]
    })
    this.editor.initialize(objects)
    let last = new Map<string, EditorObject>()
    const apply = () => {
      for (const object of this.editor!.getSnapshot().objects) {
        if (last.get(object.id) !== object) this.applyEditorObject(object)
      }
      last = new Map(this.editor!.getSnapshot().objects.map((object) => [object.id, object]))
    }
    const unsubscribe = this.editor.subscribe(apply)
    apply()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe)
    if (import.meta.env.MODE !== 'development' && import.meta.env.MODE !== 'staging') return
    void import('./editor/WorldEditorOverlay').then(({ WorldEditorOverlay }) => {
      if (this.scene.isActive()) new WorldEditorOverlay(this, this.editor!)
    })
  }

  private applyEditorObject(object: EditorObject) {
    const visual = this.editorVisuals.get(object.id)
    if (!visual) return
    const { sprite } = object
    visual.main.setPosition(sprite.x, sprite.y).setOrigin(sprite.originX, sprite.originY)
    if (visual.main instanceof Phaser.GameObjects.Image) visual.main.setDisplaySize(sprite.width, sprite.height)
    else visual.main.setSize(sprite.width, sprite.height)
    visual.extras.forEach(({ object: extra, x, y }) => extra.setPosition(x + sprite.x - visual.x, y + sprite.y - visual.y))
    const old = this.ownedColliders.get(object.id) ?? []
    old.forEach((collider) => {
      this.colliderHandles.get(collider)?.destroy()
      this.colliderHandles.delete(collider)
      this.staticColliders.splice(this.staticColliders.indexOf(collider), 1)
      collider.destroy()
    })
    this.ownedColliders.set(object.id, [])
    object.colliders.forEach(({ x, y, width, height }) => this.addStaticCollider(x, y, width, height, object.id))
    this.rebuildNavigation()
    const target = this.interactionTargets.find((candidate) => candidate.location.id === object.id)
    if (target && object.approaches[0]) target.prompt.setPosition(object.approaches[0].x, object.approaches[0].y + 74)
  }

  private rebuildNavigation() {
    this.navigation = new NavigationController(new NavigationMap(FARM_WORLD_WIDTH, FARM_WORLD_HEIGHT,
      this.staticColliders.map((collider) => { const body = collider.body as Phaser.Physics.Arcade.StaticBody; return { x: body.x + body.width / 2, y: body.y + body.height / 2, width: body.width, height: body.height } }),
      (this.player.body as Phaser.Physics.Arcade.Body).radius))
  }

  private drawNavigationPath() {
    const debug = this.pathDebug
    if (!debug) return
    debug.clear().lineStyle(3, 0x66eaff, 0.9)
    debug.beginPath().moveTo(this.player.x, this.player.y)
    for (const point of this.navigation.path) debug.lineTo(point.x, point.y)
    debug.strokePath()
    for (const point of this.navigation.path) debug.fillStyle(0x66eaff).fillCircle(point.x, point.y, 5)
  }

  private canAcceptKeyboardInput() {
    return canUseWorldKeyboard(this.game.canvas)
  }

  private isInInteractionRange(target: InteractionTarget) {
    const interaction = this.getInteractionCenter(target.layout)
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, interaction.x, interaction.y) <= this.getInteractionRadius(target.layout)
  }

  private getNearestInteraction() {
    return this.interactionTargets
      .filter((target) => this.isInInteractionRange(target))
      .sort((a, b) => {
        const aCenter = this.getInteractionCenter(a.layout)
        const bCenter = this.getInteractionCenter(b.layout)
        return Phaser.Math.Distance.Between(this.player.x, this.player.y, aCenter.x, aCenter.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, bCenter.x, bCenter.y)
      })[0] ?? null
  }

  private getInteractionCenter(layout: FarmLocationLayout) {
    const interaction = this.editor?.getSnapshot().objects.find((object) => object.id === layout.id)?.interaction
    if (interaction) return interaction
    return { x: layout.interactionX ?? layout.approachX, y: layout.interactionY ?? layout.approachY }
  }

  private getTapCenter(layout: FarmLocationLayout) {
    const interaction = this.editor?.getSnapshot().objects.find((object) => object.id === layout.id)?.interaction
    if (interaction) return interaction
    return layout.interactionX === undefined || layout.interactionY === undefined
      ? { x: layout.x, y: layout.y }
      : { x: layout.interactionX, y: layout.interactionY }
  }

  private getNearestMailboxApproach() {
    const points = this.editor?.getSnapshot().objects.find((object) => object.id === 'mail')?.approaches ?? MAILBOX_APPROACH_POINTS
    const layout = this.interactionTargets.find((target) => target.location.id === 'mail')!.layout
    const center = this.getInteractionCenter(layout)
    return points.map((point) => {
      const path = this.navigation.map.route(this.player, point)
      const end = path?.at(-1)
      let previous = this.player as { x: number; y: number }, cost = 0
      for (const step of path ?? []) { cost += Math.hypot(step.x - previous.x, step.y - previous.y); previous = step }
      return { point, cost: end && Math.hypot(end.x - center.x, end.y - center.y) <= this.getInteractionRadius(layout) ? cost : Infinity }
    }).sort((a, b) => a.cost - b.cost)[0].point
  }

  private getInteractionRadius(layout: FarmLocationLayout) {
    const radius = this.editor?.getSnapshot().objects.find((object) => object.id === layout.id)?.interaction?.radius
    if (radius !== undefined) return radius
    return layout.interactionRadius ?? INTERACTION_DISTANCE
  }

  private drawNurseryDebug(debug: Phaser.GameObjects.Graphics, layout: FarmLocationLayout) {
    debug.lineStyle(3, 0x33e0e8, 0.95)
    debug.strokeRect(layout.x - layout.width / 2, layout.y - layout.height / 2, layout.width, layout.height)
    this.add.text(
      layout.x,
      layout.y - layout.height / 2 - 30,
      'PLACEMENT — NON-COLLIDING',
      { color: '#9cf9ff', backgroundColor: '#10272add', fontSize: '12px', padding: { x: 6, y: 3 } },
    ).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    debug.lineStyle(2, 0x66d9ff, 0.75).strokeRect(
      NURSERY_V2_PRODUCTION_COLLIDER.x - NURSERY_V2_PRODUCTION_COLLIDER.width / 2,
      NURSERY_V2_PRODUCTION_COLLIDER.y - NURSERY_V2_PRODUCTION_COLLIDER.height / 2,
      NURSERY_V2_PRODUCTION_COLLIDER.width,
      NURSERY_V2_PRODUCTION_COLLIDER.height,
    )
    this.add.text(
      NURSERY_V2_PRODUCTION_COLLIDER.x,
      NURSERY_V2_PRODUCTION_COLLIDER.y,
      'V2 PRODUCTION COLLIDER CONTRACT — NOT ACTIVE',
      { color: '#9cf9ff', backgroundColor: '#10272add', fontSize: '10px', padding: { x: 5, y: 3 } },
    ).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    const interaction = this.getInteractionCenter(layout)
    this.add.text(
      interaction.x,
      interaction.y - this.getInteractionRadius(layout) - 18,
      'INTERACTION ZONE',
      { color: '#8dffd2', backgroundColor: '#10251ddd', fontSize: '12px', padding: { x: 6, y: 3 } },
    ).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    const buildingX = NURSERY_V2_MAIN_ART.anchorX
    const buildingY = NURSERY_V2_MAIN_ART.anchorY
    const baselineY = NURSERY_V2_MAIN_ART.anchorY
    debug.lineStyle(2, 0xb37cff, 0.9).strokeRect(
      buildingX - NURSERY_V2_MAIN_ART.width * NURSERY_V2_MAIN_ART.originX,
      buildingY - NURSERY_V2_MAIN_ART.height * NURSERY_V2_MAIN_ART.originY,
      NURSERY_V2_MAIN_ART.width,
      NURSERY_V2_MAIN_ART.height,
    )
    debug.lineStyle(3, 0x66d9ff, 1)
    debug.lineBetween(buildingX - 12, buildingY, buildingX + 12, buildingY)
    debug.lineBetween(buildingX, buildingY - 12, buildingX, buildingY + 12)
    debug.lineStyle(3, 0xffef66, 0.95).lineBetween(buildingX - NURSERY_V2_MAIN_ART.width / 2, baselineY, buildingX + NURSERY_V2_MAIN_ART.width / 2, baselineY)
    debug.fillStyle(0xffef66, 1).fillCircle(NURSERY_PATH_ENDPOINT.x, NURSERY_PATH_ENDPOINT.y, 7)
    this.add.text(layout.x, layout.y - layout.height / 2 - 58, 'NURSERY SPRITE BOUNDS (PURPLE)', { color: '#fff3b0', backgroundColor: '#241b12dd', fontSize: '13px', padding: { x: 6, y: 4 } }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
  }

  private drawHomeDebug(debug: Phaser.GameObjects.Graphics) {
    debug.lineStyle(2, 0xb37cff, 0.9).strokeRect(
      HOME_V1_MAIN_ART.anchorX - HOME_V1_MAIN_ART.width * HOME_V1_MAIN_ART.originX,
      HOME_V1_MAIN_ART.anchorY - HOME_V1_MAIN_ART.height * HOME_V1_MAIN_ART.originY,
      HOME_V1_MAIN_ART.width,
      HOME_V1_MAIN_ART.height,
    )
    debug.fillStyle(0xffef66, 1).fillCircle(HOME_V1_MAIN_ART.anchorX, HOME_V1_MAIN_ART.anchorY, 7)
  }

  private drawLabDebug(debug: Phaser.GameObjects.Graphics) {
    debug.lineStyle(2, 0xb37cff, 0.9).strokeRect(
      GENETICS_LAB_V1_MAIN_ART.anchorX - GENETICS_LAB_V1_MAIN_ART.width * GENETICS_LAB_V1_MAIN_ART.originX,
      GENETICS_LAB_V1_MAIN_ART.anchorY - GENETICS_LAB_V1_MAIN_ART.height * GENETICS_LAB_V1_MAIN_ART.originY,
      GENETICS_LAB_V1_MAIN_ART.width,
      GENETICS_LAB_V1_MAIN_ART.height,
    )
    debug.fillStyle(0xffef66, 1).fillCircle(2420, 1355, 7)
    this.add.text(2420, 1335, 'LAB DOOR (2420, 1355)', {
      color: '#fff3b0', backgroundColor: '#241b12dd', fontSize: '11px', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
  }

  private drawGardenDebug(debug: Phaser.GameObjects.Graphics) {
    debug.lineStyle(2, 0xb37cff, 0.9).strokeRect(
      GARDEN_V1_MAIN_ART.anchorX - GARDEN_V1_MAIN_ART.width * GARDEN_V1_MAIN_ART.originX,
      GARDEN_V1_MAIN_ART.anchorY - GARDEN_V1_MAIN_ART.height * GARDEN_V1_MAIN_ART.originY,
      GARDEN_V1_MAIN_ART.width,
      GARDEN_V1_MAIN_ART.height,
    )
    GARDEN_DISPLAY_ANCHORS.forEach((anchor) => {
      debug.fillStyle(0x66d9ff, 0.95).fillCircle(anchor.x, anchor.y, 6)
      this.add.text(anchor.x, anchor.y - 20, anchor.id, {
        color: '#bdefff', backgroundColor: '#10272add', fontSize: '10px', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    })
  }

  private drawMailboxDebug(debug: Phaser.GameObjects.Graphics, layout: FarmLocationLayout) {
    debug.lineStyle(2, 0xb37cff, 0.9).strokeRect(
      MAILBOX_V1_MAIN_ART.anchorX - MAILBOX_V1_MAIN_ART.width * MAILBOX_V1_MAIN_ART.originX,
      MAILBOX_V1_MAIN_ART.anchorY - MAILBOX_V1_MAIN_ART.height * MAILBOX_V1_MAIN_ART.originY,
      MAILBOX_V1_MAIN_ART.width,
      MAILBOX_V1_MAIN_ART.height,
    )
    debug.fillStyle(0xffef66, 1).fillCircle(MAILBOX_V1_MAIN_ART.anchorX, MAILBOX_V1_MAIN_ART.anchorY, 6)
    this.add.text(MAILBOX_V1_MAIN_ART.anchorX, MAILBOX_V1_MAIN_ART.anchorY - MAILBOX_V1_MAIN_ART.height - 16, 'MAILBOX SPRITE BOUNDS', {
      color: '#fff3b0', backgroundColor: '#241b12dd', fontSize: '11px', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    MAILBOX_APPROACH_POINTS.forEach((point) => {
      debug.fillStyle(0x66d9ff, 0.95).fillCircle(point.x, point.y, 6)
      this.add.text(point.x, point.y - 20, `MAILBOX APPROACH ${point.name}`, {
        color: '#bdefff', backgroundColor: '#10272add', fontSize: '10px', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    })
    this.add.text(layout.approachX, layout.approachY + 26, 'MAIL RETURN', {
      color: '#bdefff', backgroundColor: '#10272add', fontSize: '10px', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
  }

  private drawLocationColliderDebug(debug: Phaser.GameObjects.Graphics, layout: FarmLocationLayout) {
    const colliders = this.getLocationDebugColliders(layout)
    debug.lineStyle(3, 0xff5c8a, 0.95)
    colliders.forEach((collider, index) => {
      if (layout.visualKind === 'lab') debug.lineStyle(3, [0xff5c8a, 0x66d9ff, 0xffd166, 0xadf080][index], 0.95)
      debug.strokeRect(collider.x - collider.width / 2, collider.y - collider.height / 2, collider.width, collider.height)
      this.add.text(collider.x, collider.y - collider.height / 2 - 18, collider.label, {
        color: '#ff9fba', backgroundColor: '#2b111bdd', fontSize: '11px', padding: { x: 5, y: 3 },
      }).setOrigin(0.5).setDepth(WORLD_DEPTH.debug)
    })
  }

  private getLocationDebugColliders(layout: FarmLocationLayout) {
    if (layout.visualKind === 'lab') return LAB_PROVISIONAL_COLLIDERS.map(({ name, x, y, width, height }) => ({
      x, y, width, height,
      label: `LAB ${name.toUpperCase()} X ${x - width / 2}–${x + width / 2} Y ${y - height / 2}–${y + height / 2}`,
    }))
    if (layout.visualKind === 'home') return HOME_COLLIDERS.map(({ name, x, y, width, height }) => ({
      x, y, width, height,
      label: `HOME ${name.toUpperCase()} X ${x - width / 2}–${x + width / 2} Y ${y - height / 2}–${y + height / 2}`,
    }))
    if (layout.visualKind === 'greenhouse') return [{
      ...NURSERY_ACTIVE_COLLIDER,
      label: `NURSERY COLLIDER X ${NURSERY_COLLIDER_BOUNDS.left}–${NURSERY_COLLIDER_BOUNDS.right} Y ${NURSERY_COLLIDER_BOUNDS.top}–${NURSERY_COLLIDER_BOUNDS.bottom}`,
    }]
    if (layout.visualKind === 'garden') return [{
      ...GARDEN_V1_EXTERIOR_COLLIDER,
      label: `GARDEN EXTERIOR X ${GARDEN_V1_EXTERIOR_COLLIDER.x - GARDEN_V1_EXTERIOR_COLLIDER.width / 2}–${GARDEN_V1_EXTERIOR_COLLIDER.x + GARDEN_V1_EXTERIOR_COLLIDER.width / 2} Y ${GARDEN_V1_EXTERIOR_COLLIDER.y - GARDEN_V1_EXTERIOR_COLLIDER.height / 2}–${GARDEN_V1_EXTERIOR_COLLIDER.y + GARDEN_V1_EXTERIOR_COLLIDER.height / 2}`,
    }]
    if (layout.visualKind === 'mailbox') return MAILBOX_V1_COLLIDERS.map(({ name, x, y, width, height }) => ({
      x, y, width, height,
      label: `MAILBOX ${name} COLLIDER X ${x - width / 2}-${x + width / 2} Y ${y - height / 2}-${y + height / 2}`,
    }))
    if (layout.visualKind === 'town-exit') return [
      { x: layout.x - 135, y: layout.y, width: 24, height: 118, label: 'ROAD POST COLLISION' },
      { x: layout.x + 135, y: layout.y, width: 24, height: 118, label: 'ROAD POST COLLISION' },
    ]
    return [{ x: layout.x, y: layout.y, width: layout.width, height: layout.height, label: `${layout.id.toUpperCase()} COLLISION` }]
  }

  private activateNearestInteraction() {
    const target = this.getNearestInteraction()
    if (target) this.enterLocation(target)
  }

  private enterLocation(target: InteractionTarget) {
    this.navigation.cancel()
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
