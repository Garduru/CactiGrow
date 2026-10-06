import Phaser from 'phaser'
import { LdtkAreaScene } from './LdtkAreaScene'
import type { FoundationSceneOptions } from './AreaExitController'
export function createLdtkWorldGame(parent: HTMLElement, options: FoundationSceneOptions) {
  return new Phaser.Game({ type: Phaser.AUTO, parent, backgroundColor: '#17120f', scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    physics: { default: 'arcade' }, input: { activePointers: 2, touch: { capture: true }, keyboard: true }, scene: [new LdtkAreaScene(options)] })
}
