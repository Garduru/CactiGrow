import type Phaser from 'phaser'
import type { FoundationSceneOptions } from './AreaExitController.ts'
import type { NavigationController } from './navigation/NavigationController.ts'
import type { Facing } from '../../shared/realtime/protocolV1.ts'
import { setMovementDiagnostics } from '../features/devtools/movementDiagnostics.ts'

/** Observe completed physics. Existing keyboard/path followers remain the only movement owners. */
export function bindMovementAuthority(scene: Phaser.Scene, player: Phaser.GameObjects.Container, navigation: () => NavigationController, options?: FoundationSceneOptions) {
  if (!options?.movement) return
  const movement = options.movement, connection = options.connection
  const unsubscribe = movement.subscribeCorrection(point => {
    navigation().cancel()
    const body = player.body as Phaser.Physics.Arcade.Body
    body.stop(); body.reset(point.x, point.y)
    options.clearInteraction?.()
  })
  let previous = { x: player.x, y: player.y }, facing: Facing = 'south'
  const sample = () => {
    const point = { x: player.x, y: player.y }, dx = point.x - previous.x, dy = point.y - previous.y, moving = Math.abs(dx) + Math.abs(dy) > .01
    if (moving) facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'east' : 'west' : dy > 0 ? 'south' : 'north'
    const snapshot = connection?.getSnapshot()
    movement.realtimeStatus = snapshot?.status ?? 'idle'; movement.realtimeDiagnostic = snapshot?.diagnostic ?? ''
    if (snapshot?.authority) movement.receive(snapshot.authority)
    movement.sample({ x: player.x, y: player.y }, snapshot?.status === 'connected')
    connection?.sampleMovement({ x: player.x, y: player.y }, facing, moving)
    previous = { x: player.x, y: player.y }
  }
  const unregister = setMovementDiagnostics(movement)
  scene.events.on('postupdate', sample)
  const cleanup = () => { unsubscribe(); unregister(); scene.events.off('postupdate', sample); scene.events.off('shutdown', cleanup); scene.events.off('destroy', cleanup) }
  scene.events.once('shutdown', cleanup); scene.events.once('destroy', cleanup)
}
