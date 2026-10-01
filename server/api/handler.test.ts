import assert from 'node:assert/strict'
import test from 'node:test'
import type { WorkerEnv } from '../env.ts'
import { DEVELOPMENT_IDENTITY_HEADER, DevelopmentIdentityProvider } from '../identity/DevelopmentIdentityProvider.ts'
import type { PlayerIdentityResolver } from '../identity/PlayerIdentityResolver.ts'
import { handleApiRequest } from './handler.ts'
import { createApiRouter } from './router.ts'
import type { ApiFailure, ApiSuccess } from './response.ts'
import { PlayerBootstrapService } from '../player/PlayerBootstrapService.ts'
import type {
  CactiGrowDatabase,
  RequestDatabaseContext,
} from '../db/client/database.ts'
import { PostgresRequestDatabaseContext } from '../db/client/database.ts'
import type { Client } from 'pg'
import { ApiError } from './errors.ts'
import { CloudflareAccessIdentityProvider } from '../identity/CloudflareAccessIdentityProvider.ts'
import { MAX_MUTATION_BODY_BYTES } from './router.ts'
import type { SocialCommandV1, SocialOverviewV1, PublicPlayerProfileV1 } from '../../shared/api/socialV1.ts'

const env = {
  CACTIGROW_ENVIRONMENT: 'development',
  CACTIGROW_VERSION: 'test-build',
} as WorkerEnv

const testOptions = { createRequestId: () => 'request-test-1' }

class TrackingRequestDatabaseContext implements RequestDatabaseContext {
  readonly database: CactiGrowDatabase
  getCount = 0
  acquisitionCount = 0
  disposeCount = 0

  constructor(requestNumber: number) {
    this.database = { requestNumber } as unknown as CactiGrowDatabase
  }

  async getDatabase() {
    this.getCount += 1
    if (this.getCount === 1) this.acquisitionCount += 1
    return this.database
  }

  async dispose() {
    this.disposeCount += 1
  }
}

const testPlayerIdentityResolver: PlayerIdentityResolver = {
  async resolve(identity) {
    const playerId = identity.subject === 'account-a'
      ? '00000000-0000-4000-8000-00000000000a'
      : identity.subject === 'account-b'
        ? '00000000-0000-4000-8000-00000000000b'
        : undefined

    return playerId ? { playerId } : null
  },
}

