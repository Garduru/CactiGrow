import assert from 'node:assert/strict'
import test from 'node:test'
import { CactiGrowApiClient, CactiGrowApiError } from './CactiGrowApiClient.ts'
import { createDevelopmentCredentials } from './developmentCredentials.ts'
import { loadPlayerBootstrapState } from '../../app/loadPlayerBootstrapState.ts'
import { resolveDeploymentMode, resolveServerLifecycle } from '../../config/deploymentMode.ts'
import { getHeaderPlayerValues } from '../../components/layout/headerPlayerModel.ts'

const projection = {
  projectionVersion: 1,
  player: {
    playerId: '00000000-0000-4000-8000-00000000000a',
    createdAt: '2026-09-20T10:00:00.000Z',
  },
} as const

function response(body: unknown, status = 200) {
  return Response.json(body, { status })
}

test('valid bootstrap response maps to an authenticated projection result', async () => {
  const client = new CactiGrowApiClient({
    fetch: async () => response({ ok: true, data: projection, meta: { requestId: 'valid-request' } }),
  })

  assert.deepEqual(await client.getPlayerBootstrap(), {
    bootstrap: projection,
    requestId: 'valid-request',
  })
})

test('staging Grower bootstrap validates authoritative fresh HUD values without local fixtures', async () => {
  const grower = {
    projectionVersion: 2,
    player: projection.player,
    grower: {
      profileId: 'grower-alpha-v1', initializedAt: '2026-09-20T10:00:00.000Z',
      starterGrantedAt: '2026-09-20T10:00:00.000Z', tutorialStartedAt: null,
      tutorialCompletedAt: null, skills: { cultivationXp: 0, breedingXp: 0, geneticsXp: 0 }, tokenBalance: 0, version: 1,
    },
  }
  const client = new CactiGrowApiClient({ fetch: async (url) => {
    assert.equal(String(url), '/api/v2/me/bootstrap')
    return response({ ok: true, data: grower, meta: { requestId: 'grower-request' } })
  } })
  assert.deepEqual(await loadPlayerBootstrapState(client, undefined, true), {
    status: 'authenticated', bootstrap: grower, requestId: 'grower-request',
  })
  assert.deepEqual(getHeaderPlayerValues('staging', { cultivationXp: 315, tokens: 1216 }, grower), { cultivationXp: 0, tokens: 0 })
  assert.throws(() => getHeaderPlayerValues('staging', { cultivationXp: 315, tokens: 1216 }, projection))
  const invalid = new CactiGrowApiClient({ fetch: async () => response({ ok: true, data: { ...grower, grower: { ...grower.grower, tokenBalance: 1216, providerSubject: 'spoof' } }, meta: { requestId: 'invalid' } }) })
  await assert.rejects(invalid.getGrowerBootstrap(), (error) => error instanceof CactiGrowApiError && error.kind === 'invalid-response')
})

test('the browser fetch retains its global receiver for bootstrap and lifecycle requests', async () => {
  const lifecycle = { projectionVersion: 1, lifecycleVersion: '0', generatedAt: '2026-09-20T10:00:00.000Z', seedStacks: [], nursery: { slots: ['slot-1','slot-2','slot-3','slot-4','slot-5','slot-6'].map((slotId) => ({ slotId, occupancy: null })) }, ownedSpecimens: [] }
  const receiverSensitiveFetch = function (this: unknown, input: RequestInfo | URL) {
    assert.equal(this, globalThis)
    return Promise.resolve(response({ ok: true, data: String(input).endsWith('/bootstrap') ? projection : lifecycle, meta: { requestId: 'receiver-test' } }))
  } as typeof fetch
  const client = new CactiGrowApiClient({ fetch: receiverSensitiveFetch })
  assert.equal((await client.getPlayerBootstrap()).bootstrap.player.playerId, projection.player.playerId)
  assert.deepEqual(await client.getPlantLifecycle(), lifecycle)
})

test('malformed or expanded bootstrap data is rejected at runtime', async () => {
  for (const data of [
    { projectionVersion: 2, player: projection.player },
    { ...projection, identityProvider: 'development' },
    { ...projection, player: { ...projection.player, subject: 'account-a' } },
    { ...projection, player: { ...projection.player, createdAt: 'not-a-date' } },
  ]) {
    const client = new CactiGrowApiClient({
      fetch: async () => response({ ok: true, data, meta: { requestId: 'invalid-request' } }),
    })

    await assert.rejects(
      client.getPlayerBootstrap(),
      (error) => error instanceof CactiGrowApiError
        && error.kind === 'invalid-response'
        && error.requestId === 'invalid-request',
    )
  }
})

