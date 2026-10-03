import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { unlink } from 'node:fs/promises'

export async function verifyDevToolsUi(client, playerId) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/play?developmentIdentity=account-a&e1Lifecycle=server', pretendToBeVisual: true })
  const originals = new Map(), pending = []
  const api = new Proxy(client, { get(target, key) {
    if (typeof target[key] !== 'function') return target[key]
    return (...args) => { const task = target[key](...args); pending.push(task); return task }
  } })
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, MouseEvent: dom.window.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true, __devApi: api })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  dom.window.matchMedia = () => ({ matches: false })
  const social = await client.getSocial()
  const out = resolve(`node_modules/.tmp/dev-authority-ui-${crypto.randomUUID()}.mjs`)
  await build({ stdin: { contents: `
    import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
    import {GrowerAuthorityProvider} from './src/app/GrowerAuthorityProvider';import {PlantLifecycleProvider} from './src/app/PlantLifecycleProvider';import {GardenAuthorityProvider} from './src/app/GardenAuthorityProvider';import {GameStateProvider} from './src/game/GameStateProvider';
    import {PlayerBootstrapContext} from './src/app/PlayerBootstrapContext';import {SocialContext} from './src/features/social/socialContextState';import {SocialPanelProvider} from './src/features/social/SocialPanelContext';import {FeaturePanelProvider} from './src/features/menu/FeaturePanelProvider';
    import {GameHeader} from './src/components/layout/GameHeader';import {DevToolsPanel} from './src/features/devtools/DevToolsPanel';import {useGameState} from './src/game/useGameState';
    function State(){const {state}=useGameState();return <output id="authority-result">{JSON.stringify({player:state.player,inventory:state.inventory})}</output>}
    export {act};export function mount(playerId,social){const root=createRoot(document.getElementById('root'));root.render(<MemoryRouter><PlayerBootstrapContext.Provider value={{status:'authenticated',requestId:'test',bootstrap:{projectionVersion:1,player:{playerId,createdAt:'2026-01-01T00:00:00.000Z'}}}}><SocialContext.Provider value={{state:{status:'ready',overview:social},profileTarget:{open:false},openProfile(){}}}><PlantLifecycleProvider><GardenAuthorityProvider><GrowerAuthorityProvider><GameStateProvider><FeaturePanelProvider><SocialPanelProvider><GameHeader/><DevToolsPanel/><State/></SocialPanelProvider></FeaturePanelProvider></GameStateProvider></GrowerAuthorityProvider></GardenAuthorityProvider></PlantLifecycleProvider></SocialContext.Provider></PlayerBootstrapContext.Provider></MemoryRouter>);return root}
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' }, outfile: out, define: { 'import.meta.env': JSON.stringify({ MODE: 'development', DEV: false }) }, plugins: [{ name: 'dev-transport', setup(plugin) {
    plugin.onResolve({ filter: /\/browserApiClient(\.ts)?$/ }, () => ({ path: 'api', namespace: 'fixture' }))
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const browserApiClient=globalThis.__devApi;' }))
  } }] })
  let root
  try {
    const { act, mount } = await import(pathToFileURL(out).href)
    const settle = async () => { await act(async () => { for (let i = 0; i < pending.length; i++) await pending[i] }) }
    await act(() => { root = mount(playerId, social) }); await settle()
    const button = text => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text); assert.ok(b, text); return b }
    const click = async text => { await act(() => button(text).click()); await settle() }
    const state = () => JSON.parse(document.querySelector('#authority-result').textContent)
    const initial = state()
    await click('Economy'); await click('+1,000')
    assert.equal(state().player.tokens, initial.player.tokens + 1000)
    assert.match(document.querySelector('.game-header').textContent, /1,000/)
    await click('Progression')
    const cultivation = document.querySelector('.dev-tools__card')
    await act(() => [...cultivation.querySelectorAll('button')].find(b => b.textContent === '+100').click()); await settle()
    assert.equal(state().player.skills.cultivation.xp, initial.player.skills.cultivation.xp + 100)
    assert.match(cultivation.textContent, /Level2/)
    assert.match(document.querySelector('.game-header').textContent, /Lvl: 4/)
    await click('Inventory'); await click('+10')
    assert.equal(state().inventory.find(i => i.itemKey === 'echinopsis-pachanoi').quantity, initial.inventory.find(i => i.itemKey === 'echinopsis-pachanoi').quantity + 10)
    assert.match(document.querySelector('.dev-tools__log').textContent, /Added 10 San Pedro seeds/)
  } finally {
    if (root) { const { act } = await import(pathToFileURL(out).href); await act(() => root.unmount()) }
    await unlink(out); dom.window.close()
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
  }
}