const testAuthenticatedRouter = createApiRouter({
  authenticationConfigurationFactory: ({ env: workerEnv }) => {
    if (workerEnv.CACTIGROW_ENVIRONMENT === 'production') return null
    return {
      identityProvider: new DevelopmentIdentityProvider(workerEnv.CACTIGROW_ENVIRONMENT),
      createPlayerIdentityResolver: async () => testPlayerIdentityResolver,
    }
  },
  createPlayerBootstrapService: async () => new PlayerBootstrapService({
    async findByPlayerId(playerId) {
      return {
        playerId,
        createdAt: playerId.endsWith('a')
          ? new Date('2026-09-20T10:00:00.000Z')
          : new Date('2026-09-20T11:00:00.000Z'),
      }
    },
  }),
  createPlantLifecycleService: async () => ({
    async getProjection() {
      return { projectionVersion: 1, lifecycleVersion: '0', generatedAt: '2026-09-20T10:00:00.000Z', seedStacks: [], nursery: { slots: ['slot-1','slot-2','slot-3','slot-4','slot-5','slot-6'].map((slotId) => ({ slotId, occupancy: null })) as never }, ownedSpecimens: [] }
    },
    async getProjectionV2() {
      return { projectionVersion: 2, lifecycleVersion: '0', generatedAt: '2026-09-20T10:00:00.000Z', seedStacks: [], bredSeeds: [], nursery: { slots: ['slot-1','slot-2','slot-3','slot-4','slot-5','slot-6'].map((slotId) => ({ slotId, occupancy: null })) as never }, ownedSpecimens: [] }
    },
    async breedSpecimens(_playerId, idempotencyKey, command) {
      return { commandId: idempotencyKey, lifecycleVersion: '1', seed: { seedId: '10000000-0000-4000-8000-000000000001', cloneLineId: '20000000-0000-4000-8000-000000000002', speciesId: 'echinopsis-pachanoi', parentPlantIds: [command.parent1SpecimenId, command.parent2SpecimenId] as [string,string], parentSpeciesIds: ['echinopsis-pachanoi','echinopsis-pachanoi'] as [string,string], isHybrid: false, createdAt: '2026-09-20T10:00:00.000Z', genetics: { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 }, geneticFeatures: [], specialVariants: [] } }
    },
    async plantBredSeed(_playerId, idempotencyKey, command) {
      return { commandId: idempotencyKey, lifecycleVersion: '2', seedId: command.seedId, slot: { slotId: command.slotId, occupancy: null } }
    },
    async plantCommoditySeed(_playerId, idempotencyKey, command) {
      if (!idempotencyKey) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key header is required.')
      return { commandId: idempotencyKey, lifecycleVersion: '1', seedStack: { speciesId: command.speciesId, quantity: 3, version: 2 }, slot: { slotId: command.slotId, occupancy: null } }
    },
    async collectPlant(_playerId, idempotencyKey, command) {
      return { commandId: idempotencyKey, lifecycleVersion: '2', slot: { slotId: command.slotId, occupancy: null }, specimen: { specimenId: command.specimenId, cloneLineId: '10000000-0000-4000-8000-000000000001', speciesId: 'echinopsis-pachanoi', lifecycleStatus: 'owned', plantedAt: '2026-09-20T10:00:00.000Z', collectedAt: '2026-09-20T10:02:00.000Z', genetics: { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 }, geneticFeatures: [], specialVariants: [], geneticRepresentationVersion: 1, visualDerivationVersion: 1, version: 2 } }
    },
  }),
  createSocialService: async () => ({
    async overview(playerId): Promise<SocialOverviewV1> {
      const profile = { publicId: playerId.endsWith('a') ? '00000000-0000-4000-8000-00000000000c' : '00000000-0000-4000-8000-00000000000d',
        displayName: playerId.endsWith('a') ? 'Account A' : 'Account B', joinedAt: '2026-09-20T10:00:00.000Z', collectionCount: 0, breedingCount: 0 }
      return { projectionVersion: 1, ownProfile: profile, friends: [], incomingRequests: [], outgoingRequests: [], blockedPlayers: [] }
    },
    async execute(playerId, command: SocialCommandV1): Promise<SocialOverviewV1> {
      assert.equal(command.type, 'set-display-name')
      const displayName = command.type === 'set-display-name' ? command.displayName.trim() : 'Unknown'
      return { projectionVersion: 1, ownProfile: { publicId: '00000000-0000-4000-8000-00000000000c', displayName,
        joinedAt: '2026-09-20T10:00:00.000Z', collectionCount: 0, breedingCount: 0 }, friends: [], incomingRequests: [], outgoingRequests: [], blockedPlayers: [] }
    },
    async publicProfile(viewerId, publicId): Promise<PublicPlayerProfileV1> {
      assert.ok(viewerId.endsWith('a') || viewerId.endsWith('b'))
      return { projectionVersion: 1, profile: { publicId, displayName: 'Public Player', joinedAt: '2026-09-20T10:00:00.000Z', collectionCount: 2, breedingCount: 1 },
        relationship: { isSelf: false, areFriends: false, request: null, blockedByMe: false, blocksMe: false } }
    },
  }),
})

function authenticatedTestOptions(requestId: string) {
  return {
    createRequestId: () => requestId,
    router: testAuthenticatedRouter,
  }
}

const productionEnv = {
  CACTIGROW_ENVIRONMENT: 'production',
  CACTIGROW_VERSION: 'test-build',
} as WorkerEnv

const stagingEnv = {
  CACTIGROW_ENVIRONMENT: 'staging',
  CACTIGROW_VERSION: 'test-build',
} as WorkerEnv

