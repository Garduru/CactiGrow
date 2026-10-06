import { MarketplaceService } from '../gameplay/MarketplaceService.ts'
import { SHOP_CATALOG, MAX_SHOP_QUANTITY } from '../gameplay/shopCatalog.ts'
import { getRuntimeMetadata, type WorkerEnv } from '../env.ts'
import {
  withAuthenticatedPlayer,
  type AuthenticationConfigurationFactory,
} from '../auth/authentication.ts'
import { ApiError } from './errors.ts'
import { successResponse } from './response.ts'
import { PostgresPlayerBootstrapRepository } from '../db/repositories/PostgresPlayerBootstrapRepository.ts'
import { PlayerBootstrapService } from '../player/PlayerBootstrapService.ts'
import type { RequestDatabaseContext } from '../db/client/database.ts'
import { PlantLifecycleService, type PlantLifecycleApplication } from '../gameplay/PlantLifecycleService.ts'
import { isCollectPlantCommandV1, isPlantCommoditySeedCommandV1 } from '../../shared/api/plantLifecycleV1.ts'
import { isBreedSpecimensCommandV2, isPlantBredSeedCommandV2 } from '../../shared/api/plantLifecycleV2.ts'
import { isGardenCommandV1, type GardenCommandV1 } from '../../shared/api/gardenV1.ts'
import { GardenService } from '../gameplay/GardenService.ts'
import { isGrowerAlphaCommandV1 } from '../../shared/api/growerAlphaV1.ts'
import { GrowerAlphaService } from '../gameplay/GrowerAlphaService.ts'
import { isCollectPlantCommandV3, isPlantBredSeedCommandV3, isPlantCommoditySeedCommandV3 } from '../../shared/api/plantLifecycleV3.ts'
import { routeRealtime, syncRealtimeSocial, type RealtimePlayerSocialProjection } from '../realtime/admissionRoutes.ts'
import { SocialService } from '../player/SocialService.ts'
import { isSocialCommandV1, type SocialCommandV1 } from '../../shared/api/socialV1.ts'
import { isCanonicalUuid } from '../../shared/realtime/identifiers.ts'
import { assertDevToolsEnvironment } from '../development/devToolsGate.ts'
import { DevToolsService } from '../development/DevToolsService.ts'
import { isDevCommand } from '../../shared/api/devToolsV1.ts'
import { routeAdmin } from '../admin/routes.ts'
import { readPlayerAuthorityRevision } from '../gameplay/playerAuthorityRevision.ts'
import { MailService } from '../player/MailService.ts'
import { isMailCommand } from '../../shared/api/mailV1.ts'
import { WorldService } from '../world/WorldService.ts'
import { StartingExperienceService } from '../starting/StartingExperienceService.ts'
import { isStartingCommand } from '../../shared/api/startingExperienceV1.ts'

export interface ApiRequestContext {
  request: Request
  env: WorkerEnv
  executionContext?: ExecutionContext
  requestId: string
  database: RequestDatabaseContext
}

export type ApiRouter = (context: ApiRequestContext) => Response | Promise<Response>

export interface ApiRouterDependencies {
  authenticationConfigurationFactory?: AuthenticationConfigurationFactory
  createPlayerBootstrapService?: (context: ApiRequestContext) => Promise<PlayerBootstrapService>
  createPlantLifecycleService?: (context: ApiRequestContext) => Promise<PlantLifecycleApplication>
  createSocialService?: (context: ApiRequestContext) => Promise<Pick<SocialService, 'overview' | 'execute' | 'publicProfile' | 'search'>>
  resolveRealtimePlayerSocial?: (context: ApiRequestContext, playerId: string) => Promise<RealtimePlayerSocialProjection | null>
}

async function createPlayerBootstrapService(context: ApiRequestContext) {
  const database = await context.database.getDatabase()
  return new PlayerBootstrapService(new PostgresPlayerBootstrapRepository(database))
}

async function createPlantLifecycleService(context: ApiRequestContext) {
  const database = await context.database.getDatabase()
  return new PlantLifecycleService(database, { environment: getRuntimeMetadata(context.env).environment })
}

