export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'INTERNAL_ERROR'
  | 'INVALID_COMMAND'
  | 'UNKNOWN_SPECIES'
  | 'INVALID_NURSERY_SLOT'
  | 'SEED_STACK_NOT_FOUND'
  | 'SEED_UNAVAILABLE'
  | 'SLOT_OCCUPIED'
  | 'OCCUPANCY_NOT_FOUND'
  | 'SPECIMEN_NOT_FOUND'
  | 'PLANT_NOT_READY'
  | 'STALE_VERSION'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }

  static validation(message = 'The request is invalid.') {
    return new ApiError('VALIDATION_ERROR', 400, message)
  }

  static unauthenticated() {
    return new ApiError('UNAUTHENTICATED', 401, 'Authentication is required.')
  }

  static forbidden() {
    return new ApiError('FORBIDDEN', 403, 'This action is not permitted.')
  }

  static conflict(message = 'The request conflicts with the current state.') {
    return new ApiError('CONFLICT', 409, message)
  }

  static notFound(message = 'The requested resource was not found.') {
    return new ApiError('NOT_FOUND', 404, message)
  }

  static methodNotAllowed() {
    return new ApiError('METHOD_NOT_ALLOWED', 405, 'The request method is not allowed.')
  }

  static internal() {
    return new ApiError('INTERNAL_ERROR', 500, 'An unexpected error occurred.')
  }

  static payloadTooLarge() {
    return new ApiError('PAYLOAD_TOO_LARGE', 413, 'The request body is too large.')
  }

  static unsupportedMediaType() {
    return new ApiError('UNSUPPORTED_MEDIA_TYPE', 415, 'A JSON request body is required.')
  }
}
