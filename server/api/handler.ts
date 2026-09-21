import type { WorkerEnv } from '../env.ts'
import { ApiError } from './errors.ts'
import { errorResponse } from './response.ts'
import { routeApiRequest, type ApiRouter } from './router.ts'

export interface ApiHandlerOptions {
  router?: ApiRouter
  createRequestId?: () => string
  reportUnexpectedError?: (error: unknown, requestId: string) => void
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

  try {
    return await router({ request, env, executionContext, requestId })
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.code, error.message, error.status, requestId)
    }

    const reporter = options.reportUnexpectedError ?? reportUnexpectedError
    reporter(error, requestId)
    const internal = ApiError.internal()
    return errorResponse(internal.code, internal.message, internal.status, requestId)
  }
}
