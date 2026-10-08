import type { Facing } from '../../shared/realtime/protocolV1.ts'

export interface CharacterPoint { x: number; y: number }
export interface CharacterMotionFrame { facing: Facing; moving: boolean; frame: number }
export const CHARACTER_DIRECTIONS: readonly Facing[] = ['south', 'west', 'east', 'north']
export const CHARACTER_WALK_FRAMES = 4
export const CHARACTER_STRIDE_DISTANCE = 160
const STOP_GRACE_MS = 55

export function characterFacing(dx: number, dy: number, previous: Facing = 'south'): Facing {
  if (Math.hypot(dx, dy) <= .025) return previous
  // Retain a matching direction around diagonals instead of flickering on numerical ties.
  if (Math.abs(Math.abs(dx) - Math.abs(dy)) <= Math.max(Math.abs(dx), Math.abs(dy)) * .12) {
    if ((previous === 'east' && dx > 0) || (previous === 'west' && dx < 0)
      || (previous === 'north' && dy < 0) || (previous === 'south' && dy > 0)) return previous
  }
  return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'east' : 'west' : dy > 0 ? 'south' : 'north'
}
export function characterAtlasFrame(facing: Facing, frame: number): number {
  return CHARACTER_DIRECTIONS.indexOf(facing) * (CHARACTER_WALK_FRAMES + 1) + frame
}

/** Presentation observes actual displacement. It never sets position, velocity or navigation. */
export class CharacterMotion {
  private previous: CharacterPoint | null = null
  private movedAt = -Infinity
  private distance = 0
  private snapshot: CharacterMotionFrame = { facing: 'south', moving: false, frame: 0 }
  get current(): CharacterMotionFrame { return this.snapshot }
  face(target: CharacterPoint, origin: CharacterPoint): CharacterMotionFrame {
    this.snapshot = { ...this.snapshot, facing: characterFacing(target.x - origin.x, target.y - origin.y, this.snapshot.facing) }
    return this.snapshot
  }
  sample(position: CharacterPoint, now: number, preferredFacing?: Facing): CharacterMotionFrame {
    const old = this.previous
    this.previous = { x: position.x, y: position.y }
    const dx = old ? position.x - old.x : 0, dy = old ? position.y - old.y : 0
    const displacement = Math.hypot(dx, dy)
    // Welcome/restoration/teleport snapshots select an idle frame; they are not walking.
    if (displacement > 128) { this.distance = 0; this.movedAt = -Infinity }
    else if (displacement > .025) {
      this.movedAt = now
      this.distance += displacement
      this.snapshot = { facing: preferredFacing ?? characterFacing(dx, dy, this.snapshot.facing), moving: true,
        frame: 1 + Math.floor(this.distance / (CHARACTER_STRIDE_DISTANCE / CHARACTER_WALK_FRAMES)) % CHARACTER_WALK_FRAMES }
      return this.snapshot
    }
    // Arcade steps at 60Hz while the browser can render at 120Hz: a zero-displacement
    // render frame must not flash idle between genuine physics steps.
    if (now - this.movedAt <= STOP_GRACE_MS) return this.snapshot
    this.distance = 0
    this.snapshot = { facing: preferredFacing ?? this.snapshot.facing, moving: false, frame: 0 }
    return this.snapshot
  }
}
