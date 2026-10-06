import type Phaser from 'phaser'
import { WORLD_DEPTH } from './worldDepth'
import { DEFAULT_APPEARANCE, SHIRT_COLORS, SKIN_COLORS, type CharacterAppearance } from '../../shared/api/startingExperienceV1.ts'

/** Existing Farm/Town character registration, shared by all local world scenes. */
export function createPlayerCharacter(scene: Phaser.Scene, x: number, y: number, appearance: CharacterAppearance = DEFAULT_APPEARANCE) {
  return scene.add.container(x, y, [
    scene.add.rectangle(0, -18, 34, 62, SHIRT_COLORS[appearance.shirt]).setStrokeStyle(4, 0x2b1a13),
    scene.add.circle(0, -61, 20, SKIN_COLORS[appearance.skin]).setStrokeStyle(4, 0x2b1a13),
  ]).setSize(54, 54).setDepth(WORLD_DEPTH.localPlayer)
}