function developmentIdentityRequest(subject?: string, path = '/api/me') {
  const headers = new Headers()
  if (subject) headers.set(DEVELOPMENT_IDENTITY_HEADER, subject)
  return new Request(`http://localhost${path}`, { headers })
}

test('social profile and own-profile routes derive actor identity and expose only public projection fields', async () => {
  const load = async (subject: string) => {
    const response = await handleApiRequest(developmentIdentityRequest(subject, '/api/v1/me/social'), env, undefined, authenticatedTestOptions(`social-${subject}`))
    assert.equal(response.status, 200)
    return (await response.json() as ApiSuccess<SocialOverviewV1>).data
  }
  const accountA = await load('account-a'), accountB = await load('account-b')
  assert.equal(accountA.ownProfile?.displayName, 'Account A')
  assert.equal(accountB.ownProfile?.displayName, 'Account B')
  assert.equal(Object.hasOwn(accountA.ownProfile!, 'playerId'), false)

  const command = await handleApiRequest(new Request('http://localhost/api/v1/me/social', { method: 'POST',
    headers: { [DEVELOPMENT_IDENTITY_HEADER]: 'account-a', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'set-display-name', displayName: '  Garduru  ' }) }), env, undefined, authenticatedTestOptions('social-name'))
  assert.equal(command.status, 200)
  assert.equal(((await command.json()) as ApiSuccess<SocialOverviewV1>).data.ownProfile?.displayName, 'Garduru')

  const forgedSelf = await handleApiRequest(new Request('http://localhost/api/v1/me/social', { method: 'POST',
    headers: { [DEVELOPMENT_IDENTITY_HEADER]: 'account-a', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'set-display-name', displayName: 'Garduru', playerId: 'account-b' }) }), env, undefined, authenticatedTestOptions('social-forged-self'))
  assert.equal(forgedSelf.status, 400)

  const publicId = '00000000-0000-4000-8000-00000000000e'
  const profile = await handleApiRequest(developmentIdentityRequest('account-a', `/api/v1/players/${publicId}`), env, undefined, authenticatedTestOptions('social-public-profile'))
  assert.equal(profile.status, 200)
  const projected = (await profile.json() as ApiSuccess<PublicPlayerProfileV1>).data
  assert.equal(projected.profile.publicId, publicId)
  assert.equal(Object.hasOwn(projected.profile, 'playerId'), false)
  assert.equal(Object.hasOwn(projected.profile, 'email'), false)

  const anonymous = await handleApiRequest(developmentIdentityRequest(undefined, '/api/v1/me/social'), env, undefined, authenticatedTestOptions('social-anonymous'))
  assert.equal(anonymous.status, 401)
})

async function getMe(subject: string, requestId: string) {
  const response = await handleApiRequest(
    developmentIdentityRequest(subject),
    env,
    undefined,
    authenticatedTestOptions(requestId),
  )
  const body = await response.json() as ApiSuccess<{
    playerId: string
    identityProvider: string
  }>
  return { response, body }
}

test('plant lifecycle projection is authenticated and remains separate from bootstrap', async () => {
  const response = await handleApiRequest(developmentIdentityRequest('account-a', '/api/v1/me/plant-lifecycle'), env, undefined, authenticatedTestOptions('lifecycle-read'))
  const body = await response.json() as ApiSuccess<{ projectionVersion: number; nursery: { slots: unknown[] } }>
  assert.equal(response.status, 200)
  assert.equal(body.data.projectionVersion, 1)
  assert.equal(body.data.nursery.slots.length, 6)
})

