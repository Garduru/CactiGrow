import type { ApiEnvelope } from '../../../shared/api/envelope.ts'
import {
  isPlayerBootstrapV1,
  type PlayerBootstrapV1,
} from '../../../shared/api/playerBootstrapV1.ts'
import { isPlayerBootstrapV2, type PlayerBootstrapV2 } from '../../../shared/api/playerBootstrapV2.ts'
import { isGardenProjectionV1, type GardenCommandV1, type GardenProjectionV1 } from '../../../shared/api/gardenV1.ts'
import { isCollectPlantResultV1, isPlantCommoditySeedResultV1, isPlantLifecycleProjectionV1, type CollectPlantCommandV1, type CollectPlantResultV1, type PlantCommoditySeedCommandV1, type PlantCommoditySeedResultV1, type PlantLifecycleProjectionV1 } from '../../../shared/api/plantLifecycleV1.ts'
import { isBreedSpecimensResultV2, isPlantBredSeedResultV2, isPlantLifecycleProjectionV2, type BreedSpecimensCommandV2, type BreedSpecimensResultV2, type PlantBredSeedCommandV2, type PlantBredSeedResultV2, type PlantLifecycleProjectionV2 } from '../../../shared/api/plantLifecycleV2.ts'
import { isGrowerAlphaProjectionV1, type GrowerAlphaCommandV1, type GrowerAlphaProjectionV1 } from '../../../shared/api/growerAlphaV1.ts'
import { isCollectPlantResultV3, isPlantBredSeedResultV3, isPlantCommoditySeedResultV3, isPlantLifecycleProjectionV3, type CollectPlantCommandV3, type CollectPlantResultV3, type PlantBredSeedCommandV3, type PlantBredSeedResultV3, type PlantCommoditySeedCommandV3, type PlantCommoditySeedResultV3, type PlantLifecycleProjectionV3 } from '../../../shared/api/plantLifecycleV3.ts'

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
  bootstrap: PlayerBootstrapV1 | PlayerBootstrapV2
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
    return this.getBootstrap('/api/v1/me/bootstrap', isPlayerBootstrapV1, signal)
  }

  async getGrowerBootstrap(signal?: AbortSignal): Promise<PlayerBootstrapResult> {
    return this.getBootstrap('/api/v2/me/bootstrap', isPlayerBootstrapV2, signal)
  }

  private async getBootstrap<T extends PlayerBootstrapV1 | PlayerBootstrapV2>(path: string, validate: (value: unknown) => value is T, signal?: AbortSignal): Promise<{ bootstrap: T; requestId: string }> {
    let response: Response
    try {
      response = await this.request.call(globalThis, endpoint(this.baseUrl, path), {
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

    if (!response.ok || !validate(body.data)) {
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
  async getGarden(signal?: AbortSignal): Promise<GardenProjectionV1> { return this.execute('/api/v1/me/garden', { method: 'GET', signal }, isGardenProjectionV1, 'Garden projection') }
  async mutateGarden(command: GardenCommandV1): Promise<GardenProjectionV1> { return this.execute('/api/v1/me/garden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) }, isGardenProjectionV1, 'Garden projection') }
  async getGrowerAlpha(signal?: AbortSignal): Promise<GrowerAlphaProjectionV1> { return this.execute('/api/v1/me/grower-alpha', { method: 'GET', signal }, isGrowerAlphaProjectionV1, 'Grower Alpha projection') }
  async mutateGrowerAlpha(command: GrowerAlphaCommandV1): Promise<GrowerAlphaProjectionV1> { return this.execute('/api/v1/me/grower-alpha', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) }, isGrowerAlphaProjectionV1, 'Grower Alpha projection') }
  async getPlantLifecycleV3(signal?: AbortSignal): Promise<PlantLifecycleProjectionV3> { return this.execute('/api/v3/me/plant-lifecycle', { method: 'GET', signal }, isPlantLifecycleProjectionV3, 'plant lifecycle V3 projection') }
  async plantCommoditySeedV3(command: PlantCommoditySeedCommandV3, idempotencyKey: string): Promise<PlantCommoditySeedResultV3> { return this.execute('/api/v3/me/plant-lifecycle/commands/plant-commodity-seed', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isPlantCommoditySeedResultV3, 'planting result') }
  async plantBredSeedV3(command: PlantBredSeedCommandV3, idempotencyKey: string): Promise<PlantBredSeedResultV3> { return this.execute('/api/v3/me/plant-lifecycle/commands/plant-bred-seed', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isPlantBredSeedResultV3, 'bred-seed planting result') }
  async collectPlantV3(command: CollectPlantCommandV3, idempotencyKey: string): Promise<CollectPlantResultV3> { return this.execute('/api/v3/me/plant-lifecycle/commands/collect-plant', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isCollectPlantResultV3, 'collection result') }

  async getPlantLifecycleV2(signal?: AbortSignal): Promise<PlantLifecycleProjectionV2> {
    return this.execute('/api/v2/me/plant-lifecycle', { method: 'GET', signal }, isPlantLifecycleProjectionV2, 'plant lifecycle V2 projection')
  }

  async breedSpecimens(command: BreedSpecimensCommandV2, idempotencyKey: string): Promise<BreedSpecimensResultV2> {
    return this.execute('/api/v2/me/plant-lifecycle/commands/breed-specimens', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isBreedSpecimensResultV2, 'breeding result')
  }

  async plantBredSeed(command: PlantBredSeedCommandV2, idempotencyKey: string): Promise<PlantBredSeedResultV2> {
    return this.execute('/api/v2/me/plant-lifecycle/commands/plant-bred-seed', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isPlantBredSeedResultV2, 'bred-seed planting result')
  }

  async plantCommoditySeed(command: PlantCommoditySeedCommandV1, idempotencyKey: string): Promise<PlantCommoditySeedResultV1> {
    return this.execute('/api/v1/me/plant-lifecycle/commands/plant-commodity-seed', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isPlantCommoditySeedResultV1, 'planting result')
  }

  async collectPlant(command: CollectPlantCommandV1, idempotencyKey: string): Promise<CollectPlantResultV1> {
    return this.execute('/api/v1/me/plant-lifecycle/commands/collect-plant', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isCollectPlantResultV1, 'collection result')
  }

  private async execute<T>(path: string, init: RequestInit, validate: (value: unknown) => value is T, label: string): Promise<T> {
    let response: Response
    try { response = await this.request.call(globalThis, endpoint(this.baseUrl, path), { ...init, credentials: 'include', headers: { ...this.getCredentials(), ...init.headers } }) } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new CactiGrowApiError('network', 'Unable to reach the CactiGrow service.') }
    let body: unknown
    try { body = await response.json() } catch { throw new CactiGrowApiError('invalid-response', 'The CactiGrow service returned an invalid response.') }
    if (!isEnvelope(body)) throw new CactiGrowApiError('invalid-response', 'The CactiGrow service returned an invalid response.')
    if (!body.ok) throw new CactiGrowApiError(response.status === 401 ? 'unauthenticated' : 'server', body.error.message, body.meta.requestId)
    if (!response.ok || !validate(body.data)) throw new CactiGrowApiError('invalid-response', `The CactiGrow ${label} is invalid.`, body.meta.requestId)
    return body.data
  }
}
