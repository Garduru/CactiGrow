import { getChatLocation, sharesChatScope } from '../../shared/realtime/chatLocation.ts'
import type { PublicChatMessageV1 } from '../../shared/realtime/protocolV1.ts'
import type { Membership } from './presenceState.ts'
import type { MovementAuthorityV1 } from '../../shared/api/movementV1.ts'
import type { AreaDefinition } from '../../shared/realtime/areas.ts'
import { layerId, presenceId, type LayerId } from '../../shared/realtime/identifiers.ts'
import { MAX_CLIENT_FRAME_BYTES, MAX_SERVER_FRAME_BYTES, parseClientMessageText, type ServerMessageV1 } from '../../shared/realtime/protocolV1.ts'
import { createAreaPresenceState, findMembership, getLayerSnapshot, joinPresence, leavePresence, replaceAuthorizedConnection, retireEmptyLayers,
  toPublicPresence, updatePresenceMovement, type AreaPresenceState } from './presenceState.ts'
import { HEARTBEAT_MS, MAX_INVALID_MESSAGES, MAX_MESSAGES_PER_SECOND, MAX_OUTPUT_BYTES_PER_SECOND, STALE_AFTER_MS,
  isCheckpoint, isSocketAttachment, isTrustedAdmission, membershipKey, sameOwner, type Checkpoint, type SocketAttachment } from './runtimeContracts.ts'

export interface PresenceSocket {
  readonly readyState: number
  send(message: string): void
  close(code: number, reason: string): void
  serializeAttachment(value: unknown): void
  deserializeAttachment(): unknown
}
export interface CoordinatorPorts {
  now(): number
  uuid(): string
  accept(socket: PresenceSocket): void
  save(checkpoint: Checkpoint): void // Synchronous owner-local storage; never external I/O.
  isBlocked?(blockerPlayerId: string, blockedPublicId: string): boolean
  removeSocial?(playerId: string): void
  routeChat?(sender: Membership, message: PublicChatMessageV1): void
  diagnostic(event: string, fields: { areaId: string; population: number; reason?: string; layerId?: string }): void
}
type Delta = ServerMessageV1 extends infer M ? M extends ServerMessageV1 ? Omit<M, 'v' | 'eventSequence'> : never : never
type LeftReason = Extract<ServerMessageV1, { type: 'left' }>['reason']

/** One synchronous owner around L1. Only AreaPresence binds this to platform I/O. */
export class AreaCoordinator {
  private state: AreaPresenceState
  private readonly connections = new Map<PresenceSocket, SocketAttachment>()
  private readonly ports: CoordinatorPorts

  constructor(area: AreaDefinition, ports: CoordinatorPorts, checkpoint?: unknown, sockets: readonly PresenceSocket[] = []) {
    this.ports = ports
    this.state = createAreaPresenceState(area, ports.now())
    if (checkpoint !== undefined) {
      if (!isCheckpoint(checkpoint, area)) {
        for (const socket of sockets) this.quarantine(socket)
        this.log('recovery_failed', 'checkpoint')
        throw new Error('Invalid realtime checkpoint; admissions disabled.')
      }
      const now = Math.max(ports.now(), checkpoint.updatedAt)
      this.state = { ...this.state, nextGeneration: checkpoint.nextGeneration, updatedAt: now, layers: checkpoint.layers }
      // Reject ALL copies of ambiguous ownership, rather than guessing which socket wins.
      const candidates: { socket: PresenceSocket; attachment: SocketAttachment }[] = []
      for (const socket of sockets) {
        let value: unknown
        try { value = socket.deserializeAttachment() } catch { /* quarantine below */ }
        if (socket.readyState === 1 && isSocketAttachment(value, area, now)
          && checkpoint.owners.some((owner) => sameOwner(owner, value.member))) candidates.push({ socket, attachment: value })
        else { this.quarantine(socket); this.log('recovery_failed', 'attachment') }
      }
      for (const { socket, attachment } of candidates) {
        if (candidates.filter((item) => sameOwner(item.attachment.member, attachment.member)).length !== 1) {
          this.quarantine(socket); this.log('recovery_failed', 'duplicate_socket'); continue
        }
        this.connections.set(socket, attachment)
      }
      this.state = { ...this.state, members: [...this.connections.values()].map((value) => value.member),
        layers: checkpoint.layers.map((layer) => ({ ...layer, emptySince: [...this.connections.values()].some((value) => value.member.layerId === layer.layerId)
          ? null : layer.emptySince ?? now })) }
      this.state = retireEmptyLayers(this.state, now)
      this.save()
      for (const owner of checkpoint.owners) if (!this.state.members.some((member) => sameOwner(owner, member))) {
        this.broadcast(owner.layerId, { type: 'left', presenceId: owner.presenceId, generation: owner.generation, reason: 'expired' })
      }
    } else {
      // Orphan attachments cannot establish authority without the ownership checkpoint.
      for (const socket of sockets) this.quarantine(socket)
      this.save()
    }
    this.log('area_initialized')
  }