test('V2 breeding routes authenticate and reject client-supplied genetic outcomes', async () => {
  const projection = await handleApiRequest(developmentIdentityRequest('account-a', '/api/v2/me/plant-lifecycle'), env, undefined, authenticatedTestOptions('v2-projection'))
  assert.equal(projection.status, 200)
  assert.equal(((await projection.json()) as ApiSuccess<{ projectionVersion: number; bredSeeds: unknown[] }>).data.projectionVersion, 2)
  const anonymous = await handleApiRequest(developmentIdentityRequest(undefined, '/api/v2/me/plant-lifecycle'), env, undefined, authenticatedTestOptions('v2-anonymous'))
  assert.equal(anonymous.status, 401)
  const command = { parent1SpecimenId: '10000000-0000-4000-8000-000000000001', parent2SpecimenId: '20000000-0000-4000-8000-000000000002', expectedParent1Version: 1, expectedParent2Version: 1 }
  const endpoint = 'http://localhost/api/v2/me/plant-lifecycle/commands/breed-specimens'
  const headers = { [DEVELOPMENT_IDENTITY_HEADER]: 'account-a', 'content-type': 'application/json', 'idempotency-key': '30000000-0000-4000-8000-000000000003' }
  const invalid = await handleApiRequest(new Request(endpoint, { method: 'POST', headers, body: JSON.stringify({ ...command, genetics: { vigor: 100 } }) }), env, undefined, authenticatedTestOptions('v2-invalid'))
  assert.equal(invalid.status, 400)
  const valid = await handleApiRequest(new Request(endpoint, { method: 'POST', headers, body: JSON.stringify(command) }), env, undefined, authenticatedTestOptions('v2-valid'))
  assert.equal(valid.status, 200)
  const result = (await valid.json()) as ApiSuccess<{ seed: { parentPlantIds: string[] } }>
  assert.deepEqual(result.data.seed.parentPlantIds, [command.parent1SpecimenId, command.parent2SpecimenId])
  const production = await handleApiRequest(new Request(endpoint, { method: 'POST', headers, body: JSON.stringify(command) }), productionEnv, undefined, authenticatedTestOptions('v2-production'))
  assert.equal(production.status, 401)
})

test('plant command rejects client-generated outcome fields and requires idempotency', async () => {
  const invalid = new Request('http://localhost/api/v1/me/plant-lifecycle/commands/plant-commodity-seed', { method: 'POST', headers: { [DEVELOPMENT_IDENTITY_HEADER]: 'account-a', 'content-type': 'application/json' }, body: JSON.stringify({ slotId: 'slot-1', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 1, specimenId: crypto.randomUUID() }) })
  const invalidResponse = await handleApiRequest(invalid, env, undefined, authenticatedTestOptions('invalid-command'))
  assert.equal(invalidResponse.status, 400)
  const missingKey = new Request('http://localhost/api/v1/me/plant-lifecycle/commands/plant-commodity-seed', { method: 'POST', headers: { [DEVELOPMENT_IDENTITY_HEADER]: 'account-a', 'content-type': 'application/json' }, body: JSON.stringify({ slotId: 'slot-1', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 1 }) })
  const missingKeyResponse = await handleApiRequest(missingKey, env, undefined, authenticatedTestOptions('missing-key'))
  assert.equal(missingKeyResponse.status, 400)
})

test('production rejects development identity on lifecycle routes', async () => {
  const response = await handleApiRequest(developmentIdentityRequest('account-a', '/api/v1/me/plant-lifecycle'), productionEnv, undefined, authenticatedTestOptions('production-lifecycle'))
  assert.equal(response.status, 401)
})

test('GET /api/health returns safe structured health data', async () => {
  const response = await handleApiRequest(
    new Request('http://localhost/api/health'),
    env,
    undefined,
    testOptions,
  )
  const body = await response.json() as ApiSuccess<{
    service: string
    environment: string
    version: string
  }>

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('x-request-id'), 'request-test-1')
  assert.deepEqual(body, {
    ok: true,
    data: {
      service: 'cactigrow-api',
      environment: 'development',
      version: 'test-build',
    },
    meta: { requestId: 'request-test-1' },
  })
})

test('unknown API routes return a structured 404', async () => {
  const response = await handleApiRequest(
    new Request('http://localhost/api/unknown'),
    env,
    undefined,
    testOptions,
  )
  const body = await response.json() as ApiFailure

  assert.equal(response.status, 404)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'NOT_FOUND')
  assert.equal(body.meta.requestId, 'request-test-1')
})

