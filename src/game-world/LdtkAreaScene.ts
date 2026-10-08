import Phaser from 'phaser'
import { bindLocalMinimap } from './bindLocalMinimap'
import { bindTutorialWorldHighlight } from './tutorialWorldHighlight'
import { NavigationMap } from './navigation/NavigationMap'
import { NavigationController } from './navigation/NavigationController'
import { bindWorldKeyboardFocus, canUseWorldKeyboard } from './worldKeyboardFocus'
import { AreaExitController, drawFoundationExitDebug, type FoundationSceneOptions } from './AreaExitController'
import { createNpcCharacter, createPlayerCharacter, preloadCharacterArt, updateCharacterMotion } from './PlayerCharacter'
import { configureGameplayCamera } from './gameplayCamera'
import { terrainBaseColor, terrainTileTexture } from './worldTilePresentation'
import { drawBasinEnvironment } from './basinEnvironmentPresentation'
import { DEFAULT_APPEARANCE, NPC_PRESET_BY_ENTITY_ID } from '../../shared/characters/appearance'
import { RemotePlayers } from './RemotePlayers'
import { WORLD_DEPTH } from './worldDepth'
import type { Facing } from '../../shared/realtime/protocolV1.ts'
import { EXPLORATION_INTERACTION_RADIUS } from '../../shared/api/explorationV1.ts'
import { plantVisualAssets } from '../data/plantVisualAssets'
import { createPlantVisualDescriptor } from '../features/plants/plantVisualModel'
import { createPlantWorldVisual } from './PlantWorldVisual'
import { LandmarkEntryController, wildNodeAvailable } from '../features/exploration/explorationPresentation'
import type { WorldInteractable } from '../../shared/world/types.ts'

