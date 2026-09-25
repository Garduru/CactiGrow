import assert from 'node:assert/strict'
import test from 'node:test'
import { isRealtimeCredentialsRequestV1, isRealtimeCredentialsResponseV1, realtimeSocketProtocols } from '../../shared/api/realtimeCredentialsV1.ts'
import { credentialHash, newCredential, isTicketState, pruneTickets } from './admissionTickets.ts'
import { areaId, playerId } from '../../shared/realtime/identifiers.ts'

test('L3 client contract allows only scoped admission/reconnect fields and same-origin credential-free paths', () => {
  const token = 'a'.repeat(64), request = { v: 1, areaId: 'town', entryPointId: 'farm-arrival' }
  assert.equal(isRealtimeCredentialsRequestV1(request), true)
  assert.equal(isRealtimeCredentialsRequestV1({ ...request, reconnectToken: token }), true)
  for (const patch of [{ reconnectToken: '' }, { reconnectToken: undefined }, { playerId: token }, { replace: {} }, { areaId: 'forest' }]) {
    assert.equal(isRealtimeCredentialsRequestV1({ ...request, ...patch }), false)
  }
  const response = { v: 1, areaId: 'town', socketPath: '/api/v1/realtime/areas/town', ticket: token, reconnectToken: token,
    expiresAt: '2026-09-25T00:00:30.000Z', authorizationExpiresAt: '2026-09-25T00:15:00.000Z' }
  assert.equal(isRealtimeCredentialsResponseV1(response), true)
  for (const patch of [{ ticket: 'invalid' }, { reconnectToken: undefined }, { socketPath: 'wss://evil.example' }, { playerId: token },
    { authorizationExpiresAt: 'invalid' }, { authorizationExpiresAt: '2026-09-25T00:00:00.000Z' }]) {
    assert.equal(isRealtimeCredentialsResponseV1({ ...response, ...patch }), false)
  }
  assert.deepEqual(realtimeSocketProtocols(token), ['cactigrow.v1', `cactigrow.ticket.${token}`])
  assert.throws(() => realtimeSocketProtocols('invalid'))
})

test('Ticket randomness, hashing, expiry boundary and corrupt stored state fail safely', async () => {
  const a = newCredential(), b = newCredential()
  assert.match(a, /^[a-f0-9]{64}$/); assert.notEqual(a, b)
  const hash = await credentialHash(a)
  assert.notEqual(hash, a); assert.equal(await credentialHash(a), hash)
  const state = { v: 1 as const, pending: [], reconnect: [] }
  assert.equal(isTicketState(state), true)
  assert.deepEqual(pruneTickets(state, 1000), state)
  const pending = { hash, reconnectHash: hash, expiresAt: 1000, scope: { areaId: areaId('town'), playerId: playerId('00000000-0000-4000-8000-000000000001'), entryPointId: 'farm-arrival', authorizationExpiresAt: 2000 } }
  assert.equal(isTicketState({ ...state, pending: [pending] }), true)
  assert.equal(pruneTickets({ ...state, pending: [pending] }, 999).pending.length, 1)
  assert.equal(pruneTickets({ ...state, pending: [pending] }, 1000).pending.length, 0)
  for (const invalid of [null, {}, { ...state, v: 2 }, { ...state, pending: [{}] }, { ...state, reconnect: [{}] }, { ...state, secret: 'unexpected' }]) {
    assert.equal(isTicketState(invalid), false)
  }
})
