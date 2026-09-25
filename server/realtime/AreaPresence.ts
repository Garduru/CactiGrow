import { DurableObject } from 'cloudflare:workers'
import { getAreaDefinition } from '../../shared/realtime/areas.ts'
import { isRecord } from '../../shared/realtime/protocolV1.ts'
import { AreaCoordinator, type PresenceSocket } from './AreaCoordinator.ts'
import { areaCoordinatorName, CHECKPOINT_KEY, type TrustedAdmission } from './runtimeContracts.ts'

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
    const next = this.#runtime?.nextAlarm() ?? null
    if (next === null) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(next)
  }
  /** Private binding transport, NOT an HTTP authentication scheme or public endpoint.
   * Only admitToArea may construct this request after L3 verifies authorization.
   * WebSocket Responses cannot cross Cloudflare RPC serialization.
   */
  fetch(request: Request): Promise<Response> | Response {
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
      const area = getAreaDefinition(input.areaId)!
      // Include closing sockets in the limit; repeated reconnects cannot grow the set indefinitely.
      if (this.ctx.getWebSockets().length >= area.populationLimit * 2) return new Response('Unavailable', { status: 503 })
      const pair = new WebSocketPair()
      const result = this.#runtime.admit(input, pair[1])
      await this.#schedule()
      if (!result.ok) return Response.json({ code: result.code }, { status: result.code === 'INVALID_SCOPE' ? 403 : 409 })
      return new Response(null, { status: 101, webSocket: pair[0] })
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
      await this.#schedule()
    })
  }
}
