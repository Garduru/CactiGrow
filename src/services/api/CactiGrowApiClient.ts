import type { ApiEnvelope } from '../../../shared/api/envelope.ts'
import {
  isPlayerBootstrapV1,
  type PlayerBootstrapV1,
} from '../../../shared/api/playerBootstrapV1.ts'
import { isCollectPlantResultV1, isPlantCommoditySeedResultV1, isPlantLifecycleProjectionV1, type CollectPlantCommandV1, type CollectPlantResultV1, type PlantCommoditySeedCommandV1, type PlantCommoditySeedResultV1, type PlantLifecycleProjectionV1 } from '../../../shared/api/plantLifecycleV1.ts'

export type CactiGrowApiErrorKind =
  | 'unauthenticated'
  | 'server'
  | 'network'
  | 'invalid-response'

export class CactiGrowApiError extends Error {
  readonly kind: CactiGrowApiErrorKind
  readonly requestId?: string

  constructor(
    kind: CactiGrowApiErrorKind,
    message: string,
    requestId?: string,
  ) {
    super(message)
    this.name = 'CactiGrowApiError'
    this.kind = kind
    this.requestId = requestId
  }
}

export interface PlayerBootstrapResult {
  bootstrap: PlayerBootstrapV1
  requestId: string
}

export interface CactiGrowApiClientOptions {
  baseUrl?: string
  fetch?: typeof fetch
  getCredentials?: () => HeadersInit | undefined
}

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.ok !== 'boolean') return false
  if (!candidate.meta || typeof candidate.meta !== 'object') return false
  const meta = candidate.meta as Record<string, unknown>
  if (typeof meta.requestId !== 'string' || !meta.requestId) return false

  if (candidate.ok) return 'data' in candidate
  if (!candidate.error || typeof candidate.error !== 'object') return false
  const error = candidate.error as Record<string, unknown>
  return typeof error.code === 'string' && typeof error.message === 'string'
}

export class CactiGrowApiClient {
  private readonly baseUrl: string
  private readonly request: typeof fetch
  private readonly getCredentials: () => HeadersInit | undefined

  constructor(options: CactiGrowApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? ''
    this.request = options.fetch ?? fetch
    this.getCredentials = options.getCredentials ?? (() => undefined)
  }

  async getPlayerBootstrap(signal?: AbortSignal): Promise<PlayerBootstrapResult> {
    let response: Response
    try {
      response = await this.request(endpoint(this.baseUrl, '/api/v1/me/bootstrap'), {
        method: 'GET',
        credentials: 'include',
        headers: this.getCredentials(),
        signal,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new CactiGrowApiError('network', 'Unable to reach the CactiGrow service.')
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new CactiGrowApiError('invalid-response', 'The CactiGrow service returned an invalid response.')
    }

    if (!isEnvelope(body)) {
      throw new CactiGrowApiError('invalid-response', 'The CactiGrow service returned an invalid response.')
    }

    if (!body.ok) {
      const kind = response.status === 401 ? 'unauthenticated' : 'server'
      throw new CactiGrowApiError(kind, body.error.message, body.meta.requestId)
    }

    if (!response.ok || !isPlayerBootstrapV1(body.data)) {
      throw new CactiGrowApiError(
        'invalid-response',
        'The CactiGrow bootstrap projection is invalid.',
        body.meta.requestId,
      )
    }

    return { bootstrap: body.data, requestId: body.meta.requestId }
  }

  async getPlantLifecycle(signal?: AbortSignal): Promise<PlantLifecycleProjectionV1> {
    return this.execute('/api/v1/me/plant-lifecycle', { method: 'GET', signal }, isPlantLifecycleProjectionV1, 'plant lifecycle projection')
  }

  async plantCommoditySeed(command: PlantCommoditySeedCommandV1, idempotencyKey: string): Promise<PlantCommoditySeedResultV1> {
    return this.execute('/api/v1/me/plant-lifecycle/commands/plant-commodity-seed', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isPlantCommoditySeedResultV1, 'planting result')
  }

  async collectPlant(command: CollectPlantCommandV1, idempotencyKey: string): Promise<CollectPlantResultV1> {
    return this.execute('/api/v1/me/plant-lifecycle/commands/collect-plant', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isCollectPlantResultV1, 'collection result')
  }

  private async execute<T>(path: string, init: RequestInit, validate: (value: unknown) => value is T, label: string): Promise<T> {
    let response: Response
    try { response = await this.request(endpoint(this.baseUrl, path), { ...init, credentials: 'include', headers: { ...this.getCredentials(), ...init.headers } }) } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new CactiGrowApiError('network', 'Unable to reach the CactiGrow service.') }
    let body: unknown
    try { body = await response.json() } catch { throw new CactiGrowApiError('invalid-response', 'The CactiGrow service returned an invalid response.') }
    if (!isEnvelope(body)) throw new CactiGrowApiError('invalid-response', 'The CactiGrow service returned an invalid response.')
    if (!body.ok) throw new CactiGrowApiError(response.status === 401 ? 'unauthenticated' : 'server', body.error.message, body.meta.requestId)
    if (!response.ok || !validate(body.data)) throw new CactiGrowApiError('invalid-response', `The CactiGrow ${label} is invalid.`, body.meta.requestId)
    return body.data
  }
}
