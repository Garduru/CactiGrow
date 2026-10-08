import type Phaser from 'phaser'
export function bindTutorialWorldHighlight(scene: Phaser.Scene, target: () => string | null, bounds: (key: string) => { x: number; y: number; width: number; height: number } | undefined) {
  const graphic = scene.add.graphics().setDepth(145).setName('tutorial-guidance').setVisible(false)
  const update = (time: number) => {
    const key = target(), box = key ? bounds(key) : undefined
    graphic.clear().setVisible(!!box)
    if (!box) return
    graphic.setAlpha(.6 + Math.sin(time / 500) * .15)
    graphic.lineStyle(3 / scene.cameras.main.zoom, 0xf0c879, 1)
    graphic.strokeRoundedRect(box.x - 12, box.y - 12, box.width + 24, box.height + 24, 18)
    graphic.beginPath().moveTo(box.x + box.width/2 - 14, box.y - 35).lineTo(box.x + box.width/2, box.y - 21).lineTo(box.x + box.width/2 + 14, box.y - 35).strokePath()
  }
  scene.events.on('update', update)
  const release = () => scene.events.off('update', update)
  scene.events.once('shutdown', release); scene.events.once('destroy', release)
}
