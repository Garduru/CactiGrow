import assert from 'node:assert/strict'
import test from 'node:test'
import { isAdminMutation, isAdminSession, isAdminInspection, permissionsForRole } from '../../shared/api/adminV1.ts'

test('central permissions keep PLAYER denied, moderator scoped and role management OWNER-only', () => {
  assert.deepEqual(permissionsForRole('PLAYER'), [])
  for (const role of ['MODERATOR', 'ADMIN', 'OWNER'] as const) assert.ok(permissionsForRole(role).includes('admin.access'))
  assert.ok(permissionsForRole('MODERATOR').includes('marketplace.moderate'))
  for (const p of ['economy.adjust', 'progression.adjust', 'inventory.adjust', 'specimen.inspect', 'audit.read'] as const) { assert.equal(permissionsForRole('MODERATOR').includes(p), false); assert.ok(permissionsForRole('ADMIN').includes(p)) }
  assert.equal(permissionsForRole('ADMIN').includes('roles.manage'), false); assert.ok(permissionsForRole('OWNER').includes('roles.manage'))
})
test('admin intents reject arbitrary patches, missing reasons, unconfirmed changes, invalid signed deltas and incomplete OWNER confirmation', () => {
  const base = { commandId: crypto.randomUUID(), reason: 'Support correction', confirmed: true, delta: -1 }
  assert.ok(isAdminMutation(base, 'currency')); assert.ok(isAdminMutation({ ...base, skillId: 'cultivation' }, 'progression'))
  for (const extra of [{ reason: '' }, { reason: 'x'.repeat(241) }, { reason: 'bad\nreason' }, { confirmed: false }, { delta: 0 }, { delta: 0.5 }, { delta: 100001 }, { finalBalance: 999 }, { actorPlayerId: crypto.randomUUID() }, { authToken: 'SECRET' }]) assert.equal(isAdminMutation({ ...base, ...extra }, 'currency'), false)
  const role = { commandId: base.commandId, reason: base.reason, confirmed: true, role: 'OWNER' }
  assert.equal(isAdminMutation(role, 'role'), false); assert.ok(isAdminMutation({ ...role, confirmOwnerPlayerId: crypto.randomUUID() }, 'role'))
})
test('staff session and inspection wire contracts reject unknown/private fields and forged permissions', () => {
  const id = crypto.randomUUID(), session = { playerId: id, displayName: 'Tester', role: 'MODERATOR', permissions: permissionsForRole('MODERATOR'), environment: 'production', version: 'test' }
  assert.ok(isAdminSession(session)); assert.equal(isAdminSession({ ...session, authToken: 'SECRET' }), false)
  assert.equal(isAdminSession({ ...session, permissions: [...session.permissions, 'roles.manage'] }), false)
  const inspection = { player: { playerId: id, publicId: crypto.randomUUID(), displayName: 'Tester', joinedAt: new Date().toISOString(), role: 'PLAYER', totalLevel: 3, status: 'registered' }, social: { friends: 0, incoming: 0, outgoing: 0, blocks: 0 } }
  assert.ok(isAdminInspection(inspection)); assert.equal(isAdminInspection({ ...inspection, email: 'PRIVATE' }), false)
})