  snapshot(): AreaPresenceState { return structuredClone(this.state) }
  private now(): number { return Math.max(this.ports.now(), this.state.updatedAt) }
  private log(event: string, reason?: string, layerId?: string): void {
    this.ports.diagnostic(event, { areaId: this.state.area.areaId, population: this.state.members.length, reason, layerId })
  }
  private save(): void {
    this.ports.save({ v: 1, areaId: this.state.area.areaId, coordinateVersion: this.state.area.coordinateVersion,
      nextGeneration: this.state.nextGeneration, updatedAt: this.state.updatedAt, layers: this.state.layers, owners: this.state.members.map(membershipKey) })
  }
  private quarantine(socket: PresenceSocket): void {
    try { socket.serializeAttachment(null) } catch { /* checkpoint still fences it */ }
    try { socket.close(1008, 'Presence ended') } catch { this.log('connection_close_failed', 'already_closed_or_unavailable') }
  }
  private own(socket: PresenceSocket): SocketAttachment | undefined {
    const connection = this.connections.get(socket)
    const member = connection && findMembership(this.state, connection.member.playerId)
    return connection && member && sameOwner(member, connection.member) ? connection : undefined
  }
  private resetWindow(connection: SocketAttachment, now: number): void {
    if (now - connection.windowStart >= 1000) {
      connection.windowStart = now; connection.messages = 0; connection.movements = 0; connection.outputBytes = 0
    }
  }
  private persist(socket: PresenceSocket, connection: SocketAttachment): boolean {
    try { socket.serializeAttachment(connection); return true } catch { this.remove(socket, 'disconnect'); return false }
  }
  private send(socket: PresenceSocket, delta: Delta): boolean {
    const connection = this.own(socket)
    if (!connection) return false
    const now = this.now()
    if (socket.readyState !== 1 || connection.authorizationExpiresAt <= now || now - connection.lastSeen >= STALE_AFTER_MS) {
      this.remove(socket, 'expired'); return false
    }
    this.resetWindow(connection, now)
    const message = JSON.stringify({ v: 1, eventSequence: connection.eventSequence, ...delta })
    const bytes = new TextEncoder().encode(message).byteLength
    if (bytes > MAX_SERVER_FRAME_BYTES || connection.outputBytes + bytes > MAX_OUTPUT_BYTES_PER_SECOND || connection.eventSequence >= Number.MAX_SAFE_INTEGER) {
      this.remove(socket, 'disconnect'); return false
    }
    connection.eventSequence++; connection.outputBytes += bytes
    if (!this.persist(socket, connection)) return false
    try { socket.send(message); return true } catch { this.remove(socket, 'disconnect'); return false }
  }
  private broadcast(layer: LayerId, delta: Delta, except?: PresenceSocket): void {
    for (const [socket, connection] of [...this.connections]) {
      if (socket !== except && connection.member.layerId === layer) this.send(socket, delta)
    }
  }

