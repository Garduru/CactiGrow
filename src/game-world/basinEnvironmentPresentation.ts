import type Phaser from 'phaser'
import type { WorldArea, WorldVisualLayer } from '../../shared/world/types'
import { WORLD_DEPTH } from './worldDepth'
import { terrainBaseColor, terrainTileTexture } from './worldTilePresentation'

export const BASIN_EXTENSION_PATH = '/assets/world/tiles/world-first-basin-extension-v01.png'

/** The versioned extension opts an Area into this presentation only. */
export function hasBasinEnvironment(area: WorldArea): boolean {
  return !!area.visualLayers?.some(layer => layer.tileset.path === BASIN_EXTENSION_PATH)
}

const layerDepth: Record<WorldVisualLayer['name'], number> = {
  Ground: WORLD_DEPTH.ground,
  GroundVariation: WORLD_DEPTH.groundDetail,
  Paths: WORLD_DEPTH.paths,
  StructureGrounding: WORLD_DEPTH.shadows,
  BoundaryEdges: WORLD_DEPTH.landscaping,
  Decorations: WORLD_DEPTH.landscaping,
}

/** Keep fades in authored world directions when the sampled image is flipped. */
export function mirrorBasinMask(mask: number | undefined, flip: number, corners: boolean): number {
  let value = mask ?? 0
  const remap = (bits: readonly number[]) => [1, 2, 4, 8].reduce((out, bit, index) => out | (value & bit ? bits[index] : 0), 0)
  if (flip & 1) value = remap(corners ? [2, 1, 8, 4] : [1, 8, 4, 2])
  if (flip & 2) value = remap(corners ? [8, 4, 2, 1] : [4, 2, 1, 8])
  return value
}

/** Cache cropped, feathered and rounded frames once per authored mask. */
function basinTileTexture(scene: Phaser.Scene, layer: WorldVisualLayer, tile: WorldVisualLayer['tiles'][number]): { key: string; frame?: string } {
  const sampled = tile.flip ? {
    ...tile,
    blendEdges: mirrorBasinMask(tile.blendEdges, tile.flip, false),
    blendCorners: mirrorBasinMask(tile.blendCorners, tile.flip, true),
  } : tile
  // Different floor materials cannot share one feathered undercoat. Keep the
  // cropped Ground pixels opaque; road shoulders still fade onto that floor.
  const sampledLayer = layer.name === 'Ground' ? { ...layer, name: 'Decorations' as const } : layer
  const base = terrainTileTexture(scene, sampledLayer, sampled)
  const corners = mirrorBasinMask(tile.roundCorners, tile.flip, true)
  if (!corners) return base
  const key = `${base.key}:${base.frame ?? ''}:basin-round:${corners}`
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.get(base.key), frame = texture.get(base.frame), size = frame.cutWidth
    const canvas = scene.textures.createCanvas(key, size, size)
    if (!canvas) return base
    const context = canvas.context
    context.drawImage(texture.getSourceImage() as CanvasImageSource, frame.cutX, frame.cutY, size, size, 0, 0, size, size)
    context.globalCompositeOperation = 'destination-out'
    const radius = size * .65
    for (const [bit, x, y, left, top] of [[1, radius, radius, 0, 0], [2, size - radius, radius, size - radius, 0], [4, size - radius, size - radius, size - radius, size - radius], [8, radius, size - radius, 0, size - radius]] as const) {
      if (!(corners & bit)) continue
      const fade = context.createRadialGradient(x, y, radius * .8, x, y, radius)
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)')
      context.fillStyle = fade; context.fillRect(left, top, radius, radius)
    }
    context.globalCompositeOperation = 'source-over'; canvas.refresh()
  }
  return { key }
}

/** Draw only imported visual data; navigation and Arcade bodies remain untouched. */
export function drawBasinEnvironment(scene: Phaser.Scene, area: WorldArea): boolean {
  if (!hasBasinEnvironment(area)) return false
  const layers = [...(area.visualLayers ?? [])].sort((a, b) => layerDepth[a.name] - layerDepth[b.name])
  if (!layers.every(layer => scene.textures.exists(`terrain:${layer.tileset.uid}`))) {
    // A failed atlas request must still leave the accepted obstacles readable.
    scene.add.rectangle(area.width / 2, area.height / 2, area.width, area.height, 0x65523d).setDepth(WORLD_DEPTH.ground).setName('basin:fallback-ground')
    for (const obstacle of area.collision) scene.add.rectangle(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 0x29231e).setDepth(WORLD_DEPTH.landscaping).setName('basin:fallback-boundary')
    return true
  }
  scene.add.rectangle(area.width / 2, area.height / 2, area.width, area.height, terrainBaseColor(scene, layers)).setDepth(WORLD_DEPTH.ground).setName('basin:undercoat')
  for (const layer of layers) for (const tile of layer.tiles) {
    const texture = basinTileTexture(scene, layer, tile)
    const overlap = ['Ground', 'GroundVariation', 'Paths', 'StructureGrounding'].includes(layer.name) ? .5 : 0
    scene.add.image(tile.x + layer.offsetX - overlap / 2, tile.y + layer.offsetY - overlap / 2, texture.key, texture.frame)
      .setOrigin(0, 0).setDisplaySize((tile.width ?? layer.cellWidth) + overlap, (tile.height ?? layer.cellHeight) + overlap)
      .setFlip((tile.flip & 1) !== 0, (tile.flip & 2) !== 0)
      .setDepth(layerDepth[layer.name]).setName(`basin:${layer.name}`)
  }
  return true
}
