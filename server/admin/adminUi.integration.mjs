import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { unlink } from 'node:fs/promises'

export async function verifyAdminToolsUi(client, playerId, targetId = playerId, environment = 'production') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cactigrow.com/play', pretendToBeVisual: true })
  const originals = new Map(), pending = [], mutations = []
  const api = new Proxy(client, { get(target, key) { if (typeof target[key] !== 'function') return target[key]; return (...args) => { if (key === 'mutateAdmin') mutations.push(args); const task = target[key](...args); pending.push(task.catch(() => undefined)); return task } } })
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true, __adminApi: api })) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }) }
  dom.window.matchMedia = () => ({ matches: false })
  const social = await client.getSocial(), targetBefore = await client.inspectAdminPlayer(targetId), out = resolve(`node_modules/.tmp/admin-authority-ui-${crypto.randomUUID()}.mjs`)
  await build({ stdin: { contents: `
    import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
    import {GrowerAuthorityProvider} from './src/app/GrowerAuthorityProvider';import {PlantLifecycleProvider} from './src/app/PlantLifecycleProvider';import {GardenAuthorityProvider} from './src/app/GardenAuthorityProvider';import {GameStateProvider} from './src/game/GameStateProvider';
    import {PlayerBootstrapContext} from './src/app/PlayerBootstrapContext';import {SocialContext} from './src/features/social/socialContextState';import {SocialPanelProvider} from './src/features/social/SocialPanelContext';import {FeaturePanelProvider} from './src/features/menu/FeaturePanelProvider';import {AdminAccessProvider} from './src/features/admin/AdminAccessProvider';
    import {GameHeader} from './src/components/layout/GameHeader';import {AdminToolsPanel} from './src/features/admin/AdminToolsPanel';import {useGameState} from './src/game/useGameState';
    function State(){const {state}=useGameState();return <output id="authority-result">{JSON.stringify({player:state.player,inventory:state.inventory})}</output>}
    export {act};export function mount(playerId,social){const root=createRoot(document.getElementById('root'));root.render(<MemoryRouter><PlayerBootstrapContext.Provider value={{status:'authenticated',requestId:'test',bootstrap:{projectionVersion:1,player:{playerId,createdAt:'2026-01-01T00:00:00.000Z'}}}}><SocialContext.Provider value={{state:{status:'ready',overview:social},profileTarget:{open:false},openProfile(){}}}><PlantLifecycleProvider><GardenAuthorityProvider><GrowerAuthorityProvider><GameStateProvider><AdminAccessProvider><FeaturePanelProvider><SocialPanelProvider><GameHeader/><AdminToolsPanel/><State/></SocialPanelProvider></FeaturePanelProvider></AdminAccessProvider></GameStateProvider></GrowerAuthorityProvider></GardenAuthorityProvider></PlantLifecycleProvider></SocialContext.Provider></PlayerBootstrapContext.Provider></MemoryRouter>);return root}
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' }, outfile: out, define: { 'import.meta.env': JSON.stringify({ MODE: environment, DEV: false }) }, plugins: [{ name: 'admin-transport', setup(plugin) { plugin.onResolve({ filter: /\/browserApiClient(\.ts)?$/ }, () => ({ path: 'api', namespace: 'fixture' })); plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const browserApiClient=globalThis.__adminApi;' })) } }] })
  let root
  try {
    const { act, mount } = await import(pathToFileURL(out).href)
    const settle = async () => { for (let pass = 0; pass < 12; pass++) { const length = pending.length; await act(async () => { for (let i = 0; i < pending.length; i++) await pending[i] }); if (pass > 0 && pending.length === length) break } }
    const button = text => { const value = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text); assert.ok(value, text); return value }
    const click = async text => { await act(() => button(text).click()); await settle() }
    const input = async (element, value) => { assert.ok(element); await act(() => { const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); element.dispatchEvent(new dom.window.Event('input', { bubbles: true })); element.dispatchEvent(new dom.window.Event('change', { bubbles: true })) }); await settle() }
    await act(() => { root = mount(playerId, social) }); await settle()
    const before = JSON.parse(document.querySelector('#authority-result').textContent).player.tokens
    await click('Players')
    await input(document.querySelector('.admin-tools input'), targetBefore.player.displayName)
    await click('Search players')
    const target = [...document.querySelectorAll('.admin-tools__results button')].find(b => b.textContent.includes(targetBefore.player.displayName)); assert.ok(target)
    await act(() => target.click()); await settle()
    await click('Roles'); assert.ok(document.querySelector('.admin-tools').textContent.includes(targetId))
    await click('Support'); assert.ok(document.querySelector('.admin-tools').textContent.includes(targetId))
    await input(document.querySelector('.admin-tools textarea'), 'Isolated UI support correction')
    await click('Review correction')
    assert.ok(document.querySelector('[role="alertdialog"]'))
    await click('Confirm action')
    const after = JSON.parse(document.querySelector('#authority-result').textContent).player.tokens
    assert.equal(after, before + (targetId === playerId ? 1 : 0))
    assert.equal((await client.inspectAdminPlayer(targetId)).currency, targetBefore.currency + 1)
    assert.match(document.querySelector('.admin-tools').textContent, /Completed and recorded in the audit log/)
    assert.ok(document.querySelector('.game-header').textContent.includes(after.toLocaleString()))
    assert.equal(document.querySelector('[role="alertdialog"]'), null)
    assert.ok(document.querySelector('.admin-tools__feedback').textContent.includes(targetBefore.player.displayName))
    assert.ok(document.querySelector('.admin-tools__feedback').textContent.includes(`$${targetBefore.currency} → $${targetBefore.currency + 1} (+1)`))
    if (targetId !== playerId) {
      for (const [action, extra] of [['progression', { skillId: 'cultivation' }], ['inventory', { speciesId: 'echinopsis-pachanoi' }]]) {
        await input(document.querySelector('.admin-tools select'), action)
        if (action === 'inventory') await click('Load supported seeds')
        await input(document.querySelector('.admin-tools textarea'), `Cross-player ${action} correction`)
        await click('Review correction')
        assert.ok(document.querySelector('[role="alertdialog"]').textContent.includes(targetId))
        await click('Confirm action')
        assert.match(document.querySelector('.admin-tools__feedback').textContent, /Completed and recorded/)
        const [sentTarget, sentAction, command] = mutations.at(-1)
        assert.equal(sentTarget, targetId); assert.equal(sentAction, action)
        for (const [key, value] of Object.entries(extra)) assert.equal(command[key], value)
      }
      const targetAfter = await client.inspectAdminPlayer(targetId)
      assert.equal(targetAfter.skills.find(s => s.id === 'cultivation').xp, targetBefore.skills.find(s => s.id === 'cultivation').xp + 1)
      assert.equal(targetAfter.seeds.find(s => s.speciesId === 'echinopsis-pachanoi').quantity, targetBefore.seeds.find(s => s.speciesId === 'echinopsis-pachanoi').quantity + 1)
      assert.equal(JSON.parse(document.querySelector('#authority-result').textContent).player.tokens, before)
      for (const [sentTarget, sentAction, command] of mutations) {
        assert.equal(sentTarget, targetId)
        const replay = await client.mutateAdmin(sentTarget, sentAction, command)
        assert.equal(replay.replayed, true)
        assert.equal(replay.audit.actorPlayerId, playerId); assert.equal(replay.audit.targetPlayerId, targetId)
        assert.equal(replay.audit.reason, command.reason); assert.equal(replay.audit.after.appliedDelta, 1)
      }
      assert.deepEqual(await client.inspectAdminPlayer(targetId), targetAfter)
      await input(document.querySelector('.admin-tools select'), 'currency')
      await input(document.querySelector('.admin-tools textarea'), 'Cancel stale target review')
      await click('Review correction')
      await click('Players')
      assert.equal(document.querySelector('[role="alertdialog"]'), null, 'changing sections invalidates the old review without losing selection')
      await input(document.querySelector('.admin-tools input'), social.ownProfile.displayName)
      await click('Search players')
      assert.equal(document.querySelector('[role="alertdialog"]'), null)
      const actor = [...document.querySelectorAll('.admin-tools__results button')].find(b => b.textContent.includes(social.ownProfile.displayName))
      await act(() => actor.click()); await settle(); await click('Support')
      await input(document.querySelector('.admin-tools input[type="number"]'), '-100000')
      await input(document.querySelector('.admin-tools textarea'), 'Rejected cross-player UI verification')
      await click('Review correction'); await click('Confirm action')
      assert.match(document.querySelector('.admin-tools__feedback').textContent, /Currency adjustment exceeds/)
      assert.equal(document.querySelector('.admin-tools__feedback dl'), null, 'failure has no success receipt')
      assert.equal((await client.inspectAdminPlayer(playerId)).currency, before)
    }
    return mutations.slice(0, targetId === playerId ? 1 : 3)
  } finally {
    if (root) { const { act } = await import(pathToFileURL(out).href); await act(() => root.unmount()) }
    await unlink(out); dom.window.close(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
  }
}
