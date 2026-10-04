import { getChatLocation, sharesChatScope } from '../../shared/realtime/chatLocation.ts'
import type { PublicChatMessageV1 } from '../../shared/realtime/protocolV1.ts'
import { isRecord } from '../../shared/realtime/protocolV1.ts'
import { isCanonicalUuid, isSequence } from '../../shared/realtime/identifiers.ts'

export const CHAT_DIRECTORY_NAME = 'chat-directory:v2'
export interface ChatPeer { playerId: string; publicId: string; areaId: string; presenceId: string; joinedAt: number; expiresAt: number; chatWindowStart?: number; chatCount?: number }
export interface ChatDelivery { message: PublicChatMessageV1; senderAreaId: string; targetPresenceId?: string; echo?: boolean }
export function isChatPeer(value: unknown): value is ChatPeer {
  return isRecord(value) && isCanonicalUuid(value.playerId) && isCanonicalUuid(value.publicId) && isCanonicalUuid(value.presenceId)
    && typeof value.areaId === 'string' && !!getChatLocation(value.areaId) && isSequence(value.joinedAt) && isSequence(value.expiresAt)
    && (value.chatWindowStart === undefined || isSequence(value.chatWindowStart)) && (value.chatCount === undefined || isSequence(value.chatCount))
}
interface DirectoryPorts {
  now(): number
  save(peers: ChatPeer[]): void
  deliver(areaId: string, delivery: ChatDelivery): Promise<number>
  revoke(peer: ChatPeer): Promise<void>
}

/** Private ephemeral index over existing AreaPresence sockets, never a second socket transport. */
export class ChatDirectory {
  private peers: ChatPeer[]
  private readonly ports: DirectoryPorts
  constructor(ports: DirectoryPorts, peers: ChatPeer[] = []) {
    if (!Array.isArray(peers) || peers.length > 2048 || !peers.every(isChatPeer) || new Set(peers.map(p => p.playerId)).size !== peers.length) throw new Error('Invalid chat directory state.')
    this.ports = ports; this.peers = peers
  }
  private prune() { this.peers = this.peers.filter(p => p.expiresAt > this.ports.now()) }
  current(playerId: string) { this.prune(); return this.peers.find(p => p.playerId === playerId) }
  async update(areaId: string, incoming: ChatPeer[]): Promise<void> {
    this.prune()
    // Delete only this Area's disappeared leases; another Area may already own the player's session.
    this.peers = this.peers.filter(p => p.areaId !== areaId || incoming.some(n => n.presenceId === p.presenceId))
    const revoked: ChatPeer[] = []
    for (const peer of incoming) {
      if (peer.areaId !== areaId || peer.expiresAt <= this.ports.now() || !getChatLocation(areaId)) continue
      const previous = this.peers.find(p => p.playerId === peer.playerId)
      if (previous && previous.presenceId !== peer.presenceId && previous.joinedAt >= peer.joinedAt) continue
      if (!previous && this.peers.length >= 2048) throw new Error('Chat directory capacity reached.')
      if (previous && previous.areaId !== peer.areaId) revoked.push(previous)
      this.peers = this.peers.filter(p => p.playerId !== peer.playerId)
      this.peers.push({ ...peer, chatWindowStart: previous?.chatWindowStart, chatCount: previous?.chatCount })
    }
    this.ports.save(this.peers)
    await Promise.all(revoked.map(p => this.ports.revoke(p)))
  }
  async route(sender: ChatPeer, message: PublicChatMessageV1, blockedPublicIds: readonly string[]): Promise<boolean> {
    const current = this.current(sender.playerId)
    if (!current || current.areaId !== sender.areaId || current.presenceId !== sender.presenceId || current.publicId !== message.senderPublicId) return false
    const now = this.ports.now()
    if (current.chatWindowStart === undefined || now - current.chatWindowStart >= 2000) { current.chatWindowStart = now; current.chatCount = 0 }
    if ((current.chatCount ?? 0) >= 5) return false
    current.chatCount = (current.chatCount ?? 0) + 1
    this.ports.save(this.peers)
    const location = getChatLocation(sender.areaId)
    if (!location) return false
    if (message.channel === 'direct') {
      const recipient = this.peers.find(p => p.publicId === message.recipientPublicId && p.playerId !== sender.playerId)
      if (!recipient || blockedPublicIds.includes(recipient.publicId)) return false
      const delivered = await this.ports.deliver(recipient.areaId, { message, senderAreaId: sender.areaId, targetPresenceId: recipient.presenceId })
      if (!delivered) return false
      // Sender gets an echo only after the recipient's live socket accepted delivery.
      await this.ports.deliver(sender.areaId, { message, senderAreaId: sender.areaId, targetPresenceId: sender.presenceId, echo: true })
      return true
    }
    const areas = [...new Set(this.peers.filter(p => {
      const target = getChatLocation(p.areaId)
      return target && sharesChatScope(message.channel as 'local' | 'town' | 'world', location, target)
    }).map(p => p.areaId))]
    const results = await Promise.all(areas.map(areaId => this.ports.deliver(areaId, { message, senderAreaId: sender.areaId })))
    return results.some(n => n > 0)
  }
}
