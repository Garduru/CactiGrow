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

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) throw ApiError.validation('A JSON request body is required.')
  try { return await request.json() } catch { throw ApiError.validation('The JSON request body is invalid.') }
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

    if (url.pathname === '/api/v1/me/plant-lifecycle') {
      if (request.method !== 'GET') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.getProjection(player.playerId), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/plant-lifecycle/commands/plant-commodity-seed') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const body = await readJson(request)
        if (!isPlantCommoditySeedCommandV1(body)) throw new ApiError('INVALID_COMMAND', 400, 'The planting command is invalid.')
        const key = request.headers.get('idempotency-key') ?? ''
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.plantCommoditySeed(player.playerId, key, body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    if (url.pathname === '/api/v1/me/plant-lifecycle/commands/collect-plant') {
      if (request.method !== 'POST') throw ApiError.methodNotAllowed()
      return withAuthenticatedPlayer(context, async ({ player }) => {
        const body = await readJson(request)
        if (!isCollectPlantCommandV1(body)) throw new ApiError('INVALID_COMMAND', 400, 'The collection command is invalid.')
        const key = request.headers.get('idempotency-key') ?? ''
        const service = await (dependencies.createPlantLifecycleService ?? createPlantLifecycleService)(context)
        return successResponse(await service.collectPlant(player.playerId, key, body), requestId)
      }, dependencies.authenticationConfigurationFactory)
    }

    throw ApiError.notFound('API route not found.')
  }
}

export const routeApiRequest = createApiRouter()
