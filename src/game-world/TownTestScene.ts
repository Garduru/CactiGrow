import { bindMovementAuthority } from './bindMovementAuthority.ts'
import { PLAYER_MOVEMENT_SPEED } from '../../shared/world/movement.ts'
import { createNpcCharacter, createPlayerCharacter, preloadCharacterArt, updateCharacterMotion } from './PlayerCharacter'
import { configureGameplayCamera } from './gameplayCamera'
import { NavigationMap } from './navigation/NavigationMap'
import { bindFoundationExits, type FoundationSceneOptions } from './AreaExitController'
import { registerWorldDiagnostics } from '../features/devtools/worldDiagnostics'
import { getWorldEditor } from './editor/worldEditorState'
import { NavigationController } from './navigation/NavigationController'
import { bindWorldKeyboardFocus, canUseWorldKeyboard } from './worldKeyboardFocus'
import Phaser from 'phaser'
import { bindLocalMinimap } from './bindLocalMinimap'
import { drawSettlementArt, preloadSettlementArt } from './settlementPresentation'
import type { WorldBridge } from './WorldBridge'
import { TOWN_WORLD_HEIGHT, TOWN_WORLD_WIDTH, townWorldLayout, townWorldSpawns, type TownLocationLayout } from './townWorldLayout'
import type { TownWorldLocationProjection, TownWorldSpawnId } from './worldTypes'
import { WORLD_DEPTH } from './worldDepth'
import { MARKETPLACE_V1_MAIN_ART, SHOP_V1_MAIN_ART } from './townArtAssets'
import type { EditorObject, WorldEditorController } from './editor/worldEditorState'
import type { AreaConnection } from '../services/realtime/AreaConnection'
import type { Facing } from '../../shared/realtime/protocolV1'
import { RemotePlayers } from './RemotePlayers'
import { DEFAULT_APPEARANCE, NPC_PRESET_BY_ENTITY_ID } from '../../shared/characters/appearance'
import { TOWN_CONTENT, TOWN_INTERACTION_RADIUS, TOWN_NPC_IDS } from '../../shared/api/townContentV1.ts'
import { TOWN_BOUNDARY_COLLIDERS, TOWN_ROAD_POST_COLLIDERS } from '../../shared/world/townGeometry.ts'
import type { WorldInteractable } from '../../shared/world/types.ts'

const PLAYER_SPEED = PLAYER_MOVEMENT_SPEED
const CAMERA_ZOOM_FLOOR = 0.1
const MAX_CAMERA_ZOOM = 1.5
const WORLD_OVERVIEW_MARGIN_SCALE = 0.94

interface TownInteractionTarget {
  location: TownWorldLocationProjection
  layout: TownLocationLayout
  prompt: Phaser.GameObjects.Text
}
interface TownContentTarget { entity: WorldInteractable; prompt: Phaser.GameObjects.Text }

interface PendingWorldTap {
  pointerId: number
  worldX: number
  worldY: number
  screenX: number
  screenY: number
  profilePublicId?: string
}

export class TownTestScene extends Phaser.Scene {
  private readonly bridge: WorldBridge
  private readonly debugWorld: boolean
  private devDebugObjects: Phaser.GameObjects.GameObject[] = []
  private readonly playerSpawn: Readonly<{ x: number; y: number }>
  private editor?: WorldEditorController
  private readonly editorVisuals = new Map<string, { main: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; extras: { object: Phaser.GameObjects.Rectangle; x: number; y: number }[]; x: number; y: number }>()
  private readonly ownedColliders = new Map<string, Phaser.GameObjects.Rectangle[]>()
  private readonly colliderHandles = new Map<Phaser.GameObjects.Rectangle, Phaser.Physics.Arcade.Collider>()
  private player!: Phaser.GameObjects.Container
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: Record<'up' | 'down' | 'left' | 'right' | 'interact', Phaser.Input.Keyboard.Key>
  private navigation = new NavigationController(new NavigationMap(TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT, []))
  private pathDebug: Phaser.GameObjects.Graphics | null = null
  private readonly interactionTargets: TownInteractionTarget[] = []
  private readonly contentTargets: TownContentTarget[] = []
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
  private readonly connection?: AreaConnection
  private remotePlayers?: RemotePlayers

