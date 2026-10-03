import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleApiRequest } from '../api/handler.ts'
import type { WorkerEnv } from '../env.ts'
import { safeSocialReadDiagnostic, socialRead, SocialReadError } from './socialReadDiagnostics.ts'

test('Social diagnostics preserve nested SQLSTATE and named read without leaking SQL, values or secrets', async () => {
  const pgError = Object.assign(new Error('relation "player_profiles" does not exist'), {
    code: '42P01', query: 'secret SQL', params: ['private identity'], detail: 'private detail', connectionString: 'private URL',
  })
  let captured: unknown
  try { await socialRead('social.profiles', async () => { throw new Error('private wrapper', { cause: pgError }) }) } catch (error) { captured = error }
  assert.deepEqual(safeSocialReadDiagnostic(captured), { operation: 'social.profiles', sqlState: '42P01', relation: 'player_profiles', column: undefined, classification: 'missing-relation' })
  assert.equal(JSON.stringify(safeSocialReadDiagnostic(captured)).includes('private'), false)
  assert.equal(safeSocialReadDiagnostic({ code: '42501', message: 'permission denied for table friendships' }).classification, 'permission-denied')
  assert.equal(safeSocialReadDiagnostic({ code: '42703', column: 'display_name' }).column, 'display_name')
  assert.equal(safeSocialReadDiagnostic(new SocialReadError('social.projection', new TypeError('private value'))).classification, 'data-shape')
  assert.equal(safeSocialReadDiagnostic({ code: 'INVALID_SECRET', table: 'credentials', column: 'password', message: 'private' }).relation, undefined)
})

test('detailed Social diagnostics are staging GET-only and never enter the client response', async () => {
  const original = console.error
  const calls: unknown[][] = []
  console.error = (...args: unknown[]) => { calls.push(args) }
  try {
    for (const [environment, method, path, expected] of [
      ['staging', 'GET', '/api/v1/me/social', true], ['production', 'GET', '/api/v1/me/social', false],
      ['development', 'GET', '/api/v1/me/social', false], ['staging', 'POST', '/api/v1/me/social', false],
      ['staging', 'GET', '/api/v1/me/bootstrap', false],
    ] as const) {
      calls.length = 0
      const response = await handleApiRequest(new Request(`https://example.test${path}`, { method }), { CACTIGROW_ENVIRONMENT: environment } as WorkerEnv, undefined, {
        router: async () => { throw new SocialReadError('social.profiles', { code: '42P01', message: 'relation "player_profiles" does not exist' }) },
      })
      assert.equal(response.status, 500)
      const body = await response.text()
      assert.equal(body.includes('player_profiles'), false)
      assert.equal(body.includes('42P01'), false)
      assert.equal(calls.some(args => args[0] === 'Staging Social read diagnostic.'), expected)
    }
  } finally { console.error = original }
})