test('401 maps to unauthenticated and propagates the request ID', async () => {
  const client = new CactiGrowApiClient({
    fetch: async () => response({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
      meta: { requestId: 'unauthenticated-request' },
    }, 401),
  })

  await assert.rejects(
    client.getPlayerBootstrap(),
    (error) => error instanceof CactiGrowApiError
      && error.kind === 'unauthenticated'
      && error.requestId === 'unauthenticated-request',
  )
})

test('network and server failures remain distinct typed errors', async () => {
  const networkClient = new CactiGrowApiClient({
    fetch: async () => { throw new Error('connection failed') },
  })
  await assert.rejects(
    networkClient.getPlayerBootstrap(),
    (error) => error instanceof CactiGrowApiError && error.kind === 'network',
  )

  const serverClient = new CactiGrowApiClient({
    fetch: async () => response({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      meta: { requestId: 'server-request' },
    }, 500),
  })
  await assert.rejects(
    serverClient.getPlayerBootstrap(),
    (error) => error instanceof CactiGrowApiError
      && error.kind === 'server'
      && error.requestId === 'server-request',
  )
})

test('bootstrap loader maps valid, unauthenticated, and failed requests to distinct states', async () => {
  const valid = new CactiGrowApiClient({
    fetch: async () => response({ ok: true, data: projection, meta: { requestId: 'state-valid' } }),
  })
  const unauthenticated = new CactiGrowApiClient({
    fetch: async () => response({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
      meta: { requestId: 'state-unauthenticated' },
    }, 401),
  })
  const failed = new CactiGrowApiClient({ fetch: async () => { throw new Error('offline') } })

  assert.deepEqual(await loadPlayerBootstrapState(valid), {
    status: 'authenticated',
    bootstrap: projection,
    requestId: 'state-valid',
  })
  assert.deepEqual(await loadPlayerBootstrapState(unauthenticated), {
    status: 'unauthenticated',
    requestId: 'state-unauthenticated',
  })
  assert.deepEqual(await loadPlayerBootstrapState(failed), {
    status: 'error',
    message: 'Unable to reach the CactiGrow service.',
    requestId: undefined,
  })
})

test('development credentials require an explicit supported account and are disabled in production', () => {
  assert.deepEqual(
    createDevelopmentCredentials(true, '?developmentIdentity=account-a'),
    { 'x-cactigrow-development-identity': 'account-a' },
  )
  assert.equal(createDevelopmentCredentials(true, ''), undefined)
  assert.equal(
    createDevelopmentCredentials(true, '?developmentIdentity=unknown-account'),
    undefined,
  )
  assert.equal(
    createDevelopmentCredentials(false, '?developmentIdentity=account-a'),
    undefined,
  )
})

test('deployment mode is explicit and unknown modes fail to production behavior', () => {
  assert.equal(resolveDeploymentMode('development'), 'development')
  assert.equal(resolveDeploymentMode('staging'), 'staging')
  assert.equal(resolveDeploymentMode('production'), 'production')
  assert.equal(resolveDeploymentMode('unexpected'), 'production')
})

test('staging and production always select server lifecycle while development requires opt-in', () => {
  assert.equal(resolveServerLifecycle('development', ''), false)
  assert.equal(resolveServerLifecycle('development', '?e1Lifecycle=server'), true)
  assert.equal(resolveServerLifecycle('staging', ''), true)
  assert.equal(resolveServerLifecycle('staging', '?e1Lifecycle=local'), true)
  assert.equal(resolveServerLifecycle('production', ''), true)
})

test('lifecycle client validates the six-slot projection', async () => {
  const lifecycle = { projectionVersion: 1, lifecycleVersion: '0', generatedAt: '2026-09-20T10:00:00.000Z', seedStacks: [{ speciesId: 'echinopsis-pachanoi', quantity: 4, version: 1 }], nursery: { slots: ['slot-1','slot-2','slot-3','slot-4','slot-5','slot-6'].map((slotId) => ({ slotId, occupancy: null })) }, ownedSpecimens: [] }
  const client = new CactiGrowApiClient({ fetch: async () => response({ ok: true, data: lifecycle, meta: { requestId: 'lifecycle' } }) })
  assert.deepEqual(await client.getPlantLifecycle(), lifecycle)
})

test('plant command sends intent and idempotency headers without generated outcome fields', async () => {
  let captured: RequestInit | undefined
  const client = new CactiGrowApiClient({ fetch: async (_input, init) => { captured = init; return response({ ok: true, data: { commandId: '30000000-0000-4000-8000-000000000003', lifecycleVersion: '1', seedStack: { speciesId: 'echinopsis-pachanoi', quantity: 3, version: 2 }, slot: { slotId: 'slot-1', occupancy: null } }, meta: { requestId: 'plant' } }) } })
  await client.plantCommoditySeed({ slotId: 'slot-1', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 1 }, '30000000-0000-4000-8000-000000000003')
  const headers = new Headers(captured?.headers)
  assert.equal(headers.get('idempotency-key'), '30000000-0000-4000-8000-000000000003')
  assert.deepEqual(JSON.parse(String(captured?.body)), { slotId: 'slot-1', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 1 })
})

