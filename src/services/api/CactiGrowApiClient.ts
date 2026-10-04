import { isShopCatalogV1, isMarketplaceV1, type ShopCatalogV1, type MarketplaceV1 } from '../../../shared/api/commerceV1.ts'
import { isAdminSession, isAdminPlayer, isAdminInspection, isAdminListing, isAdminAudit, isAdminResult, isAdminRoleEntry, isAdminSpecimen, adminPageValidator, type AdminSession, type AdminMutation, type AdminAction } from '../../../shared/api/adminV1.ts'
import { isDevCommandResult, isDevSpecimenDiagnostics, type DevCommand, type DevCommandResult, type DevSpecimenDiagnostics } from '../../../shared/api/devToolsV1.ts'
import type { ApiEnvelope } from '../../../shared/api/envelope.ts'
import { isPlayerAuthorityRevisionV1, type PlayerAuthorityRevisionV1 } from '../../../shared/api/playerAuthorityRevisionV1.ts'
import { isRealtimeCredentialsResponseV1, type RealtimeCredentialsRequestV1, type RealtimeCredentialsResponseV1 } from '../../../shared/api/realtimeCredentialsV1.ts'
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
import { isPlayerSearchV1, type PlayerSearchV1, isPublicPlayerProfileV1, isSocialOverviewV1, type PublicPlayerProfileV1, type SocialCommandV1, type SocialOverviewV1 } from '../../../shared/api/socialV1.ts'

export type CactiGrowApiErrorKind =
  | 'unauthenticated'
  | 'server'
  | 'network'
  | 'invalid-response'

export class CactiGrowApiError extends Error {
  readonly kind: CactiGrowApiErrorKind
  readonly requestId?: string
  readonly status?: number
  readonly code?: string

  constructor(
    kind: CactiGrowApiErrorKind,
    message: string,
    requestId?: string,
    status?: number,
    code?: string,
  ) {
    super(message)
    this.name = 'CactiGrowApiError'
    this.kind = kind
    this.requestId = requestId
    this.status = status
    this.code = code
  }
}

export interface PlayerBootstrapResult {
  bootstrap: PlayerBootstrapV1 | PlayerBootstrapV2
  requestId: string
}

export interface CactiGrowApiClientOptions {
  baseUrl?: string
  fetch?: typeof fetch
  getCredentials?: () => HeadersInit | undefined | Promise<HeadersInit | undefined>
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
  async getUnreadMailCount(signal?: AbortSignal): Promise<{ unreadCount: number }> {
    return this.execute('/api/v1/me/mail/count', { method: 'GET', signal },
      (v): v is { unreadCount: number } => !!v && typeof v === 'object' && Number.isSafeInteger((v as { unreadCount?: unknown }).unreadCount) && ((v as { unreadCount: number }).unreadCount >= 0), 'unread mail count')
  }
  async getMailbox(signal?: AbortSignal, inboxOffset = 0, sentOffset = 0): Promise<Mailbox> {
    return this.execute(`/api/v1/me/mail?inboxOffset=${inboxOffset}&sentOffset=${sentOffset}`, { method: 'GET', signal }, isMailbox, 'mailbox')
  }
  async mutateMail(command: MailCommand): Promise<{ mailId: string }> {
    return this.execute('/api/v1/me/mail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) },
      isMailReceipt, 'mail receipt')
  }
  private readonly baseUrl: string
  private readonly request: typeof fetch
  private readonly getCredentials: () => HeadersInit | undefined | Promise<HeadersInit | undefined>

  constructor(options: CactiGrowApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? ''
    this.request = options.fetch ?? fetch
    this.getCredentials = options.getCredentials ?? (() => undefined)
  }