/** Rough terrain presentation; uses the existing obstacle-aware route planner unchanged. */
export class LdtkAreaScene extends Phaser.Scene {
  private readonly options: FoundationSceneOptions
  private player!: Phaser.GameObjects.Container
  private navigation!: NavigationController
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private exits!: AreaExitController
  private touch: { id: number; x: number; y: number; worldX: number; worldY: number } | null = null
  private interaction: string | null = null
  private potPlant?: Phaser.GameObjects.Image
  private readonly wildPlants = new Map<string, Phaser.GameObjects.Container>()
  private readonly landmarkEntries = new LandmarkEntryController()
  private remotePlayers?: RemotePlayers
  private interactionPrompt?: Phaser.GameObjects.Text
  constructor(options: FoundationSceneOptions) { super('ldtk-area'); this.options = options }
  preload() {
    preloadCharacterArt(this)
    const tilesets = new Map((this.options.area.visualLayers ?? []).map(layer => [layer.tileset.uid, layer.tileset]))
    for (const tileset of tilesets.values()) if (!this.textures.exists(`terrain:${tileset.uid}`)) this.load.image(`terrain:${tileset.uid}`, tileset.path)
    if (this.options.area.interactables?.some(e => e.kind === 'harvestable')) this.load.image('tutorial-san-pedro', '/assets/plants/species/echinopsis-pachanoi/plant-echinopsis-pachanoi-mature-base-v01.webp')
    if (this.options.area.interactables?.some(entity => entity.resourceType && entity.speciesId === 'lophophora-williamsii') && !this.textures.exists('wild-peyote-v01')) this.load.image('wild-peyote-v01', '/assets/world/props/wild-peyote-v01.webp')
    for (const entity of this.options.area.interactables ?? []) {
      const asset = entity.resourceType && entity.speciesId ? plantVisualAssets[entity.speciesId]?.stages.mature : null
      if (asset && !this.textures.exists(asset.key)) this.load.image(asset.key, asset.path)
    }
    if (this.options.area.interactables?.some(e => e.kind === 'tutorial-pot')) for (const stage of ['seedling','developing','mature']) this.load.image(`pot-${stage}`, `/assets/plants/species/echinopsis-pachanoi/plant-echinopsis-pachanoi-${stage}-base-v01.webp`)
  }
  create() {
    const { area, position, onExit } = this.options
    this.physics.world.setBounds(0, 0, area.width, area.height)
    this.cameras.main.setBounds(0, 0, area.width, area.height)
    if (!drawBasinEnvironment(this, area)) {
      this.add.rectangle(area.width / 2, area.height / 2, area.width, area.height, terrainBaseColor(this, area.visualLayers ?? []))
      for (const layer of [...(area.visualLayers ?? [])].sort((a,b) => (['Ground','GroundVariation','BoundaryEdges','Decorations'].indexOf(a.name)) - (['Ground','GroundVariation','BoundaryEdges','Decorations'].indexOf(b.name)))) {
        for (const tile of layer.tiles) {
          const {key,frame} = terrainTileTexture(this, layer, tile)
          this.add.image(tile.x + layer.offsetX + (tile.width ?? layer.cellWidth)/2, tile.y + layer.offsetY + (tile.height ?? layer.cellHeight)/2, key, frame).setDisplaySize((tile.width ?? layer.cellWidth) + .5, (tile.height ?? layer.cellHeight) + .5).setFlipX(!!(tile.flip & 1)).setFlipY(!!(tile.flip & 2)).setName(layer.name === 'BoundaryEdges' ? 'terrain-boundary' : 'terrain-tile')
        }
      }
    }
    const walls = this.physics.add.staticGroup()
    for (const o of area.collision) {
      const rect = this.add.rectangle(o.x, o.y, o.width, o.height, 0x29231e, area.visualLayers?.length ? 0 : 1)
      if (this.options.debug) this.add.rectangle(o.x, o.y, o.width, o.height, 0xff4050, .25).setStrokeStyle(2,0xff4050).setDepth(200).setName('collision-debug-boundary')
      this.physics.add.existing(rect, true); walls.add(rect)
    }
    this.player = createPlayerCharacter(this, position.x, position.y, this.options.appearance)
    this.physics.add.existing(this.player)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    // Normalized geometry uses the established Farm/Town gameplay body and speed.
    body.setCircle(27); body.setCollideWorldBounds(true)
    if (this.options.debug) this.player.add(this.add.circle(0, 0, 27, 0xf5d18a).setName('player-debug-body'))
    this.physics.add.collider(this.player, walls)
    this.navigation = new NavigationController(new NavigationMap(area.width, area.height, area.collision))
    for (const entity of area.interactables ?? []) {
      if (entity.kind === 'npc') {
        const preset = NPC_PRESET_BY_ENTITY_ID[entity.entityId]
        if (preset) createNpcCharacter(this, entity.x, entity.y, preset, () => this.player)
        else createPlayerCharacter(this, entity.x, entity.y)
      }
      else if (entity.kind === 'harvestable' && entity.resourceType) {
        if (entity.speciesId === 'lophophora-williamsii' && this.textures.exists('wild-peyote-v01')) {
          // This world-only button cactus preserves the authored foot and real
          // bitmap proportions; it does not replace owned-specimen visuals.
          const source = this.textures.get('wild-peyote-v01').getSourceImage()
          const image = this.add.image(0, 0, 'wild-peyote-v01').setOrigin(.5, 1).setDisplaySize(90, 90 * source.height / source.width)
          this.wildPlants.set(entity.entityId, this.add.container(entity.x, entity.y, [image]).setDepth(WORLD_DEPTH.foreground).setName(`wild-plant:${entity.entityId}`))
          continue
        }
        // World plants reuse species art and its established button/column fallback.
        // These descriptors are visual props; they establish no genetic identity.
        const visual = createPlantVisualDescriptor({ id: entity.entityId, cloneLineId: entity.entityId, speciesId: entity.speciesId!, geneticFeatures: [], specialVariants: [] })
        this.wildPlants.set(entity.entityId, createPlantWorldVisual(this, { x: entity.x, y: entity.y, visual }).setScale(entity.speciesId === 'lophophora-williamsii' ? 1.65 : 1.8).setName(`wild-plant:${entity.entityId}`))
      }
      else if (entity.kind === 'harvestable') this.add.image(entity.x, entity.y, 'tutorial-san-pedro').setOrigin(.5,1).setScale(150 / this.textures.get('tutorial-san-pedro').getSourceImage().height).setDepth(110)
      else if (entity.kind === 'tutorial-pot') {
        this.add.container(entity.x,entity.y,[this.add.ellipse(0,12,76,25,0x543728),this.add.rectangle(0,-2,62,42,0xad6241).setStrokeStyle(4,0x573626),this.add.ellipse(0,-23,74,24,0x543728).setStrokeStyle(4,0xd28e5f)]).setDepth(110)
        this.potPlant = this.add.image(entity.x,entity.y-16,'pot-seedling').setOrigin(.5,1).setDepth(111).setVisible(false)
      }
      // Tutorial names retain their accepted presentation. Exploration reveals a
      // compact contextual prompt only when approached, never permanent labels.
      if (entity.tutorial) this.add.text(entity.x, entity.y + 32, entity.displayName, {fontSize:'15px',fontFamily:'system-ui',color:'#fff3dc',backgroundColor:'#39281edd',padding:{x:7,y:4}}).setOrigin(.5,0).setDepth(140)
    }
    this.interactionPrompt = this.add.text(0, 0, '', { fontSize: '13px', fontFamily: 'system-ui', color: '#fff3dc', backgroundColor: '#39281eee', padding: { x: 9, y: 5 } }).setOrigin(.5, 0).setDepth(WORLD_DEPTH.prompts).setVisible(false).setName('exploration-interaction-prompt')
    this.setupPresence()
    if (this.options.guidance) bindTutorialWorldHighlight(this, this.options.guidance, key => {
      if (key.startsWith('entity:')) {
        const entity = area.interactables?.find(e => e.entityId === key.slice(7))
        return entity ? { x: entity.x - 60, y: entity.y - 155, width: 120, height: 170 } : undefined
      }
      const exit = area.exits.find(e => key === `exit:${e.exitId}`)
      return exit ? { x: exit.x - exit.width/2, y: exit.y - exit.height/2, width: exit.width, height: exit.height } : undefined
    })
    bindLocalMinimap(this, this.options.minimap, area, this.player, () => this.navigation, this.options.pending, () => { this.interaction = null })
    this.exits = new AreaExitController(area, onExit)
    drawFoundationExitDebug(this, this.options)
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,E') as Record<string, Phaser.Input.Keyboard.Key>
    const release = bindWorldKeyboardFocus(this.game.canvas, this.input.keyboard!)
    this.events.once('shutdown', release); this.events.once('destroy', release)
    this.game.canvas.tabIndex = 0
    const accept = (x: number, y: number) => {
      if (this.options.pending()) return
      const entity = area.interactables?.find(e => Math.hypot(e.x - x,e.y - y) < 95)
      if (entity && !entity.tutorial) { this.approachEntity(entity); return }
      this.interaction = entity?.entityId ?? null
      this.navigation.move(this.player, entity ? { x: entity.x, y: entity.y + 65 } : { x, y })
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
    this.game.canvas.setAttribute('aria-label', `Interactive ${area.displayName}. Use arrow keys or WASD to move. Press E near a plant or landmark to interact, or tap it to approach.`)
  }
  private approachEntity(entity: WorldInteractable) {
    this.interaction = null
    this.navigation.approach(this.player, { id: entity.entityId, position: () => entity, radius: EXPLORATION_INTERACTION_RADIUS, activate: () => this.options.onInteract?.(entity.entityId, { x: this.player.x, y: this.player.y }) }, this.time.now)
  }
  private setupPresence() {
    const connection = this.options.connection
    if (!connection) return
    const remotes = new RemotePlayers(presence => createPlayerCharacter(this, presence.position.x, presence.position.y, presence.appearance === 'placeholder' ? DEFAULT_APPEARANCE : presence.appearance, { externalMotion: true })
      .add(this.add.text(0, -96, presence.label, { color: '#fff3dc', fontFamily: 'system-ui', fontSize: '14px' }).setOrigin(.5)).setDepth(WORLD_DEPTH.remotePlayers),
      (avatar, presence, position, now) => updateCharacterMotion(avatar as Phaser.GameObjects.Container, position, now, presence.facing))
    this.remotePlayers = remotes
    const refresh = () => remotes.sync(connection.getSnapshot().remotes, performance.now())
    const unsubscribe = connection.subscribe(refresh)
    refresh()
    let previous = { x: this.player.x, y: this.player.y }, facing: Facing = 'south'
    const sample = () => {
      const position = { x: this.player.x, y: this.player.y }, dx = position.x - previous.x, dy = position.y - previous.y
      const moving = Math.abs(dx) + Math.abs(dy) > .01
      if (moving) facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'east' : 'west' : dy > 0 ? 'south' : 'north'
      connection.sampleMovement(position, facing, moving); previous = position
    }
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, sample)
    const cleanup = () => { unsubscribe(); remotes.clear(); this.events.off(Phaser.Scenes.Events.POST_UPDATE, sample); this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup); this.events.off(Phaser.Scenes.Events.DESTROY, cleanup) }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup); this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  }
  update(time: number, delta = 1000 / 60) {
    if (!this.player) return
    this.remotePlayers?.update(performance.now())
    const exploration = this.options.exploration?.() ?? null, now = this.options.explorationNow?.() ?? Date.now()
    for (const [entityId, plant] of this.wildPlants) plant.setAlpha(wildNodeAvailable(exploration, entityId, now) ? 1 : .55)
    const pot = this.options.tutorialPot?.()
    if (this.potPlant) {
      this.potPlant.setVisible(!!pot && !pot.collectedAt)
      if (pot && !pot.collectedAt) {
        const progress = ((this.options.tutorialNow?.() ?? Date.now())-Date.parse(pot.plantedAt))/(Date.parse(pot.readyAt)-Date.parse(pot.plantedAt)), key = progress < .33 ? 'pot-seedling' : progress < .85 ? 'pot-developing' : 'pot-mature'
        if (this.potPlant.texture.key !== key) this.potPlant.setTexture(key)
        this.potPlant.setScale(110 / this.potPlant.texture.getSourceImage().height)
      }
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body
    if (this.options.pending() || !canUseWorldKeyboard(this.game.canvas)) { body.setVelocity(0); return }
    this.landmarkEntries.update(this.options.area, this.player, exploration, id => this.options.onDiscover?.(id, { x: this.player.x, y: this.player.y }) ?? false)
    const nearest = (this.options.area.interactables ?? []).filter(entity => !entity.tutorial && Math.hypot(this.player.x - entity.x, this.player.y - entity.y) <= 150 && this.navigation.map.visible(this.player, entity)).sort((a, b) => Math.hypot(this.player.x - a.x, this.player.y - a.y) - Math.hypot(this.player.x - b.x, this.player.y - b.y))[0]
    if (this.interactionPrompt) {
      this.interactionPrompt.setVisible(!!nearest)
      if (nearest) this.interactionPrompt.setPosition(nearest.x, nearest.y + 24).setText(`${nearest.displayName} · ${nearest.kind === 'npc' ? 'E / tap to talk' : nearest.kind === 'inspectable' ? 'E / tap to inspect' : wildNodeAvailable(exploration, nearest.entityId, now) ? 'E / tap to harvest' : 'Pods regrowing'}`)
    }
    if (nearest && Phaser.Input.Keyboard.JustDown(this.keys.E)) this.approachEntity(nearest)
    const x = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown)
    const y = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown)
    if (x || y) { this.interaction = null; this.navigation.cancel(); const v = new Phaser.Math.Vector2(x, y).normalize().scale(245); body.setVelocity(v.x, v.y) }
    else { const v = this.navigation.update(this.player, delta, 245, time); body.setVelocity(v.x, v.y) }
    this.exits.update(this.player)
    const target = this.options.area.interactables?.find(e => e.entityId === this.interaction)
    if (target && Math.hypot(this.player.x-target.x,this.player.y-target.y) <= 115) { this.interaction = null; this.navigation.cancel(); body.setVelocity(0); this.options.onInteract?.(target.entityId) }
  }
}
