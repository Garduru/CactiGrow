import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('production hides menu, refuses direct panel opening and excludes developer UI code; development and staging expose the entry', async t => {
  for (const mode of ['production', 'unknown', 'development', 'staging']) {
    const dom = new JSDOM('<div id="root"></div>', { url: 'https://test/play' })
    const originals = new Map<string, PropertyDescriptor | undefined>()
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }) }
    await mkdir('node_modules/.tmp', { recursive: true })
    const file = resolve(`node_modules/.tmp/dev-ui-${mode}-${crypto.randomUUID()}.mjs`)
    try {
      const result = await build({ stdin: { contents: `import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {FeaturePanelProvider} from './src/features/menu/FeaturePanelProvider';import {useFeaturePanel} from './src/features/menu/featurePanelState';import {MenuDropdown} from './src/components/layout/UtilityMenu';import {FeatureContent} from './src/features/menu/FeatureContent';function Harness(){const p=useFeaturePanel();return <><MenuDropdown onDismiss={()=>{}}/><button id="direct" onClick={()=>p.openFeature('devtools')}>Direct</button><output>{p.feature}</output></>};export {act};export function mount(){const r=createRoot(document.getElementById('root'));r.render(<FeaturePanelProvider><Harness/></FeaturePanelProvider>);return r};export const Content=FeatureContent;`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', loader: { '.css': 'empty' }, write: false, define: { 'import.meta.env.MODE': JSON.stringify(mode), 'import.meta.env.DEV': 'false', 'import.meta.env': JSON.stringify({ MODE: mode, DEV: false }) } })
      const source = result.outputFiles[0].text
      if (mode === 'production' || mode === 'unknown') {
        assert.equal(source.includes('Copied clean debug snapshot'), false)
        assert.equal(source.includes('Reset Full Character Onboarding'), false)
        assert.equal(source.includes('Reset own Field Survey quest only'), false)
      }
      await writeFile(file, source)
      const { act, mount } = await import(pathToFileURL(file).href)
      let root: { unmount(): void }
      await act(async () => { root = mount() })
      const other = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes('Other'))!
      await act(async () => other.click())
      const entry = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Developer Tools')
      assert.equal(!!entry, mode === 'development' || mode === 'staging')
      await act(async () => (document.querySelector('#direct') as HTMLElement).click())
      assert.equal(document.querySelector('output')!.textContent, entry ? 'devtools' : '')
      await act(async () => root!.unmount())
    } finally {
      await unlink(file).catch(() => {}); dom.window.close()
      for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
    }
  }
  t.diagnostic('All four build modes verified with the actual menu and FeaturePanelProvider.')
})

test('debug snapshot omits credentials, query parameters, emails and nested unapproved fields', async () => {
  const file = resolve(`node_modules/.tmp/dev-snapshot-${crypto.randomUUID()}.mjs`)
  await build({ entryPoints: ['src/features/devtools/debugSnapshot.ts'], bundle: true, packages: 'external', platform: 'node', format: 'esm', outfile: file })
  try {
    const { createDebugSnapshot } = await import(pathToFileURL(file).href)
    const secret = 'PRIVATE_SECRET'
    const snapshot = createDebugSnapshot({ environment: 'development', version: 'test', playerId: 'uuid', name: 'Grower', route: `/play?token=${secret}`, skills: { cultivation: { xp: 100 }, breeding: { xp: 0 }, genetics: { xp: 0 } }, currency: 1000, gardenLevel: 1, bootstrap: 'authenticated', authority: 'server', email: secret, authToken: secret, world: { world: 'Town', area: 'town', sessionId: 'scene-1', position: { x: 1, y: 2, token: secret }, multiplayer: { status: 'connected', layer: 'layer', remotePlayers: 2, reconnectToken: secret } } })
    assert.equal(JSON.stringify(snapshot).includes(secret), false)
    assert.equal(snapshot.route, '/play'); assert.deepEqual(snapshot.position, { x: 1, y: 2 })
  } finally { await unlink(file) }
})
