import type { ApiErrorCode } from './errors.ts'
import type {
  ApiFailure as SharedApiFailure,
  ApiSuccess,
} from '../../shared/api/envelope.ts'

export type { ApiSuccess } from '../../shared/api/envelope.ts'

export interface ApiFailure extends Omit<SharedApiFailure, 'error'> {
  error: { code: ApiErrorCode; message: string }
}

function jsonResponse(body: ApiSuccess<unknown> | ApiFailure, status: number, requestId: string): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-request-id': requestId,
    },
  })
}

export function successResponse<T>(data: T, requestId: string, status = 200): Response {
  return jsonResponse({ ok: true, data, meta: { requestId } }, status, requestId)
}

export function errorResponse(code: ApiErrorCode, message: string, status: number, requestId: string): Response {
  return jsonResponse({ ok: false, error: { code, message }, meta: { requestId } }, status, requestId)
}
