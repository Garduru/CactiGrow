import type Phaser from 'phaser'
import type { WorldArea, WorldVisualLayer } from '../../shared/world/types'
import { WORLD_DEPTH } from './worldDepth'
import { terrainBaseColor, terrainTileTexture } from './worldTilePresentation'

/** LDtk visual data only. The registered template bodies remain navigation truth. */
export function hasSettlementArt(area: WorldArea | undefined): area is WorldArea {
  return !!area && (area.areaType === 'farm' || area.areaType === 'town')
    && !!area.visualLayers?.some(layer => layer.tileset.path === '/assets/world/tiles/world-settlement-master-v01.png')
}

export function preloadSettlementArt(scene: Phaser.Scene, area: WorldArea | undefined) {
  if (!hasSettlementArt(area)) return
  const tilesets = new Map(area.visualLayers?.map(layer => [layer.tileset.uid, layer.tileset]))
  for (const tileset of tilesets.values()) if (!scene.textures.exists(`terrain:${tileset.uid}`)) scene.load.image(`terrain:${tileset.uid}`, tileset.path)
}

const layerDepth: Record<WorldVisualLayer['name'], number> = {
  Ground: WORLD_DEPTH.ground,
  GroundVariation: WORLD_DEPTH.groundDetail,
  Paths: WORLD_DEPTH.paths,
  StructureGrounding: WORLD_DEPTH.shadows,
  BoundaryEdges: WORLD_DEPTH.landscaping,
  Decorations: WORLD_DEPTH.landscaping,
}

/** Round exposed overlay corners; preserve the accepted wilderness renderer. */
function settlementTileTexture(scene: Phaser.Scene, layer: WorldVisualLayer, tile: WorldVisualLayer['tiles'][number]) {
  // The image is flipped after sampling. Mirror masks before painting so their
  // final fades still face the same authored world neighbors.
  const mirror = (mask: number | undefined, corner: boolean) => {
    let value=mask ?? 0
    const remap=(bits: number[]) => [1,2,4,8].reduce((out,bit,index)=>out | (value & bit ? bits[index] : 0),0)
    if(tile.flip & 1)value=remap(corner?[2,1,8,4]:[1,8,4,2])
    if(tile.flip & 2)value=remap(corner?[8,4,2,1]:[4,2,1,8])
    return value
  }
  const sampled = tile.flip ? { ...tile, blendEdges:mirror(tile.blendEdges,false), blendCorners:mirror(tile.blendCorners,true) } : tile
  const base = terrainTileTexture(scene, layer, sampled), corners = mirror(tile.roundCorners,true)
  if (!corners) return base
  const key = `${base.key}:${base.frame ?? ''}:settlement-round:${corners}`
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.get(base.key), frame = texture.get(base.frame), size = frame.cutWidth
    const canvas = scene.textures.createCanvas(key, size, size)
    if (!canvas) return base
    const context = canvas.context
    context.drawImage(texture.getSourceImage() as CanvasImageSource, frame.cutX, frame.cutY, size, size, 0, 0, size, size)
    context.globalCompositeOperation = 'destination-out'
    const radius = size * .65
    for (const [bit,x,y,left,top] of [[1,radius,radius,0,0],[2,size-radius,radius,size-radius,0],[4,size-radius,size-radius,size-radius,size-radius],[8,radius,size-radius,0,size-radius]] as const) {
      if (!(corners & bit)) continue
      const fade = context.createRadialGradient(x,y,radius*.8,x,y,radius)
      fade.addColorStop(0,'rgba(0,0,0,0)'); fade.addColorStop(1,'rgba(0,0,0,1)')
      context.fillStyle=fade; context.fillRect(left,top,radius,radius)
    }
    context.globalCompositeOperation = 'source-over'; canvas.refresh()
  }
  return { key }
}

export function drawSettlementArt(scene: Phaser.Scene, area: WorldArea | undefined): boolean {
  if (!hasSettlementArt(area) || !area.visualLayers?.every(layer => scene.textures.exists(`terrain:${layer.tileset.uid}`))) return false
  const layers = [...area.visualLayers].sort((a, b) => layerDepth[a.name] - layerDepth[b.name])
  scene.add.rectangle(area.width / 2, area.height / 2, area.width, area.height, terrainBaseColor(scene, layers)).setDepth(WORLD_DEPTH.ground)
  for (const layer of layers) for (const tile of layer.tiles) {
    const texture = settlementTileTexture(scene, layer, tile)
    // Fractional compact-template cells need slight overlap to avoid sampling gaps.
    const overlap = ['Ground','GroundVariation','Paths','StructureGrounding'].includes(layer.name) ? .75 : 0
    scene.add.image(tile.x + layer.offsetX - overlap/2, tile.y + layer.offsetY - overlap/2, texture.key, texture.frame)
      .setOrigin(0, 0).setDisplaySize((tile.width ?? layer.cellWidth) + overlap, (tile.height ?? layer.cellHeight) + overlap)
      .setFlip((tile.flip & 1) !== 0, (tile.flip & 2) !== 0)
      .setDepth(layerDepth[layer.name]).setName(`settlement:${layer.name}`)
  }
  return true
}
