import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { Miniflare, Log, LogLevel } from 'miniflare'
import { isServerMessageV1 } from '../../shared/realtime/protocolV1.ts'

const entry = `
import { AreaPresence, admitToArea } from './server/realtime/AreaPresence.ts';
import { movementOwnerName } from './server/movement/MovementOwner.ts';
import { findArea } from './shared/world/world.ts';
export class TestAreaPresence extends AreaPresence {}
export default { async fetch(request,env) {
 const c=JSON.parse(request.headers.get('x-test-scope')||'{}'),path=new URL(request.url).pathname;
 const stub=env.AREA_PRESENCE.get(env.AREA_PRESENCE.idFromName(movementOwnerName(c.playerId)));
 if(path==='/seed') { const area=findArea('town-p1'),position=area.spawns.find(s=>s.entryId==='from-path-2');
  return stub.fetch(new Request('https://movement.internal/movement',{method:'POST',body:JSON.stringify({playerId:c.playerId,command:{type:'seed',location:{projectionVersion:1,revision:1,areaId:area.areaId,runtimeAreaId:'town',zoneId:area.zoneId,entryId:position.entryId,position:{x:position.x,y:position.y},discoveredAreaIds:[area.areaId],discoveredTravelDestinationIds:['town-p1']}}})})); }
 if(path==='/read')return stub.fetch(new Request('https://movement.internal/movement',{method:'POST',body:JSON.stringify({playerId:c.playerId,command:{type:'read'}})}));
 return admitToArea(env.AREA_PRESENCE,c);
}}`
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
async function runtime(t, environment = 'staging') {
  const bundle = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'neutral', target: 'es2023', external: ['cloudflare:workers'] })
  const mf = new Miniflare({ workers: [{ config: { name: 'movement-test', type: 'worker', compatibilityDate: '2026-09-20', manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } } }, env: { CACTIGROW_ENVIRONMENT: { type: 'text', value: environment }, AREA_PRESENCE: { type: 'durable-object', worker: 'movement-test', exportName: 'TestAreaPresence' } }, exports: { TestAreaPresence: { type: 'durable-object', storage: 'sqlite', unsafePreventEviction: false } } } }], log: new Log(LogLevel.ERROR), port: 0, telemetry: { enabled: false } })
  t.after(() => mf.dispose())
  const scope = n => ({ areaId: 'town', playerId: uuid(n), publicId: uuid(n + 100), displayName: `Movement ${n}`, entryPointId: 'farm-arrival', authorizationExpiresAt: Date.now() + 120000 })
  const call = (path, c, upgrade = false) => mf.dispatchFetch('https://test' + path, { headers: { 'x-test-scope': JSON.stringify(c), ...(upgrade ? { Upgrade: 'websocket' } : {}) } })
  return { mf, scope, call }
}
function socketClient(response) {
  assert.equal(response.status, 101)
  const socket = response.webSocket, messages = []
  socket.addEventListener('message', e => { const m = JSON.parse(String(e.data)); assert.ok(isServerMessageV1(m)); messages.push(m) }); socket.accept()
  return { socket, messages, wait: async predicate => {
    const until = Date.now() + 5000
    while (!predicate()) { if (Date.now() > until) assert.fail('Timed out waiting for movement.'); await new Promise(r => setTimeout(r, 15)) }
  } }
}
test('workerd: two Town players retain smooth sequenced updates; impossible packets correct only their sender', { timeout: 60000 }, async t => {
  const { scope, call } = await runtime(t), aScope = scope(1), bScope = scope(2)
  assert.equal((await call('/seed', aScope)).status, 200); assert.equal((await call('/seed', bScope)).status, 200)
  const a = socketClient(await call('/admit', aScope, true)), b = socketClient(await call('/admit', bScope, true))
  await a.wait(() => a.messages.some(m => m.type === 'joined'))
  for (let i = 1; i <= 12; i++) {
    await new Promise(r => setTimeout(r, 120))
    a.socket.send(JSON.stringify({ v: 1, type: 'move', sequence: i, position: { x: 1100 + 24 * i, y: 1280 }, facing: 'east', movement: 'moving' }))
    b.socket.send(JSON.stringify({ v: 1, type: 'move', sequence: i, position: { x: 1100, y: 1280 - 24 * i }, facing: 'north', movement: 'moving' }))
  }
  await b.wait(() => b.messages.filter(m => m.type === 'moved').length === 12)
  await a.wait(() => a.messages.filter(m => m.type === 'moved').length === 12)
  assert.deepEqual(b.messages.filter(m => m.type === 'moved').map(m => m.sample.sequence), Array.from({ length: 12 }, (_, i) => i + 1))
  a.socket.send(JSON.stringify({ v: 1, type: 'move', sequence: 13, position: { x: 2000, y: 1000 }, facing: 'east', movement: 'moving' }))
  await a.wait(() => a.messages.some(m => m.type === 'movement-authority' && !m.authority.accepted))
  const correction = a.messages.findLast(m => m.type === 'movement-authority').authority
  assert.equal(correction.lastRejection, 'TOO_FAST'); assert.deepEqual(correction.position, { x: 1388, y: 1280 })
  assert.equal(b.messages.filter(m => m.type === 'moved').length, 12)
  assert.deepEqual((await (await call('/read', aScope)).json()).position, correction.position)
  await new Promise(r => setTimeout(r, 120))
  a.socket.send(JSON.stringify({ v: 1, type: 'move', sequence: 14, position: { x: 1412, y: 1280 }, facing: 'east', movement: 'moving' }))
  await b.wait(() => b.messages.some(m => m.type === 'moved' && m.sample.sequence === 14))
  a.socket.close(); b.socket.close()
})
test('workerd: private movement operations remain unavailable in production', async t => {
  const { scope, call } = await runtime(t, 'production')
  assert.equal((await call('/seed', scope(1))).status, 404)
})
