import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('actual staging routes retire legacy Farm/Town renderers and resume the authoritative world; production stays gated', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dev.cactigrow.com' })
  const original = new Map()
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  await mkdir('node_modules/.tmp', { recursive: true })
  try {
    for (const mode of ['staging', 'production']) {
      const file = resolve(`node_modules/.tmp/world-routing-${crypto.randomUUID()}.mjs`)
      const built = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
        import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';import {AppRoutes} from './src/app/AppRouter';
        function Location(){const l=useLocation();return <output id="location">{JSON.stringify({path:l.pathname,search:l.search,hash:l.hash,state:l.state})}</output>}
        export {act};export function mount(path){const root=createRoot(document.getElementById('root'));root.render(<MemoryRouter initialEntries={[{pathname:path,search:'?check=1',hash:'#entry',state:{token:'kept'}}]}><Location/><AppRoutes/></MemoryRouter>);return root}
      ` }, bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ MODE: mode, DEV: false }) },
      plugins: [{ name: 'route-surfaces', setup(plugin) {
        plugin.onResolve({ filter: /\/(GameSession|PageLayout|PlayerLogin|[A-Za-z]+Page|FeatureContent)$/ }, args => {
          if (!args.importer.endsWith('AppRouter.tsx')) return
          return { path: args.path.split('/').at(-1), namespace: 'surface' }
        })
        plugin.onLoad({ filter: /.*/, namespace: 'surface' }, args => ({ resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import {Outlet} from 'react-router-dom';export function ${args.path}(){return ${['GameSession','PageLayout'].includes(args.path) ? '<Outlet/>' : `<div data-surface="${args.path}"/>`}}` }))
      } }] })
      await writeFile(file, built.outputFiles[0].contents)
      try {
        const { mount, act } = await import(pathToFileURL(file).href)
        for (const path of mode === 'staging' ? ['/play','/town','/farm','/world-preview'] : ['/play','/town']) {
          let root
          await act(async () => { root = mount(path); await new Promise(r => setTimeout(r, 20)) })
          await act(async () => { await new Promise(r => setTimeout(r, 20)) })
          assert.deepEqual(JSON.parse(document.querySelector('#location').textContent), { path: mode === 'staging' ? '/world' : path, search: '?check=1', hash: '#entry', state: { token: 'kept' } })
          assert.ok(document.querySelector(`[data-surface="${mode === 'staging' ? 'LdtkWorldPage' : path === '/play' ? 'FarmWorldPage' : 'TownWorldPage'}"]`))
          if (mode === 'staging') assert.equal(document.querySelector('[data-surface="FarmWorldPage"],[data-surface="TownWorldPage"]'), null)
          await act(async () => root.unmount())
        }
      } finally { await unlink(file) }
    }
  } finally {
    dom.window.close()
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
  }
})
