import Phaser from 'phaser'
import { TownTestScene } from './TownTestScene'
import type { WorldBridge } from './WorldBridge'
import type { TownWorldSpawnId } from './worldTypes'

export interface TownWorldGameOptions {
  spawnId: TownWorldSpawnId
}

export function createTownWorldGame(parent: HTMLElement, bridge: WorldBridge, options: TownWorldGameOptions) {
  const debugWorld = import.meta.env.DEV && new URLSearchParams(window.location.search).has('worldDebug')
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#17120f',
    transparent: false,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    physics: { default: 'arcade', arcade: { debug: debugWorld } },
    input: { keyboard: true, mouse: { preventDefaultWheel: true }, touch: { capture: true }, activePointers: 2 },
    scene: [new TownTestScene(bridge, debugWorld, options)],
    render: { antialias: true, pixelArt: false, roundPixels: false },
  })
}
