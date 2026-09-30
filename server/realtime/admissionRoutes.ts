import type { ApiRequestContext } from '../api/router.ts'
import type { AuthenticationConfigurationFactory } from '../auth/authentication.ts'
import { authenticateRequest } from '../auth/authentication.ts'
import { ApiError } from '../api/errors.ts'
import { successResponse } from '../api/response.ts'
import { isRealtimeCredentialsRequestV1, REALTIME_SUBPROTOCOL, TICKET_PROTOCOL_PREFIX, isRealtimeCredential } from '../../shared/api/realtimeCredentialsV1.ts'
import { getAreaDefinition } from '../../shared/realtime/areas.ts'
import { isCanonicalUuid } from '../../shared/realtime/identifiers.ts'
import { areaCoordinatorName } from './runtimeContracts.ts'
import { CONNECTION_TTL_MS } from './admissionTickets.ts'

/** Browser requests never reach the binding unchanged; only these explicit fields cross it. */
export async function routeRealtime(context: ApiRequestContext, readJson: (request: Request) => Promise<unknown>,
  authenticationFactory?: AuthenticationConfigurationFactory): Promise<Response> {
  const { request, env, requestId } = context
  const url = new URL(request.url)
  if (env.CACTIGROW_REALTIME_ENABLED !== 'true' || !env.AREA_PRESENCE) throw ApiError.notFound()
  const origin = request.headers.get('Origin')
  if (!origin || origin !== env.CACTIGROW_REALTIME_ORIGIN || origin !== url.origin || url.search) throw ApiError.forbidden()
  if (url.protocol !== 'https:' && !(['development', 'test'].includes(env.CACTIGROW_ENVIRONMENT)
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw ApiError.forbidden()
  if (url.pathname === '/api/v1/realtime/admission') {
    if (request.method !== 'POST') throw ApiError.methodNotAllowed()
    const player = await authenticateRequest(context, authenticationFactory)
    if (!isCanonicalUuid(player.playerId)) throw ApiError.unauthenticated()
    const input = await readJson(request)
    if (!isRealtimeCredentialsRequestV1(input)) throw ApiError.validation('Invalid realtime admission request.')
    const now = Date.now()
    const sessionExpiry = player.authorizationExpiresAt === undefined && (['development', 'test'].includes(env.CACTIGROW_ENVIRONMENT) || (env.CACTIGROW_ENVIRONMENT === 'production' && player.externalIdentity.provider === 'base44'))
      ? now + CONNECTION_TTL_MS : Date.parse(player.authorizationExpiresAt ?? '')
    if (!Number.isSafeInteger(sessionExpiry) || sessionExpiry <= now) throw ApiError.unauthenticated()
    const stub = env.AREA_PRESENCE.get(env.AREA_PRESENCE.idFromName(areaCoordinatorName(input.areaId)))
    const response = await stub.fetch(new Request('https://area.internal/tickets', { method: 'POST', headers: {
      'X-CactiGrow-Trusted-Scope': JSON.stringify({ areaId: input.areaId, entryPointId: input.entryPointId,
        playerId: player.playerId, authorizationExpiresAt: Math.min(sessionExpiry, now + CONNECTION_TTL_MS),
        ...(input.reconnectToken ? { reconnectToken: input.reconnectToken } : {}) }),
    } }))
    if (response.status === 403) throw ApiError.forbidden()
    if (response.status === 409) throw ApiError.conflict('An active presence requires its reconnect credential.')
    if (!response.ok) throw ApiError.conflict('Realtime admission is temporarily unavailable.')
    return successResponse(await response.json(), requestId)
  }
  const match = /^\/api\/v1\/realtime\/areas\/([a-z0-9-]+)$/.exec(url.pathname)
  const area = match && getAreaDefinition(match[1])
  if (!area) throw ApiError.notFound()
  if (request.method !== 'GET') throw ApiError.methodNotAllowed()
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') throw ApiError.validation('WebSocket upgrade required.')
  const protocols = (request.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((value) => value.trim())
  if (protocols.length !== 2 || protocols[0] !== REALTIME_SUBPROTOCOL || !protocols[1].startsWith(TICKET_PROTOCOL_PREFIX)) throw ApiError.unauthenticated()
  const ticket = protocols[1].slice(TICKET_PROTOCOL_PREFIX.length)
  if (!isRealtimeCredential(ticket)) throw ApiError.unauthenticated()
  const stub = env.AREA_PRESENCE.get(env.AREA_PRESENCE.idFromName(areaCoordinatorName(area.areaId)))
  const response = await stub.fetch(new Request('https://area.internal/redeem', { headers: {
    Upgrade: 'websocket', 'X-CactiGrow-Area': area.areaId, 'X-CactiGrow-Ticket': ticket,
  } }))
  if (response.status === 101) return response
  if (response.status === 401 || response.status === 403) throw ApiError.unauthenticated()
  throw ApiError.conflict('Realtime admission failed; request a new ticket.')
}