test('L2 exposes no public realtime admission or upgrade route in any environment', async () => {
  for (const environment of ['development', 'test', 'staging', 'production'] as const) {
    const database = new TrackingRequestDatabaseContext(1)
    for (const path of ['/api/v1/realtime/admission', '/api/v1/realtime/areas/town', '/connect']) {
      const response = await handleApiRequest(new Request(`http://localhost${path}`, {
        headers: { Upgrade: 'websocket', 'X-CactiGrow-Trusted-Scope': '{"areaId":"town","playerId":"forged"}' },
      }), { ...env, CACTIGROW_ENVIRONMENT: environment }, undefined, {
        ...testOptions, createRequestDatabaseContext: () => database,
      })
      assert.equal(response.status, 404)
    }
    assert.equal(database.getCount, 0)
  }
})

test('unexpected exceptions return a generic structured 500', async () => {
  const response = await handleApiRequest(
    new Request('http://localhost/api/health'),
    env,
    undefined,
    {
      ...testOptions,
      router: () => { throw new Error('sensitive internal detail') },
      reportUnexpectedError: () => undefined,
    },
  )
  const text = await response.text()
  const body = JSON.parse(text) as ApiFailure

  assert.equal(response.status, 500)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'INTERNAL_ERROR')
  assert.equal(body.error.message, 'An unexpected error occurred.')
  assert.equal(text.includes('sensitive internal detail'), false)
})

test('GET /api/me requires an explicit development identity', async () => {
  const response = await handleApiRequest(
    developmentIdentityRequest(),
    env,
    undefined,
    testOptions,
  )
  const body = await response.json() as ApiFailure

  assert.equal(response.status, 401)
  assert.equal(body.error.code, 'UNAUTHENTICATED')
})

test('unavailable database configuration fails without leaking details', async () => {
  const response = await handleApiRequest(
    developmentIdentityRequest('account-a'),
    env,
    undefined,
    { ...testOptions, reportUnexpectedError: () => undefined },
  )
  const text = await response.text()
  const body = JSON.parse(text) as ApiFailure

  assert.equal(response.status, 500)
  assert.equal(body.error.code, 'INTERNAL_ERROR')
  assert.equal(text.includes('database binding'), false)
  assert.equal(text.includes('HYPERDRIVE'), false)
})

test('development Account A is stable across isolated requests', async () => {
  const first = await getMe('account-a', 'request-account-a-1')
  const second = await getMe('account-a', 'request-account-a-2')

  assert.equal(first.response.status, 200)
  assert.equal(second.response.status, 200)
  assert.equal(first.body.data.playerId, second.body.data.playerId)
  assert.equal(first.body.data.identityProvider, 'development')
  assert.equal(first.body.meta.requestId, 'request-account-a-1')
  assert.equal(second.body.meta.requestId, 'request-account-a-2')
})

test('development Accounts A and B resolve to distinct internal players', async () => {
  const [accountA, accountB] = await Promise.all([
    getMe('account-a', 'request-account-a'),
    getMe('account-b', 'request-account-b'),
  ])

  assert.equal(accountA.response.status, 200)
  assert.equal(accountB.response.status, 200)
  assert.notEqual(accountA.body.data.playerId, accountB.body.data.playerId)
})

test('client-supplied internal player IDs are ignored', async () => {
  const headers = new Headers({
    [DEVELOPMENT_IDENTITY_HEADER]: 'account-a',
    'x-cactigrow-player-id': '00000000-0000-4000-8000-00000000000b',
  })
  const response = await handleApiRequest(
    new Request('http://localhost/api/me', { headers }),
    env,
    undefined,
    authenticatedTestOptions('request-test-1'),
  )
  const body = await response.json() as ApiSuccess<{ playerId: string }>

  assert.equal(response.status, 200)
  assert.equal(body.data.playerId, '00000000-0000-4000-8000-00000000000a')
})

