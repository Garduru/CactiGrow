import type { MovementAuthorityV1, MovementCheckpointV1 } from '../../shared/api/movementV1.ts'
import type { WorldLocation, WorldPoint } from '../../shared/world/types.ts'
import { MOVEMENT_CHECKPOINT_MS, MOVEMENT_PERSIST_MS } from '../../shared/world/movement.ts'

export class WorldMovementClient {
  private readonly location: WorldLocation
  private readonly checkpoint: (command: MovementCheckpointV1) => Promise<MovementAuthorityV1>
  private point: WorldPoint
  private sent: WorldPoint | null = null
  private lastSentAt = -Infinity
  private inFlight: Promise<MovementAuthorityV1> | null = null
  private stopped = false
  private generation = 0
  private readonly corrections = new Set<(point: WorldPoint) => void>()
  authority: MovementAuthorityV1 | null = null
  error = ''
  realtimeStatus = 'idle'
  realtimeDiagnostic = ''
  constructor(location: WorldLocation, checkpoint: (command: MovementCheckpointV1) => Promise<MovementAuthorityV1>) {
    this.location = location; this.point = { ...location.position }; this.checkpoint = checkpoint
  }
  sample(point: WorldPoint, realtime: boolean, now = performance.now()) {
    this.point = { ...point }
    if (this.stopped || this.inFlight || now - this.lastSentAt < (realtime ? MOVEMENT_PERSIST_MS : MOVEMENT_CHECKPOINT_MS)
      || this.sent && Math.hypot(point.x - this.sent.x, point.y - this.sent.y) < .01) return
    void this.flush(now).catch(() => { /* Retry only at bounded cadence; local movement stays responsive. */ })
  }
  setPosition(point: WorldPoint) { this.point = { ...point } }
  receive(authority: MovementAuthorityV1) {
    if (this.stopped || authority.worldRevision !== this.location.revision || authority.runtimeAreaId !== this.location.runtimeAreaId
      || this.authority && (authority.revision < this.authority.revision || authority.serverNow < this.authority.serverNow)) return
    if (this.authority && authority.revision === this.authority.revision && authority.serverNow === this.authority.serverNow
      && authority.rejections === this.authority.rejections && authority.accepted === this.authority.accepted) return
    this.authority = authority
    this.error = authority.accepted ? '' : `Position corrected: ${authority.lastRejection}.`
    if (!authority.accepted) {
      this.point = { ...authority.position }; this.sent = { ...authority.position }
      this.corrections.forEach(listener => listener(authority.position))
    }
  }
  async flush(now = performance.now()): Promise<MovementAuthorityV1> {
    if (this.stopped) throw new Error('World movement session ended.')
    const generation = this.generation
    if (this.inFlight) {
      await this.inFlight
      if (this.stopped || generation !== this.generation) throw new Error('World movement session ended.')
      if (this.sent && Math.hypot(this.point.x - this.sent.x, this.point.y - this.sent.y) < .01 && this.authority?.accepted) return this.authority
    }
    const point = { ...this.point }
    this.lastSentAt = now
    const request = this.checkpoint({ v: 1, runtimeAreaId: this.location.runtimeAreaId, expectedWorldRevision: this.location.revision, position: point })
    this.inFlight = request
    try {
      const result = await request
      if (this.stopped || generation !== this.generation) throw new Error('World movement session ended.')
      this.sent = point; this.receive(result)
      if (!result.accepted) throw new Error('Your position was corrected. Approach again to interact.')
      return result
    } catch (e) { if (!this.stopped && generation === this.generation) this.error = e instanceof Error ? e.message : 'Movement checkpoint unavailable.'; throw e }
    finally { if (this.inFlight === request) this.inFlight = null }
  }
  subscribeCorrection(listener: (point: WorldPoint) => void) { this.corrections.add(listener); return () => this.corrections.delete(listener) }
  get delta() { return this.authority ? Math.hypot(this.point.x - this.authority.position.x, this.point.y - this.authority.position.y) : null }
  start() { this.stopped = false; this.generation++; this.inFlight = null; this.sent = null; this.lastSentAt = -Infinity }
  stop() { this.stopped = true; this.generation++; this.corrections.clear() }
}
