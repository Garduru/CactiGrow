import type { AreaConnection } from '../../services/realtime/AreaConnection'
import type { PublicChatMessageV1 } from '../../../shared/realtime/protocolV1'

/** Bounded session-only direct history survives locations, never identities. */
export class ChatHistory {
  readonly playerId: string | null
  constructor(playerId: string | null) { this.playerId = playerId }
  private messages: readonly PublicChatMessageV1[] = []
  private readonly listeners = new Set<() => void>()
  getSnapshot = () => this.messages
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  attach(connection: AreaConnection) {
    this.messages = this.messages.filter(m => m.channel === 'direct')
    const update = () => {
      const ids = new Set(this.messages.map(m => m.id))
      const added = connection.getSnapshot().chatMessages.filter(m => !ids.has(m.id))
      if (added.length) this.messages = [...this.messages, ...added].slice(-100)
      this.listeners.forEach(l => l())
    }
    update()
    return connection.subscribe(update)
  }
}
