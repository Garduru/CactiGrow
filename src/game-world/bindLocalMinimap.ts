import type Phaser from 'phaser'
import type { WorldArea } from '../../shared/world/types.ts'
import type { NavigationController } from './navigation/NavigationController.ts'
import { walkMinimap, type LocalMinimapStore } from './localMinimap.ts'
import type { Point } from './navigation/NavigationMap.ts'
export function bindLocalMinimap(scene: Phaser.Scene, store: LocalMinimapStore | undefined, area: WorldArea, player: Point, navigation: () => NavigationController, pending: () => boolean, clearInteraction?: () => void) {
  if (!store) return
  const walk = (point: Point) => {
    if (pending() || !walkMinimap(navigation(), player, point)) return false
    clearInteraction?.(); scene.game.canvas.focus(); return true
  }
  let last = -Infinity
  const update = (time: number) => {
    if (!store.open || time - last < 100) return
    last = time
    store.publish({ area, blocked: navigation().map.obstacles, player: { x: player.x, y: player.y } }, walk)
  }
  scene.events.on('update', update)
  const release = () => { scene.events.off('update', update); store.clear(walk) }
  scene.events.once('shutdown', release); scene.events.once('destroy', release)
}
