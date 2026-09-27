import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { createFarmReturnState, createTownReturnState, resolveFarmReturnPath, resolveFarmSpawnId, createFarmTownRoadEntryState } from './farmReturnNavigation.ts'

test('Public homepage renders outside authentication; direct game routes retain the production access boundary', async (t) => {
  // Compile the actual React routes for server rendering using the existing build dependency.
  const directory = resolve('node_modules/.tmp')
  await mkdir(directory, { recursive: true })
  const file = resolve(directory, `website-routing-${crypto.randomUUID()}.mjs`)
  t.after(() => unlink(file))
  const result = await build({ stdin: { contents: `
    import React from 'react';
    import { renderToString } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import { AppRoutes } from './src/app/AppRouter';
    import { DeploymentAccessBoundary } from './src/app/DeploymentAccessBoundary';
    import { PlayerBootstrapContext } from './src/app/PlayerBootstrapContext';
    export function render(path) { return renderToString(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>); }
    export function access(state) { return renderToString(<PlayerBootstrapContext.Provider value={state}><DeploymentAccessBoundary><p>Game content</p></DeploymentAccessBoundary></PlayerBootstrapContext.Provider>); }
  `, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, jsx: 'automatic', platform: 'node', format: 'esm', packages: 'external',
    // Phaser is a browser renderer; this test exercises routing/access, not canvas rendering.
    plugins: [{ name: 'browser-renderer-placeholder', setup(plugin) {
      plugin.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'renderer-test' }))
      plugin.onLoad({ filter: /.*/, namespace: 'renderer-test' }, () => ({ contents: 'export default { Scene: class {} }' }))
    } }],
    loader: { '.css': 'empty' }, define: { 'import.meta.env.MODE': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_CACTIGROW_API_BASE_URL': '"https://dev.cactigrow.com"' } })
  await writeFile(file, result.outputFiles[0].contents)
  const { render, access } = await import(pathToFileURL(file).href)
  const homepage: string = render('/')
  assert.match(homepage, /cactigrow-logo.png/)
  assert.match(homepage, /href="\/play"/)
  assert.match(homepage, /PLAY NOW/)
  assert.doesNotMatch(homepage, /Establishing your secure session|game-header|Tokens/)
  for (const route of ['/play', '/town', '/nursery', '/garden', '/inventory', '/home', '/lab', '/mail', '/shop', '/market', '/farm', '/world-preview', '/collection', '/marketplace']) {
    assert.match(render(route), /Establishing your secure session/, route)
  }
  assert.doesNotMatch(access({ status: 'unauthenticated' }), /Game content/)
  assert.match(access({ status: 'authenticated' }), /Game content/)
})

test('Interior and Town return navigation target the same Farm at /play and preserve authored spawns', () => {
  assert.equal(resolveFarmReturnPath(undefined), '/play')
  assert.equal(resolveFarmReturnPath({ worldReturnTo: '/' }), '/play', 'old history entries still return to Farm')
  const nursery = createFarmReturnState('nursery')
  assert.equal(resolveFarmReturnPath(nursery), '/play')
  assert.equal(resolveFarmSpawnId(nursery), 'nursery-exterior')
  assert.equal(resolveFarmSpawnId(createFarmTownRoadEntryState()), 'road-from-town')
  assert.equal(resolveFarmReturnPath(createTownReturnState('shop')), '/town')
})