test('V2 client preserves individual bred seeds and sends only parent and seed intent', async () => {
  const seed = { seedId: '10000000-0000-4000-8000-000000000001', cloneLineId: '20000000-0000-4000-8000-000000000002', speciesId: 'echinopsis-pachanoi', parentPlantIds: ['30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004'], parentSpeciesIds: ['echinopsis-pachanoi', 'echinopsis-pachanoi'], isHybrid: false, createdAt: '2026-09-20T10:00:00.000Z', genetics: { vigor: 50, growthSpeed: 50, size: 50, flowering: 50, mutationChance: 1 }, geneticFeatures: [], specialVariants: [] }
  const lifecycle = { projectionVersion: 2, lifecycleVersion: '1', generatedAt: '2026-09-20T10:00:00.000Z', seedStacks: [], bredSeeds: [seed], nursery: { slots: ['slot-1','slot-2','slot-3','slot-4','slot-5','slot-6'].map((slotId) => ({ slotId, occupancy: null })) }, ownedSpecimens: [] }
  const requests: Array<{ path: string; init?: RequestInit }> = []
  const client = new CactiGrowApiClient({ fetch: async (path, init) => {
    requests.push({ path: String(path), init })
    const data = !init || init.method === 'GET' ? lifecycle : String(path).endsWith('breed-specimens')
      ? { commandId: '50000000-0000-4000-8000-000000000005', lifecycleVersion: '2', seed }
      : { commandId: '60000000-0000-4000-8000-000000000006', lifecycleVersion: '3', seedId: seed.seedId, slot: { slotId: 'slot-1', occupancy: null } }
    return response({ ok: true, data, meta: { requestId: 'v2-client' } })
  } })
  assert.deepEqual((await client.getPlantLifecycleV2()).bredSeeds, [seed])
  const breedCommand = { parent1SpecimenId: seed.parentPlantIds[0], parent2SpecimenId: seed.parentPlantIds[1], expectedParent1Version: 2, expectedParent2Version: 2 }
  assert.deepEqual((await client.breedSpecimens(breedCommand, '50000000-0000-4000-8000-000000000005')).seed, seed)
  await client.plantBredSeed({ slotId: 'slot-1', seedId: seed.seedId }, '60000000-0000-4000-8000-000000000006')
  assert.equal(requests[0].path, '/api/v2/me/plant-lifecycle')
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), breedCommand)
  assert.deepEqual(JSON.parse(String(requests[2].init?.body)), { slotId: 'slot-1', seedId: seed.seedId })
  assert.equal(new Headers(requests[1].init?.headers).get('idempotency-key'), '50000000-0000-4000-8000-000000000005')
})

test('V3 lifecycle projects unlocked Nursery capacity and sends expanded-slot intent', async () => {
  const slots = ['slot-1','slot-2','slot-3','slot-4','slot-5','slot-6','slot-7','slot-8'].map((slotId) => ({ slotId, occupancy: null }))
  const lifecycle = { projectionVersion: 3, lifecycleVersion: '4', generatedAt: '2026-09-20T10:00:00.000Z', seedStacks: [{ speciesId: 'echinopsis-pachanoi', quantity: 1, version: 2 }], bredSeeds: [], nursery: { capacity: 8, slots }, ownedSpecimens: [] }
  const requests: Array<{ path: string; init?: RequestInit }> = []
  const client = new CactiGrowApiClient({ fetch: async (path, init) => {
    requests.push({ path: String(path), init })
    const data = init?.method === 'POST'
      ? { commandId: '70000000-0000-4000-8000-000000000007', lifecycleVersion: '5', seedStack: { speciesId: 'echinopsis-pachanoi', quantity: 0, version: 3 }, slot: { slotId: 'slot-7', occupancy: null } }
      : lifecycle
    return response({ ok: true, data, meta: { requestId: 'v3-client' } })
  } })
  assert.equal((await client.getPlantLifecycleV3()).nursery.capacity, 8)
  await client.plantCommoditySeedV3({ slotId: 'slot-7', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 2 }, '70000000-0000-4000-8000-000000000007')
  assert.equal(requests[0]?.path, '/api/v3/me/plant-lifecycle')
  assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), { slotId: 'slot-7', speciesId: 'echinopsis-pachanoi', expectedSeedStackVersion: 2 })
})
