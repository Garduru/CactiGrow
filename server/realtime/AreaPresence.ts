import { ChatDirectory, CHAT_DIRECTORY_NAME, isChatPeer, type ChatPeer, type ChatDelivery } from './ChatDirectory.ts'
import { STALE_AFTER_MS } from './runtimeContracts.ts'
import { parseServerMessageText, type PublicChatMessageV1 } from '../../shared/realtime/protocolV1.ts'
import type { Membership } from './presenceState.ts'
import { DurableObject } from 'cloudflare:workers'
import { getAreaDefinition } from '../../shared/realtime/areas.ts'
import { isRecord } from '../../shared/realtime/protocolV1.ts'
import { isCanonicalUuid } from '../../shared/realtime/identifiers.ts'
import { AreaCoordinator, type PresenceSocket } from './AreaCoordinator.ts'
import { areaCoordinatorName, CHECKPOINT_KEY, isTrustedAdmission, membershipKey, sameOwner, type TrustedAdmission } from './runtimeContracts.ts'
import { CONNECTION_TTL_MS, TICKET_TTL_MS, TICKETS_KEY, MAX_CREDENTIAL_RECORDS, credentialHash, newCredential, pruneTickets, isTicketState, type TicketState } from './admissionTickets.ts'
import { isRealtimeCredential, REALTIME_SUBPROTOCOL } from '../../shared/api/realtimeCredentialsV1.ts'
import { MovementOwner, MOVEMENT_KEY, movementOwnerName } from '../movement/MovementOwner.ts'
import { parseClientMessageText } from '../../shared/realtime/protocolV1.ts'
import { isMovementAuthorityV1 } from '../../shared/api/movementV1.ts'

export interface RealtimeEnv { AREA_PRESENCE: DurableObjectNamespace<AreaPresence>; CACTIGROW_ENVIRONMENT?: string }
const SOCIAL_KEY = 'area-social-v1'
interface AreaSocialProfile { playerId: string; publicId: string; displayName: string; blockedPublicIds: readonly string[] }
function isAreaSocialProfile(value: unknown): value is AreaSocialProfile {
  return isRecord(value) && Object.keys(value).length === 4 && isCanonicalUuid(value.playerId) && isCanonicalUuid(value.publicId)
    && typeof value.displayName === 'string' && value.displayName.length >= 3 && value.displayName.length <= 20
    && Array.isArray(value.blockedPublicIds) && value.blockedPublicIds.every(isCanonicalUuid)
}

/** L3 obtains this stub ONLY after validating configured Area and authenticated scope. */
export function getAreaCoordinator(namespace: RealtimeEnv['AREA_PRESENCE'], areaId: unknown): DurableObjectStub<AreaPresence> {
  return namespace.get(namespace.idFromName(areaCoordinatorName(areaId)))
}

/** Constructs a fresh binding-only request. NEVER forward a browser Request to this stub. */
export function admitToArea(namespace: RealtimeEnv['AREA_PRESENCE'], scope: TrustedAdmission): Promise<Response> {
  return getAreaCoordinator(namespace, scope.areaId).fetch(new Request('https://area.internal/connect', {
    headers: { Upgrade: 'websocket', 'X-CactiGrow-Trusted-Scope': JSON.stringify(scope) },
  }))
}

export class AreaPresence extends DurableObject<RealtimeEnv> {
  #directory?: ChatDirectory
  #pendingChats: { sender: Membership; message: PublicChatMessageV1 }[] = []
  #runtime?: AreaCoordinator
  #socialProfiles = new Map<string, AreaSocialProfile>()
  #lastMovementAck = new Map<string, number>()

