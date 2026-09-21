export interface ApiSuccess<T> {
  ok: true
  data: T
  meta: { requestId: string }
}

export interface ApiFailure {
  ok: false
  error: {
    code: string
    message: string
  }
  meta: { requestId: string }
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure
