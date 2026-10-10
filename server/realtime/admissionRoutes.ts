import { createMovementPort } from '../movement/movementPort.ts'
import { CHAT_DIRECTORY_NAME } from './ChatDirectory.ts'
import { WorldService } from '../world/WorldService.ts'
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
import { eq } from 'drizzle-orm'
import { playerBlocks, playerProfiles } from '../db/schema/index.ts'
import { StartingExperienceService } from '../starting/StartingExperienceService.ts'

export interface RealtimePlayerSocialProjection {
  displayName: string
  publicId: string
  blockedPublicIds: readonly string[]
}

async function resolveRealtimePlayerSocial(context: ApiRequestContext, playerId: string): Promise<RealtimePlayerSocialProjection | null> {
  const database = await context.database.getDatabase()
  const [profile] = await database.select({ displayName: playerProfiles.displayName, publicId: playerProfiles.publicId }).from(playerProfiles)
    .where(eq(playerProfiles.playerId, playerId)).limit(1)
  if (!profile) return null
  const blocks = await database.select({ publicId: playerProfiles.publicId }).from(playerBlocks)
    .innerJoin(playerProfiles, eq(playerBlocks.blockedPlayerId, playerProfiles.playerId))
    .where(eq(playerBlocks.blockerPlayerId, playerId))
  return { ...profile, blockedPublicIds: blocks.map((block) => block.publicId) }
}

export async function syncRealtimeSocial(context: ApiRequestContext, playerId: string,
  projection?: RealtimePlayerSocialProjection,
  resolveSocial: (context: ApiRequestContext, playerId: string) => Promise<RealtimePlayerSocialProjection | null> = resolveRealtimePlayerSocial): Promise<void> {
  const { env } = context
  if (env.CACTIGROW_REALTIME_ENABLED !== 'true' || !env.AREA_PRESENCE) return
  const profile = projection ?? await resolveSocial(context, playerId)
  if (!profile) throw ApiError.conflict('Choose a character name before entering Town.')
  const stub = env.AREA_PRESENCE.get(env.AREA_PRESENCE.idFromName(CHAT_DIRECTORY_NAME))
  const response = await stub.fetch(new Request('https://area.internal/social-sync', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId, ...profile }) }))
  if (!response.ok) throw ApiError.conflict('Realtime social state is temporarily unavailable.')
}

/** Browser requests never reach the binding unchanged; only these explicit fields cross it. */
export async function routeRealtime(context: ApiRequestContext, readJson: (request: Request) => Promise<unknown>,
  authenticationFactory?: AuthenticationConfigurationFactory,
  resolveSocial: (context: ApiRequestContext, playerId: string) => Promise<RealtimePlayerSocialProjection | null> = resolveRealtimePlayerSocial): Promise<Response> {
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
    const profile = await resolveSocial(context, player.playerId)
    if (!profile) throw ApiError.conflict('Choose a character name before entering Town.')
    const input = await readJson(request)
    if (!isRealtimeCredentialsRequestV1(input)) throw ApiError.validation('Invalid realtime admission request.')
    if (['staging', 'production'].includes(env.CACTIGROW_ENVIRONMENT) || input.worldFoundation || input.areaId !== 'town' && !input.areaId.startsWith('farm-')) {
      if (!input.worldFoundation || !['staging', 'production', 'test'].includes(env.CACTIGROW_ENVIRONMENT)) throw ApiError.forbidden()
      const location = await new WorldService(await context.database.getDatabase(), ['staging', 'production'].includes(env.CACTIGROW_ENVIRONMENT) ? createMovementPort(env) : undefined).read(player.playerId)
      if (input.areaId !== location.runtimeAreaId || input.entryPointId !== location.entryId) throw ApiError.forbidden()
    }
    const now = Date.now()
    const starting = ['staging', 'production'].includes(env.CACTIGROW_ENVIRONMENT) ? await new StartingExperienceService(await context.database.getDatabase()).read(player.playerId) : null
    const appearance = starting && !starting.compatibilityComplete && starting.appearanceComplete ? starting.appearance : undefined
    const sessionExpiry = player.authorizationExpiresAt === undefined && ['development', 'test'].includes(env.CACTIGROW_ENVIRONMENT)
      ? now + CONNECTION_TTL_MS : Date.parse(player.authorizationExpiresAt ?? '')
    if (!Number.isSafeInteger(sessionExpiry) || sessionExpiry <= now) throw ApiError.unauthenticated()
    const stub = env.AREA_PRESENCE.get(env.AREA_PRESENCE.idFromName(areaCoordinatorName(input.areaId)))
    if (input.areaId.startsWith('farm-') && input.areaId !== `farm-${profile.publicId}`) throw ApiError.forbidden()
    const synced = await stub.fetch(new Request('https://area.internal/social-sync', { method: 'POST', body: JSON.stringify({ playerId: player.playerId, ...profile }) }))
    if (!synced.ok) throw ApiError.conflict('Realtime social state is unavailable.')
    const response = await stub.fetch(new Request('https://area.internal/tickets', { method: 'POST', headers: {
      'X-CactiGrow-Trusted-Scope': JSON.stringify({ areaId: input.areaId, entryPointId: input.entryPointId,
        playerId: player.playerId, publicId: profile.publicId, displayName: profile.displayName,
        ...(appearance ? { appearance } : {}),
        authorizationExpiresAt: Math.min(sessionExpiry, now + CONNECTION_TTL_MS),
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
