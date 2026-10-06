import type Phaser from 'phaser'
import { WORLD_DEPTH } from './worldDepth'

/** Existing Farm/Town character registration, shared by all local world scenes. */
export function createPlayerCharacter(scene: Phaser.Scene, x: number, y: number) {
  return scene.add.container(x, y, [
    scene.add.rectangle(0, -18, 34, 62, 0xb85e3d).setStrokeStyle(4, 0x2b1a13),
    scene.add.circle(0, -61, 20, 0xd39a6b).setStrokeStyle(4, 0x2b1a13),
  ]).setSize(54, 54).setDepth(WORLD_DEPTH.localPlayer)
}
