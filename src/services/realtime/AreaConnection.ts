import type { MovementAuthorityV1 } from '../../../shared/api/movementV1.ts'
import { isRealtimeCredentialsResponseV1, realtimeSocketProtocols, type RealtimeCredentialsRequestV1, type RealtimeCredentialsResponseV1 } from '../../../shared/api/realtimeCredentialsV1.ts'
import { getAreaDefinition, isWithinArea, type Position } from '../../../shared/realtime/areas.ts'
import type { AreaId, LayerId, PresenceId } from '../../../shared/realtime/identifiers.ts'
import { parseServerMessageText, type ClientMessageV1, type ConnectionLimitsV1, type Facing, type MovementSample, type PublicChatMessageV1, type PublicPresenceV1, type ServerMessageV1 } from '../../../shared/realtime/protocolV1.ts'
import { CactiGrowApiError } from '../api/CactiGrowApiClient.ts'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unavailable'
export interface AreaConnectionState { readonly authority?: MovementAuthorityV1; readonly diagnostic?: string; readonly status: ConnectionStatus; readonly remotes: readonly PublicPresenceV1[]; readonly chatMessages: readonly PublicChatMessageV1[]; readonly chatError?: string; readonly layerId?: LayerId }
export type RealtimeSocket = Pick<WebSocket, 'readyState' | 'bufferedAmount' | 'send' | 'close' | 'addEventListener'>
interface ConnectionOptions {
  areaId: AreaId
  entryPointId: string
  origin: string
  recoverStalePresence?: boolean
  admit(input: RealtimeCredentialsRequestV1, signal: AbortSignal): Promise<RealtimeCredentialsResponseV1>
  socket?(url: string, protocols: string[]): RealtimeSocket
  now?(): number
  schedule?(callback: () => void, delayMs: number): () => void
}
const RETRY_DELAYS = [1000, 3000, 8000]

/** Route-owned transient presence. No player identity, Layer selection, gameplay state or persistent credentials. */
export class AreaConnection {
  private readonly options: ConnectionOptions
  private readonly now: () => number
  private readonly schedule: NonNullable<ConnectionOptions['schedule']>
  private readonly listeners = new Set<() => void>()
  private state: AreaConnectionState = { status: 'idle', remotes: [], chatMessages: [] }
  private readonly remotes = new Map<PresenceId, PublicPresenceV1>()
  private chatMessages: PublicChatMessageV1[] = []
  private authority?: MovementAuthorityV1
  private chatError: string | null = null
  private diagnostic = ''
  private conflictRecoveryUsed = false
  private active = false
  private epoch = 0
  private socket?: RealtimeSocket
  private abort?: AbortController
  private cancelTask?: () => void
  private cancelDeadline?: () => void
  private cancelHeartbeat?: () => void
  private reconnectTokens: string[] = []
  private authorizationExpiresAt = 0
  private failures = 0
  private connectedAt = 0
  private lastReceived = 0
  private lastEvent = -1
  private self?: PresenceId
  private limits?: ConnectionLimitsV1
  private sequence = 0
  private pingSequence = 0
  private lastSent?: MovementSample
  private lastSentAt = -Infinity

