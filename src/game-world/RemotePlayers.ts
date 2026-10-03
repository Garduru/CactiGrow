import type { PublicPresenceV1 } from '../../shared/realtime/protocolV1.ts'
import type { PresenceId } from '../../shared/realtime/identifiers.ts'
import type { Position } from '../../shared/realtime/areas.ts'

export interface RemoteAvatar { setPosition(x: number, y: number): unknown; destroy(): void }
interface Remote { avatar: RemoteAvatar; presence: PublicPresenceV1; from: Position; target: Position; rendered: Position; receivedAt: number }
const INTERPOLATION_MS = 110

/** Presentation only: one non-physical avatar per delivered public presence, no extrapolation. */
export class RemotePlayers {
  private readonly players = new Map<PresenceId, Remote>()
  private readonly create: (presence: PublicPresenceV1) => RemoteAvatar
  constructor(create: (presence: PublicPresenceV1) => RemoteAvatar) { this.create = create }
  sync(presences: readonly PublicPresenceV1[], now: number) {
    const present = new Set(presences.map((presence) => presence.presenceId))
    for (const [id, remote] of this.players) if (!present.has(id)) { remote.avatar.destroy(); this.players.delete(id) }
    for (const presence of presences) {
      const old = this.players.get(presence.presenceId)
      if (!old || old.presence.generation !== presence.generation) {
        old?.avatar.destroy()
        const avatar = this.create(presence)
        avatar.setPosition(presence.position.x, presence.position.y)
        this.players.set(presence.presenceId, { avatar, presence, from: presence.position, target: presence.position, rendered: presence.position, receivedAt: now })
      } else if (presence.sequence > old.presence.sequence) {
        const position = this.position(old, now)
        old.from = position; old.target = presence.position; old.receivedAt = now; old.presence = presence
      }
    }
  }
  private position(remote: Remote, now: number): Position {
    const fraction = Math.min(1, Math.max(0, (now - remote.receivedAt) / INTERPOLATION_MS))
    return { x: remote.from.x + (remote.target.x - remote.from.x) * fraction, y: remote.from.y + (remote.target.y - remote.from.y) * fraction }
  }
  update(now: number) {
    for (const remote of this.players.values()) { const position = this.position(remote, now); remote.rendered = position; remote.avatar.setPosition(position.x, position.y) }
  }
  getAtPosition(position: Position): PublicPresenceV1 | undefined {
    // Match the visible head/body at the interpolated location, not the network target's feet.
    return [...this.players.values()].filter((remote) => Math.abs(position.x - remote.rendered.x) <= 30
      && position.y >= remote.rendered.y - 84 && position.y <= remote.rendered.y + 18)
      .sort((a, b) => Math.hypot(position.x - a.rendered.x, position.y - (a.rendered.y - 32))
        - Math.hypot(position.x - b.rendered.x, position.y - (b.rendered.y - 32)))[0]?.presence
  }
  getPosition(publicId: string): Position | undefined {
    const remote = [...this.players.values()].find((player) => player.presence.publicId === publicId)
    return remote ? { ...remote.rendered } : undefined
  }
  clear() { for (const remote of this.players.values()) remote.avatar.destroy(); this.players.clear() }
}