test('invalid and ambiguous development credentials are rejected', async () => {
  for (const subject of ['unknown-account', 'account-a, account-b']) {
    const response = await handleApiRequest(
      developmentIdentityRequest(subject),
      env,
      undefined,
      testOptions,
    )
    const body = await response.json() as ApiFailure

    assert.equal(response.status, 401)
    assert.equal(body.error.code, 'UNAUTHENTICATED')
  }
})

test('production rejects all development identity credentials', async () => {
  for (const subject of [undefined, 'account-a', 'account-b']) {
    const response = await handleApiRequest(
      developmentIdentityRequest(subject),
      productionEnv,
      undefined,
      testOptions,
    )
    const body = await response.json() as ApiFailure

    assert.equal(response.status, 404)
    assert.equal(body.error.code, 'NOT_FOUND')
  }
})

test('development identity provider cannot be constructed for production', () => {
  assert.throws(
    () => new DevelopmentIdentityProvider('production'),
    /only be enabled in development or test/,
  )
  assert.throws(
    () => new DevelopmentIdentityProvider('staging'),
    /only be enabled in development or test/,
  )
})

test('staging rejects development identity and the diagnostic endpoint is absent', async () => {
  const bootstrap = await handleApiRequest(
    developmentIdentityRequest('account-a', '/api/v1/me/bootstrap'),
    stagingEnv,
    undefined,
    testOptions,
  )
  assert.equal(bootstrap.status, 401)

  const diagnostic = await handleApiRequest(
    developmentIdentityRequest('account-a'),
    stagingEnv,
    undefined,
    testOptions,
  )
  assert.equal(diagnostic.status, 404)
})

test('Access identity boundary fails closed without a verifier and ignores identity-like headers', async () => {
  const provider = new CloudflareAccessIdentityProvider()
  const result = await provider.verify({
    getHeader(name) {
      if (name === 'cf-access-jwt-assertion') return 'unverified-token'
      if (name === 'cf-access-authenticated-user-email') return 'someone@example.invalid'
      return null
    },
  })
  assert.equal(result, null)
})

test('mutation requests reject unsupported media types and oversized bodies safely', async () => {
  const path = '/api/v1/me/plant-lifecycle/commands/plant-commodity-seed'
  const unsupported = await handleApiRequest(new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { [DEVELOPMENT_IDENTITY_HEADER]: 'account-a', 'content-type': 'text/plain' },
    body: '{}',
  }), env, undefined, authenticatedTestOptions('unsupported'))
  assert.equal(unsupported.status, 415)

  const oversized = await handleApiRequest(new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { [DEVELOPMENT_IDENTITY_HEADER]: 'account-a', 'content-type': 'application/json' },
    body: JSON.stringify({ padding: 'x'.repeat(MAX_MUTATION_BODY_BYTES) }),
  }), env, undefined, authenticatedTestOptions('oversized'))
  const body = await oversized.json() as ApiFailure
  assert.equal(oversized.status, 413)
  assert.equal(body.error.code, 'PAYLOAD_TOO_LARGE')
})

async function getBootstrap(subject: string | undefined, requestId: string) {
  const response = await handleApiRequest(
    developmentIdentityRequest(subject, '/api/v1/me/bootstrap'),
    env,
    undefined,
    authenticatedTestOptions(requestId),
  )
  const body = await response.json()
  return { response, body }
}

test('GET /api/v1/me/bootstrap requires authentication', async () => {
  for (const subject of [undefined, 'invalid-account']) {
    const { response, body } = await getBootstrap(subject, 'bootstrap-rejected')
    assert.equal(response.status, 401)
    assert.equal((body as ApiFailure).error.code, 'UNAUTHENTICATED')
  }
})