  async getDevSession(signal?: AbortSignal): Promise<{ environment: string; version: string; playerId: string }> {
    return this.execute('/api/v1/dev/session', { method: 'GET', signal }, (v): v is { environment: string; version: string; playerId: string } => !!v && typeof v === 'object' && ['environment', 'version', 'playerId'].every(k => typeof (v as Record<string, unknown>)[k] === 'string'), 'developer session')
  }
  async getAdminSession(signal?: AbortSignal): Promise<AdminSession> { return this.execute('/api/v1/admin/me', { method: 'GET', signal }, isAdminSession, 'staff session') }
  async searchAdminPlayers(query: string) { return this.execute(`/api/v1/admin/players/search?q=${encodeURIComponent(query)}`, { method: 'GET' }, adminPageValidator(isAdminPlayer), 'staff player search') }
  async inspectAdminPlayer(id: string) { return this.execute(`/api/v1/admin/players/${encodeURIComponent(id)}`, { method: 'GET' }, isAdminInspection, 'staff player inspection') }
  async inspectAdminSpecimen(id: string) { return this.execute(`/api/v1/admin/specimens/${encodeURIComponent(id)}`, { method: 'GET' }, isAdminSpecimen, 'staff specimen inspection') }
  async getAdminListings(offset = 0, filter = '') { return this.execute(`/api/v1/admin/marketplace?offset=${offset}&filter=${encodeURIComponent(filter)}`, { method: 'GET' }, adminPageValidator(isAdminListing), 'staff listings') }
  async getAdminRoles(offset = 0) { return this.execute(`/api/v1/admin/roles?offset=${offset}`, { method: 'GET' }, adminPageValidator(isAdminRoleEntry), 'staff roles') }
  async getAdminAudit(offset = 0, filters: { actor?: string; target?: string; action?: string } = {}) { return this.execute(`/api/v1/admin/audit?offset=${offset}&${new URLSearchParams(filters)}`, { method: 'GET' }, adminPageValidator(isAdminAudit), 'staff audit') }
  async mutateAdmin(target: string, action: AdminAction, command: AdminMutation) {
    const path = action === 'cancel-listing' ? `/api/v1/admin/marketplace/${encodeURIComponent(target)}/cancel` : `/api/v1/admin/players/${encodeURIComponent(target)}/${action}`
    return this.execute(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) }, isAdminResult, 'staff mutation result')
  }
  async executeDevCommand(command: DevCommand): Promise<DevCommandResult> {
    return this.execute('/api/v1/dev/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) }, isDevCommandResult, 'developer command result')
  }
  async getDevSpecimen(id: string, signal?: AbortSignal): Promise<DevSpecimenDiagnostics> {
    return this.execute(`/api/v1/dev/specimen?id=${encodeURIComponent(id)}`, { method: 'GET', signal }, isDevSpecimenDiagnostics, 'specimen diagnostics')
  }

  async getPlayerBootstrap(signal?: AbortSignal): Promise<PlayerBootstrapResult> {
    return this.getBootstrap('/api/v1/me/bootstrap', isPlayerBootstrapV1, signal)
  }

  async requestRealtimeAdmission(input: RealtimeCredentialsRequestV1, signal?: AbortSignal): Promise<RealtimeCredentialsResponseV1> {
    return this.execute('/api/v1/realtime/admission', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input), signal }, isRealtimeCredentialsResponseV1, 'realtime admission')
  }

  async getGrowerBootstrap(signal?: AbortSignal): Promise<PlayerBootstrapResult> {
    return this.getBootstrap('/api/v2/me/bootstrap', isPlayerBootstrapV2, signal)
  }

  private async getBootstrap<T extends PlayerBootstrapV1 | PlayerBootstrapV2>(path: string, validate: (value: unknown) => value is T, signal?: AbortSignal): Promise<{ bootstrap: T; requestId: string }> {
    const response = await this.fetchResponse(path, { method: 'GET', signal })
    const body = await this.readEnvelope(response)

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
  async getShopCatalog(signal?: AbortSignal): Promise<ShopCatalogV1> { return this.execute('/api/v1/shop', { method: 'GET', signal }, isShopCatalogV1, 'shop catalog') }
  async getMarketplace(mine = false, offset = 0, signal?: AbortSignal): Promise<MarketplaceV1> { return this.execute(`/api/v1/marketplace?mine=${mine}&offset=${offset}`, { method: 'GET', signal }, isMarketplaceV1, 'Marketplace') }
  async getGarden(signal?: AbortSignal): Promise<GardenProjectionV1> { return this.execute('/api/v1/me/garden', { method: 'GET', signal }, isGardenProjectionV1, 'Garden projection') }
  async mutateGarden(command: GardenCommandV1): Promise<GardenProjectionV1> { return this.execute('/api/v1/me/garden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) }, isGardenProjectionV1, 'Garden projection') }
  async getPlayerAuthorityRevision(signal?: AbortSignal): Promise<PlayerAuthorityRevisionV1> { return this.execute('/api/v1/me/authority-revision', { method: 'GET', signal }, isPlayerAuthorityRevisionV1, 'player authority revision') }
  async getGrowerAlpha(signal?: AbortSignal): Promise<GrowerAlphaProjectionV1> { return this.execute('/api/v1/me/grower-alpha', { method: 'GET', signal }, isGrowerAlphaProjectionV1, 'Grower Alpha projection') }
  async mutateGrowerAlpha(command: GrowerAlphaCommandV1): Promise<GrowerAlphaProjectionV1> { return this.execute('/api/v1/me/grower-alpha', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) }, isGrowerAlphaProjectionV1, 'Grower Alpha projection') }
  async searchPlayers(query: string, signal?: AbortSignal): Promise<PlayerSearchV1> {
    return this.execute(`/api/v1/players/search?q=${encodeURIComponent(query.trim())}`, { method: 'GET', signal }, isPlayerSearchV1, 'player search')
  }
  async getSocial(signal?: AbortSignal): Promise<SocialOverviewV1> { return this.execute('/api/v1/me/social', { method: 'GET', signal }, isSocialOverviewV1, 'social projection') }
  async mutateSocial(command: SocialCommandV1): Promise<SocialOverviewV1> { return this.execute('/api/v1/me/social', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(command) }, isSocialOverviewV1, 'social projection') }
  async getPublicPlayerProfile(publicId: string, signal?: AbortSignal): Promise<PublicPlayerProfileV1> {
    return this.execute(`/api/v1/players/${encodeURIComponent(publicId)}`, { method: 'GET', signal }, isPublicPlayerProfileV1, 'player profile')
  }
  async getPlantLifecycleV3(signal?: AbortSignal): Promise<PlantLifecycleProjectionV3> { return this.execute('/api/v3/me/plant-lifecycle', { method: 'GET', signal }, isPlantLifecycleProjectionV3, 'plant lifecycle V3 projection') }
  async plantCommoditySeedV3(command: PlantCommoditySeedCommandV3, idempotencyKey: string): Promise<PlantCommoditySeedResultV3> { return this.execute('/api/v3/me/plant-lifecycle/commands/plant-commodity-seed', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isPlantCommoditySeedResultV3, 'planting result', true) }
  async plantBredSeedV3(command: PlantBredSeedCommandV3, idempotencyKey: string): Promise<PlantBredSeedResultV3> { return this.execute('/api/v3/me/plant-lifecycle/commands/plant-bred-seed', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey }, body: JSON.stringify(command) }, isPlantBredSeedResultV3, 'bred-seed planting result', true) }
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

  private async fetchResponse(path: string, init: RequestInit, retryIdempotentPlant = false): Promise<Response> {
    const url = endpoint(this.baseUrl, path)
    const requestInit: RequestInit = { ...init, credentials: 'include', redirect: 'manual', headers: { ...await this.getCredentials(), ...init.headers } }
    // Only the V3 planting methods opt in. Reuse the identical body and receipt
    // key after a transport failure: the first attempt may already have committed.
    const attempts = retryIdempotentPlant ? 2 : 1
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.request.call(globalThis, url, requestInit)
        if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
          throw new CactiGrowApiError('unauthenticated', 'Your CactiGrow session needs authentication. Reload to sign in again.', undefined, response.status)
        }
        return response
      } catch (error) {
        if (init.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
        if (error instanceof CactiGrowApiError) throw error
        if (attempt + 1 < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 250))
          continue
        }
        throw new CactiGrowApiError('network', 'Unable to reach the CactiGrow service.')
      }
    }
    throw new Error('Unreachable request attempt.')
  }

  private async readEnvelope(response: Response): Promise<ApiEnvelope<unknown> & { ok: true }> {
    let body: unknown
    try { body = await response.json() } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      throw this.unstructuredResponseError(response)
    }
    if (!isEnvelope(body)) throw this.unstructuredResponseError(response)
    if (!body.ok) throw new CactiGrowApiError(response.status === 401 ? 'unauthenticated' : 'server', body.error.message, body.meta.requestId, response.status, body.error.code)
    return body
  }

  private unstructuredResponseError(response: Response): CactiGrowApiError {
    if (response.status === 401 || response.status === 403) return new CactiGrowApiError('unauthenticated', 'Access to CactiGrow was denied. Reload to check your session.', undefined, response.status)
    if (response.status === 429) return new CactiGrowApiError('server', 'Too many requests. Please wait a moment before trying again.', undefined, response.status)
    if (!response.ok) return new CactiGrowApiError('server', `The CactiGrow service returned HTTP ${response.status}. Please try again shortly.`, undefined, response.status)
    return new CactiGrowApiError('invalid-response', 'The CactiGrow service returned an invalid response.', undefined, response.status)
  }

  private async execute<T>(path: string, init: RequestInit, validate: (value: unknown) => value is T, label: string, retryIdempotentPlant = false): Promise<T> {
    const response = await this.fetchResponse(path, init, retryIdempotentPlant)
    const body = await this.readEnvelope(response)
    if (!response.ok || !validate(body.data)) throw new CactiGrowApiError('invalid-response', `The CactiGrow ${label} is invalid.`, body.meta.requestId, response.status)
    return body.data
  }
}
import { isMailbox, isMailReceipt, type Mailbox, type MailCommand } from '../../../shared/api/mailV1.ts'
