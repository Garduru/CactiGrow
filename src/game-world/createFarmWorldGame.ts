import Phaser from 'phaser'
import { FarmTestScene } from './FarmTestScene'
import type { WorldBridge } from './WorldBridge'

export function createFarmWorldGame(parent: HTMLElement, bridge: WorldBridge) {
  const debugWorld = import.meta.env.DEV && new URLSearchParams(window.location.search).has('worldDebug')
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#17120f',
    transparent: false,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    physics: { default: 'arcade', arcade: { debug: debugWorld } },
    input: { keyboard: true, mouse: { preventDefaultWheel: true }, touch: { capture: true }, activePointers: 2 },
    scene: [new FarmTestScene(bridge, debugWorld)],
    render: { antialias: true, pixelArt: false, roundPixels: false },
  })
}
