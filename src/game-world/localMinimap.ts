import type { WorldArea } from '../../shared/world/types.ts'
import type { NavigationController } from './navigation/NavigationController.ts'
import type { Point } from './navigation/NavigationMap.ts'
export interface MinimapSnapshot {
  area: WorldArea
  blocked: readonly { left: number; right: number; top: number; bottom: number }[]
  player: Point
}
export interface MinimapSurface { layer: 'GroundVariation' | 'Paths' | 'StructureGrounding'; x: number; y: number; width: number; height: number }
/** Visual roads/courtyards are derived from LDtk, never used by the ground-walk port. */
export function minimapSurfaces(area: WorldArea): MinimapSurface[] {
  if (area.areaType !== 'farm' && area.areaType !== 'town' && !area.visualLayers?.some(layer => layer.name === 'Paths')) return []
  const surfaces: MinimapSurface[] = []
  for (const layer of area.visualLayers ?? []) {
    if (layer.name !== 'GroundVariation' && layer.name !== 'Paths' && layer.name !== 'StructureGrounding') continue
    const rows = new Map<string, MinimapSurface[]>()
    for (const tile of layer.tiles) {
      const rect: MinimapSurface = { layer: layer.name, x: tile.x + layer.offsetX, y: tile.y + layer.offsetY, width: tile.width ?? layer.cellWidth, height: tile.height ?? layer.cellHeight }
      const key = `${rect.y}:${rect.height}`
      const row = rows.get(key) ?? []; row.push(rect); rows.set(key, row)
    }
    for (const row of rows.values()) {
      row.sort((a, b) => a.x - b.x)
      let previous: MinimapSurface | undefined
      for (const rect of row) {
        if (previous && Math.abs(previous.x + previous.width - rect.x) < 1e-6) previous.width += rect.width
        else { previous = { ...rect }; surfaces.push(previous) }
      }
    }
  }
  return surfaces
}
/** Transient scene presentation and ground-walk port. No persistence or camera ownership. */
export class LocalMinimapStore {
  open = false
  toggleOpen() { this.open = !this.open; return this.open }
  private current: MinimapSnapshot | null = null
  private walker: ((point: Point) => boolean) | null = null
  private readonly listeners = new Set<() => void>()
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.current
  publish(snapshot: MinimapSnapshot, walker: (point: Point) => boolean) { this.current = snapshot; this.walker = walker; this.listeners.forEach(listener => listener()) }
  clear(walker: (point: Point) => boolean) { if (this.walker !== walker) return; this.current = null; this.walker = null; this.listeners.forEach(listener => listener()) }
  walk(point: Point) { return this.walker?.(point) ?? false }
}
export function minimapPoint(x: number, y: number, width: number, height: number, area: Pick<WorldArea, 'width' | 'height'>): Point | null {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || x < 0 || y < 0 || x > width || y > height) return null
  return { x: x / width * area.width, y: y / height * area.height }
}
export function walkMinimap(navigation: NavigationController, player: Point, point: Point) {
  // Reject invalid/unreachable clicks without cancelling an already valid route.
  if (!navigation.map.walkable(point) || !navigation.map.route(player, point)) return false
  return navigation.move(player, point)
}