  constructor(options: ConnectionOptions) {
    this.options = options
    this.now = options.now ?? Date.now
    this.schedule = options.schedule ?? ((callback, ms) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer) })
  }
  getSnapshot = (): AreaConnectionState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(status = this.state.status, layerId = this.state.layerId) {
    this.state = { authority: this.authority, status, remotes: [...this.remotes.values()], chatMessages: this.chatMessages,
      ...(this.diagnostic ? { diagnostic: this.diagnostic } : {}),
      ...(this.chatError ? { chatError: this.chatError } : {}), layerId }
    this.listeners.forEach((listener) => listener())
  }
  start() {
    if (this.active) return
    this.active = true; this.failures = 0
    this.diagnostic = ''
    this.conflictRecoveryUsed = false
    this.publish('connecting')
    // Strict Mode's setup/cleanup/setup cancels this task before any admission or socket exists.
    this.cancelTask = this.schedule(() => { void this.connect() }, 0)
  }
  stop() {
    this.active = false
    if (this.socket?.readyState === 1) { try { this.socket.send('{"v":1,"type":"leave"}') } catch { /* close still follows */ } }
    this.reset()
    this.reconnectTokens = []
    this.chatMessages = []
    this.chatError = null
    this.publish('idle')
  }
  private reset() {
    this.epoch++
    this.cancelTask?.(); this.cancelDeadline?.(); this.cancelHeartbeat?.(); this.abort?.abort()
    const socket = this.socket; this.socket = undefined
    try { socket?.close(1000, 'Town presence ended') } catch { /* already closed */ }
    this.authority = undefined
    this.remotes.clear(); this.self = undefined; this.limits = undefined
    this.lastEvent = -1; this.sequence = 0; this.pingSequence = 0; this.lastSent = undefined; this.lastSentAt = -Infinity
    this.state = { status: this.state.status, remotes: [], chatMessages: this.chatMessages,
      ...(this.chatError ? { chatError: this.chatError } : {}) }
  }
  private fail(retry = true, diagnostic = 'transport-ended', stalePresence = false) {
    if (!this.active) return
    this.diagnostic = diagnostic
    if (this.state.status === 'connected' && this.now() - this.connectedAt >= 60_000) this.failures = 0
    this.reset()
    let delay = RETRY_DELAYS[this.failures++]
    // A reload loses its private reconnect token before the old 60-second lease expires.
    // One delayed staging-world retry recovers without replacing an active owner.
    if (retry && delay === undefined && stalePresence && !this.conflictRecoveryUsed) {
      this.conflictRecoveryUsed = true; delay = 60_000
    }
    if (!retry || delay === undefined) { this.publish('unavailable'); return }
    this.publish('reconnecting')
    this.cancelTask = this.schedule(() => { void this.connect() }, delay)
  }
  private async connect() {
    if (!this.active) return
    const epoch = ++this.epoch
    const owns = () => this.active && epoch === this.epoch
    const abort = new AbortController(); this.abort = abort
    this.cancelDeadline = this.schedule(() => { if (owns()) this.fail() }, 10_000)
    try {
      const credentials = await this.options.admit({ v: 1, areaId: this.options.areaId, entryPointId: this.options.entryPointId,
        ...(this.reconnectTokens[0] ? { reconnectToken: this.reconnectTokens[0] } : {}) }, abort.signal)
      if (!owns()) return
      if (!isRealtimeCredentialsResponseV1(credentials) || credentials.areaId !== this.options.areaId
        || Date.parse(credentials.expiresAt) <= this.now()) { this.fail(false, 'invalid-admission-projection'); return }
      this.authorizationExpiresAt = Date.parse(credentials.authorizationExpiresAt)
      this.reconnectTokens = [credentials.reconnectToken, ...this.reconnectTokens].slice(0, 2)
      const url = new URL(credentials.socketPath, this.options.origin)
      if (url.origin !== this.options.origin || !['http:', 'https:'].includes(url.protocol)) { this.fail(false); return }
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      const socket = (this.options.socket ?? ((url, protocols) => new WebSocket(url, protocols)))(url.href, realtimeSocketProtocols(credentials.ticket))
      this.socket = socket
      // L3 upgrade is the handshake. L2 rejects an additional stream hello.
      socket.addEventListener('message', (event) => {
        if (!owns()) return
        if (typeof event.data !== 'string') { this.fail(false); return }
        const parsed = parseServerMessageText(event.data)
        if (!parsed.ok) { this.fail(false, `protocol-${parsed.code}`); return }
        this.receive(parsed.message)
      })
      socket.addEventListener('close', () => { if (owns()) this.fail() })
      socket.addEventListener('error', () => { if (owns()) this.fail() })
    } catch (error) {
      if (!owns()) return
      if (error instanceof CactiGrowApiError && error.status === 403 && this.reconnectTokens.length) {
        this.reconnectTokens.shift() // Try the retained pre-upgrade token after an ambiguous outcome.
        this.fail(); return
      }
      const permanent = error instanceof CactiGrowApiError && (error.kind === 'unauthenticated' || error.kind === 'invalid-response' || [400, 403, 404].includes(error.status ?? 0))
      this.fail(!permanent, error instanceof CactiGrowApiError ? `admission-${error.status ?? error.kind}` : 'admission-unavailable',
        !!this.options.recoverStalePresence && error instanceof CactiGrowApiError && error.status === 409)
    }
  }
  private receive(message: ServerMessageV1) {
    if (this.now() >= this.authorizationExpiresAt) { this.fail(false); return }
    if (message.eventSequence <= this.lastEvent) return
    if (message.eventSequence !== this.lastEvent + 1) { this.fail(true, 'sequence-gap'); return }
    this.lastEvent = message.eventSequence; this.lastReceived = this.now()
    if (message.type === 'welcome') {
      if (this.self || message.areaId !== this.options.areaId) { this.fail(false); return }
      this.self = message.selfPresenceId; this.limits = message.limits
      this.diagnostic = ''
      this.remotes.clear()
      message.players.forEach((player) => { if (player.presenceId !== this.self) this.remotes.set(player.presenceId, player) })
      this.cancelDeadline?.(); this.connectedAt = this.now(); this.reconnectTokens = this.reconnectTokens.slice(0, 1)
      this.publish('connected', message.layerId); this.heartbeat(); return
    }
    if (!this.self) { this.fail(false); return }
    if (message.type === 'movement-authority') {
      if (message.authority.runtimeAreaId !== this.options.areaId) return
      this.authority = message.authority; this.publish(); return
    }
    if (message.type === 'error') {
      if (message.code === 'CHAT_UNAVAILABLE') { this.chatError = 'Message unavailable. Check recipient availability, blocks or the send limit; use Mail for offline delivery.'; this.publish(); return }
      this.fail(message.retryable, `server-${message.code}`); return
    }
    if (message.type === 'chat') {
      this.chatError = null
      this.chatMessages = [...this.chatMessages.slice(-99), message.message]
      this.publish()
      return
    }
    const area = getAreaDefinition(this.options.areaId)!
    if (message.type === 'joined' && message.player.presenceId !== this.self) {
      const old = this.remotes.get(message.player.presenceId)
      if (!isWithinArea(area, message.player.position)) { this.fail(false); return }
      if (!old || message.player.generation > old.generation) this.remotes.set(message.player.presenceId, message.player)
      if (this.remotes.size >= area.layerCapacity) { this.fail(false); return }
    } else if (message.type === 'moved') {
      const old = this.remotes.get(message.presenceId)
      if (!isWithinArea(area, message.sample.position)) { this.fail(false); return }
      if (old?.generation === message.generation && message.sample.sequence > old.sequence) this.remotes.set(message.presenceId, { ...old, ...message.sample })
    } else if (message.type === 'left' && this.remotes.get(message.presenceId)?.generation === message.generation) this.remotes.delete(message.presenceId)
    if (message.type !== 'pong') this.publish()
  }
  private heartbeat() {
    const limits = this.limits
    if (!limits) return
    this.cancelHeartbeat = this.schedule(() => {
      if (this.state.status !== 'connected') return
      if (this.now() >= this.authorizationExpiresAt) { this.fail(false); return }
      if (this.now() - this.lastReceived >= limits.staleAfterMs) { this.fail(); return }
      if (this.send({ v: 1, type: 'ping', sequence: ++this.pingSequence })) this.heartbeat()
    }, Math.min(limits.heartbeatIntervalMs, Math.max(1, this.authorizationExpiresAt - this.now())))
  }
  private send(message: ClientMessageV1): boolean {
    if (this.state.status !== 'connected' || this.socket?.readyState !== 1) return false
    if (this.now() >= this.authorizationExpiresAt) { this.fail(false); return false }
    // No application queue; avoid building up browser buffers on a slow connection.
    if (this.socket.bufferedAmount > 4096) { this.fail(); return false }
    try { this.socket.send(JSON.stringify(message)); return true } catch { this.fail(); return false }
  }
  sampleMovement(position: Position, facing: Facing, moving: boolean) {
    if (!this.limits || this.state.status !== 'connected') return
    const now = this.now(), movement = moving ? 'moving' : 'stopped'
    if (now - this.lastSentAt < Math.max(110, 1000 / this.limits.maxMovementUpdatesPerSecond)) return
    if (!isWithinArea(getAreaDefinition(this.options.areaId)!, position)) return
    const old = this.lastSent
    if (old && old.position.x === position.x && old.position.y === position.y && old.facing === facing && old.movement === movement) return
    const sample: MovementSample = { position: { ...position }, facing, movement, sequence: this.sequence + 1 }
    if (this.send({ v: 1, type: 'move', ...sample })) { this.sequence++; this.lastSent = sample; this.lastSentAt = now }
  }

  sendPublicMessage(channel: 'local' | 'town' | 'world', text: string): boolean {
    const cleaned = text.trim()
    if (!cleaned) return false
    this.chatError = null
    return this.send({ v: 1, type: 'chat', channel, text: cleaned })
  }
  sendWorldMessage(text: string): boolean {
    const cleaned = text.trim()
    if (!cleaned) return false
    this.chatError = null
    return this.send({ v: 1, type: 'chat', channel: 'world', text: cleaned })
  }

  sendDirectMessage(recipientPublicId: string, text: string): boolean {
    const cleaned = text.trim()
    if (!cleaned) return false
    this.chatError = null
    return this.send({ v: 1, type: 'chat', channel: 'direct', recipientPublicId, text: cleaned })
  }

  refreshPresence(): void {
    if (!this.active) return
    this.failures = 0
    this.reset()
    this.publish('reconnecting')
    this.cancelTask = this.schedule(() => { void this.connect() }, 0)
  }
}