  private readonly foundation?: FoundationSceneOptions
  private settlementRendered = false
  constructor(bridge: WorldBridge, debugWorld = false, options: { spawnId: TownWorldSpawnId; editor?: WorldEditorController; connection?: AreaConnection; foundation?: FoundationSceneOptions }) {
    super('town-graybox')
    this.bridge = bridge
    this.debugWorld = debugWorld
    this.foundation = options.foundation
    this.playerSpawn = options.foundation?.position ?? options.editor?.getSnapshot().objects.flatMap((object) => object.returnSpawn?.id === options.spawnId ? [object.returnSpawn] : [])[0] ?? townWorldSpawns[options.spawnId]
    this.editor = options.editor
    this.connection = options.connection
  }

  preload() {
    preloadSettlementArt(this, this.foundation?.area)
    preloadCharacterArt(this)
    this.load.image(SHOP_V1_MAIN_ART.key, SHOP_V1_MAIN_ART.path)
    this.load.image(MARKETPLACE_V1_MAIN_ART.key, MARKETPLACE_V1_MAIN_ART.path)
  }

  create() {
    this.physics.world.setBounds(0, 0, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT)
    this.cameras.main.setBounds(0, 0, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT)
    this.drawGroundAndPaths()
    this.drawBoundary()
    this.createLocations(this.bridge.getProjection().locations.filter((location): location is TownWorldLocationProjection => location.id === 'shop' || location.id === 'market' || location.id === 'farm'))
    this.createPlayer()
    this.createTownContent()
    this.setupPresence()
    this.createInput()
    this.configureCamera()
    if (this.editor) this.setupEditor()
    this.rebuildNavigation()
    bindFoundationExits(this, this.player, this.foundation)
    bindMovementAuthority(this, this.player, () => this.navigation, this.foundation)
    if (this.foundation) bindLocalMinimap(this, this.foundation.minimap, this.foundation.area, this.player, () => this.navigation, this.foundation.pending)
    if (this.debugWorld) this.setDevelopmentDebug(true)

    this.unsubscribeProjection = this.bridge.subscribeToProjection((projection) => {
      projection.locations.forEach((location) => {
        const target = this.interactionTargets.find((candidate) => candidate.location.id === location.id)
        if (!target || (location.id !== 'shop' && location.id !== 'market' && location.id !== 'farm')) return
        target.location = location as TownWorldLocationProjection
        target.prompt.setText(this.getPromptText(target.location))
      })
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribeProjection?.())
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.unsubscribeProjection?.())
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'staging') {
      const sessionId = crypto.randomUUID()
      const unregister = registerWorldDiagnostics({
        read: () => { const realtime = this.connection?.getSnapshot(); return { world: 'Town', area: 'town', sessionId, position: { x: this.player.x, y: this.player.y }, destination: this.navigation.destination, waypoints: this.navigation.path.length, multiplayer: realtime ? { status: realtime.status, layer: realtime.layerId ?? null, remotePlayers: realtime.remotes.length } : null } },
        resetPosition: () => {
          const spawn = townWorldSpawns['farm-arrival']
          if (!this.navigation.map.walkable(spawn)) return false
          this.navigation.cancel(); (this.player.body as Phaser.Physics.Arcade.Body).reset(spawn.x, spawn.y)
          return true
        },
        enableEditor: () => { if (!this.editor) { this.editor = getWorldEditor('town'); this.editor.setMode('test'); this.setupEditor() }; return this.editor },
        setDebugVisible: visible => this.setDevelopmentDebug(visible),
      })
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, unregister)
      this.events.once(Phaser.Scenes.Events.DESTROY, unregister)
    }
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
    this.remotePlayers?.update(performance.now())
    const body = this.player.body as Phaser.Physics.Arcade.Body
    if (this.foundation?.pending()) { body.setVelocity(0); this.navigation.cancel(); return }
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

    const nearby = this.getNearestInteraction(), content = this.getNearestTownContent()
    const contentFirst = content && (!nearby || Math.hypot(this.player.x - content.entity.x, this.player.y - content.entity.y) < Math.hypot(this.player.x - this.getInteraction(nearby.layout).x, this.player.y - this.getInteraction(nearby.layout).y))
    this.interactionTargets.forEach((target) => target.prompt.setVisible(!contentFirst && target === nearby))
    this.contentTargets.forEach((target) => target.prompt.setVisible(!!contentFirst && target === content))
  }

  private drawGroundAndPaths() {
    this.settlementRendered = drawSettlementArt(this, this.foundation?.area)
    if (this.settlementRendered) return
    this.add.rectangle(TOWN_WORLD_WIDTH / 2, TOWN_WORLD_HEIGHT / 2, TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT, 0x2b2520).setDepth(WORLD_DEPTH.ground)
    const ground = this.add.graphics().setDepth(WORLD_DEPTH.ground)
    ground.fillStyle(0x65523d).fillRoundedRect(60, 50, TOWN_WORLD_WIDTH - 120, TOWN_WORLD_HEIGHT - 100, 70)

    const paths = this.add.graphics().setDepth(WORLD_DEPTH.paths)
    paths.lineStyle(110, 0xb58b5d, 0.5)
    const branches: readonly (readonly [number, number])[][] = [
      [[1100, 1500], [1100, 1140], [1100, 850]],
      [[1100, 850], [850, 690], [650, 560]],
      [[1100, 850], [1320, 700], [1510, 590]],
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
    const wall = this.add.graphics().setDepth(WORLD_DEPTH.foreground).setVisible(!this.settlementRendered)
    wall.lineStyle(18, 0x584432, 1).strokeRect(60, 50, TOWN_WORLD_WIDTH - 120, TOWN_WORLD_HEIGHT - 100)
    TOWN_BOUNDARY_COLLIDERS.forEach(({ x, y, width, height }) => this.addStaticCollider(x, y, width, height))
  }

  private createLocations(locations: readonly TownWorldLocationProjection[]) {
    townWorldLayout.forEach((layout) => {
      const location = locations.find((candidate) => candidate.id === layout.id)
      if (!location) return
      this.drawLocation(layout)
      if (this.foundation && layout.visualKind === 'farm-exit') return
      const prompt = this.add.text(layout.approachX, layout.approachY + 66, this.getPromptText(location), {
        color: '#fff3dc', backgroundColor: '#211710ee', fontFamily: 'system-ui', fontSize: '18px', padding: { x: 14, y: 9 }, align: 'center',
      }).setOrigin(0.5).setDepth(WORLD_DEPTH.prompts).setVisible(false)
      this.interactionTargets.push({ location, layout, prompt })
    })
  }

  private createTownContent() {
    if (import.meta.env.MODE !== 'staging' || this.foundation?.area.areaId !== TOWN_CONTENT.areaId) return
    for (const entity of this.foundation.area.interactables ?? []) {
      if (entity.entityId !== TOWN_CONTENT.boardEntityId && !TOWN_NPC_IDS.some(id => id === entity.entityId)) continue
      if (entity.kind === 'npc') {
        const preset = NPC_PRESET_BY_ENTITY_ID[entity.entityId]
        if (preset) createNpcCharacter(this, entity.x, entity.y, preset, () => this.player).setName(`town-npc:${entity.entityId}`)
      }
      // The board already belongs to accepted settlement artwork. Only its target is added.
      const prompt = this.add.text(entity.x, entity.y + 28, `${entity.displayName} · E / tap to ${entity.kind === 'npc' ? 'talk' : 'read'}`, {
        color: '#fff3dc', backgroundColor: '#39281eee', fontFamily: 'system-ui', fontSize: '13px', padding: { x: 9, y: 5 },
      }).setOrigin(.5, 0).setDepth(WORLD_DEPTH.prompts).setVisible(false).setName('town-content-prompt')
      this.contentTargets.push({ entity, prompt })
    }
  }

  private drawLocation(layout: TownLocationLayout) {
    if (layout.visualKind === 'market' && this.textures.exists(MARKETPLACE_V1_MAIN_ART.key)) {
      const main = this.add.image(MARKETPLACE_V1_MAIN_ART.anchorX, MARKETPLACE_V1_MAIN_ART.anchorY, MARKETPLACE_V1_MAIN_ART.key)
        .setOrigin(MARKETPLACE_V1_MAIN_ART.originX, MARKETPLACE_V1_MAIN_ART.originY)
        .setDisplaySize(MARKETPLACE_V1_MAIN_ART.width, MARKETPLACE_V1_MAIN_ART.height)
        .setDepth(MARKETPLACE_V1_MAIN_ART.depth)
      this.rememberVisual(layout.id, main, [])
      layout.colliders?.forEach(({ x, y, width, height }) => this.addStaticCollider(x, y, width, height, layout.id))
      return
    }
    if (layout.visualKind === 'shop' && this.textures.exists(SHOP_V1_MAIN_ART.key)) {
      const main = this.add.image(SHOP_V1_MAIN_ART.anchorX, SHOP_V1_MAIN_ART.anchorY, SHOP_V1_MAIN_ART.key)
        .setOrigin(SHOP_V1_MAIN_ART.originX, SHOP_V1_MAIN_ART.originY)
        .setDisplaySize(SHOP_V1_MAIN_ART.width, SHOP_V1_MAIN_ART.height)
        .setDepth(SHOP_V1_MAIN_ART.depth)
      this.rememberVisual(layout.id, main, [])
      if (layout.colliderX !== undefined && layout.colliderY !== undefined && layout.colliderWidth !== undefined && layout.colliderHeight !== undefined) {
        this.addStaticCollider(layout.colliderX, layout.colliderY, layout.colliderWidth, layout.colliderHeight, layout.id)
      }
      return
    }
    if (layout.visualKind === 'farm-exit') {
      const left = this.add.rectangle(layout.x - 135, layout.y, 24, 118, 0x745237).setDepth(WORLD_DEPTH.foreground).setVisible(!this.settlementRendered)
      const right = this.add.rectangle(layout.x + 135, layout.y, 24, 118, 0x745237).setDepth(WORLD_DEPTH.foreground).setVisible(!this.settlementRendered)
      const main = this.add.rectangle(layout.x, layout.y - 45, 290, 56, 0x4e3828).setStrokeStyle(4, 0xa27a51).setDepth(WORLD_DEPTH.foreground).setVisible(!this.settlementRendered)
      this.rememberVisual(layout.id, main, [left, right])
      TOWN_ROAD_POST_COLLIDERS.forEach(({ x, y, width, height }) => this.addStaticCollider(x, y, width, height, layout.id))
      return
    }

    const bodyColor = layout.visualKind === 'shop' ? 0x8c6545 : 0x656273
    const foundationColor = layout.visualKind === 'shop' ? 0x49352a : 0x3e3a49
    const doorColor = layout.visualKind === 'shop' ? 0x65422e : 0x454052
    const main = this.add.rectangle(layout.x, layout.y, layout.width, layout.height, bodyColor).setStrokeStyle(7, 0x302218).setDepth(WORLD_DEPTH.buildings)
    const extras = [
      this.add.rectangle(layout.x, layout.y + layout.height / 2 - 24, layout.width, 48, foundationColor).setStrokeStyle(3, 0x2b2019).setDepth(WORLD_DEPTH.buildings),
      this.add.rectangle(layout.interactionX, layout.y + layout.height / 2 - 68, 88, 136, doorColor).setStrokeStyle(5, 0x2c211b).setDepth(WORLD_DEPTH.foreground),
    ]
    if (layout.visualKind === 'shop') {
      extras.push(this.add.rectangle(layout.x - 105, layout.y - 34, 96, 72, 0xd6b879, 0.35).setStrokeStyle(4, 0x5a402d).setDepth(WORLD_DEPTH.foreground))
      extras.push(this.add.rectangle(layout.x + 105, layout.y - 34, 96, 72, 0xd6b879, 0.35).setStrokeStyle(4, 0x5a402d).setDepth(WORLD_DEPTH.foreground))
    } else {
      for (let windowX = layout.x - 180; windowX <= layout.x + 180; windowX += 120) extras.push(this.add.rectangle(windowX, layout.y - 36, 78, 74, 0x9da5ab, 0.34).setStrokeStyle(4, 0x454052).setDepth(WORLD_DEPTH.foreground))
    }
    this.rememberVisual(layout.id, main, extras)
    if (layout.visualKind === 'market') layout.colliders?.forEach(({ x, y, width, height }) => this.addStaticCollider(x, y, width, height, layout.id))
    if (layout.colliderX !== undefined && layout.colliderY !== undefined && layout.colliderWidth !== undefined && layout.colliderHeight !== undefined) {
      this.addStaticCollider(layout.colliderX, layout.colliderY, layout.colliderWidth, layout.colliderHeight, layout.id)
    }
  }

  private createPlayer() {
    this.player = createPlayerCharacter(this, this.playerSpawn.x, this.playerSpawn.y, this.foundation?.appearance)
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setCircle(27).setCollideWorldBounds(true)
    this.staticColliders.forEach((collider) => this.attachCollider(collider))
  }

  private setupPresence() {
    const connection = this.connection
    if (!connection) return
    const remotes = new RemotePlayers((presence) => (presence.appearance === 'placeholder' && import.meta.env.MODE !== 'staging' ? this.add.container(presence.position.x, presence.position.y, [
      this.add.rectangle(0, -18, 34, 62, 0x58806b).setStrokeStyle(4, 0x2b1a13),
      this.add.circle(0, -61, 20, 0xd39a6b).setStrokeStyle(4, 0x2b1a13),
    ]) : createPlayerCharacter(this, presence.position.x, presence.position.y, presence.appearance === 'placeholder' ? DEFAULT_APPEARANCE : presence.appearance, { externalMotion: true }))
      .add(this.add.text(0, -96, presence.label, { color: '#fff3dc', fontFamily: 'system-ui', fontSize: '14px' }).setOrigin(.5)).setDepth(WORLD_DEPTH.remotePlayers),
      (avatar, presence, position, now) => updateCharacterMotion(avatar as Phaser.GameObjects.Container, position, now, presence.facing))
    this.remotePlayers = remotes
    const refresh = () => remotes.sync(connection.getSnapshot().remotes, performance.now())
    const unsubscribe = connection.subscribe(refresh)
    refresh()
    let previous = { x: this.player.x, y: this.player.y }, facing: Facing = 'south'
    const sample = () => {
      const position = { x: this.player.x, y: this.player.y }
      const dx = position.x - previous.x, dy = position.y - previous.y
      const moving = Math.abs(dx) + Math.abs(dy) > 0.01
      if (moving) facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north')
      if (!this.foundation?.movement) connection.sampleMovement(position, facing, moving)
      previous = position
    }
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, sample)
    const cleanup = () => {
      unsubscribe(); remotes.clear(); this.events.off(Phaser.Scenes.Events.POST_UPDATE, sample)
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup); this.events.off(Phaser.Scenes.Events.DESTROY, cleanup)
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  }

  private createInput() {
    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable')
    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D', interact: 'E' }) as typeof this.wasd
    const releaseKeyboardFocus = bindWorldKeyboardFocus(this.game.canvas, this.input.keyboard)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, releaseKeyboardFocus)
    this.events.once(Phaser.Scenes.Events.DESTROY, releaseKeyboardFocus)
    this.wasd.interact.on('down', () => { if (this.editor?.getSnapshot().mode !== 'edit' && this.canAcceptKeyboardInput()) this.activateNearestInteraction() })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.editor?.getSnapshot().mode === 'edit') {
        if (this.getActiveTouchPointers().length >= 2) this.beginPinch()
        return
      }
      this.game.canvas.focus()
      if (this.getActiveTouchPointers().length >= 2) return this.beginPinch()
      const remote = this.remotePlayers?.getAtPosition({ x: pointer.worldX, y: pointer.worldY })
      if (!pointer.wasTouch) {
        this.pendingWorldTap = null
        if (remote) {
          this.approachPlayer(remote.publicId)
        } else this.handleWorldTap(pointer.worldX, pointer.worldY)
        return
      }
      this.pendingWorldTap = { pointerId: pointer.pointerId, worldX: pointer.worldX, worldY: pointer.worldY,
        screenX: pointer.x, screenY: pointer.y, profilePublicId: remote?.publicId }
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
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: Phaser.GameObjects.GameObject[], _dx: number, deltaY: number) => this.setUserZoom((this.foundation ? this.cameras.main.zoom : this.targetCameraZoom) * Math.exp(-deltaY * 0.0012)))
    this.game.canvas.tabIndex = 0
    this.game.canvas.setAttribute('aria-label', 'Interactive Town. Use arrow keys or WASD to move, E near a person or location, or tap to approach.')
  }

  private configureCamera() {
    if (this.foundation) { configureGameplayCamera(this, this.player, this.foundation.camera ?? {}); return }
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
      if (layout.visualKind === 'shop' && this.textures.exists(SHOP_V1_MAIN_ART.key)) {
        debug.lineStyle(2, 0xb37cff, 0.9).strokeRect(
          SHOP_V1_MAIN_ART.anchorX - SHOP_V1_MAIN_ART.width * SHOP_V1_MAIN_ART.originX,
          SHOP_V1_MAIN_ART.anchorY - SHOP_V1_MAIN_ART.height * SHOP_V1_MAIN_ART.originY,
          SHOP_V1_MAIN_ART.width,
          SHOP_V1_MAIN_ART.height,
        )
        debug.fillStyle(0xffef66, 1).fillCircle(SHOP_V1_MAIN_ART.anchorX, SHOP_V1_MAIN_ART.anchorY, 6)
      }
      if (layout.visualKind === 'market' && this.textures.exists(MARKETPLACE_V1_MAIN_ART.key)) {
        debug.lineStyle(2, 0xb37cff, 0.9).strokeRect(
          MARKETPLACE_V1_MAIN_ART.anchorX - MARKETPLACE_V1_MAIN_ART.width * MARKETPLACE_V1_MAIN_ART.originX,
          MARKETPLACE_V1_MAIN_ART.anchorY - MARKETPLACE_V1_MAIN_ART.height * MARKETPLACE_V1_MAIN_ART.originY,
          MARKETPLACE_V1_MAIN_ART.width,
          MARKETPLACE_V1_MAIN_ART.height,
        )
        debug.fillStyle(0xffef66, 1).fillCircle(MARKETPLACE_V1_MAIN_ART.anchorX, MARKETPLACE_V1_MAIN_ART.anchorY, 6)
      }
      if (layout.colliderX !== undefined && layout.colliderY !== undefined && layout.colliderWidth !== undefined && layout.colliderHeight !== undefined) {
        debug.lineStyle(3, 0xff5c8a, 0.95).strokeRect(layout.colliderX - layout.colliderWidth / 2, layout.colliderY - layout.colliderHeight / 2, layout.colliderWidth, layout.colliderHeight)
      }
      layout.colliders?.forEach(({ x, y, width, height }) => {
        debug.lineStyle(3, 0xff5c8a, 0.95).strokeRect(x - width / 2, y - height / 2, width, height)
      })
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
    this.navigation.cancel()
    this.pinchStartDistance = Phaser.Math.Distance.Between(pointers[0].x, pointers[0].y, pointers[1].x, pointers[1].y)
    this.pinchStartZoom = this.foundation ? this.cameras.main.zoom : this.targetCameraZoom
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
    const remote = this.remotePlayers?.getAtPosition({ x: tap.worldX, y: tap.worldY })
    if (remote && remote.publicId === tap.profilePublicId) {
      this.approachPlayer(remote.publicId)
      return
    }
    this.handleWorldTap(tap.worldX, tap.worldY)
  }

  private approachPlayer(publicId: string) {
    this.navigation.approach(this.player, {
      id: publicId, position: () => this.remotePlayers?.getPosition(publicId), radius: 96, moving: true,
      activate: () => this.bridge.emitIntent({ type: 'OPEN_PLAYER_PROFILE', publicId }),
    }, performance.now())
  }

  private handleWorldTap(worldX: number, worldY: number) {
    if (this.foundation?.pending()) return
    const content = this.contentTargets.find(({ entity }) => Math.hypot(worldX - entity.x, worldY - (entity.y - (entity.kind === 'npc' ? 40 : 0))) <= (entity.kind === 'npc' ? 75 : 95))
    if (content) { this.approachTownContent(content); return }
    const target = this.interactionTargets.find((candidate) => {
      const point = this.getInteraction(candidate.layout)
      const onBody = this.ownedColliders.get(candidate.location.id)?.some((collider) => {
        const body = collider.body as Phaser.Physics.Arcade.StaticBody
        return worldX >= body.x && worldX <= body.right && worldY >= body.y && worldY <= body.bottom
      })
      return onBody || Phaser.Math.Distance.Between(worldX, worldY, point.x, point.y) <= candidate.layout.tapRadius
    })
    if (!target) { this.navigation.move(this.player, { x: worldX, y: worldY }); return }
    const authored = this.editor?.getSnapshot().objects.find((object) => object.id === target.location.id)?.approaches[0]
    const approach = authored ?? { x: target.layout.approachX, y: target.layout.approachY }
    this.navigation.approach(this.player, {
      id: target.location.id, position: () => this.getInteraction(target.layout),
      radius: this.getInteraction(target.layout).radius, approach, activate: () => this.enterLocation(target),
    }, performance.now())
  }

  private setUserZoom(zoom: number) {
    if (this.foundation) {
      const value = Phaser.Math.Clamp(zoom, .72, MAX_CAMERA_ZOOM)
      if (this.foundation.camera) this.foundation.camera.zoom = value
      this.cameras.main.setZoom(value); return
    } this.targetCameraZoom = Phaser.Math.Clamp(zoom, this.fitCameraZoom, MAX_CAMERA_ZOOM) }

  private updateCameraZoom() {
    if (this.foundation) return
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
  }

  private attachCollider(collider: Phaser.GameObjects.Rectangle) {
    this.colliderHandles.set(collider, this.physics.add.collider(this.player, collider))
  }

  private rememberVisual(id: string, main: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, extras: Phaser.GameObjects.Rectangle[]) {
    this.editorVisuals.set(id, { main, extras: extras.map((object) => ({ object, x: object.x, y: object.y })), x: main.x, y: main.y })
  }

  private setupEditor() {
    if (!this.editor) return
    const returnIds: Record<string, TownWorldSpawnId> = { shop: 'shop-exterior', market: 'marketplace-exterior', farm: 'farm-arrival' }
    const objects: EditorObject[] = townWorldLayout.flatMap((layout) => {
      const visual = this.editorVisuals.get(layout.id)?.main
      if (!visual) return []
      const colliders = layout.visualKind === 'farm-exit'
        ? [{ id: 'left-post', label: 'Left post', x: layout.x - 135, y: layout.y, width: 24, height: 118 }, { id: 'right-post', label: 'Right post', x: layout.x + 135, y: layout.y, width: 24, height: 118 }]
        : layout.colliders ? layout.colliders.map((collider) => ({ ...collider }))
          : layout.colliderX !== undefined && layout.colliderY !== undefined && layout.colliderWidth !== undefined && layout.colliderHeight !== undefined
          ? [{ id: 'main', label: 'Main collider', x: layout.colliderX, y: layout.colliderY, width: layout.colliderWidth, height: layout.colliderHeight }]
          : []
      const returnSpawn = townWorldSpawns[returnIds[layout.id]]
      return [{
        id: layout.id, label: this.interactionTargets.find((target) => target.location.id === layout.id)?.location.displayName ?? layout.id,
        sprite: { x: visual.x, y: visual.y, width: visual.displayWidth, height: visual.displayHeight, originX: visual.originX, originY: visual.originY },
        colliders,
        interaction: { x: layout.interactionX, y: layout.interactionY, radius: layout.interactionRadius },
        approaches: [{ id: 'approach', label: 'Approach', x: layout.approachX, y: layout.approachY }],
        returnSpawn: { id: returnIds[layout.id], label: 'Return/arrival spawn', x: returnSpawn.x, y: returnSpawn.y },
        anchors: [],
      }]
    })
    this.editor.initialize(objects)
    let last = new Map<string, EditorObject>()
    const apply = () => {
      for (const object of this.editor!.getSnapshot().objects) if (last.get(object.id) !== object) this.applyEditorObject(object)
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
    if (target && object.approaches[0]) target.prompt.setPosition(object.approaches[0].x, object.approaches[0].y + 66)
  }

  private rebuildNavigation() {
    this.navigation = new NavigationController(new NavigationMap(TOWN_WORLD_WIDTH, TOWN_WORLD_HEIGHT,
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

  private canAcceptKeyboardInput() { return canUseWorldKeyboard(this.game.canvas) }
  private getInteraction(layout: TownLocationLayout) { return this.editor?.getSnapshot().objects.find((object) => object.id === layout.id)?.interaction ?? { x: layout.interactionX, y: layout.interactionY, radius: layout.interactionRadius } }
  private isInInteractionRange(target: TownInteractionTarget) { const point = this.getInteraction(target.layout); return Phaser.Math.Distance.Between(this.player.x, this.player.y, point.x, point.y) <= point.radius }
  private getNearestInteraction() { return this.interactionTargets.filter((target) => this.isInInteractionRange(target)).sort((a, b) => { const first = this.getInteraction(a.layout); const second = this.getInteraction(b.layout); return Phaser.Math.Distance.Between(this.player.x, this.player.y, first.x, first.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, second.x, second.y) })[0] ?? null }
  private getNearestTownContent() { return this.contentTargets.filter(({ entity }) => Math.hypot(this.player.x - entity.x, this.player.y - entity.y) <= TOWN_INTERACTION_RADIUS && this.navigation.map.visible(this.player, entity)).sort((a, b) => Math.hypot(this.player.x - a.entity.x, this.player.y - a.entity.y) - Math.hypot(this.player.x - b.entity.x, this.player.y - b.entity.y))[0] ?? null }
  private activateNearestInteraction() {
    const target = this.getNearestInteraction(), content = this.getNearestTownContent()
    if (content && (!target || Math.hypot(this.player.x - content.entity.x, this.player.y - content.entity.y) < Math.hypot(this.player.x - this.getInteraction(target.layout).x, this.player.y - this.getInteraction(target.layout).y))) this.approachTownContent(content)
    else if (target) this.enterLocation(target)
  }
  private approachTownContent(target: TownContentTarget) {
    if (this.foundation?.pending()) return
    const entity = target.entity
    this.navigation.approach(this.player, { id: entity.entityId, position: () => entity, radius: TOWN_INTERACTION_RADIUS,
      approach: { x: entity.x, y: entity.y + 65 }, activate: () => {
        this.navigation.cancel(); (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0)
        this.foundation?.onInteract?.(entity.entityId, { x: this.player.x, y: this.player.y })
      },
    }, performance.now())
  }
  private enterLocation(target: TownInteractionTarget) { this.navigation.cancel(); this.bridge.emitIntent({ type: 'ENTER_LOCATION', locationId: target.location.id, ...(this.foundation?.movement ? { position: { x: this.player.x, y: this.player.y } } : {}) }) }
  private getPromptText(location: TownWorldLocationProjection) { return `${location.displayName}\n${location.interactionLabel}` }
}
