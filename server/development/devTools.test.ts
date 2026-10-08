import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDevToolsEnvironment } from './devToolsGate.ts'
import { isDevCommand } from '../../shared/api/devToolsV1.ts'
import { isStartingResetCommand } from '../../shared/api/startingResetV1.ts'
import { handleApiRequest } from '../api/handler.ts'
import { createApiRouter } from '../api/router.ts'
import type { WorkerEnv } from '../env.ts'

const id = '00000000-0000-4000-8000-000000000001'
const local = { CACTIGROW_ENVIRONMENT: 'development', CACTIGROW_VERSION: 'test', HYPERDRIVE: { connectionString: 'postgresql://user@127.0.0.1:55432/cactigrow_local' } } as WorkerEnv

test('Starting Experience reset requires exact target confirmation and rejects arbitrary patches', () => {
  const command = { commandId: id, targetPlayerId: id, confirmPlayerId: id, mode: 'tutorial' }
  assert.equal(isStartingResetCommand(command), true)
  for (const change of [{ confirmPlayerId: 'wrong' }, { confirmPlayerId: true }, { targetPlayerId: 'bad' }, { commandId: 'bad' }, { actorPlayerId: id }, { deleteAccount: true }, { mode: 'invented' }]) assert.equal(isStartingResetCommand({ ...command, ...change }), false)
})
test('developer surface fails closed for production, public domains, unknown environments and shared remote development data', async () => {
  for (const env of [{ ...local, CACTIGROW_ENVIRONMENT: 'production' }, { ...local, CACTIGROW_ENVIRONMENT: 'test' }, { ...local, CACTIGROW_ENVIRONMENT: 'unknown' }, { ...local, HYPERDRIVE: { connectionString: 'postgresql://user@remote.invalid/cactigrow' } }, { ...local, HYPERDRIVE: undefined }]) {
    let databaseReads = 0, authCalls = 0
    const router = createApiRouter({ authenticationConfigurationFactory: () => { authCalls++; return null } })
    for (const path of ['/api/v1/dev/session', '/api/v1/dev/commands', '/api/v1/dev/starting-experience/reset', `/api/v1/dev/specimen?id=${id}`]) {
      const response = await handleApiRequest(new Request(`https://dev.test${path}`, { method: 'POST', body: '{}' }), env as WorkerEnv, undefined, { router, createRequestDatabaseContext: () => ({ getDatabase: async () => { databaseReads++; throw Error('Must not read database') }, dispose: async () => {} }) })
      assert.equal(response.status, 404)
    }
    assert.equal(databaseReads, 0); assert.equal(authCalls, 0)
  }
  for (const host of ['cactigrow.com', 'www.cactigrow.com']) assert.throws(() => assertDevToolsEnvironment(local, `https://${host}/api/v1/dev/commands`))
  assert.doesNotThrow(() => assertDevToolsEnvironment(local, 'http://localhost:8788/api/v1/dev/commands'))
  assert.doesNotThrow(() => assertDevToolsEnvironment({ ...local, CACTIGROW_ENVIRONMENT: 'staging', CACTIGROW_ACCESS_TEAM_DOMAIN: 'https://access.test', CACTIGROW_ACCESS_AUDIENCE: 'test' } as WorkerEnv, 'https://dev.cactigrow.com/api/v1/dev/commands'))
})
test('local developer routes require verified identity and session returns only safe metadata', async () => {
  const router = createApiRouter({ authenticationConfigurationFactory: () => ({ identityProvider: { verify: async request => request.getHeader('x-test-player') === id ? { provider: 'test', subject: 'private-subject' } : null }, createPlayerIdentityResolver: async () => ({ resolve: async () => ({ playerId: id }) }) }) })
  const options = { router, createRequestDatabaseContext: () => ({ getDatabase: async () => { throw Error('Session does not need database') }, dispose: async () => {} }) }
  for (const path of ['session', 'commands', 'specimen', 'starting-experience/reset']) assert.equal((await handleApiRequest(new Request('http://localhost/api/v1/dev/' + path), local, undefined, options)).status, 401)
  const response = await handleApiRequest(new Request('http://localhost/api/v1/dev/session', { headers: { 'x-test-player': id } }), local, undefined, options)
  assert.equal(response.status, 200)
  const { data } = await response.json() as { data: unknown }
  assert.deepEqual(data, { environment: 'development', version: 'test', playerId: id })
})
test('developer commands reject arbitrary patches, actor IDs, invalid IDs, quantities and unsupported skills', () => {
  const base = { commandId: id, type: 'add-xp', skillId: 'cultivation', amount: 100 }
  assert.equal(isDevCommand(base), true)
  for (const change of [{ playerId: id }, { amount: -1 }, { amount: 1.5 }, { amount: 1_000_001 }, { skillId: 'health' }, { commandId: 'bad' }, { type: 'set-row' }]) assert.equal(isDevCommand({ ...base, ...change }), false)
  for (const amount of [-101, 0, 101, 1.5]) assert.equal(isDevCommand({ commandId: id, type: 'adjust-seeds', speciesId: 'echinopsis-pachanoi', amount }), false)
  assert.equal(isDevCommand({ commandId: id, type: 'advance-growth', specimenId: 'bad', minutes: 'complete' }), false)
})
