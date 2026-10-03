import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { mkdir, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('actual production menu/panel enforces staff visibility and permission-limited sections while Dev Tools remains absent', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cactigrow.com/town', pretendToBeVisual: true })
  const originals = new Map()
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true })) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }) }
  await mkdir('node_modules/.tmp', { recursive: true }); const out = resolve(`node_modules/.tmp/admin-ui-${crypto.randomUUID()}.mjs`)
  await build({ stdin: { contents: `
    import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
    import {AdminAccessContext} from './src/features/admin/adminAccess';import {AdminToolsPanel} from './src/features/admin/AdminToolsPanel';
    import {permissionsForRole} from './shared/api/adminV1';import {FeaturePanelProvider} from './src/features/menu/FeaturePanelProvider';import {useFeaturePanel} from './src/features/menu/featurePanelState';import {MenuDropdown} from './src/components/layout/UtilityMenu';
    import {GrowerAuthorityContext} from './src/app/GrowerAuthorityContext';import {PlantLifecycleContext} from './src/app/PlantLifecycleContext';
    function Harness(){const p=useFeaturePanel();return <><MenuDropdown onDismiss={()=>{}}/><button id="direct" onClick={()=>p.openFeature('admintools')}>Direct</button><output>{p.feature}</output><AdminToolsPanel/></>}
    export {act};export function mount(role){const root=createRoot(document.getElementById('root'));const session=role==='PLAYER'?null:{playerId:crypto.randomUUID(),displayName:'Staff Tester',role,permissions:permissionsForRole(role),environment:'production',version:'test'};const refresh=async()=>session;root.render(<MemoryRouter><AdminAccessContext.Provider value={{session,status:'ready',refresh}}><GrowerAuthorityContext.Provider value={{state:{authority:'local'},refresh:async()=>{},applyProjection(){},mutate:async()=>null}}><PlantLifecycleContext.Provider value={{state:{authority:'local'},applyProjection(){}}}><FeaturePanelProvider><Harness/></FeaturePanelProvider></PlantLifecycleContext.Provider></GrowerAuthorityContext.Provider></AdminAccessContext.Provider></MemoryRouter>);return root}
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' }, outfile: out, define: { 'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false }), 'import.meta.env.MODE': '"production"' } })
  let root
  try {
    const { act, mount } = await import(pathToFileURL(out).href)
    for (const role of ['PLAYER', 'MODERATOR', 'ADMIN', 'OWNER']) {
      await act(async () => { root = mount(role) })
      await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Other')).click())
      const text = [...document.querySelectorAll('button')].map(b => b.textContent.trim())
      assert.equal(text.includes('Admin Tools'), role !== 'PLAYER'); assert.equal(text.includes('Developer Tools'), false)
      await act(async () => document.querySelector('#direct').click())
      assert.equal(document.querySelector('output').textContent, role === 'PLAYER' ? '' : 'admintools')
      const sections = [...document.querySelectorAll('nav[aria-label="Admin sections"] button')].map(b => b.textContent)
      assert.equal(sections.includes('Support'), ['ADMIN', 'OWNER'].includes(role)); assert.equal(sections.includes('Specimens'), ['ADMIN', 'OWNER'].includes(role)); assert.equal(sections.includes('Audit Log'), ['ADMIN', 'OWNER'].includes(role)); assert.equal(sections.includes('Roles'), role === 'OWNER')
      if (role === 'MODERATOR') assert.ok(sections.includes('Marketplace'))
      await act(async () => root.unmount()); root = undefined
    }
  } finally { if (root) { const { act } = await import(pathToFileURL(out).href); await act(async () => root.unmount()) }; await unlink(out); dom.window.close(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) } }
})
