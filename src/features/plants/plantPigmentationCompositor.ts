import type { PlantVisualDescriptor } from '../../types/plantVisual'

export const VARIEGATION_TREATMENT_VERSION = 'yellow-green-v02'
const TARGET = { r: 201, g: 211, b: 111 }

export function getPlantCompositionKey(visual: PlantVisualDescriptor): string | null {
  const mask = visual.pigmentation?.maskAsset
  return visual.baseAsset && mask ? `${visual.baseAsset.key}--${mask.key}--${VARIEGATION_TREATMENT_VERSION}` : null
}

/** Applies an alpha strength mask while preserving the base pixel's luminance and alpha. */
export function composeVariegationPixels(base: ImageData, mask: ImageData): ImageData {
  if (base.width !== mask.width || base.height !== mask.height) throw new Error('Plant body and pigmentation mask dimensions must match')
  const output = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height)
  for (let index = 0; index < output.data.length; index += 4) {
    const strength = (mask.data[index + 3] / 255) * (base.data[index + 3] / 255)
    if (strength <= 0) continue
    const luminance = (.2126 * base.data[index] + .7152 * base.data[index + 1] + .0722 * base.data[index + 2]) / 255
    // Calibrated against the approved Developing A composite: preserve shading
    // while lifting reduced-chlorophyll tissue enough to read at gameplay scale.
    const scale = .25 + 1.25 * luminance
    const treated = [TARGET.r * scale, TARGET.g * scale, TARGET.b * scale]
    output.data[index] = base.data[index] * (1 - strength) + treated[0] * strength
    output.data[index + 1] = base.data[index + 1] * (1 - strength) + treated[1] * strength
    output.data[index + 2] = base.data[index + 2] * (1 - strength) + treated[2] * strength
  }
  return output
}

export function composePlantCanvas(base: CanvasImageSource, mask: CanvasImageSource, width = 512, height = 768): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2D canvas unavailable')
  context.drawImage(base, 0, 0, width, height)
  const basePixels = context.getImageData(0, 0, width, height)
  context.clearRect(0, 0, width, height)
  context.drawImage(mask, 0, 0, width, height)
  const maskPixels = context.getImageData(0, 0, width, height)
  context.putImageData(composeVariegationPixels(basePixels, maskPixels), 0, 0)
  return canvas
}

const reactCompositionCache = new Map<string, Promise<string>>()

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Unable to load plant composition asset: ${path}`))
    image.src = path
  })
}

export function getReactPlantComposition(visual: PlantVisualDescriptor): Promise<string> | null {
  const key = getPlantCompositionKey(visual)
  const mask = visual.pigmentation?.maskAsset
  if (!key || !visual.baseAsset || !mask) return null
  const cached = reactCompositionCache.get(key)
  if (cached) return cached
  const pending = Promise.all([loadImage(visual.baseAsset.path), loadImage(mask.path)])
    .then(([body, maskImage]) => composePlantCanvas(body, maskImage).toDataURL('image/png'))
  reactCompositionCache.set(key, pending)
  return pending
}
