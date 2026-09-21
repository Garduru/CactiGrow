import type { ApiErrorCode } from './errors.ts'

export interface ApiSuccess<T> {
  ok: true
  data: T
  meta: { requestId: string }
}

export interface ApiFailure {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
  }
  meta: { requestId: string }
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