test('bootstrap returns the exact V1 durable player projection without identity or database details', async () => {
  const { response, body } = await getBootstrap('account-a', 'bootstrap-account-a')

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    ok: true,
    data: {
      projectionVersion: 1,
      player: {
        playerId: '00000000-0000-4000-8000-00000000000a',
        createdAt: '2026-09-20T10:00:00.000Z',
      },
    },
    meta: { requestId: 'bootstrap-account-a' },
  })

  const serialized = JSON.stringify(body)
  for (const forbidden of ['identityProvider', 'subject', 'database', 'table', 'HYPERDRIVE']) {
    assert.equal(serialized.includes(forbidden), false)
  }
})

test('independent clients resolve equivalent Account A projections while Account B stays isolated', async () => {
  const [desktopA, phoneA, accountB] = await Promise.all([
    getBootstrap('account-a', 'desktop-request'),
    getBootstrap('account-a', 'phone-request'),
    getBootstrap('account-b', 'account-b-request'),
  ])

  const desktop = desktopA.body as ApiSuccess<{ player: { playerId: string }; projectionVersion: 1 }>
  const phone = phoneA.body as ApiSuccess<{ player: { playerId: string }; projectionVersion: 1 }>
  const other = accountB.body as ApiSuccess<{ player: { playerId: string }; projectionVersion: 1 }>

  assert.deepEqual(desktop.data, phone.data)
  assert.notEqual(desktop.meta.requestId, phone.meta.requestId)
  assert.notEqual(desktop.data.player.playerId, other.data.player.playerId)
})

test('production rejects development credentials for the bootstrap endpoint', async () => {
  const response = await handleApiRequest(
    developmentIdentityRequest('account-a', '/api/v1/me/bootstrap'),
    productionEnv,
    undefined,
    authenticatedTestOptions('production-bootstrap'),
  )
  const body = await response.json() as ApiFailure

  assert.equal(response.status, 401)
  assert.equal(body.error.code, 'UNAUTHENTICATED')
})

test('production cannot activate staging Access identity or starter provisioning', async () => {
  const configuredProduction = {
    ...productionEnv,
    CACTIGROW_ACCESS_TEAM_DOMAIN: 'https://cactigrow-test.cloudflareaccess.com',
    CACTIGROW_ACCESS_AUDIENCE: 'a'.repeat(64),
  } as WorkerEnv
  const request = new Request('http://localhost/api/v1/me/bootstrap', {
    headers: { 'cf-access-jwt-assertion': 'a.signed.access-token', 'cf-access-authenticated-user-email': 'tester@example.invalid' },
  })
  const response = await handleApiRequest(request, configuredProduction, undefined, testOptions)
  const body = await response.json() as ApiFailure
  assert.equal(response.status, 401)
  assert.equal(body.error.code, 'UNAUTHENTICATED')
})

test('Grower onboarding projection requires verified identity and cannot be reached with a spoofed identity header', async () => {
  const path = 'http://localhost/api/v2/me/bootstrap'
  const spoofed = await handleApiRequest(new Request(path, { headers: { 'cf-access-authenticated-user-email': 'tester@example.invalid' } }), stagingEnv, undefined, testOptions)
  assert.equal(spoofed.status, 401)
  const production = await handleApiRequest(new Request(path, { headers: { 'cf-access-jwt-assertion': 'fake' } }), productionEnv, undefined, testOptions)
  assert.equal(production.status, 401)
})

test('consolidated Grower and Garden projections require verified identity and reject spoofed identity headers', async () => {
  for (const path of ['/api/v1/me/grower-alpha', '/api/v1/me/garden']) {
    const spoofed = await handleApiRequest(new Request(`http://localhost${path}`, { headers: { 'cf-access-authenticated-user-email': 'tester@example.invalid' } }), stagingEnv, undefined, testOptions)
    const spoofedBody = await spoofed.json() as ApiFailure
    assert.equal(spoofed.status, 401)
    assert.equal(spoofedBody.error.code, 'UNAUTHENTICATED')
    const production = await handleApiRequest(new Request(`http://localhost${path}`, { headers: { 'cf-access-jwt-assertion': 'fake' } }), productionEnv, undefined, testOptions)
    assert.equal(production.status, 401)
  }
})

