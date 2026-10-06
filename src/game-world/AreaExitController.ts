import type Phaser from 'phaser'
import type { WorldArea, WorldExit, WorldPoint } from '../../shared/world/types.ts'
import { findArea } from '../../shared/world/world.ts'
import type { GameplayCameraState } from './gameplayCamera'
import type { CharacterAppearance, StartingExperienceV1 } from '../../shared/api/startingExperienceV1.ts'

/** Player center enters an authored opening; no click or point-radius interaction. */
export function insideExit(position: WorldPoint, exit: WorldExit, margin = 0) {
  return Math.abs(position.x - exit.x) <= exit.width / 2 + margin && Math.abs(position.y - exit.y) <= exit.height / 2 + margin
}
/** Arrivals must clear the trigger before rearming, including failed/blocked requests. */
export class AreaExitController {
  private readonly area: WorldArea
  private readonly activate: (id: string) => void
  private readonly armed = new Set<string>()
  constructor(area: WorldArea, activate: (id: string) => void) { this.area = area; this.activate = activate }
  update(position: WorldPoint) {
    for (const exit of this.area.exits) {
      if (!insideExit(position, exit, 8)) this.armed.add(exit.exitId)
      else if (insideExit(position, exit) && this.armed.delete(exit.exitId)) { this.activate(exit.exitId); break }
    }
  }
}
export interface FoundationSceneOptions { position: WorldPoint; area: WorldArea; onExit(id: string): void; pending(): boolean; camera?: GameplayCameraState; debug?: boolean; appearance?: CharacterAppearance; onInteract?(id: string): void; tutorialPot?(): StartingExperienceV1['pot'] }
export function drawFoundationExitDebug(scene: Phaser.Scene, options: FoundationSceneOptions) {
  if (!options.debug) return
  for (const exit of options.area.exits) {
    scene.add.rectangle(exit.x, exit.y, exit.width, exit.height, exit.blocked ? 0x9f5445 : 0x78a562, .18).setStrokeStyle(2, 0x78a562).setDepth(130).setName('area-debug-trigger')
    const target = exit.targetAreaId ? findArea(exit.targetAreaId) : undefined
    const spawn = target?.spawns.find(s => s.entryId === exit.targetEntryId)
    const destination = target ? `${target.displayName} / ${spawn?.entryId} (${spawn?.x}, ${spawn?.y})` : exit.futureDestinationLabel ?? 'Blocked'
    scene.add.text(exit.x, exit.y, `${exit.exitId} ? ${destination}`, {fontSize:'12px',color:'#fff3dc',backgroundColor:'#211710'}).setOrigin(.5).setDepth(131).setName('area-debug-label')
  }
  for (const spawn of options.area.spawns) {
    scene.add.circle(spawn.x, spawn.y, 7, 0x78a562).setDepth(130).setName('area-debug-spawn')
    scene.add.text(spawn.x, spawn.y + 12, spawn.entryId, {fontSize:'12px',color:'#fff3dc',backgroundColor:'#211710'}).setOrigin(.5,0).setDepth(131).setName('area-debug-label')
  }
}
export function bindFoundationExits(scene: Phaser.Scene, player: WorldPoint, options?: FoundationSceneOptions) {
  if (!options) return
  drawFoundationExitDebug(scene, options)
  const controller = new AreaExitController(options.area, options.onExit)
  const update = () => { if (!options.pending()) controller.update(player) }
  scene.events.on('update', update)
  const release = () => scene.events.off('update', update)
  scene.events.once('shutdown', release); scene.events.once('destroy', release)
}
