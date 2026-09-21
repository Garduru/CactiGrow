import { getRuntimeMetadata, type WorkerEnv } from '../env.ts'
import {
  withAuthenticatedPlayer,
  type AuthenticationConfigurationFactory,
} from '../auth/authentication.ts'
import { ApiError } from './errors.ts'
import { successResponse } from './response.ts'

export interface ApiRequestContext {
  request: Request
  env: WorkerEnv
  executionContext?: ExecutionContext
  requestId: string
}

export type ApiRouter = (context: ApiRequestContext) => Response | Promise<Response>

export interface ApiRouterDependencies {
  authenticationConfigurationFactory?: AuthenticationConfigurationFactory
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

    throw ApiError.notFound('API route not found.')
  }
}

export const routeApiRequest = createApiRouter()
