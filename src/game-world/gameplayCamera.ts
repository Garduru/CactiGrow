import type Phaser from 'phaser'

/** Same viewport-based initial scale as the established Farm/Town camera. */
export function gameplayZoom(width: number, height: number) {
  return Math.min(1.18, Math.max(.72, Math.min(width, height) / 720))
}
export interface GameplayCameraState { zoom?: number }
export function configureGameplayCamera(scene: Phaser.Scene, player: Phaser.GameObjects.Container, state: GameplayCameraState) {
  const camera = scene.cameras.main
  // Phaser clamps undersized bounds to their top-left. Center the spare viewport
  // on either undersized axis without changing zoom or the authored bounds.
  const clampX = camera.clampX.bind(camera), clampY = camera.clampY.bind(camera)
  camera.clampX = x => { const bounds = camera.getBounds(); return bounds.width < camera.displayWidth ? bounds.centerX - camera.width / 2 : clampX(x) }
  camera.clampY = y => { const bounds = camera.getBounds(); return bounds.height < camera.displayHeight ? bounds.centerY - camera.height / 2 : clampY(y) }
  camera.startFollow(player, true, .1, .1)
  const resize = () => camera.setZoom(state.zoom ?? gameplayZoom(scene.scale.width, scene.scale.height))
  resize()
  scene.scale.on('resize', resize)
  const cleanup = () => { scene.scale.off('resize', resize); camera.clampX = clampX; camera.clampY = clampY }
  scene.events.once('shutdown', cleanup); scene.events.once('destroy', cleanup)
}