test('authentication and bootstrap share one isolated request database context', async () => {
  const contexts: TrackingRequestDatabaseContext[] = []
  const authenticationDatabases: CactiGrowDatabase[] = []
  const bootstrapDatabases: CactiGrowDatabase[] = []
  const router = createApiRouter({
    authenticationConfigurationFactory: (context) => ({
      identityProvider: new DevelopmentIdentityProvider(context.env.CACTIGROW_ENVIRONMENT),
      createPlayerIdentityResolver: async () => {
        authenticationDatabases.push(await context.database.getDatabase())
        return testPlayerIdentityResolver
      },
    }),
    createPlayerBootstrapService: async (context) => {
      bootstrapDatabases.push(await context.database.getDatabase())
      return new PlayerBootstrapService({
        async findByPlayerId(playerId) {
          return { playerId, createdAt: new Date('2026-09-20T10:00:00.000Z') }
        },
      })
    },
  })
  const createContext = () => {
    const context = new TrackingRequestDatabaseContext(contexts.length + 1)
    contexts.push(context)
    return context
  }

  for (const requestId of ['shared-context-1', 'shared-context-2']) {
    const response = await handleApiRequest(
      developmentIdentityRequest('account-a', '/api/v1/me/bootstrap'),
      env,
      undefined,
      {
        router,
        createRequestId: () => requestId,
        createRequestDatabaseContext: createContext,
      },
    )
    assert.equal(response.status, 200)
  }

  assert.equal(contexts.length, 2)
  assert.notEqual(contexts[0]?.database, contexts[1]?.database)
  for (const context of contexts) {
    assert.equal(context.getCount, 2)
    assert.equal(context.acquisitionCount, 1)
    assert.equal(context.disposeCount, 1)
  }
  assert.equal(authenticationDatabases[0], bootstrapDatabases[0])
  assert.equal(authenticationDatabases[1], bootstrapDatabases[1])
  assert.notEqual(authenticationDatabases[0], authenticationDatabases[1])
})

test('request database cleanup runs after route exceptions', async () => {
  const database = new TrackingRequestDatabaseContext(1)
  const reported: unknown[] = []
  const response = await handleApiRequest(
    new Request('http://localhost/api/failure'),
    env,
    undefined,
    {
      router: async (context) => {
        await context.database.getDatabase()
        throw new Error('route failed')
      },
      createRequestDatabaseContext: () => database,
      reportUnexpectedError: (error) => reported.push(error),
    },
  )

  assert.equal(response.status, 500)
  assert.equal(database.acquisitionCount, 1)
  assert.equal(database.disposeCount, 1)
  assert.equal(reported.length, 1)
})

test('request database cleanup runs when authentication fails after acquisition', async () => {
  const database = new TrackingRequestDatabaseContext(1)
  const router = createApiRouter({
    authenticationConfigurationFactory: (context) => ({
      identityProvider: new DevelopmentIdentityProvider(context.env.CACTIGROW_ENVIRONMENT),
      createPlayerIdentityResolver: async () => {
        await context.database.getDatabase()
        return { async resolve() { return null } }
      },
    }),
  })
  const response = await handleApiRequest(
    developmentIdentityRequest('account-a'),
    env,
    undefined,
    { router, createRequestDatabaseContext: () => database },
  )

  assert.equal(response.status, 401)
  assert.equal(database.acquisitionCount, 1)
  assert.equal(database.disposeCount, 1)
})

test('PostgreSQL request context connects once, reuses Drizzle, and ends once', async () => {
  let connectCount = 0
  let endCount = 0
  const fakeClient = {
    async connect() { connectCount += 1 },
    async end() { endCount += 1 },
  } as unknown as Client
  const database = new PostgresRequestDatabaseContext(
    'test-connection-string',
    () => fakeClient,
  )

  const first = await database.getDatabase()
  const second = await database.getDatabase()
  await database.dispose()
  await database.dispose()

  assert.equal(first, second)
  assert.equal(connectCount, 1)
  assert.equal(endCount, 1)
  await assert.rejects(database.getDatabase(), /already been disposed/)
})
