import { HAIR_COLORS, PANTS_COLORS, SHIRT_COLORS, SKIN_COLORS, resolveCharacterAppearance, type CharacterAppearance } from '../../shared/characters/appearance.ts'
import { CHARACTER_REGISTRATION } from './characterRegistration.generated.ts'
import { CHARACTER_FIT } from './characterFit.generated.ts'

export const CHARACTER_ART_WIDTH = 128
export const CHARACTER_ART_HEIGHT = 224
export const CHARACTER_ATLAS_WIDTH = CHARACTER_ART_WIDTH * 5
export const CHARACTER_ATLAS_HEIGHT = CHARACTER_ART_HEIGHT * 4
export const CHARACTER_DIRECTIONS = ['south', 'west', 'east', 'north'] as const
export type CharacterFacing = typeof CHARACTER_DIRECTIONS[number]
export interface CharacterArtOptions { facing?: CharacterFacing; frame?: number; npcId?: 'mara' }
export const CHARACTER_MODULES = {
  masculine: '/assets/characters/player/masculine/desert-grower-masculine-poses-v02.webp',
  masculineMask: '/assets/characters/player/masculine/desert-grower-masculine-pigments-v02.png',
  feminine: '/assets/characters/player/feminine/desert-grower-feminine-poses-v02.webp',
  feminineMask: '/assets/characters/player/feminine/desert-grower-feminine-pigments-v02.png',
  mara: '/assets/characters/npc/mara/desert-mara-poses-v03.webp',
  masculineArms: CHARACTER_FIT.bodies.masculine.armMask.url,
  feminineArms: CHARACTER_FIT.bodies.feminine.armMask.url,
  cropped: CHARACTER_FIT.hair.cropped.front.url,
  tied: CHARACTER_FIT.hair.tied.front.url,
  wavy: CHARACTER_FIT.hair.wavy.front.url,
  braid: CHARACTER_FIT.hair.braid.front.url,
  croppedBack: CHARACTER_FIT.hair.cropped.back.url,
  tiedBack: CHARACTER_FIT.hair.tied.back.url,
  wavyBack: CHARACTER_FIT.hair.wavy.back.url,
  braidBack: CHARACTER_FIT.hair.braid.back.url,
  straw: CHARACTER_FIT.hats.straw.url,
  cap: CHARACTER_FIT.hats.cap.url,
  satchel: CHARACTER_FIT.satchel.bag.url,
  satchelFront: CHARACTER_FIT.satchel.front.url,
  satchelBack: CHARACTER_FIT.satchel.back.url,
} as const
export type CharacterModule = keyof typeof CHARACTER_MODULES
export type CharacterArtSources = Readonly<Record<CharacterModule, CanvasImageSource>>
let browserAssets: Promise<CharacterArtSources> | null = null