async function createSocialService(context: ApiRequestContext) {
  return new SocialService(await context.database.getDatabase())
}

export const MAX_MUTATION_BODY_BYTES = 24 * 1024

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) throw ApiError.unsupportedMediaType()

  const declaredLength = request.headers.get('content-length')
  if (declaredLength) {
    const parsedLength = Number(declaredLength)
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) throw ApiError.validation('The Content-Length header is invalid.')
    if (parsedLength > MAX_MUTATION_BODY_BYTES) throw ApiError.payloadTooLarge()
  }

  const reader = request.body?.getReader()
  if (!reader) throw ApiError.validation('The JSON request body is invalid.')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_MUTATION_BODY_BYTES) {
        await reader.cancel()
        throw ApiError.payloadTooLarge()
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw ApiError.validation('The JSON request body is invalid.')
  }
}

export function createApiRouter(dependencies: ApiRouterDependencies = {}): ApiRouter {
  return async (context) => {
    const { request, env, requestId } = context
    const url = new URL(request.url)
    if (url.pathname === '/api/v1/me/starting-experience') {
      if (!['staging', 'test'].includes(env.CACTIGROW_ENVIRONMENT)) throw ApiError.notFound()
      if (request.method !== 'GET' && request.method !== 'POST') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = new StartingExperienceService(await context.database.getDatabase())
        if (request.method === 'GET') return successResponse(await service.read(player.playerId), requestId)
        const command = await readJson(request)
        if (!isStartingCommand(command)) throw ApiError.validation('Invalid tutorial command.')
        return successResponse(await service.execute(player.playerId, command), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }
    if (url.pathname === '/api/v1/me/world') {
      if (!['staging', 'test'].includes(env.CACTIGROW_ENVIRONMENT)) throw ApiError.notFound()
      if (request.method !== 'GET' && request.method !== 'POST') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = new WorldService(await context.database.getDatabase())
        if (request.method === 'GET') return successResponse(await service.read(player.playerId), requestId)
        const raw = await readJson(request)
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw ApiError.validation('Invalid exit command.')
        const c = raw as Record<string, unknown>
        const keys = Object.keys(c).sort().join(',')
        const destination = keys === 'commandId,exitId,expectedRevision,v' ? c.exitId : keys === 'commandId,expectedRevision,travelDestinationId,v' ? c.travelDestinationId : undefined
        if (c.v !== 1 || !isCanonicalUuid(c.commandId) || typeof destination !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(destination)
          || !Number.isSafeInteger(c.expectedRevision) || (c.expectedRevision as number) < 0) throw ApiError.validation('Invalid world command.')
        return successResponse(await service.transition(player.playerId, c as unknown as import('../world/WorldService.ts').ExitCommand | import('../world/WorldService.ts').TravelCommand), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }
    if (url.pathname === '/api/v1/me/mail' || url.pathname === '/api/v1/me/mail/count') {
      if (request.method !== 'GET' && request.method !== 'POST') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = new MailService(await context.database.getDatabase())
        if (url.pathname.endsWith('/count')) {
          if (request.method !== 'GET') throw ApiError.methodNotAllowed()
          return successResponse(await service.unreadCount(player.playerId), requestId)
        }
        if (request.method === 'POST') {
          const command = await readJson(request)
          if (!isMailCommand(command)) throw ApiError.validation('Invalid mail command.')
          return successResponse(await service.execute(player.playerId, command), requestId)
        }
        const inboxOffset = Number(url.searchParams.get('inboxOffset') ?? 0), sentOffset = Number(url.searchParams.get('sentOffset') ?? 0)
        if (![inboxOffset, sentOffset].every(v => Number.isSafeInteger(v) && v >= 0 && v <= 10000)) throw ApiError.validation('Invalid mailbox page.')
        return successResponse(await service.mailbox(player.playerId, inboxOffset, sentOffset), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }
    if (url.pathname.startsWith('/api/v1/admin/')) return routeAdmin(context, readJson, dependencies.authenticationConfigurationFactory)
    if (url.pathname.startsWith('/api/v1/dev/')) {
      assertDevToolsEnvironment(env, request.url)
      return withAuthenticatedPlayer(context, async ({ player }) => {
        if (url.pathname === '/api/v1/dev/session') {
          if (request.method !== 'GET') throw ApiError.methodNotAllowed()
          return successResponse({ ...getRuntimeMetadata(env), playerId: player.playerId }, requestId)
        }
        const service = new DevToolsService(await context.database.getDatabase(), getRuntimeMetadata(env).environment)
        if (url.pathname === '/api/v1/dev/commands') {
          if (request.method !== 'POST') throw ApiError.methodNotAllowed()
          const body = await readJson(request)
          if (!isDevCommand(body)) throw ApiError.validation('Invalid development command.')
          return successResponse(await service.execute(player.playerId, body), requestId)
        }
        if (url.pathname === '/api/v1/dev/specimen') {
          if (request.method !== 'GET') throw ApiError.methodNotAllowed()
          const id = url.searchParams.get('id') ?? ''
          if (!isCanonicalUuid(id)) throw ApiError.validation('Invalid specimen ID.')
          return successResponse(await service.specimen(player.playerId, id), requestId)
        }
        throw ApiError.notFound('API route not found.')
      }, dependencies.authenticationConfigurationFactory)
    }
    if (url.pathname.startsWith('/api/v1/realtime/')) return routeRealtime(context, readJson,
      dependencies.authenticationConfigurationFactory, dependencies.resolveRealtimePlayerSocial)

    if (url.pathname === '/api/health') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      const runtime = getRuntimeMetadata(env)
      return successResponse({
        service: 'cactigrow-api',
        environment: runtime.environment,
        version: runtime.version,
      }, requestId)
    }

    if (url.pathname === '/api/me') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      if (getRuntimeMetadata(env).environment !== 'development') throw ApiError.notFound('API route not found.')

      return withAuthenticatedPlayer(context, ({ player }) => successResponse({
        playerId: player.playerId,
        identityProvider: player.externalIdentity.provider,
      }, requestId), dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/bootstrap') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()

      return withAuthenticatedPlayer(context, async ({ player }) => {
        const createService = dependencies.createPlayerBootstrapService
          ?? createPlayerBootstrapService
        const service = await createService(context)
        const projection = await service.getForPlayer(player.playerId)
        return successResponse(projection, requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v2/me/bootstrap') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      if (!['development', 'staging', 'production'].includes(getRuntimeMetadata(env).environment)) throw ApiError.notFound('API route not found.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlayerBootstrapService ?? createPlayerBootstrapService)(context)
        return successResponse(await service.getGrowerForPlayer(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/social') {
      if (request.method !== 'GET' && request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = request.method === 'POST' ? await readJson(request) : null
      if (request.method === 'POST' && !isSocialCommandV1(body)) throw new ApiError('INVALID_COMMAND', 400, 'The social command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createSocialService ?? createSocialService)(context)
        if (request.method === 'POST') {
          const command = body as SocialCommandV1
          const projection = await service.execute(player.playerId, command)
          if (['set-display-name', 'block-player', 'unblock-player'].includes(command.type)) await syncRealtimeSocial(context, player.playerId)
          return successResponse(projection, requestId)
        }
        return successResponse(await service.overview(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/players/search') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createSocialService ?? createSocialService)(context)
        return successResponse(await service.search(player.playerId, url.searchParams.get('q') ?? ''), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    const publicProfileMatch = /^\/api\/v1\/players\/([0-9a-f-]{36})$/.exec(url.pathname)
    if (publicProfileMatch) {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      if (!isCanonicalUuid(publicProfileMatch[1])) throw ApiError.notFound('Player profile not found.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createSocialService ?? createSocialService)(context)
        return successResponse(await service.publicProfile(player.playerId, publicProfileMatch[1]), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/garden') {
      if (!['development', 'staging', 'production'].includes(getRuntimeMetadata(env).environment)) throw ApiError.notFound('API route not found.')
      if (request.method !== 'GET' && request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = request.method === 'POST' ? await readJson(request) : null
      if (request.method === 'POST' && !isGardenCommandV1(body)) throw new ApiError('INVALID_COMMAND', 400, 'The Garden command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = new GardenService(await context.database.getDatabase())
        return successResponse(request.method === 'POST'
          ? await service.execute(player.playerId, body as GardenCommandV1)
          : await service.project(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/shop' || url.pathname === '/api/v1/marketplace') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      const offset = Number(url.searchParams.get('offset') ?? 0)
      if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw ApiError.validation('Invalid Marketplace page.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        if (url.pathname === '/api/v1/shop') return successResponse({ projectionVersion: 1, items: SHOP_CATALOG, maxQuantity: MAX_SHOP_QUANTITY }, requestId)
        return successResponse(await new MarketplaceService(await context.database.getDatabase()).browse(player.playerId, url.searchParams.get('mine') === 'true', offset), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/authority-revision') {
      if (!['development', 'staging', 'production'].includes(getRuntimeMetadata(env).environment)) throw ApiError.notFound('API route not found.')
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => successResponse(
        await readPlayerAuthorityRevision(await context.database.getDatabase(), player.playerId), requestId,
      ), dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/grower-alpha') {
      if (!['development', 'staging', 'production'].includes(getRuntimeMetadata(env).environment)) throw ApiError.notFound('API route not found.')
      if (request.method !== 'GET' && request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = request.method === 'POST' ? await readJson(request) : null
      if (request.method === 'POST' && !isGrowerAlphaCommandV1(body)) throw new ApiError('INVALID_COMMAND', 400, 'The Grower command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = new GrowerAlphaService(await context.database.getDatabase())
        return successResponse(request.method === 'POST'
          ? await service.execute(player.playerId, body as import('../../shared/api/growerAlphaV1.ts').GrowerAlphaCommandV1)
          : await service.project(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/plant-lifecycle') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.getProjection(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v2/me/plant-lifecycle') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.getProjectionV2(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v3/me/plant-lifecycle') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.getProjectionV3(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v3/me/plant-lifecycle/commands/plant-commodity-seed') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = await readJson(request)
      if (!isPlantCommoditySeedCommandV3(body)) throw new ApiError('INVALID_COMMAND', 400, 'The planting command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.plantCommoditySeedV3(player.playerId, request.headers.get('idempotency-key') ?? '', body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v3/me/plant-lifecycle/commands/plant-bred-seed') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = await readJson(request)
      if (!isPlantBredSeedCommandV3(body)) throw new ApiError('INVALID_COMMAND', 400, 'The bred-seed planting command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.plantBredSeedV3(player.playerId, request.headers.get('idempotency-key') ?? '', body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v3/me/plant-lifecycle/commands/collect-plant') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = await readJson(request)
      if (!isCollectPlantCommandV3(body)) throw new ApiError('INVALID_COMMAND', 400, 'The collection command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.collectPlantV3(player.playerId, request.headers.get('idempotency-key') ?? '', body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v2/me/plant-lifecycle/commands/breed-specimens') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = await readJson(request)
      if (!isBreedSpecimensCommandV2(body)) throw new ApiError('INVALID_COMMAND', 400, 'The breeding command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.breedSpecimens(player.playerId, request.headers.get('idempotency-key') ?? '', body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v2/me/plant-lifecycle/commands/plant-bred-seed') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = await readJson(request)
      if (!isPlantBredSeedCommandV2(body)) throw new ApiError('INVALID_COMMAND', 400, 'The bred-seed planting command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.plantBredSeed(player.playerId, request.headers.get('idempotency-key') ?? '', body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/plant-lifecycle/commands/plant-commodity-seed') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = await readJson(request)
      if (!isPlantCommoditySeedCommandV1(body)) throw new ApiError('INVALID_COMMAND', 400, 'The planting command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const key = request.headers.get('idempotency-key') ?? ''
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.plantCommoditySeed(player.playerId, key, body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/plant-lifecycle/commands/collect-plant') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      const body = await readJson(request)
      if (!isCollectPlantCommandV1(body)) throw new ApiError('INVALID_COMMAND', 400, 'The collection command is invalid.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const key = request.headers.get('idempotency-key') ?? ''
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.collectPlant(player.playerId, key, body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    throw ApiError.notFound('API route not found.')
  }
}

export const routeApiRequest = createApiRouter()
