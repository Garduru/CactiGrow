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
}

async function createPlayerBootstrapService(context: ApiRequestContext) {
  const database = await context.database.getDatabase()
  return new PlayerBootstrapService(new PostgresPlayerBootstrapRepository(database))
}

async function createPlantLifecycleService(context: ApiRequestContext) {
  const database = await context.database.getDatabase()
  return new PlantLifecycleService(database, { environment: getRuntimeMetadata(context.env).environment })
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
      if (getRuntimeMetadata(env).environment !== 'staging') throw ApiError.notFound('API route not found.')
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlayerBootstrapService ?? createPlayerBootstrapService)(context)
        return successResponse(await service.getGrowerForPlayer(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/garden') {
      if (getRuntimeMetadata(env).environment !== 'staging') throw ApiError.notFound('API route not found.')
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

    if (url.pathname === '/api/v1/me/grower-alpha') {
      if (getRuntimeMetadata(env).environment !== 'staging') throw ApiError.notFound('API route not found.')
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
