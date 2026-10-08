import Phaser from 'phaser'
import type { GardenDisplayProjection } from './worldTypes'
import { WORLD_DEPTH } from './worldDepth'
import { composePlantCanvas, getPlantCompositionKey } from '../features/plants/plantPigmentationCompositor'

function resolveTextureKey(scene: Phaser.Scene, visual: GardenDisplayProjection['visual']): string | null {
  if (!visual.baseAsset || !scene.textures.exists(visual.baseAsset.key)) return null
  const compositionKey = getPlantCompositionKey(visual)
  const mask = visual.pigmentation?.maskAsset
  if (!compositionKey || !mask || !scene.textures.exists(mask.key)) return visual.baseAsset.key
  if (!scene.textures.exists(compositionKey)) {
    const body = scene.textures.get(visual.baseAsset.key).getSourceImage() as CanvasImageSource
    const maskImage = scene.textures.get(mask.key).getSourceImage() as CanvasImageSource
    scene.textures.addCanvas(compositionKey, composePlantCanvas(body, maskImage))
  }
  return compositionKey
}

export function createPlantWorldVisual(scene: Phaser.Scene, display: Pick<GardenDisplayProjection, 'x' | 'y' | 'visual'>): Phaser.GameObjects.Container {
  const { x, y, visual } = display
  const textureKey = resolveTextureKey(scene, visual)
  if (textureKey) {
    const image = new Phaser.GameObjects.Image(scene, 0, 0, textureKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(53.333, 80)
    return scene.add.container(x, y, [image]).setDepth(WORLD_DEPTH.foreground)
      .setScale(1 + visual.variation.scaleBucket * .025)
      .setAngle((visual.variation.orientationIndex - 1) * 2)
  }

  // Geometry is the last fallback when no registered species/stage body is available.
  const graphics = scene.add.graphics()
  const isButton = visual.silhouette === 'button'
  const normalColors = [0x658b55, 0x6c9255, 0x5b8254] as const
  const fill = visual.specialTreatmentKey ? 0x91bca1 : visual.pigmentationRecipeKeys.length ? 0xa5ad70 : normalColors[visual.variation.paletteIndex] ?? normalColors[0]
  const outline = visual.specialTreatmentKey ? 0xd7bc69 : 0x314b35
  graphics.lineStyle(3, outline)
  graphics.fillStyle(fill)
  if (isButton) {
    graphics.fillEllipse(0, -17, 48, 30)
    graphics.strokeEllipse(0, -17, 48, 30)
  } else {
    graphics.fillRoundedRect(-10, -65, 20, 65, 10)
    graphics.strokeRoundedRect(-10, -65, 20, 65, 10)
    graphics.fillRoundedRect(-25, -40, 15, 35, 7)
    graphics.strokeRoundedRect(-25, -40, 15, 35, 7)
    graphics.fillRoundedRect(10, -34, 15, 29, 7)
    graphics.strokeRoundedRect(10, -34, 15, 29, 7)
  }
  if (visual.spineRecipeKey) {
    graphics.lineStyle(2, 0xddca98)
    graphics.lineBetween(-12, -40, -19, -44)
    graphics.lineBetween(12, -44, 19, -48)
  }
  return scene.add.container(x, y, [graphics]).setDepth(WORLD_DEPTH.foreground)
    .setScale(1 + visual.variation.scaleBucket * .025)
    .setAngle((visual.variation.orientationIndex - 1) * 2)
}
