import assert from 'node:assert/strict'
import test from 'node:test'
import { CharacterMotion, characterAtlasFrame, characterFacing } from './characterMotion.ts'

test('actual displacement starts directional walking and stopping retains facing with idle', () => {
  for (const [point, facing] of [[{ x: 0, y: -5 }, 'north'], [{ x: 0, y: 5 }, 'south'], [{ x: 5, y: 0 }, 'east'], [{ x: -5, y: 0 }, 'west']] as const) {
    const motion = new CharacterMotion()
    assert.deepEqual(motion.sample({ x: 0, y: 0 }, 0), { facing: 'south', moving: false, frame: 0 })
    assert.deepEqual(motion.sample(point, 16), { facing, moving: true, frame: 1 })
    assert.deepEqual(motion.sample(point, 80), { facing, moving: false, frame: 0 })
  }
})
test('distance drives a four-pose leg cycle independently of render refresh rate or input source', () => {
  const run = (interval: number) => {
    const motion = new CharacterMotion(), frames: number[] = []
    motion.sample({ x: 0, y: 0 }, 0)
    for (let x = 10; x <= 170; x += 10) frames.push(motion.sample({ x, y: 0 }, x / 10 * interval).frame)
    return frames
  }
  assert.deepEqual(run(8), run(16))
  assert.deepEqual([...new Set(run(16))].sort(), [1, 2, 3, 4])
  assert.equal(characterAtlasFrame('north', 4), 19)
  assert.equal(characterAtlasFrame('south', 0), 0)
})
test('120Hz gaps, collision stops and restored positions do not create gliding or phantom gait', () => {
  const motion = new CharacterMotion()
  motion.sample({ x: 0, y: 0 }, 0)
  assert.equal(motion.sample({ x: 4, y: 0 }, 16).moving, true)
  assert.equal(motion.sample({ x: 4, y: 0 }, 24).moving, true)
  assert.equal(motion.sample({ x: 8, y: 0 }, 32).moving, true)
  assert.equal(motion.sample({ x: 8, y: 0 }, 100).frame, 0)
  assert.equal(motion.sample({ x: 1000, y: 1000 }, 120).moving, false)
  assert.equal(motion.current.facing, 'east')
})
test('NPCs can face interactions while idle, and public remote facing remains available', () => {
  const motion = new CharacterMotion()
  motion.sample({ x: 10, y: 10 }, 0)
  assert.deepEqual(motion.face({ x: 10, y: -10 }, { x: 10, y: 10 }), { facing: 'north', moving: false, frame: 0 })
  assert.equal(motion.sample({ x: 10, y: 10 }, 100).facing, 'north')
  assert.equal(motion.sample({ x: 11, y: 10 }, 116, 'west').facing, 'west')
  assert.equal(motion.sample({ x: 11, y: 10 }, 180, 'east').facing, 'east')
  assert.equal(characterFacing(1, 1.01, 'east'), 'east')
})
