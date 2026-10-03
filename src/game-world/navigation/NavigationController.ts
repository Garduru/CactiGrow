import { distance, NavigationMap, type Point } from './NavigationMap.ts'

export interface ApproachTarget {
  id: string
  position(): Point | undefined
  radius: number
  /** Fixed authored entrances can differ from their interaction center. */
  approach?: Point
  moving?: boolean
  activate(): void
}

/** Pure local intent/following. Does not own physics, persistence or network publication. */
export class NavigationController {
  path: Point[] = []
  destination: Point | null = null
  private target: ApproachTarget | null = null
  private plannedPosition: Point | null = null
  private plannedAt = 0
  private stalledMs = 0
  private lastPosition: Point | null = null
  readonly map: NavigationMap
  constructor(map: NavigationMap) { this.map = map }

  cancel() { this.path = []; this.destination = null; this.target = null; this.lastPosition = null; this.stalledMs = 0 }
  move(from: Point, to: Point): boolean {
    this.cancel()
    const path = this.map.route(from, to)
    if (!path) return false
    this.path = path; this.destination = path.at(-1) ?? null
    return true
  }
  approach(from: Point, target: ApproachTarget, now: number): boolean {
    this.cancel(); this.target = target
    return this.planApproach(from, now)
  }
  private planApproach(from: Point, now: number): boolean {
    const target = this.target, position = target?.position()
    if (!target || !position) { this.cancel(); return false }
    this.plannedAt = now; this.plannedPosition = { ...position }
    let goal = target.approach ?? position
    if (!target.approach) {
      const length = distance(from, position), stop = Math.min(target.radius * 0.75, length)
      goal = length ? { x: position.x + (from.x - position.x) * stop / length, y: position.y + (from.y - position.y) * stop / length } : position
      if (!this.map.walkable(goal)) goal = position
    }
    const path = this.map.route(from, goal)
    if (!path) { this.cancel(); return false }
    this.path = path; this.destination = path.at(-1) ?? null
    this.stalledMs = 0; this.lastPosition = null
    return true
  }
  update(position: Point, deltaMs: number, speed: number, now: number): Point {
    const zero = { x: 0, y: 0 }
    const targetPosition = this.target?.position()
    if (this.target) {
      if (!targetPosition) { this.cancel(); return zero }
      const near = distance(position, targetPosition) <= this.target.radius
      // Fixed buildings activate at their authored approach, not through a rear wall.
      const atEntrance = !this.target.approach || distance(position, this.destination ?? this.target.approach) <= 8
      const visible = this.target.approach || this.map.visible(position, targetPosition)
      if (near && atEntrance && visible) { const activate = this.target.activate; this.cancel(); activate(); return zero }
      if (this.target.moving && now - this.plannedAt >= 500 && this.plannedPosition) {
        const moved = distance(targetPosition, this.plannedPosition)
        if (moved >= 48 || (moved > 1 && (!this.path.length || distance(position, this.destination!) < 8))) this.planApproach(position, now)
      }
    }
    if (!this.path.length) return zero
    // Skip a reached corner only if the next segment is still collision-clear.
    while (this.path.length > 1 && distance(position, this.path[0]) < 6 && this.map.clear(position, this.path[1])) this.path.shift()
    const waypoint = this.path[0], length = distance(position, waypoint)
    if (length < 2) {
      this.path.shift()
      if (!this.path.length) {
        // A small target move can put it beyond range at arrival. Wait for the bounded refresh.
        if (!(this.target?.moving && targetPosition && this.plannedPosition && distance(targetPosition, this.plannedPosition) > 1)) this.cancel()
        return zero
      }
      return this.update(position, deltaMs, speed, now)
    }
    if (this.lastPosition && distance(position, this.lastPosition) < 0.1) this.stalledMs += Math.min(deltaMs, 100)
    else this.stalledMs = 0
    this.lastPosition = { ...position }
    if (this.stalledMs > 900) { this.cancel(); return zero }
    // Arcade steps at 60 Hz even on 120 Hz displays. Cap against both clocks.
    const velocity = Math.min(speed, length / (Math.max(1000 / 60, deltaMs) / 1000))
    return { x: (waypoint.x - position.x) / length * velocity, y: (waypoint.y - position.y) / length * velocity }
  }
}
