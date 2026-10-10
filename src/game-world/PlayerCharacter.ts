import type Phaser from 'phaser'
import { WORLD_DEPTH } from './worldDepth'
import { DEFAULT_APPEARANCE, SHIRT_COLORS, SKIN_COLORS, NPC_APPEARANCES, characterAppearanceKey, resolveCharacterAppearance, type CharacterAppearance } from '../../shared/characters/appearance.ts'
import { CHARACTER_MODULES, paintCharacterAtlas, type CharacterArtSources, type CharacterModule } from '../characters/characterArt'
import { CharacterMotion, characterAtlasFrame, CHARACTER_DIRECTIONS, CHARACTER_WALK_FRAMES, type CharacterPoint } from '../characters/characterMotion'
import type { Facing } from '../../shared/realtime/protocolV1.ts'

interface CharacterOptions { externalMotion?: boolean; npcId?: keyof typeof NPC_APPEARANCES; faceTarget?(): CharacterPoint | undefined }
const motionBindings = new WeakMap<Phaser.GameObjects.Container, { motion: CharacterMotion; sprite: Phaser.GameObjects.Image }>()

export function preloadCharacterArt(scene: Phaser.Scene) {
  if (import.meta.env.MODE !== 'staging' && import.meta.env.MODE !== 'production') return
  for (const [module, path] of Object.entries(CHARACTER_MODULES)) if (!scene.textures.exists(`character-module:${module}`)) scene.load.image(`character-module:${module}`, path)
}

function createCharacterArt(scene: Phaser.Scene, appearance: CharacterAppearance, npcId?: keyof typeof NPC_APPEARANCES) {
  const textureKey = `character-art-v2:${npcId ?? 'player'}:${characterAppearanceKey(appearance)}`
  if (!scene.textures.exists(textureKey)) {
    const sources = Object.fromEntries(Object.keys(CHARACTER_MODULES).map(module => [module, scene.textures.get(`character-module:${module}`).getSourceImage()])) as Record<CharacterModule, CanvasImageSource>
    const source = document.createElement('canvas')
    paintCharacterAtlas(source, sources as CharacterArtSources, appearance, { npcId })
    // Source remains 128x224 per pose for previews; world sprites retain 64x112
    // and cache 20 poses at 560KiB per look.
    const canvas = document.createElement('canvas')
    canvas.width = 64 * (CHARACTER_WALK_FRAMES + 1); canvas.height = 112 * CHARACTER_DIRECTIONS.length
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
    const texture = scene.textures.addCanvas(textureKey, canvas)!
    for (let row = 0; row < CHARACTER_DIRECTIONS.length; row++) for (let frame = 0; frame <= CHARACTER_WALK_FRAMES; frame++) {
      texture.add(String(row * (CHARACTER_WALK_FRAMES + 1) + frame), 0, frame * 64, row * 112, 64, 112)
    }
  }
  return scene.add.image(0, 13, textureKey, '0').setOrigin(.5, 1).setDisplaySize(64, 112).setName('character-art-v1')
}

/** External Town interpolation uses the exact same visual state machine as local physics. */
export function updateCharacterMotion(container: Phaser.GameObjects.Container, position: CharacterPoint, now: number, preferredFacing?: Facing) {
  const binding = motionBindings.get(container)
  if (!binding) return
  const state = binding.motion.sample(position, now, preferredFacing)
  binding.sprite.setFrame(String(characterAtlasFrame(state.facing, state.frame)))
  container.setData('characterMotion', state)
}

function bindCharacterMotion(scene: Phaser.Scene, container: Phaser.GameObjects.Container, sprite: Phaser.GameObjects.Image, options: CharacterOptions) {
  const motion = new CharacterMotion()
  motionBindings.set(container, { motion, sprite })
  updateCharacterMotion(container, container, scene.time.now)
  if (options.externalMotion) return
  const present = (now: number) => {
    updateCharacterMotion(container, container, now)
    const target = options.faceTarget?.()
    if (target && !motion.current.moving && Math.hypot(target.x - container.x, target.y - container.y) <= 190) {
      const state = motion.face(target, container)
      sprite.setFrame(String(characterAtlasFrame(state.facing, state.frame)))
      container.setData('characterMotion', state)
    }
  }
  // Post-update observes completed Arcade displacement, including collisions and
  // all existing navigation inputs, without writing movement or inspecting goals.
  scene.events.on('postupdate', present)
  const cleanup = () => { scene.events.off('postupdate', present); scene.events.off('shutdown', cleanup); scene.events.off('destroy', cleanup); container.off('destroy', cleanup) }
  scene.events.once('shutdown', cleanup); scene.events.once('destroy', cleanup); container.once('destroy', cleanup)
}

/** Existing Farm/Town character registration, shared by all local world scenes. */
export function createPlayerCharacter(scene: Phaser.Scene, x: number, y: number, appearance: CharacterAppearance = DEFAULT_APPEARANCE, options: CharacterOptions = {}) {
  const modulesReady = Object.keys(CHARACTER_MODULES).every(module => scene.textures.exists(`character-module:${module}`))
  const sprite = (import.meta.env.MODE === 'staging' || import.meta.env.MODE === 'production') && modulesReady ? createCharacterArt(scene, appearance, options.npcId) : null
  const pieces = sprite ? [sprite] : [
    scene.add.rectangle(0, -18, 34, 62, SHIRT_COLORS[appearance.shirt]).setStrokeStyle(4, 0x2b1a13),
    scene.add.circle(0, -61, 20, SKIN_COLORS[appearance.skin]).setStrokeStyle(4, 0x2b1a13),
  ]
  const container = scene.add.container(x, y, pieces).setSize(54, 54).setDepth(WORLD_DEPTH.localPlayer).setData('characterAppearance', resolveCharacterAppearance(appearance))
  if (sprite) bindCharacterMotion(scene, container, sprite, options)
  return container
}
/** A reusable preset, never a second body renderer or source of tutorial truth. */
export function createNpcCharacter(scene: Phaser.Scene, x: number, y: number, npcId: keyof typeof NPC_APPEARANCES, faceTarget?: () => CharacterPoint | undefined) {
  const preset = NPC_APPEARANCES[npcId]
  return createPlayerCharacter(scene, x, y, preset.appearance, { npcId, faceTarget }).setDepth(WORLD_DEPTH.remotePlayers).setData('characterPreset', preset.npcId)
}