  admit(input: unknown, socket: PresenceSocket): { ok: true } | { ok: false; code: string } {
    this.sweep()
    const now = this.now()
    if (!isTrustedAdmission(input, this.state.area, now)) { this.log('admission_rejected', 'scope'); return { ok: false, code: 'INVALID_SCOPE' } }
    const previous = input.replace && [...this.connections].find(([, value]) => sameOwner(value.member, input.replace!))
    const result = input.replace
      ? replaceAuthorizedConnection(this.state, input.replace, now, { publicId: input.publicId ?? input.replace.presenceId,
        displayName: input.displayName ?? 'Grower', ...(input.appearance ? { appearance: input.appearance } : {}) })
      : joinPresence(this.state, { playerId: input.playerId, publicId: input.publicId, displayName: input.displayName, ...(input.appearance ? { appearance: input.appearance } : {}),
        entryPointId: input.entryPointId,
        presenceId: presenceId(this.ports.uuid()), newLayerId: layerId(this.ports.uuid()), recentLayerId: input.recentLayerId }, now)
    if (!result.ok) { this.log('admission_rejected', result.code); return { ok: false, code: result.code } }
    if (input.replace && !previous) { this.log('admission_rejected', 'STALE_CONNECTION'); return { ok: false, code: 'STALE_CONNECTION' } }
    const connection: SocketAttachment = { v: 1, coordinateVersion: this.state.area.coordinateVersion, member: result.membership,
      authorizationExpiresAt: input.authorizationExpiresAt, lastSeen: now, eventSequence: 0, windowStart: now,
      messages: 0, movements: 0, outputBytes: 0, invalidMessages: 0 }
    // No await between reading L1 state, assignment, ownership insertion and checkpoint.
    try { this.ports.accept(socket); socket.serializeAttachment(connection) } catch {
      this.quarantine(socket); this.log('admission_rejected', 'socket'); return { ok: false, code: 'UNAVAILABLE' }
    }
    this.state = result.state
    this.connections.set(socket, connection)
    if (previous) this.connections.delete(previous[0])
    this.save() // Storage failure terminates the DO; do not continue with uncertain state.
    if (previous) {
      this.quarantine(previous[0])
      this.broadcast(previous[1].member.layerId, { type: 'left', presenceId: previous[1].member.presenceId,
        generation: previous[1].member.generation, reason: 'replaced' }, socket)
    }
    const welcomed = this.send(socket, { type: 'welcome', areaId: this.state.area.areaId, layerId: result.membership.layerId,
      coordinateVersion: this.state.area.coordinateVersion, selfPresenceId: result.membership.presenceId,
      players: getLayerSnapshot(this.state, result.membership.layerId), limits: { maxClientFrameBytes: MAX_CLIENT_FRAME_BYTES,
        maxMovementUpdatesPerSecond: this.state.area.movement.maxUpdatesPerSecond, heartbeatIntervalMs: HEARTBEAT_MS, staleAfterMs: STALE_AFTER_MS } })
    if (!welcomed) return { ok: false, code: 'UNAVAILABLE' }
    this.broadcast(result.membership.layerId, { type: 'joined', player: toPublicPresence(result.membership) }, socket)
    this.log('admission_accepted', undefined, result.membership.layerId)
    this.log('population_changed')
    return { ok: true }
  }
  movementScope(socket: PresenceSocket, raw: string | ArrayBuffer): Membership | null {
    const connection = this.own(socket), now = this.now()
    if (!connection || socket.readyState !== 1 || connection.authorizationExpiresAt <= now || now - connection.lastSeen >= STALE_AFTER_MS || typeof raw !== 'string') return null
    const parsed = parseClientMessageText(raw)
    if (!parsed.ok || parsed.message.type !== 'move' || parsed.message.sequence <= connection.member.sample.sequence) return null
    this.resetWindow(connection, now)
    if (connection.messages >= MAX_MESSAGES_PER_SECOND || connection.movements >= this.state.area.movement.maxUpdatesPerSecond) return null
    return connection.member
  }
  movementAuthority(socket: PresenceSocket, authority: MovementAuthorityV1) { this.send(socket, { type: 'movement-authority', authority }) }
  movementUnavailable(socket: PresenceSocket) { this.send(socket, { type: 'error', code: 'UNAVAILABLE', retryable: true }) }
  rejectMovement(socket: PresenceSocket) {
    const connection = this.own(socket)
    if (!connection) return
    this.resetWindow(connection, this.now()); connection.messages++; connection.movements++; connection.lastSeen = this.now()
    this.persist(socket, connection)
  }
  message(socket: PresenceSocket, raw: string | ArrayBuffer): void {
    const connection = this.own(socket)
    if (!connection) { this.quarantine(socket); return }
    const now = this.now()
    if (socket.readyState !== 1 || connection.authorizationExpiresAt <= now || now - connection.lastSeen >= STALE_AFTER_MS) { this.remove(socket, 'expired'); return }
    this.resetWindow(connection, now)
    if (++connection.messages > MAX_MESSAGES_PER_SECOND) { this.log('protocol_violation', 'rate'); this.remove(socket, 'disconnect'); return }
    if (typeof raw !== 'string') { this.log('protocol_violation', 'binary'); this.remove(socket, 'disconnect'); return }
    const parsed = parseClientMessageText(raw)
    if (!parsed.ok) {
      if (parsed.code === 'FRAME_TOO_LARGE') { this.log('protocol_violation', parsed.code); this.remove(socket, 'disconnect') }
      else this.violation(socket, connection, parsed.code === 'UNSUPPORTED_VERSION' ? 'UNSUPPORTED_VERSION' : 'INVALID_MESSAGE')
      return
    }
    const message = parsed.message
    if (message.type === 'hello') { this.violation(socket, connection, 'INVALID_MESSAGE'); return } // L3 consumes admission, never this stream.
    if (message.type === 'leave') { this.remove(socket, 'leave'); return }
    if (message.type === 'move') {
      if (++connection.movements > this.state.area.movement.maxUpdatesPerSecond) { this.log('protocol_violation', 'movement_rate'); this.remove(socket, 'disconnect'); return }
      const result = updatePresenceMovement(this.state, connection.member,
        { sequence: message.sequence, position: message.position, facing: message.facing, movement: message.movement }, now)
      if (!result.ok) { this.violation(socket, connection, 'INVALID_MESSAGE'); return }
      this.state = result.state; connection.member = result.membership; connection.lastSeen = now
      if (!this.persist(socket, connection)) return
      this.save()
      this.broadcast(connection.member.layerId, { type: 'moved', presenceId: connection.member.presenceId,
        generation: connection.member.generation, sample: connection.member.sample, acceptedAt: now }, socket)
    } else if (message.type === 'ping') {
      connection.lastSeen = now
      this.send(socket, { type: 'pong', sequence: message.sequence, serverTime: now })
    } else {
      connection.lastSeen = now
      this.sendChat(socket, message.channel, message.text, message.recipientPublicId)
    }
  }
  private sendChat(socket: PresenceSocket, channel: PublicChatMessageV1['channel'], text: string, recipientPublicId?: string): void {
    const connection = this.own(socket)
    if (!connection) return
    const sender = connection.member
    const location = getChatLocation(sender.areaId)
    if (!text.trim() || channel === 'town' && !location?.town || channel === 'direct' && (!recipientPublicId || recipientPublicId === sender.publicId)) {
      this.chatUnavailable(sender.playerId); return
    }
    const message: PublicChatMessageV1 = { id: this.ports.uuid(), channel, senderPublicId: sender.publicId,
      senderDisplayName: sender.displayName ?? 'Grower', ...(recipientPublicId ? { recipientPublicId } : {}), text: text.trim(), sentAt: this.now() }
    if (this.ports.routeChat) { this.ports.routeChat(sender, message); return }
    // Synchronous test/local fallback retains area-wide routing, independent of rendering Layers.
    if (channel === 'direct') {
      const recipient = [...this.connections].find(([, c]) => c.member.publicId === recipientPublicId)
      if (!recipient || this.ports.isBlocked?.(sender.playerId, recipientPublicId!) || this.ports.isBlocked?.(recipient[1].member.playerId, sender.publicId)) { this.chatUnavailable(sender.playerId); return }
      if (this.send(recipient[0], { type: 'chat', message })) this.send(socket, { type: 'chat', message })
    } else this.deliverChat(message, sender.areaId)
  }
  chatUnavailable(playerId: string): void {
    for (const [socket, connection] of this.connections) if (connection.member.playerId === playerId) this.send(socket, { type: 'error', code: 'CHAT_UNAVAILABLE', retryable: false })
  }
  deliverChat(message: PublicChatMessageV1, senderAreaId: string, targetPresenceId?: string, echo = false): number {
    const senderLocation = getChatLocation(senderAreaId), recipientLocation = getChatLocation(this.state.area.areaId)
    if (message.channel !== 'direct' && (!senderLocation || !recipientLocation || !sharesChatScope(message.channel, senderLocation, recipientLocation))) return 0
    let delivered = 0
    for (const [socket, connection] of [...this.connections]) {
      const member = connection.member
      if (targetPresenceId && member.presenceId !== targetPresenceId) continue
      if (message.channel === 'direct' && member.publicId !== (echo ? message.senderPublicId : message.recipientPublicId)) continue
      if (this.ports.isBlocked?.(member.playerId, message.senderPublicId)) continue
      if (this.send(socket, { type: 'chat', message })) delivered++
    }
    return delivered
  }
  private violation(socket: PresenceSocket, connection: SocketAttachment, code: 'INVALID_MESSAGE' | 'UNSUPPORTED_VERSION'): void {
    this.log('protocol_violation', code)
    if (++connection.invalidMessages >= MAX_INVALID_MESSAGES) this.remove(socket, 'disconnect')
    else this.send(socket, { type: 'error', code, retryable: false })
  }
  remove(socket: PresenceSocket, reason: LeftReason = 'disconnect'): void {
    const connection = this.own(socket)
    this.connections.delete(socket)
    if (!connection) { this.quarantine(socket); return }
    const result = leavePresence(this.state, connection.member, this.now())
    if (!result.ok) { this.quarantine(socket); return }
    this.state = result.state; this.save()
    this.ports.removeSocial?.(connection.member.playerId)
    this.quarantine(socket)
    this.log('connection_closed', reason, connection.member.layerId); this.log('population_changed')
    this.broadcast(connection.member.layerId, { type: 'left', presenceId: connection.member.presenceId, generation: connection.member.generation, reason })
  }
  sweep(): void {
    const now = this.now()
    for (const [socket, connection] of [...this.connections]) if (socket.readyState !== 1 || connection.authorizationExpiresAt <= now || now - connection.lastSeen >= STALE_AFTER_MS) this.remove(socket, 'expired')
    this.state = retireEmptyLayers(this.state, now); this.save()
  }
  nextAlarm(): number | null {
    const deadlines = [...this.connections.values()].map((value) => Math.min(value.authorizationExpiresAt, value.lastSeen + STALE_AFTER_MS))
    for (const layer of this.state.layers) if (layer.emptySince !== null) deadlines.push(layer.emptySince + this.state.area.emptyLayerRetentionMs)
    return deadlines.length ? Math.max(this.now() + 1, Math.min(...deadlines)) : null
  }
}
