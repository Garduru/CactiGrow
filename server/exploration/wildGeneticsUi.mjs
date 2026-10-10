import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'

export async function verifyWildGeneticsUi(plants, grower, garden) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://wild.test/nursery', pretendToBeVisual: true }), originals = new Map()
  for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'IS_REACT_ACT_ENVIRONMENT']) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] })
  }
  dom.window.HTMLElement.prototype.scrollTo = function () {}
  const out = resolve('node_modules/.tmp/wild-ui-runtime.mjs')
  const contents = `
    import React,{act} from 'react'; import {createRoot} from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom';
    import {InventoryPage} from './src/features/inventory/InventoryPage'; import {SeedPicker} from './src/features/nursery/SeedPicker';
    import {PlantDetails} from './src/features/garden/PlantDetails'; import {GameStateContext} from './src/game/GameStateContext';
    import {createInitialGameState} from './src/game/gameState'; import {restoreServerGameState} from './src/game/restoreServerGameState';
    import {PlantLifecycleContext} from './src/app/PlantLifecycleContext'; import {getSpeciesById} from './src/data/species';
    import {CollectionKnowledge} from './src/features/garden/CollectionKnowledge';
    export {act}; export function setup(plants,grower,garden){ const state=restoreServerGameState(createInitialGameState(Date.now()),grower,plants,garden);
      const root=createRoot(document.getElementById('root')); let picked; const render=view=>root.render(<MemoryRouter><GameStateContext.Provider value={{state}}><PlantLifecycleContext.Provider value={{state:{authority:'server',status:'ready',projection:plants}}}>
        {view==='inventory'?<InventoryPage/>:view==='picker'?<SeedPicker seeds={[]} bredSeeds={[]} wildSeedLots={plants.wildSeedLots} onSelectWildSeed={async id=>{picked=id}} onSelect={()=>{}} onSelectBredSeed={()=>{}} onClose={()=>{}}/>:
        <><CollectionKnowledge plant={state.ownedPlants[0]} research={state.geneticsResearch} level={1}/><PlantDetails plant={state.ownedPlants[0]} species={getSpeciesById(state.ownedPlants[0].speciesId)} readOnly={false} onClose={()=>{}} organizationUnlocked={false} organization={{favorite:false,tags:[]}} displayAssignments={garden.displayAssignments} onFavoriteChange={()=>{}} onAddTag={()=>false} onRemoveTag={()=>{}} onAssignDisplay={()=>{}} onClearDisplay={()=>{}}/></>}
      </PlantLifecycleContext.Provider></GameStateContext.Provider></MemoryRouter>); return {root,render,getPicked:()=>picked}; }
  `
  await build({ stdin: { contents, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', outfile: out, define: { 'import.meta.env': JSON.stringify({ MODE: 'staging', DEV: false }) } })
  let ui, actCleanup
  try {
    const { act, setup } = await import(pathToFileURL(out).href + '?' + crypto.randomUUID())
    actCleanup = act
    ui = setup(plants, grower, garden)
    await act(() => ui.render('inventory'))
    assert.match(dom.window.document.body.textContent, /Wild genetic seed lots/); assert.match(dom.window.document.body.textContent, /Seed lots cannot be traded or mailed/)
    assert.equal(dom.window.document.querySelector('.inventory-item--bred')?.textContent.includes('vigor'), false)
    await act(() => ui.render('picker'))
    const wild = [...dom.window.document.querySelectorAll('button')].find(b => b.textContent.includes('Wild San Pedro seed lot')); assert.ok(wild)
    await act(async () => { wild.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await Promise.resolve() })
    assert.ok(plants.wildSeedLots.some(l => l.seedIds.includes(ui.getPicked())))
    await act(() => ui.render('details'))
    assert.match(dom.window.document.body.textContent, /Wild origin/); assert.match(dom.window.document.body.textContent, /Study Genetics/)
    assert.equal(dom.window.document.body.textContent.includes('Detected hidden carriers'), false)
    await act(() => ui.root.unmount()); ui = null
  } finally {
    if (ui) await actCleanup(() => ui.root.unmount())
    dom.window.close(); for (const [key, descriptor] of originals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  }
  if (process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE) await verifyBrowser(contents, plants, grower, garden)
}

// Real components with database-derived projections; this fixture never ships.
async function verifyBrowser(contents, plants, grower, garden) {
  const fixture = JSON.stringify({ plants, grower, garden }).replaceAll('<', '\\u003c')
  const bundle = await build({ stdin: { contents: contents + `\nconst data=${fixture}; window.wildUi=setup(data.plants,data.grower,data.garden); window.wildUi.render('inventory');`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false, loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ MODE: 'staging', DEV: false }) }, logLevel: 'silent' })
  const css = (await Promise.all(['src/index.css', 'src/styles/tokens.css', 'src/styles/game.css'].map(f => readFile(f, 'utf8')))).join('\n')
  const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root" style="overflow:auto;padding:16px"></div><script>${bundle.outputFiles[0].text}</script>`) })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const { chromium } = await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE, headless: true })
  const errors = []
  try {
    await mkdir('.wrangler/wild-genetics-work/visual', { recursive: true })
    const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    for (const width of [320, 360, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      for (const view of ['inventory', 'picker', 'details']) {
        await page.evaluate(v => window.wildUi.render(v), view)
        await page.getByText(view === 'inventory' ? 'Wild genetic seed lots' : view === 'picker' ? 'Wild San Pedro seed lot' : 'Wild origin:', { exact: view !== 'details' }).waitFor()
        assert.ok(await page.evaluate(() => [...document.querySelectorAll('.inventory-item,.seed-option,.plant-details')].every(el => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && el.scrollWidth <= el.clientWidth + 1 })), `${view} fits ${width}px`)
        assert.equal(await page.evaluate(() => document.body.textContent.includes('Detected hidden carriers')), false)
        if (view === 'details') await page.getByText('Wild origin:', { exact: false }).scrollIntoViewIfNeeded()
        await page.screenshot({ path: `.wrangler/wild-genetics-work/visual/${view}-${width}.png` })
        if (view === 'picker') { await page.getByRole('button', { name: /Wild San Pedro seed lot/ }).click(); const picked = await page.evaluate(() => window.wildUi.getPicked()); assert.ok(plants.wildSeedLots.some(l => l.seedIds.includes(picked))) }
      }
    }
    assert.deepEqual(errors, [])
  } finally { await browser.close(); await new Promise(r => server.close(r)) }
}
