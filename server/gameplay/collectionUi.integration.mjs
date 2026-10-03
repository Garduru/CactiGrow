import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

// Only the browser transport is substituted. The component, providers, runner,
// restoration, typed client, authenticated Worker and PostgreSQL are real.
export async function verifyCollectionResearchUi(client, unlocked) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://collection.test/garden', pretendToBeVisual: true })
  const originals = new Map()
  const reads = []
  let mutation
  const api = {
    getGarden: (...args) => { const task = client.getGarden(...args); reads.push(task); return task },
    getGrowerAlpha: (...args) => { const task = client.getGrowerAlpha(...args); reads.push(task); return task },
    mutateGrowerAlpha: (...args) => { mutation = client.mutateGrowerAlpha(...args); return mutation },
  }
  for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'IS_REACT_ACT_ENVIRONMENT', '__collectionApi']) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === '__collectionApi' ? api : dom.window[key] })
  }
  const plants = await client.getPlantLifecycleV3()
  const out = resolve('node_modules/.tmp/collection-api-runtime.mjs')
  await build({
    stdin: { contents: `
      import React,{act} from 'react'; import {createRoot} from 'react-dom/client';
      import {ServerGardenPage} from './src/features/garden/ServerGardenPage';
      import {GrowerAuthorityProvider} from './src/app/GrowerAuthorityProvider';
      import {GardenAuthorityProvider} from './src/app/GardenAuthorityProvider';
      import {GameStateProvider} from './src/game/GameStateProvider';
      import {PlantLifecycleContext} from './src/app/PlantLifecycleContext';
      export {act}; export function mount(plants){const root=createRoot(document.getElementById('root'));
        root.render(<PlantLifecycleContext.Provider value={{state:{authority:'server',status:'ready',projection:plants}}}>
          <GrowerAuthorityProvider><GardenAuthorityProvider><GameStateProvider><ServerGardenPage/></GameStateProvider></GardenAuthorityProvider></GrowerAuthorityProvider>
        </PlantLifecycleContext.Provider>);return root;}
    `, loader: 'tsx', resolveDir: process.cwd() },
    bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', outfile: out,
    define: { 'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false }) },
    plugins: [{ name: 'collection-api', setup(plugin) {
      plugin.onResolve({ filter: /\/browserApiClient(\.ts)?$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const browserApiClient=globalThis.__collectionApi;' }))
    } }],
  })
  const { act, mount } = await import(pathToFileURL(out).href + '?' + crypto.randomUUID())
  let root
  try {
    await act(() => { root = mount(plants) })
    await act(async () => { await Promise.all(reads) })
    const doc = dom.window.document
    const button = (text) => {
      const node = [...doc.querySelectorAll('button')].find((node) => node.textContent?.trim() === text)
      assert.ok(node, text)
      return node
    }
    const click = async (text) => { await act(() => button(text).click()) }
    await click('Select'); await click('Select page (1)')
    assert.equal(button('Research Selected').disabled, !unlocked)
    await click('Research Selected')
    if (!unlocked) {
      assert.match(doc.querySelector('.collection-research-action').textContent, /Requires Organized Beds \(Garden Level 2\)/)
      assert.equal(doc.querySelector('[role="dialog"]'), null)
      assert.equal(mutation, undefined, 'locked click makes no API request')
    } else {
      assert.match(doc.querySelector('[role="dialog"]').textContent, /1 eligible/)
      await click('Confirm research')
      assert.match(doc.querySelector('[role="dialog"]').textContent, /Researching selected specimens/)
      await act(async () => { await mutation })
      assert.match(doc.querySelector('[role="dialog"]').textContent, /1 researched/)
      assert.match(doc.querySelector('.garden-specimen').textContent, /Studied/)
      assert.equal(doc.querySelector('.collection-favorite__button').getAttribute('aria-pressed'), 'true')
      await click('Done'); await click('Unresearched')
      assert.equal(doc.querySelectorAll('.garden-specimen').length, 0, 'real authoritative research removes the specimen immediately')
      assert.match(doc.querySelector('.garden-selection-bar').textContent, /1 specimen selected/, 'selection retains owned researched specimens')
    }
  } finally {
    if (root) await act(() => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}
