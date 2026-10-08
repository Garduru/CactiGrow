import type Phaser from 'phaser'
import type { WorldVisualLayer } from '../../shared/world/types'

/** Match the quiet terrain undercoat to the Area's actual ground material. */
export function terrainBaseColor(scene: Phaser.Scene, layers: WorldVisualLayer[]): number {
  const ground = layers.find(layer => layer.name === 'Ground'), tile = ground?.tiles[0]
  if (!ground || !tile) return 0x65523d
  const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
  const context = canvas.getContext('2d')!
  context.drawImage(scene.textures.get(`terrain:${ground.tileset.uid}`).getSourceImage() as CanvasImageSource, tile.sourceX, tile.sourceY, ground.tileset.tileSize, ground.tileset.tileSize, 0, 0, 1, 1)
  const [red,green,blue] = context.getImageData(0,0,1,1).data
  return red*65536+green*256+blue
}

/** Presentation-only road feathering; its edges come from authored visual neighbors. */
export function terrainTileTexture(scene: Phaser.Scene, layer: WorldVisualLayer, tile: WorldVisualLayer['tiles'][number]): { key: string; frame?: string } {
  const key = `terrain:${layer.tileset.uid}`, frame = `${tile.sourceX}:${tile.sourceY}`
  const texture = scene.textures.get(key), inset = layer.tileset.inset ?? 2, size = layer.tileset.tileSize - inset * 2
  if (!texture.has(frame)) texture.add(frame, 0, tile.sourceX + inset, tile.sourceY + inset, size, size)
  const ground = layer.name === 'Ground' && layer.tileset.inset !== undefined, edges = ground ? 15 : tile.blendEdges, corners = ground ? 0 : tile.blendCorners ?? 0
  if (!edges && !corners) return { key, frame }
  const blended = `${key}:${ground?'ground':'road'}:${frame}:${edges ?? 0}:${corners}`
  if (!scene.textures.exists(blended)) {
    const canvas = scene.textures.createCanvas(blended, size, size)
    if (!canvas) return { key, frame }
    const context = canvas.context
    context.drawImage(texture.getSourceImage() as CanvasImageSource, tile.sourceX + inset, tile.sourceY + inset, size, size, 0, 0, size, size)
    context.globalCompositeOperation = 'destination-out'
    const fade = Math.max(1, Math.round(size * .22))
    for (const [bit, from, to, rect] of [
      [1,[0,0],[0,fade],[0,0,size,fade]],
      [2,[size,0],[size-fade,0],[size-fade,0,fade,size]],
      [4,[0,size],[0,size-fade],[0,size-fade,size,fade]],
      [8,[0,0],[fade,0],[0,0,fade,size]],
    ] as const) {
      if (!((edges ?? 0) & bit)) continue
      const gradient = context.createLinearGradient(from[0], from[1], to[0], to[1])
      gradient.addColorStop(0, `rgba(0,0,0,${ground ? .4 : 1})`); gradient.addColorStop(1, 'rgba(0,0,0,0)')
      context.fillStyle = gradient; context.fillRect(rect[0], rect[1], rect[2], rect[3])
    }
    for (const [bit,x,y,left,top] of [
      [1,0,0,0,0], [2,size,0,size-fade,0],
      [4,size,size,size-fade,size-fade], [8,0,size,0,size-fade],
    ] as const) {
      if (!(corners & bit)) continue
      const gradient = context.createRadialGradient(x,y,0,x,y,fade)
      gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)')
      context.fillStyle=gradient;context.fillRect(left,top,fade,fade)
    }
    context.globalCompositeOperation = 'source-over'
    canvas.refresh()
  }
  return { key: blended }
}