/** One browser image load per module, shared by every creator preview. */
export function loadCharacterArt(): Promise<CharacterArtSources> {
  if (!browserAssets) browserAssets = Promise.all(Object.entries(CHARACTER_MODULES).map(([name, url]) => new Promise<[CharacterModule, HTMLImageElement]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve([name as CharacterModule, image])
    image.onerror = () => reject(new Error('Character artwork could not load.'))
    image.src = url
  }))).then(entries => Object.fromEntries(entries) as CharacterArtSources).catch(error => { browserAssets = null; throw error })
  return browserAssets
}
function raster(source: CanvasImageSource, width: number, height: number, x = 0, y = 0) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  canvas.getContext('2d')!.drawImage(source, x, y, width, height, 0, 0, width, height)
  return canvas
}
function tintBody(canvas: HTMLCanvasElement, mask: HTMLCanvasElement, colors: readonly number[], references: readonly number[]) {
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const pigments = mask.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, mask.width, mask.height)
  for (let pixel = 0; pixel < pixels.data.length; pixel += 4) {
    if (pixels.data[pixel + 3] < 4 || pigments.data[pixel + 3] === 0) continue
    const material = pigments.data[pixel] ? 0 : pigments.data[pixel + 1] ? 1 : 2
    const light = (.2126 * pixels.data[pixel] + .7152 * pixels.data[pixel + 1] + .0722 * pixels.data[pixel + 2]) / references[material]
    const color = colors[material]
    pixels.data[pixel] = Math.min(255, (color >> 16 & 255) * light)
    pixels.data[pixel + 1] = Math.min(255, (color >> 8 & 255) * light)
    pixels.data[pixel + 2] = Math.min(255, (color & 255) * light)
  }
  context.putImageData(pixels, 0, 0)
}
function tintHair(canvas: HTMLCanvasElement, color: number, reference: number) {
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let pixel = 0; pixel < pixels.data.length; pixel += 4) {
    if (pixels.data[pixel + 3] < 4) continue
    const light = (.2126 * pixels.data[pixel] + .7152 * pixels.data[pixel + 1] + .0722 * pixels.data[pixel + 2]) / reference
    pixels.data[pixel] = Math.min(255, (color >> 16 & 255) * light)
    pixels.data[pixel + 1] = Math.min(255, (color >> 8 & 255) * light)
    pixels.data[pixel + 2] = Math.min(255, (color & 255) * light)
  }
  context.putImageData(pixels, 0, 0)
}
type HairModule = 'cropped' | 'tied' | 'wavy' | 'braid'
type PlayerBody = 'masculine' | 'feminine'
function appearanceBody(appearance: CharacterAppearance): PlayerBody { return appearance.body === 1 ? 'feminine' : 'masculine' }
function appearanceHair(appearance: Required<CharacterAppearance>): HairModule { return (['cropped', 'tied', 'wavy', 'braid'] as const)[appearance.hair] ?? 'cropped' }
export const CHARACTER_LAYER_ORDER = ['rearHair', 'rearAccessory', 'body', 'frontAccessory', 'foregroundArms', 'frontHair', 'headwear'] as const
type Point = readonly [number, number]
/** Geometry depends only on the selected modules and actual authored pose.
 * Palette choices affect RGB only. The same plan serves creator and world.
 */
