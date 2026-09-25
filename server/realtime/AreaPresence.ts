import { DurableObject } from 'cloudflare:workers'
import { getAreaDefinition } from '../../shared/realtime/areas.ts'
import { isRecord } from '../../shared/realtime/protocolV1.ts'
import { AreaCoordinator, type PresenceSocket } from './AreaCoordinator.ts'
import { areaCoordinatorName, CHECKPOINT_KEY, isTrustedAdmission, membershipKey, sameOwner, type TrustedAdmission } from './runtimeContracts.ts'
import { CONNECTION_TTL_MS, TICKET_TTL_MS, TICKETS_KEY, MAX_CREDENTIAL_RECORDS, credentialHash, newCredential, pruneTickets, isTicketState, type TicketState } from './admissionTickets.ts'
import { isRealtimeCredential, REALTIME_SUBPROTOCOL } from '../../shared/api/realtimeCredentialsV1.ts'

export interface RealtimeEnv { AREA_PRESENCE: DurableObjectNamespace<AreaPresence> }

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
  #runtime?: AreaCoordinator

  constructor(ctx: DurableObjectState, env: RealtimeEnv) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
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
  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    return this.ctx.blockConcurrencyWhile(async () => {
      if (this.#runtime) this.#runtime.message(socket, message)
      else socket.close(1008, 'Missing Area state')
      await this.#schedule()
    })
  }
  webSocketClose(socket: WebSocket): Promise<void> { return this.#close(socket) }
  webSocketError(socket: WebSocket): Promise<void> { return this.#close(socket) }
  #close(socket: WebSocket): Promise<void> {
    return this.ctx.blockConcurrencyWhile(async () => {
      this.#runtime?.remove(socket)
      await this.#schedule()
    })
  }
  alarm(): Promise<void> {
    return this.ctx.blockConcurrencyWhile(async () => {
      this.#runtime?.sweep()
      this.ctx.storage.kv.put(TICKETS_KEY, pruneTickets(this.#tickets(), Date.now()))
      await this.#schedule()
    })
  }
}
