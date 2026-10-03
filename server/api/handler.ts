import type { WorkerEnv } from '../env.ts'
import { ApiError } from './errors.ts'
import { safeSocialReadDiagnostic } from '../player/socialReadDiagnostics.ts'
import { errorResponse } from './response.ts'
import { routeApiRequest, type ApiRouter } from './router.ts'
import {
  createRequestDatabaseContext,
  type RequestDatabaseContextFactory,
} from '../db/client/database.ts'

export interface ApiHandlerOptions {
  router?: ApiRouter
  createRequestId?: () => string
  reportUnexpectedError?: (error: unknown, requestId: string) => void
  createRequestDatabaseContext?: RequestDatabaseContextFactory
}

function reportUnexpectedError(error: unknown, requestId: string) {
  const errorName = error instanceof Error ? error.name : 'UnknownError'
  console.error('Unhandled CactiGrow API error.', { requestId, errorName })
}

export async function handleApiRequest(
  request: Request,
  env: WorkerEnv,
  executionContext?: ExecutionContext,
  options: ApiHandlerOptions = {},
): Promise<Response> {
  const createRequestId = options.createRequestId ?? (() => crypto.randomUUID())
  const requestId = createRequestId()
  const router = options.router ?? routeApiRequest
  const database = (options.createRequestDatabaseContext ?? createRequestDatabaseContext)(env)
  const reporter = options.reportUnexpectedError ?? ((error: unknown, id: string) => {
    reportUnexpectedError(error, id)
    if (env.CACTIGROW_ENVIRONMENT === 'staging' && new URL(request.url).pathname === '/api/v1/me/social' && request.method === 'GET') {
      console.error('Staging Social read diagnostic.', { requestId: id, ...safeSocialReadDiagnostic(error) })
    }
  })

  try {
    return await router({ request, env, executionContext, requestId, database })
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.code, error.message, error.status, requestId)
    }

    reporter(error, requestId)
    const internal = ApiError.internal()
    return errorResponse(internal.code, internal.message, internal.status, requestId)
  } finally {
    try {
      await database.dispose()
    } catch (error) {
      reporter(error, requestId)
    }
  }
}
