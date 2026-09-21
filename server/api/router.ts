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
}

async function createPlayerBootstrapService(context: ApiRequestContext) {
  const database = await context.database.getDatabase()
  return new PlayerBootstrapService(new PostgresPlayerBootstrapRepository(database))
}

export function createApiRouter(dependencies: ApiRouterDependencies = {}): ApiRouter {
  return (context) => {
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

    throw ApiError.notFound('API route not found.')
  }
}

export const routeApiRequest = createApiRouter()