export function resolveCharacterComposition(appearance: CharacterAppearance, options: CharacterArtOptions = {}) {
  const a = resolveCharacterAppearance(appearance)
  const row = CHARACTER_DIRECTIONS.indexOf(options.facing ?? 'south')
  const frame = Math.max(0, Math.min(4, Math.trunc(options.frame ?? 0)))
  const body = appearanceBody(a), fit = CHARACTER_FIT.bodies[body].frames[row * 5 + frame]
  const hair = appearanceHair(a), hairAnchor = CHARACTER_FIT.hair[hair].anchors[row]
  const scale = fit.headScale
  const hatScale = a.hat === 2 ? scale * .9 : scale
  const hatVerticalScale = hatScale * (row === 0 ? (a.hat === 1 ? .7 : .65) : 1)
  const crown: Point = [fit.crown[0], fit.crown[1]]
  const bagSide = row === 0 || row === 1 ? 1 : 0
  const shoulder = fit.shoulders[bagSide === 1 ? 0 : 1]
  const hip = fit.hips[bagSide]
  const pouchScale = row === 0 || row === 3 ? .66 : .62
  const pouch: Point = [hip[0] + (bagSide === 1 ? 4 : -4), hip[1] - 6]
  const source = CHARACTER_FIT.satchel.frames[row]
  const hook: Point = [pouch[0] + (source.hook[0] - source.bagCenter[0]) * pouchScale,
    pouch[1] + (source.hook[1] - source.bagCenter[1]) * pouchScale]
  // A rotation plus uniform length fit stretches only the strap, never the
  // pouch. The shoulder/root and pouch/hook coincide exactly in every pose.
  const sx = source.hook[0] - source.root[0], sy = source.hook[1] - source.root[1]
  const tx = hook[0] - shoulder[0], ty = hook[1] - shoulder[1]
  const denominator = sx * sx + sy * sy
  const u = (tx * sx + ty * sy) / denominator, v = (ty * sx - tx * sy) / denominator
  const strapMatrix = [u, v, -v, u, shoulder[0] - u * source.root[0] + v * source.root[1],
    shoulder[1] - v * source.root[0] - u * source.root[1]] as const
  return { npcId: options.npcId, body, row, frame, layerOrder: CHARACTER_LAYER_ORDER,
    crown, faceOpening: fit.faceOpening, protectedEyes: fit.protectedEyes, shoulder, hip, pouch, hook, pouchScale, strapMatrix,
    farPouch: row === 2, accessory: a.accessory === 1,
    hair, hairScale: scale, hairAnchor,
    // The hat socket sits around the skull, with a retained fringe/nape below
    // the band. Crown hair under the headwear is clipped, not every hairstyle.
    hairCrownClip: a.hat ? crown[1] + (row === 0 ? 13 : (a.hat === 1 ? 21 : 20)) * scale : null,
    hat: a.hat, hatScale, hatVerticalScale,
    hatAnchor: [crown[0], crown[1] + (row === 0 ? 4 : 8)] as const }
}
type Composition = ReturnType<typeof resolveCharacterComposition>
function directional(context: CanvasRenderingContext2D, source: CanvasImageSource, row: number, anchor: readonly number[], socket: readonly number[], scale: number, verticalScale = scale) {
  context.drawImage(source, 0, row * 128, 96, 128, socket[0] - anchor[0] * scale, socket[1] - anchor[1] * verticalScale, 96 * scale, 128 * verticalScale)
}
function hairLayer(context: CanvasRenderingContext2D, source: CanvasImageSource, plan: Composition) {
  context.save()
  if (plan.hairCrownClip !== null) {
    context.beginPath(); context.rect(0, plan.hairCrownClip, 128, 224 - plan.hairCrownClip); context.clip()
  }
  directional(context, source, plan.row, plan.hairAnchor, plan.crown, plan.hairScale)
  context.restore()
}
function strap(context: CanvasRenderingContext2D, source: CanvasImageSource, plan: Composition) {
  context.save()
  // A strap ends at its pouch hook. Alpha outside that attachment span is
  // source loop overflow, not a hanging strap beside the hand.
  context.beginPath(); context.rect(Math.min(plan.shoulder[0], plan.hook[0]) - 9, plan.shoulder[1] - 5,
    Math.abs(plan.hook[0] - plan.shoulder[0]) + 18, plan.hook[1] - plan.shoulder[1] + 7); context.clip()
  context.transform(...plan.strapMatrix)
  context.drawImage(source, 0, plan.row * 128, 96, 128, 0, 0, 96, 128); context.restore()
}
function pouch(context: CanvasRenderingContext2D, sources: CharacterArtSources, plan: Composition) {
  directional(context, sources.satchel, plan.row, CHARACTER_FIT.satchel.frames[plan.row].bagCenter, plan.pouch, plan.pouchScale)
}
function frameArt(context: CanvasRenderingContext2D, sources: CharacterArtSources, appearance: Required<CharacterAppearance>, row: number, frame: number, body: CanvasImageSource, hair: CanvasImageSource | undefined, backHair: CanvasImageSource | undefined, npcId?: 'mara', croppedBody = false) {
  const column = Math.max(0, Math.min(4, Math.trunc(frame)))
  const plan = resolveCharacterComposition(appearance, { facing: CHARACTER_DIRECTIONS[row], frame: column, npcId })
  if (!npcId) {
    if (backHair) hairLayer(context, backHair, plan)
    if (plan.accessory) { strap(context, sources.satchelBack, plan); if (plan.farPouch) pouch(context, sources, plan) }
  }
  context.drawImage(body, croppedBody ? 0 : column * CHARACTER_ART_WIDTH, croppedBody ? 0 : row * CHARACTER_ART_HEIGHT,
    CHARACTER_ART_WIDTH, CHARACTER_ART_HEIGHT, 0, 0, CHARACTER_ART_WIDTH, CHARACTER_ART_HEIGHT)
  if (npcId === 'mara') return
  if (plan.accessory) {
    const accessory = document.createElement('canvas'); accessory.width = 128; accessory.height = 224
    const layer = accessory.getContext('2d')!
    strap(layer, sources.satchelFront, plan); if (!plan.farPouch) pouch(layer, sources, plan)
    // The near arm matte removes accessory pixels and exposes the original
    // tinted sleeve/hand below, retaining that pose's articulated silhouette.
    layer.globalCompositeOperation = 'destination-out'
    layer.drawImage(sources[appearance.body === 1 ? 'feminineArms' : 'masculineArms'], column * 128, row * 224, 128, 224, 0, 0, 128, 224)
    context.drawImage(accessory, 0, 0)
  }
  if (hair) hairLayer(context, hair, plan)
  if (appearance.hat) directional(context, sources[appearance.hat === 1 ? 'straw' : 'cap'], row, [48, 24], plan.hatAnchor, plan.hatScale, plan.hatVerticalScale)
}
/** Shared single-pose preview. Defaults to south idle; saved choices never contain animation state. */
export function paintCharacterArt(canvas: HTMLCanvasElement, sources: CharacterArtSources, appearance: CharacterAppearance, options: CharacterArtOptions = {}) {
  canvas.width = CHARACTER_ART_WIDTH; canvas.height = CHARACTER_ART_HEIGHT
  const a = resolveCharacterAppearance(appearance), row = CHARACTER_DIRECTIONS.indexOf(options.facing ?? 'south')
  const frame = Math.max(0, Math.min(4, Math.trunc(options.frame ?? 0)))
  const bodyName = options.npcId ?? appearanceBody(a)
  const body = raster(sources[bodyName], CHARACTER_ART_WIDTH, CHARACTER_ART_HEIGHT, frame * CHARACTER_ART_WIDTH, row * CHARACTER_ART_HEIGHT)
  let hair: HTMLCanvasElement | undefined, backHair: HTMLCanvasElement | undefined
  if (!options.npcId) {
    const mask = raster(sources[a.body === 1 ? 'feminineMask' : 'masculineMask'], CHARACTER_ART_WIDTH, CHARACTER_ART_HEIGHT, frame * CHARACTER_ART_WIDTH, row * CHARACTER_ART_HEIGHT)
    tintBody(body, mask, [SKIN_COLORS[a.skin], SHIRT_COLORS[a.shirt], PANTS_COLORS[a.pants]], CHARACTER_REGISTRATION.bodies[appearanceBody(a)].references)
    const hairName = appearanceHair(a), registration = CHARACTER_REGISTRATION.cosmetics[hairName]
    hair = raster(sources[hairName], registration.size[0], registration.size[1])
    tintHair(hair, HAIR_COLORS[a.hairColor], registration.reference)
    backHair = raster(sources[`${hairName}Back`], registration.size[0], registration.size[1])
    tintHair(backHair, HAIR_COLORS[a.hairColor], registration.reference)
  }
  frameArt(canvas.getContext('2d')!, sources, a, row, frame, body, hair, backHair, options.npcId, true)
}
/** Flatten once per look, then the world renderer selects frames without repainting. */
export function paintCharacterAtlas(canvas: HTMLCanvasElement, sources: CharacterArtSources, appearance: CharacterAppearance, options: Pick<CharacterArtOptions, 'npcId'> = {}) {
  canvas.width = CHARACTER_ATLAS_WIDTH; canvas.height = CHARACTER_ATLAS_HEIGHT
  const a = resolveCharacterAppearance(appearance), bodyName = options.npcId ?? appearanceBody(a)
  const body = raster(sources[bodyName], CHARACTER_ATLAS_WIDTH, CHARACTER_ATLAS_HEIGHT)
  let hair: HTMLCanvasElement | undefined, backHair: HTMLCanvasElement | undefined
  if (!options.npcId) {
    const mask = raster(sources[a.body === 1 ? 'feminineMask' : 'masculineMask'], CHARACTER_ATLAS_WIDTH, CHARACTER_ATLAS_HEIGHT)
    tintBody(body, mask, [SKIN_COLORS[a.skin], SHIRT_COLORS[a.shirt], PANTS_COLORS[a.pants]], CHARACTER_REGISTRATION.bodies[appearanceBody(a)].references)
    const hairName = appearanceHair(a), registration = CHARACTER_REGISTRATION.cosmetics[hairName]
    hair = raster(sources[hairName], registration.size[0], registration.size[1])
    tintHair(hair, HAIR_COLORS[a.hairColor], registration.reference)
    backHair = raster(sources[`${hairName}Back`], registration.size[0], registration.size[1])
    tintHair(backHair, HAIR_COLORS[a.hairColor], registration.reference)
  }
  const context = canvas.getContext('2d')!
  for (let row = 0; row < 4; row++) for (let frame = 0; frame < 5; frame++) {
    context.save(); context.translate(frame * CHARACTER_ART_WIDTH, row * CHARACTER_ART_HEIGHT)
    frameArt(context, sources, a, row, frame, body, hair, backHair, options.npcId)
    context.restore()
  }
}