  constructor(ctx: DurableObjectState, env: RealtimeEnv) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      const savedSocial: unknown = ctx.storage.kv.get(SOCIAL_KEY)
      if (savedSocial !== undefined) {
        if (!Array.isArray(savedSocial) || !savedSocial.every(isAreaSocialProfile)) throw new Error('Invalid realtime social cache.')
        this.#socialProfiles = new Map(savedSocial.map((profile) => [profile.playerId, profile]))
      }
      const saved: unknown = ctx.storage.kv.get(CHECKPOINT_KEY)
      if (saved !== undefined) {
        if (!isRecord(saved) || !this.#isOwner(saved.areaId)) {
          for (const socket of ctx.getWebSockets()) socket.close(1008, 'Invalid Area state')
          throw new Error('Invalid realtime Area checkpoint.')
        }
        this.#runtime = this.#create(saved.areaId, saved)
        await this.#schedule()
      } else {
        for (const socket of ctx.getWebSockets()) socket.close(1008, 'Missing Area state')
      }
    })
  }
  #isOwner(id: unknown): boolean {
    return !!getAreaDefinition(id) && this.ctx.id.toString() === this.env.AREA_PRESENCE.idFromName(areaCoordinatorName(id)).toString()
  }
  #create(id: unknown, saved?: unknown): AreaCoordinator {
    const area = getAreaDefinition(id)
    if (!area) throw new Error('Unknown realtime Area.')
    return new AreaCoordinator(area, {
      now: () => Date.now(), uuid: () => crypto.randomUUID(),
      accept: (socket: PresenceSocket) => this.ctx.acceptWebSocket(socket as WebSocket),
      save: (value) => this.ctx.storage.kv.put(CHECKPOINT_KEY, value),
      routeChat: (sender, message) => { this.#pendingChats.push({ sender, message }) },
      isBlocked: (blockerPlayerId, blockedPublicId) => this.#socialProfiles.get(blockerPlayerId)?.blockedPublicIds.includes(blockedPublicId) ?? false,
      removeSocial: (playerId) => { this.#socialProfiles.delete(playerId); this.#lastMovementAck.delete(playerId); this.#saveSocialProfiles() },
      diagnostic: (event, fields) => console.info(JSON.stringify({ service: 'area-presence', event, ...fields })),
    }, saved, this.ctx.getWebSockets())
  }
  async #schedule(): Promise<void> {
    const state = this.#tickets()
    const deadlines = [this.#runtime?.nextAlarm(), ...state.pending.map((ticket) => ticket.expiresAt), ...state.reconnect.map((grant) => grant.expiresAt)]
      .filter((value): value is number => typeof value === 'number')
    const next = deadlines.length ? Math.max(Date.now() + 1, Math.min(...deadlines)) : null
    if (next === null) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(next)
  }
  /** Private binding transport, NOT an HTTP authentication scheme or public endpoint.
   * Only admitToArea may construct this request after L3 verifies authorization.
   * WebSocket Responses cannot cross Cloudflare RPC serialization.
   */
  fetch(request: Request): Promise<Response> | Response {
    const path = new URL(request.url).pathname
    if (path === '/movement' && request.method === 'POST') return this.#movementFetch(request)
    if (this.ctx.id.toString() === this.env.AREA_PRESENCE.idFromName(CHAT_DIRECTORY_NAME).toString()) return this.#directoryFetch(request)
    if (path === '/chat-deliver' && request.method === 'POST') return this.#deliver(request)
    if (path === '/chat-revoke' && request.method === 'POST') return this.#revoke(request)
    if (path === '/social-sync' && request.method === 'POST') return this.#syncSocial(request)
    if (path === '/tickets' && request.method === 'POST') return this.#issue(request)
    if (path === '/redeem' && request.method === 'GET' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return this.#redeem(request)
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/connect'
      || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Not found', { status: 404 })
    const scope = request.headers.get('X-CactiGrow-Trusted-Scope')
    if (!scope || new TextEncoder().encode(scope).byteLength > 1024) return new Response('Invalid scope', { status: 403 })
    let input: unknown
    try { input = JSON.parse(scope) } catch { return new Response('Invalid scope', { status: 403 }) }
    return this.#admit(input)
  }
  async #movementFetch(request: Request): Promise<Response> {
    if (!['staging', 'test'].includes(this.env.CACTIGROW_ENVIRONMENT ?? '')) return new Response(null, { status: 404 })
    const raw = await request.text()
    if (raw.length > 4096) return new Response(null, { status: 413 })
    let input: { playerId: string; command: unknown }
    try { input = JSON.parse(raw) } catch { return new Response(null, { status: 400 }) }
    if (!isCanonicalUuid(input?.playerId) || this.ctx.id.toString() !== this.env.AREA_PRESENCE.idFromName(movementOwnerName(input.playerId)).toString()) return new Response(null, { status: 403 })
    return this.ctx.blockConcurrencyWhile(async () => {
      const owner = new MovementOwner({ get: () => this.ctx.storage.kv.get(MOVEMENT_KEY), put: state => this.ctx.storage.kv.put(MOVEMENT_KEY, state) })
      try {
        const result = owner.execute(input.playerId, input.command)
        if ((input.command as { type?: string })?.type === 'move' && !result.accepted && (result.rejections === 1 || result.rejections % 20 === 0)) console.info(JSON.stringify({ service: 'movement-authority', playerId: input.playerId, areaId: result.runtimeAreaId, reason: result.lastRejection, rejections: result.rejections }))
        return Response.json(result)
      } catch { return new Response(null, { status: 409 }) }
    })
  }
  async #syncSocial(request: Request): Promise<Response> {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > 1_000_000) return new Response('Invalid social profile', { status: 413 })
    let input: unknown
    try { input = JSON.parse(text) } catch { return new Response('Invalid social profile', { status: 400 }) }
    if (!isAreaSocialProfile(input)) return new Response('Invalid social profile', { status: 400 })
    return this.ctx.blockConcurrencyWhile(async () => {
      // Bound to a configured Area, including the authenticated player's private Farm.
      const area = this.#runtime?.snapshot().area.areaId
      if (area && !this.#isOwner(area)) return new Response('Invalid Area', { status: 403 })
      this.#socialProfiles.set(input.playerId, input)
      this.#saveSocialProfiles()
      return new Response(null, { status: 204 })
    })
  }
  #saveSocialProfiles(): void { this.ctx.storage.kv.put(SOCIAL_KEY, [...this.#socialProfiles.values()]) }
  #admit(input: unknown): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => {
      if (!isRecord(input) || !this.#isOwner(input.areaId)) return new Response('Invalid scope', { status: 403 })
      this.#runtime ??= this.#create(input.areaId)
      const response = this.#open(input)
      await this.#schedule()
      return response
    })
  }
  #open(input: unknown): Response {
    if (!isRecord(input) || !this.#isOwner(input.areaId) || !this.#runtime) return new Response('Invalid scope', { status: 403 })
    const area = getAreaDefinition(input.areaId)!
    if (this.ctx.getWebSockets().length >= area.populationLimit * 2) return new Response('Unavailable', { status: 503 })
    const pair = new WebSocketPair()
    const result = this.#runtime.admit(input, pair[1])
    if (!result.ok) return Response.json({ code: result.code }, { status: result.code === 'INVALID_SCOPE' ? 403 : 409 })
    return new Response(null, { status: 101, webSocket: pair[0] })
  }
  #tickets(): TicketState {
    const saved: unknown = this.ctx.storage.kv.get(TICKETS_KEY)
    if (saved === undefined) return { v: 1, pending: [], reconnect: [] }
    if (!isTicketState(saved) || saved.pending.some((ticket) => !this.#isOwner(ticket.scope.areaId))
      || saved.reconnect.some((grant) => !this.#isOwner(grant.owner.areaId))) throw new Error('Invalid realtime credential state.')
    return saved
  }
  async #issue(request: Request): Promise<Response> {
    const raw = request.headers.get('X-CactiGrow-Trusted-Scope') ?? ''
    if (new TextEncoder().encode(raw).byteLength > 2048) return new Response('Invalid scope', { status: 403 })
    let input: unknown
    try { input = JSON.parse(raw) } catch { return new Response('Invalid scope', { status: 403 }) }
    if (!isRecord(input)) return new Response('Invalid scope', { status: 403 })
    const { reconnectToken, ...scope } = input
    if (reconnectToken !== undefined && !isRealtimeCredential(reconnectToken)) return new Response('Invalid scope', { status: 403 })
    const ticket = newCredential(), nextReconnect = newCredential()
    const [hash, reconnectHash, previousHash] = await Promise.all([credentialHash(ticket), credentialHash(nextReconnect),
      reconnectToken === undefined ? Promise.resolve(undefined) : credentialHash(reconnectToken)])
    return this.ctx.blockConcurrencyWhile(async () => {
      const area = getAreaDefinition(scope.areaId), now = Date.now()
      if (!area || !this.#isOwner(scope.areaId) || !isTrustedAdmission(scope, area, now) || scope.replace || scope.recentLayerId
        || scope.authorizationExpiresAt > now + CONNECTION_TTL_MS) return new Response('Invalid scope', { status: 403 })
      this.#runtime ??= this.#create(area.areaId)
      this.#runtime.sweep()
      const state = pruneTickets(this.#tickets(), now)
      const member = this.#runtime.snapshot().members.find((value) => value.playerId === scope.playerId)
      const grant = state.reconnect.find((value) => value.owner.playerId === scope.playerId && value.hash === previousHash)
      if (previousHash && !grant) return new Response('Invalid reconnect', { status: 403 })
      if (member && (!grant || !sameOwner(member, grant.owner))) return new Response('Presence already active', { status: 409 })
      state.pending = state.pending.filter((value) => value.scope.playerId !== scope.playerId)
      if (state.pending.length >= MAX_CREDENTIAL_RECORDS) return new Response('Unavailable', { status: 503 })
      const expiresAt = Math.min(now + TICKET_TTL_MS, scope.authorizationExpiresAt)
      state.pending.push({ hash, reconnectHash, expiresAt, scope: { ...scope, ...(member ? { replace: membershipKey(member) } : {}) } })
      this.ctx.storage.kv.put(TICKETS_KEY, state)
      await this.#schedule()
      return Response.json({ v: 1, areaId: area.areaId, socketPath: `/api/v1/realtime/areas/${area.areaId}`, ticket,
        expiresAt: new Date(expiresAt).toISOString(), reconnectToken: nextReconnect,
        authorizationExpiresAt: new Date(scope.authorizationExpiresAt).toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
    })
  }
  async #redeem(request: Request): Promise<Response> {
    const response = await this.#redeemLocked(request)
    if (response.status === 101) await this.#updateDirectory()
    return response
  }
  async #redeemLocked(request: Request): Promise<Response> {
    const ticket = request.headers.get('X-CactiGrow-Ticket'), areaId = request.headers.get('X-CactiGrow-Area')
    if (!isRealtimeCredential(ticket) || !this.#isOwner(areaId)) return new Response('Invalid ticket', { status: 401 })
    const hash = await credentialHash(ticket)
    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now(), state = pruneTickets(this.#tickets(), now)
      const pending = state.pending.find((value) => value.hash === hash && value.scope.areaId === areaId)
      if (!pending) return new Response('Invalid ticket', { status: 401 })
      // Burning the ticket and committing L2 ownership share one synchronous gated transition.
      state.pending = state.pending.filter((value) => value !== pending)
      if (state.reconnect.length >= MAX_CREDENTIAL_RECORDS && !state.reconnect.some((value) => value.owner.playerId === pending.scope.playerId)) {
        const active = this.#runtime?.snapshot().members ?? []
        // Expired/disconnected sessions do not reserve storage capacity against active players.
        state.reconnect = state.reconnect.filter((grant) => active.some((member) => sameOwner(member, grant.owner)))
      }
      this.ctx.storage.kv.put(TICKETS_KEY, state)
      if (state.reconnect.length >= MAX_CREDENTIAL_RECORDS && !state.reconnect.some((value) => value.owner.playerId === pending.scope.playerId)) return new Response('Unavailable', { status: 409 })
      this.#runtime ??= this.#create(areaId)
      const response = this.#open(pending.scope)
      if (response.status === 101) {
        const member = this.#runtime.snapshot().members.find((value) => value.playerId === pending.scope.playerId)!
        state.reconnect = state.reconnect.filter((value) => value.owner.playerId !== member.playerId)
        state.reconnect.push({ hash: pending.reconnectHash, owner: membershipKey(member), expiresAt: pending.scope.authorizationExpiresAt })
        this.ctx.storage.kv.put(TICKETS_KEY, state)
        response.headers.set('Sec-WebSocket-Protocol', REALTIME_SUBPROTOCOL)
      }
      await this.#schedule()
      return response
    })
  }
  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const chats = await this.ctx.blockConcurrencyWhile(async () => {
      if (this.#runtime) {
        const scope = ['staging', 'test'].includes(this.env.CACTIGROW_ENVIRONMENT ?? '') ? this.#runtime.movementScope(socket, message) : null
        if (scope) {
          const parsed = typeof message === 'string' ? parseClientMessageText(message) : null
          if (parsed?.ok && parsed.message.type === 'move') {
            const stub = this.env.AREA_PRESENCE.get(this.env.AREA_PRESENCE.idFromName(movementOwnerName(scope.playerId)))
            const response = await stub.fetch(new Request('https://movement.internal/movement', { method: 'POST', body: JSON.stringify({ playerId: scope.playerId, command: { type: 'move', runtimeAreaId: scope.areaId, position: parsed.message.position } }) }))
            const authority: unknown = response.ok ? await response.json() : null
            if (!isMovementAuthorityV1(authority)) { this.#runtime.movementUnavailable(socket); return [] }
            if (!authority.accepted || Date.now() - (this.#lastMovementAck.get(scope.playerId) ?? 0) >= 500) {
              this.#runtime.movementAuthority(socket, authority); this.#lastMovementAck.set(scope.playerId, Date.now())
            }
            if (!authority.accepted) { this.#runtime.rejectMovement(socket); return [] }
          }
        }
        this.#runtime.message(socket, message)
      }
      else socket.close(1008, 'Missing Area state')
      const chats = this.#pendingChats.splice(0)
      await this.#schedule()
      return chats
    })
    // Never await cross-object callbacks under an Area's concurrency gate.
    if (chats.length || typeof message === 'string' && message.includes('"ping"')) await this.#updateDirectory()
    for (const chat of chats) {
      const profile = this.#socialProfiles.get(chat.sender.playerId)
      let delivered = false
      try {
        const response = await this.#directoryStub().fetch(new Request('https://chat.internal/route', { method: 'POST', body: JSON.stringify({ sender: this.#peer(chat.sender), message: chat.message, blockedPublicIds: profile?.blockedPublicIds ?? [] }) }))
        delivered = response.ok && (await response.json() as { delivered: boolean }).delivered
      } catch { /* Failure is visible; never synthesize a delivered DM. */ }
      if (!delivered) this.#runtime?.chatUnavailable(chat.sender.playerId)
    }
  }
  webSocketClose(socket: WebSocket): Promise<void> { return this.#close(socket) }
  webSocketError(socket: WebSocket): Promise<void> { return this.#close(socket) }
  async #close(socket: WebSocket): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      this.#runtime?.remove(socket)
      await this.#schedule()
    })
    await this.#updateDirectory()
  }
  #directoryStub() { return this.env.AREA_PRESENCE.get(this.env.AREA_PRESENCE.idFromName(CHAT_DIRECTORY_NAME)) }
  #peer(member: Membership): ChatPeer {
    const attachment = this.ctx.getWebSockets().map(s => s.deserializeAttachment()).find(a => isRecord(a) && isRecord(a.member) && a.member.presenceId === member.presenceId) as { lastSeen: number; authorizationExpiresAt: number } | undefined
    return { playerId: member.playerId, publicId: member.publicId, areaId: member.areaId, presenceId: member.presenceId, joinedAt: member.joinedAt,
      expiresAt: attachment ? Math.min(attachment.authorizationExpiresAt, attachment.lastSeen + STALE_AFTER_MS) : 0 }
  }
  async #updateDirectory() {
    if (!this.#runtime) return
    const snapshot = this.#runtime.snapshot()
    const response = await this.#directoryStub().fetch(new Request('https://chat.internal/update', { method: 'POST', body: JSON.stringify({ areaId: snapshot.area.areaId, peers: snapshot.members.map(m => this.#peer(m)) }) }))
    if (!response.ok) throw new Error('Chat directory unavailable.')
  }
  async #deliver(request: Request): Promise<Response> {
    const delivery = await request.json() as ChatDelivery
    const parsed = parseServerMessageText(JSON.stringify({ v: 1, eventSequence: 0, type: 'chat', message: delivery.message }))
    if (!parsed.ok || typeof delivery.senderAreaId !== 'string') return new Response(null, { status: 400 })
    return this.ctx.blockConcurrencyWhile(async () => Response.json({ delivered: this.#runtime?.deliverChat(delivery.message, delivery.senderAreaId, delivery.targetPresenceId, delivery.echo) ?? 0 }))
  }
  async #revoke(request: Request): Promise<Response> {
    const peer = await request.json() as ChatPeer
    return this.ctx.blockConcurrencyWhile(async () => {
      for (const socket of this.ctx.getWebSockets()) {
        const attachment = socket.deserializeAttachment()
        if (isRecord(attachment) && isRecord(attachment.member) && attachment.member.presenceId === peer.presenceId) this.#runtime?.remove(socket, 'replaced')
      }
      await this.#schedule()
      return new Response(null, { status: 204 })
    })
  }
  async #directoryFetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (request.method !== 'POST') return new Response(null, { status: 404 })
    const stored = this.ctx.storage.kv.get<ChatPeer[]>('chat-directory-v2') ?? []
    this.#directory ??= new ChatDirectory({ now: Date.now, save: peers => this.ctx.storage.kv.put('chat-directory-v2', peers),
      deliver: async (areaId, delivery) => {
        const response = await getAreaCoordinator(this.env.AREA_PRESENCE, areaId).fetch(new Request('https://area.internal/chat-deliver', { method: 'POST', body: JSON.stringify(delivery) }))
        return response.ok ? (await response.json() as { delivered: number }).delivered : 0
      }, revoke: async peer => { await getAreaCoordinator(this.env.AREA_PRESENCE, peer.areaId).fetch(new Request('https://area.internal/chat-revoke', { method: 'POST', body: JSON.stringify(peer) })) },
    }, stored)
    if (path === '/update') {
      const input = await request.json() as { areaId: string; peers: ChatPeer[] }
      if (!getAreaDefinition(input.areaId) || !Array.isArray(input.peers) || input.peers.length > 128 || !input.peers.every(isChatPeer)) return new Response(null, { status: 400 })
      await this.#directory.update(input.areaId, input.peers)
      return new Response(null, { status: 204 })
    }
    if (path === '/route') {
      const input = await request.json() as { sender: ChatPeer; message: PublicChatMessageV1; blockedPublicIds: string[] }
      const parsed = parseServerMessageText(JSON.stringify({ v: 1, eventSequence: 0, type: 'chat', message: input.message }))
      if (!isChatPeer(input.sender) || !parsed.ok || !Array.isArray(input.blockedPublicIds) || !input.blockedPublicIds.every(isCanonicalUuid)) return new Response(null, { status: 400 })
      return Response.json({ delivered: await this.#directory.route(input.sender, input.message, input.blockedPublicIds) })
    }
    if (path === '/social-sync') {
      const profile = await request.json() as AreaSocialProfile
      if (!isAreaSocialProfile(profile)) return new Response(null, { status: 400 })
      const peer = this.#directory.current(profile.playerId)
      if (peer) return getAreaCoordinator(this.env.AREA_PRESENCE, peer.areaId).fetch(new Request('https://area.internal/social-sync', { method: 'POST', body: JSON.stringify(profile) }))
      return new Response(null, { status: 204 })
    }
    return new Response(null, { status: 404 })
  }
  alarm(): Promise<void> {
    return this.ctx.blockConcurrencyWhile(async () => {
      this.#runtime?.sweep()
      this.ctx.storage.kv.put(TICKETS_KEY, pruneTickets(this.#tickets(), Date.now()))
      await this.#schedule()
    })
  }
}
