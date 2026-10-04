import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { unlink } from 'node:fs/promises'

/** Two simultaneously mounted real provider/HUD trees with separate authenticated API clients. */
export async function verifyLivePlayerReconciliation(actorClient, targetClient, actorId, targetId, environment, createSpecimen) {
  const dom = new JSDOM('<div id="actor"></div><div id="target"></div>', { url: 'https://cactigrow.com/play', pretendToBeVisual: true })
  const originals = new Map(), pending = [], files = [], roots = [], timers = new Map(), reads = [{}, {}]
  let timerId = 0
  const clients = [actorClient, targetClient].map((client, i) => new Proxy(client, { get(target, key) {
    if (typeof target[key] !== 'function') return target[key]
    return (...args) => { reads[i][key] = (reads[i][key] ?? 0) + 1; const task = target[key](...args); pending.push(task.catch(() => undefined)); return task }
  } }))
  const schedule = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return () => timers.delete(id) }
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true, __reconciliationClients: clients, __reconciliationSchedule: schedule })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  dom.window.matchMedia = () => ({ matches: false })
  const modules = [], worldNodes = []
  const ids = [actorId, targetId]
  try {
    for (let i = 0; i < 2; i++) {
      const out = resolve(`node_modules/.tmp/player-reconciliation-${crypto.randomUUID()}.mjs`); files.push(out)
      await build({ stdin: { contents: `
        import React,{act,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
        import {GrowerAuthorityProvider} from './src/app/GrowerAuthorityProvider';import {PlantLifecycleProvider} from './src/app/PlantLifecycleProvider';import {GardenAuthorityProvider} from './src/app/GardenAuthorityProvider';import {GameStateProvider} from './src/game/GameStateProvider';
        import {PlayerAuthorityReconciler} from './src/app/PlayerAuthorityReconciler';import {PlayerBootstrapContext} from './src/app/PlayerBootstrapContext';import {SocialContext} from './src/features/social/socialContextState';import {SocialPanelProvider} from './src/features/social/SocialPanelContext';import {FeaturePanelProvider} from './src/features/menu/FeaturePanelProvider';import {AdminAccessProvider} from './src/features/admin/AdminAccessProvider';
        import {GameHeader} from './src/components/layout/GameHeader';import {useGameState} from './src/game/useGameState';import {useCommerceActions} from './src/features/marketplace/useCommerceActions';import {useFeaturePanel} from './src/features/menu/featurePanelState';import {useGrowerAuthority} from './src/app/useGrowerAuthority';import {PhaserWorldCanvas} from './src/game-world/PhaserWorldHost';import {townWorldProjection} from './src/game-world/townWorldProjection';
        export {act};export const world={mounts:0,destroys:0,position:{x:1234,y:567},connections:1};export let transact;
        const createGame=parent=>{world.mounts++;parent.appendChild(document.createElement('canvas'));return {destroy(){world.destroys++}}};const onIntent=()=>{};
        function World(){const {state}=useGameState();return <PhaserWorldCanvas projection={{...townWorldProjection,playerTokens:state.player.tokens}} onIntent={onIntent} createGame={createGame}/>}
        function State(){const {state}=useGameState(),commerce=useCommerceActions(),menu=useFeaturePanel(),grower=useGrowerAuthority();transact=commerce.transact;return <><output className="state">{JSON.stringify({player:state.player,inventory:state.inventory,balance:commerce.balance})}</output><button className="open-panel" onClick={()=>menu.openFeature(${i === 0 ? "'admintools'" : "'inventory'"})}>Open</button><output className="panel">{menu.feature}</output><button className="refresh" onClick={()=>grower.refresh()}>Refresh data</button></>}
        export function mount(id,social){const root=createRoot(document.getElementById(${JSON.stringify(i === 0 ? 'actor' : 'target')}));root.render(<MemoryRouter><PlayerBootstrapContext.Provider value={{status:'authenticated',bootstrap:{projectionVersion:1,player:{playerId:id,createdAt:'2026-01-01T00:00:00.000Z'}}}}><SocialContext.Provider value={{state:{status:'ready',overview:social},profileTarget:{open:false}}}><PlantLifecycleProvider><GardenAuthorityProvider><GrowerAuthorityProvider><GameStateProvider><PlayerAuthorityReconciler/><AdminAccessProvider><FeaturePanelProvider><SocialPanelProvider><GameHeader/><World/><State/></SocialPanelProvider></FeaturePanelProvider></AdminAccessProvider></GameStateProvider></GrowerAuthorityProvider></GardenAuthorityProvider></PlantLifecycleProvider></SocialContext.Provider></PlayerBootstrapContext.Provider></MemoryRouter>);return root}
      `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' }, outfile: out,
      define: { 'import.meta.env': JSON.stringify({ MODE: environment, DEV: false }) }, plugins: [{ name: 'isolated-client-clock', setup(plugin) {
        plugin.onResolve({ filter: /\/browserApiClient(\.ts)?$/ }, () => ({ path: 'api', namespace: 'fixture' }))
        plugin.onResolve({ filter: /\/playerAuthorityReconciliation$/ }, () => ({ path: 'clock', namespace: 'fixture' }))
        plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'api'
          ? `export const browserApiClient=globalThis.__reconciliationClients[${i}];`
          : `import {startPlayerAuthorityReconciliation as start} from ${JSON.stringify(resolve('src/app/playerAuthorityReconciliation.ts'))};export const startPlayerAuthorityReconciliation=deps=>start({...deps,schedule:globalThis.__reconciliationSchedule});`, resolveDir: process.cwd() }))
      } }] })
      modules.push(await import(pathToFileURL(out).href))
    }
    const { act } = modules[0]
    const settle = async () => { for (let pass = 0; pass < 20; pass++) { const length = pending.length; await act(async () => { for (let i = 0; i < pending.length; i++) await pending[i] }); if (pass > 0 && length === pending.length) break } }
    const cycle = async () => { await act(() => { for (const [id, task] of [...timers]) if (task.delay === 30_000) { timers.delete(id); task.callback() } }); await settle() }
    const containers = ['actor', 'target'].map(id => document.getElementById(id))
    const state = i => JSON.parse(containers[i].querySelector('.state').textContent)
    const assertHud = i => assert.equal(containers[i].querySelector('[aria-label="Currency"]').textContent, '$ ' + state(i).player.tokens.toLocaleString())
    const assertPreserved = () => {
      modules.forEach((module, i) => { assert.equal(module.world.mounts, 1); assert.equal(module.world.destroys, 0); assert.equal(module.world.connections, 1); assert.deepEqual(module.world.position, { x: 1234, y: 567 }); assert.equal(containers[i].querySelector('canvas'), worldNodes[i]) })
      assert.equal(containers[0].querySelector('.panel').textContent, 'admintools')
      assert.equal(containers[1].querySelector('.panel').textContent, 'inventory')
    }
    for (let i = 0; i < 2; i++) { const social = await clients[i].getSocial(); await act(() => roots[i] = modules[i].mount(ids[i], social)); await settle(); worldNodes[i] = containers[i].querySelector('canvas'); await act(() => containers[i].querySelector('.open-panel').click()) }
    await cycle() // Establish observed revisions and close the initial-read race.
    const before = [state(0), state(1)], revisionBefore = await targetClient.getPlayerAuthorityRevision()
    const command = extra => ({ commandId: crypto.randomUUID(), reason: 'Disposable live HUD reconciliation acceptance', confirmed: true, ...extra })
    const currency = command({ delta: 1 })
    await actorClient.mutateAdmin(targetId, 'currency', currency)
    assert.equal((await actorClient.inspectAdminPlayer(targetId)).currency, before[1].player.tokens + 1)
    assert.equal(state(1).player.tokens, before[1].player.tokens, 'mounted target starts stale before observing the server revision')
    assert.deepEqual(state(0), before[0])
    await cycle()
    assert.equal(state(1).player.tokens, before[1].player.tokens + 1); assert.equal(state(1).balance, state(1).player.tokens)
    assert.deepEqual(state(0), before[0]); assertHud(0); assertHud(1); assertPreserved()
    assert.ok((await targetClient.getPlayerAuthorityRevision()).profileVersion > revisionBefore.profileVersion)
    const readCounts = reads.map(value => ({ ...value }))
    assert.equal((await actorClient.mutateAdmin(targetId, 'currency', currency)).replayed, true)
    await cycle(); await cycle()
    assert.equal(state(1).player.tokens, before[1].player.tokens + 1)
    for (let i = 0; i < 2; i++) { assert.equal(reads[i].getGrowerAlpha, readCounts[i].getGrowerAlpha); assert.equal(reads[i].getPlantLifecycleV3, readCounts[i].getPlantLifecycleV3) }
    await actorClient.mutateAdmin(targetId, 'progression', command({ delta: 1, skillId: 'cultivation' }))
    await actorClient.mutateAdmin(targetId, 'inventory', command({ delta: 1, speciesId: 'echinopsis-pachanoi' }))
    await cycle()
    assert.equal(state(1).player.skills.cultivation.xp, before[1].player.skills.cultivation.xp + 1)
    const seed = value => value.inventory.find(item => item.itemKey === 'echinopsis-pachanoi').quantity
    assert.equal(seed(state(1)), seed(before[1]) + 1); assert.deepEqual(state(0), before[0]); assertPreserved()
    // Existing Shop path applies its full authoritative receipt immediately, before the next revision check.
    const shopBefore = state(1)
    const shopItem = (await targetClient.getShopCatalog()).items.find(item => item.speciesId === 'echinopsis-pachanoi')
    await act(async () => assert.equal(await modules[1].transact({ type: 'buy-shop-seeds', itemId: shopItem.id, quantity: 1 }), true)); await settle()
    assert.equal(state(1).player.tokens, shopBefore.player.tokens - 25); assert.equal(seed(state(1)), seed(shopBefore) + 1); assertHud(1)
    await cycle(); assert.equal(state(1).player.tokens, shopBefore.player.tokens - 25); assertPreserved()
    const specimen = await createSpecimen(actorId)
    await act(async () => assert.equal(await modules[0].transact({ type: 'list-specimen', specimenId: specimen, askingPrice: 1 }), true)); await settle()
    const listing = (await actorClient.getGrowerAlpha()).marketplaceListings.find(item => item.plantId === specimen)
    const marketBefore = [state(0).player.tokens, state(1).player.tokens]
    await act(async () => assert.equal(await modules[1].transact({ type: 'buy-marketplace-listing', listingId: listing.id }), true)); await settle()
    assert.equal(state(1).player.tokens, marketBefore[1] - 1, 'buyer reconciles receipt immediately')
    assert.equal(state(0).player.tokens, marketBefore[0], 'seller remains stale until observing its revision')
    await cycle(); assert.equal(state(0).player.tokens, marketBefore[0] + 1); assertHud(0); assertHud(1); assertPreserved()
    const saleBefore = state(1).player.tokens
    await act(async () => assert.equal(await modules[1].transact({ type: 'sell-specimen-to-npc', specimenId: specimen }), true)); await settle()
    assert.ok(state(1).player.tokens > saleBefore); assertHud(1); assertPreserved()
    // Offline target uses the existing session reads, with no replay or special handling.
    await act(() => roots[1].unmount()); roots[1] = null
    const offlineBefore = (await actorClient.inspectAdminPlayer(targetId)).currency
    await actorClient.mutateAdmin(targetId, 'currency', command({ delta: 1 }))
    const social = await targetClient.getSocial()
    await act(() => roots[1] = modules[1].mount(targetId, social)); await settle()
    assert.equal(state(1).player.tokens, offlineBefore + 1); assertHud(1)
  } finally {
    if (modules[0]) await modules[0].act(() => roots.forEach(root => root?.unmount()))
    for (const file of files) await unlink(file)
    dom.window.close(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
  }
}
