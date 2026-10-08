import assert from 'node:assert/strict'
import test from 'node:test'
import { RemotePlayers } from './RemotePlayers.ts'
import { CharacterMotion } from '../characters/characterMotion.ts'
import type { PublicPresenceV1 } from '../../shared/realtime/protocolV1.ts'
import { connectionGeneration, presenceId } from '../../shared/realtime/identifiers.ts'

test('remote saved appearance and actual interpolated displacement drive shared walking, idle and facing', () => {
  const appearance = { body: 1, skin: 2, shirt: 1, hair: 1, hairColor: 3, pants: 1, hat: 1, accessory: 1 }
  const initial: PublicPresenceV1 = { presenceId: presenceId('00000000-0000-4000-8000-000000000001'), publicId: '00000000-0000-4000-8000-000000000002', generation: connectionGeneration(1), label: 'Remote grower', appearance, sequence: 0, position: { x: 100, y: 100 }, facing: 'south', movement: 'stopped' }
  const avatars: { x: number; y: number; appearance: unknown; destroyed: boolean; motion: CharacterMotion; setPosition(x: number, y: number): void; destroy(): void }[] = []
  const view = new RemotePlayers(presence => {
    const avatar = { ...presence.position, appearance: presence.appearance, destroyed: false, motion: new CharacterMotion(), setPosition(x: number, y: number) { this.x = x; this.y = y }, destroy() { this.destroyed = true } }
    avatars.push(avatar); return avatar
  }, (avatar, presence, position, now) => {
    avatars.find(candidate => candidate === avatar)!.motion.sample(position, now, presence.facing)
  })
  view.sync([initial], 0)
  assert.deepEqual(avatars[0].appearance, appearance)
  assert.equal(avatars[0].motion.current.moving, false)
  view.sync([{ ...initial, sequence: 1, position: { x: 180, y: 100 }, facing: 'east', movement: 'moving' }], 10)
  view.update(65)
  assert.equal(avatars[0].x, 140)
  assert.equal(avatars[0].motion.current.moving, true)
  assert.equal(avatars[0].motion.current.facing, 'east')
  view.update(120); view.update(190)
  assert.equal(avatars[0].x, 180)
  assert.equal(avatars[0].motion.current.moving, false, 'no extrapolation or stale packet marching')
  view.sync([{ ...initial, sequence: 2, position: { x: 180, y: 100 }, facing: 'north', movement: 'stopped' }], 200)
  view.update(220)
  assert.deepEqual(avatars[0].motion.current, { facing: 'north', moving: false, frame: 0 })
  assert.equal(avatars.length, 1)
  view.sync([], 230); assert.equal(avatars[0].destroyed, true)
})
