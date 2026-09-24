import assert from 'node:assert/strict'
import test from 'node:test'
import { isRealtimeAdmissionRequestV1, isRealtimeAdmissionResponseV1, type RealtimeAdmissionRequestV1, type RealtimeAdmissionResponseV1 } from '../../shared/api/realtimeAdmissionV1.ts'
import { TOWN_AREA } from '../../shared/realtime/areas.ts'

const request: RealtimeAdmissionRequestV1 = { v: 1, areaId: TOWN_AREA.areaId, entryPointId: 'farm-arrival' }
const response: RealtimeAdmissionResponseV1 = { v: 1, areaId: TOWN_AREA.areaId, socketPath: '/api/v1/realtime/areas/town', ticket: 'test-only-ticket', expiresAt: '2026-09-23T00:00:30.000Z' }

test('Admission accepts configured Area entry points and a minimal response', () => {
  for (const entryPointId of Object.keys(TOWN_AREA.entryPoints)) assert.equal(isRealtimeAdmissionRequestV1({ ...request, entryPointId }), true)
  assert.equal(isRealtimeAdmissionResponseV1(response), true)
})
test('Admission rejects unknown Areas, entries, versions, identity claims, and malformed shapes', () => {
  for (const value of [null, [], {}, { ...request, v: 2 }, { ...request, areaId: 'forest' }, { ...request, areaId: '__proto__' },
    { ...request, entryPointId: 'default' }, { ...request, entryPointId: 'constructor' },
    { ...request, playerId: 'forged' }, { ...request, layerId: 'forged' }, { ...request, generation: 1 }]) {
    assert.equal(isRealtimeAdmissionRequestV1(value), false)
  }
})
test('Admission response rejects private fields, credential URLs, invalid tickets, and malformed expiry', () => {
  for (const value of [null, [], {}, { ...response, v: 2 }, { ...response, areaId: 'forest' },
    { ...response, playerId: 'private' }, { ...response, email: 'private' },
    { ...response, socketPath: 'wss://untrusted.example/town' }, { ...response, socketPath: '//untrusted.example/town' },
    { ...response, socketPath: '/api/v1/realtime/areas/town?ticket=secret' },
    { ...response, ticket: '' }, { ...response, ticket: 'x'.repeat(257) }, { ...response, ticket: '\n' },
    { ...response, expiresAt: 'invalid' }, { ...response, expiresAt: 0 }, { ...response, expiresAt: '2026-09-23' }]) {
    assert.equal(isRealtimeAdmissionResponseV1(value), false)
  }
})
