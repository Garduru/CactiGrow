import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const evidence = resolve('.wrangler/exploration-browser')
const entry = `
import React,{useCallback,useEffect,useRef,useState} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
import {PlayerBootstrapContext} from './src/app/PlayerBootstrapContext';import {PlantLifecycleContext} from './src/app/PlantLifecycleContext';import {StartingContext} from './src/features/starting/StartingContext';import {WorldLocationContext} from './src/game-world/WorldLocationContext';
import {ExplorationProvider} from './src/features/exploration/ExplorationProvider';import {useExploration} from './src/features/exploration/ExplorationContext';import {ExplorationNotice} from './src/features/exploration/ExplorationNotice';import {ExplorationJournal} from './src/features/exploration/ExplorationJournal';
import {PhaserWorldCanvas} from './src/game-world/PhaserWorldHost';import {createLdtkWorldGame} from './src/game-world/createLdtkWorldGame';import {WORLD,findArea} from './shared/world/world';import {LocalMinimapStore} from './src/game-world/localMinimap';import {LocalMinimapContext} from './src/game-world/LocalMinimapContext';import {LocalMinimap} from './src/game-world/LocalMinimapView';
const params=new URLSearchParams(location.search),area=findArea(params.get('area'));window.fixtureArea=area;const node=area.interactables.find(e=>e.resourceType);const focus=params.get('focus')==='landmark'?area.landmarks[0]:params.get('focus')==='note'?area.interactables.find(e=>e.kind==='inspectable'):params.get('focus')==='peyote'?area.interactables.find(e=>e.resourceType&&e.speciesId==='lophophora-williamsii'):node;window.fixtureFocusedEntity=focus;
const start=params.get('focus')==='landmark'?{x:focus.x,y:focus.y+focus.height/2+70}:{x:focus.x,y:focus.y+180};
window.fixtureProjection={projectionVersion:1,revision:0,serverNow:new Date().toISOString(),harvestingXp:0,nodes:WORLD.areas.flatMap(a=>(a.interactables||[]).filter(e=>e.resourceType).map(e=>({entityId:e.entityId,areaId:a.areaId,readyAt:null}))),landmarks:WORLD.areas.flatMap(a=>(a.landmarks||[]).map(e=>({landmarkId:e.landmarkId,areaId:a.areaId,discoveredAt:null}))),notes:WORLD.areas.flatMap(a=>(a.interactables||[]).filter(e=>e.noteId).map(e=>({noteId:e.noteId,areaId:a.areaId,discoveredAt:null})))};
window.fixtureFailEntry=params.has('reject-entry');window.fixtureEntries=[];window.fixtureFailDiscovery=params.has('reject');window.fixtureCommands=[];window.fixtureReads=0;window.fixtureLifecycleReads=0;window.fixtureXP=0;window.fixtureTool=false;window.fixtureNote='';window.fixtureMoveSamples=0;window.fixtureListeners=new Set();window.fixtureRemote={presenceId:'17511805-24fb-4934-8fb8-bd495bc3ad55',publicId:'27511805-24fb-4934-8fb8-bd495bc3ad55',generation:1,label:'Nearby grower',appearance:'placeholder',sequence:0,position:{x:start.x+120,y:start.y},facing:'south',movement:'idle'};
const result=()=>({projection:structuredClone(window.fixtureProjection),starting:{revision:window.fixtureProjection.revision,serverNow:new Date().toISOString(),ownedEquipment:['field-knife'],equipment:{tool:'field-knife'},harvestingXp:window.fixtureXP}});
window.fixtureApi={async getExploration(){window.fixtureReads++;return result()},async explorationCommand(c){window.fixtureCommands.push(c);window.fixtureProjection.revision++;window.fixtureProjection.serverNow=new Date().toISOString();if(c.type==='harvest'){const item=window.fixtureProjection.nodes.find(n=>n.entityId===c.entityId);if(item.readyAt&&Date.parse(item.readyAt)>Date.now())throw Error('This plant is regrowing its seed pods.');item.readyAt=new Date(Date.now()+300000).toISOString();const e=area.interactables.find(e=>e.entityId===c.entityId);window.fixtureXP+=e.harvestingXp;window.fixtureProjection.harvestingXp=window.fixtureXP;return {...result(),reward:{name:e.displayName,speciesId:e.speciesId,quantity:6,harvestingXp:e.harvestingXp}}}if(c.type==='discover-landmark'){if(window.fixtureFailDiscovery){window.fixtureFailDiscovery=false;throw Error('Field record temporarily unavailable.')}await new Promise(r=>setTimeout(r,200));window.fixtureProjection.landmarks.find(n=>n.landmarkId===c.landmarkId).discoveredAt=new Date().toISOString()}else{const e=area.interactables.find(e=>e.entityId===c.entityId);window.fixtureProjection.notes.find(n=>n.noteId===e.noteId).discoveredAt=new Date().toISOString();window.fixtureNote=e.description}return result()},async resetExploration(){return result()}};
const lifecycle={state:{authority:'local'},refresh:async()=>{window.fixtureLifecycleReads++;return true}},starting={active:true,state:null,now:()=>Date.now(),error:'',pending:false,refresh:async()=>{},execute:async()=>false,applyProjection:s=>{window.fixtureXP=s.harvestingXp;window.fixtureTool=s.equipment.tool==='field-knife'}};
const bootstrap={status:'authenticated',bootstrap:{player:{playerId:'47511805-24fb-4934-8fb8-bd495bc3ad55'}},requestId:'test'};
window.fixtureMinimap=new LocalMinimapStore();window.fixtureMinimap.open=true;
function App(){const exploration=useExploration(),ref=useRef(exploration),[journal,setJournal]=useState(false);ref.current=exploration;window.fixtureExploration=exploration;window.fixtureShowJournal=()=>setJournal(true);
 const create=useCallback(parent=>{const connection={getSnapshot:()=>({remotes:[window.fixtureRemote]}),subscribe:f=>{window.fixtureListeners.add(f);return()=>window.fixtureListeners.delete(f)},sampleMovement:()=>{window.fixtureMoveSamples++}};
 const game=createLdtkWorldGame(parent,{area,position:start,camera:{},minimap:window.fixtureMinimap,pending:()=>false,connection,exploration:()=>ref.current.projection,explorationNow:()=>ref.current.now(),onExit:()=>{},onInteract:(entityId,position)=>{void ref.current.execute({type:area.interactables.find(e=>e.entityId===entityId).kind==='inspectable'?'inspect':'harvest',entityId,position})},onDiscover:(landmarkId,position)=>{if(ref.current.pending)return false;void ref.current.execute({type:'discover-landmark',landmarkId,position});return true}});window.fixtureGame=game;return game},[]);
 return <LocalMinimapContext.Provider value={{store:window.fixtureMinimap,open:true,toggle(){}}}><div className='world-page__viewport'><PhaserWorldCanvas projection={{locations:[]}} createGame={create} onIntent={()=>{}}/><LocalMinimap areaId={area.areaId} hidden={journal}/><ExplorationNotice/>{journal&&<div id='journal'><ExplorationJournal/></div>}</div></LocalMinimapContext.Provider>}
function Session(){const [revision,setRevision]=useState(1);window.fixtureChangeRevision=()=>setRevision(r=>r+1);return <WorldLocationContext.Provider value={{active:true,location:{revision,areaId:area.areaId},error:'',pending:false}}><StartingContext.Provider value={starting}><PlantLifecycleContext.Provider value={lifecycle}><ExplorationProvider><App/></ExplorationProvider></PlantLifecycleContext.Provider></StartingContext.Provider></WorldLocationContext.Provider>}
const root=createRoot(document.getElementById('root'));window.fixtureDestroy=()=>root.unmount();root.render(<MemoryRouter><PlayerBootstrapContext.Provider value={bootstrap}><Session/></PlayerBootstrapContext.Provider></MemoryRouter>);
window.fixtureScreen=point=>{const scene=window.fixtureGame.scene.getScenes(true)[0],camera=scene.cameras.main,rect=scene.game.canvas.getBoundingClientRect();return{x:rect.x+(point.x-camera.worldView.x)*camera.zoom,y:rect.y+(point.y-camera.worldView.y)*camera.zoom}};
`

test('real Phaser approaches wild plants by click/tap/E, discovers regions while walking, reconciles compact UI and cleans remote presentation', {
  skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set an existing Chromium executable.', timeout: 180000,
}, async () => {
  await mkdir(evidence, { recursive: true })
  const bundle = await build({ stdin: { contents: entry, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ MODE: 'staging', DEV: false }) }, logLevel: 'silent', plugins: [{ name: 'authoritative-response-fixture', setup(plugin) {
    plugin.onResolve({ filter: /\/browserApiClient$/ }, () => ({ path: 'api-fixture', namespace: 'fixture' }))
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const browserApiClient={getExploration:s=>window.fixtureApi.getExploration(s),restoreExplorationEntry:(c,s)=>{window.fixtureEntries.push(c);if(window.fixtureFailEntry){window.fixtureFailEntry=false;return Promise.reject(Error("Entry temporarily unavailable."))}return window.fixtureApi.getExploration(s)},explorationCommand:c=>window.fixtureApi.explorationCommand(c),resetExploration:c=>window.fixtureApi.resetExploration(c)}' }))
  } }] })
  const css = (await Promise.all(['src/styles/tokens.css', 'src/index.css', 'src/styles/game.css', 'src/game-world/localMinimap.css', 'src/features/exploration/exploration.css'].map(path => readFile(path, 'utf8')))).join('\n') + '\nhtml,body,#root,.world-page__viewport,.phaser-world-host{width:100%;height:100%;margin:0;overflow:hidden}#journal{position:absolute;inset:0;overflow:auto;padding:16px;background:var(--cg-surface);z-index:150;box-sizing:border-box;}'
  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/assets/')) { const path = resolve('public', '.' + req.url); if (!path.startsWith(resolve('public') + sep)) throw Error('Invalid asset path'); res.end(await readFile(path)); return }
      res.setHeader('content-type', 'text/html'); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style><div id="root"></div><script>' + bundle.outputFiles[0].text + '</script>')
    } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const { chromium } = await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE, headless: true, args: ['--no-sandbox'] })
  const errors = [], checks = []
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true })
    page.on('pageerror', error => errors.push(error.message))
    const load = async (area, focus = 'resource') => {
      await page.goto(`http://127.0.0.1:${server.address().port}/?area=${area}&focus=${focus}`)
      await page.waitForFunction(() => window.fixtureGame?.scene.getScenes(true)[0]?.player?.body && window.fixtureExploration?.projection && window.fixtureListeners.size === 1)
      await page.waitForTimeout(150)
      assert.equal(await page.evaluate(() => window.fixtureReads), 1, 'provider performs one initial exploration entry restoration')
      assert.equal(await page.evaluate(() => window.fixtureTool), true, 'server compatibility gear reconciles existing equipment projection')
    }
    const screen = point => page.evaluate(point => window.fixtureScreen(point), point)
    const resource = () => page.evaluate(() => window.fixtureFocusedEntity?.resourceType ? window.fixtureFocusedEntity : window.fixtureArea.interactables.find(entity => entity.resourceType))
    const harvestCount = () => page.evaluate(() => window.fixtureCommands.filter(command => command.type === 'harvest').length)
    await load('cross-path-1')
    const sanPedro = await resource(), tap = await screen(sanPedro)
    assert.equal(await page.evaluate(() => { const scene = window.fixtureGame.scene.getScenes(true)[0]; return scene.wildPlants.get(window.fixtureArea.interactables.find(e => e.resourceType).entityId).list[0].type }), 'Image', 'San Pedro uses approved plant raster')
    await page.mouse.click(tap.x, tap.y)
    await page.waitForFunction(() => window.fixtureCommands.some(command => command.type === 'harvest'))
    await page.getByRole('status').filter({ hasText: 'Harvested' }).waitFor()
    assert.equal(await harvestCount(), 1)
    assert.equal(await page.evaluate(() => window.fixtureLifecycleReads), 1, 'one targeted inventory refresh after authoritative reward')
    assert.equal(await page.evaluate(() => window.fixtureXP), sanPedro.harvestingXp)
    assert.equal(await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].wildPlants.get(window.fixtureArea.interactables.find(e => e.resourceType).entityId).alpha), .55, 'personal depletion is visible')
    const submitted = await page.evaluate(() => window.fixtureCommands.find(command => command.type === 'harvest'))
    assert.equal(submitted.expectedWorldRevision, 1)
    assert.ok(Math.hypot(submitted.position.x - sanPedro.x, submitted.position.y - sanPedro.y) <= 96)
    assert.equal(await page.locator('.local-minimap').textContent().then(text => text.includes(sanPedro.displayName)), false)
    const cooldownTap = await screen(sanPedro); await page.mouse.click(cooldownTap.x, cooldownTap.y)
    await page.getByRole('status').filter({ hasText: 'regrowing' }).waitFor()
    assert.equal(await page.evaluate(() => window.fixtureLifecycleReads), 1, 'rejected cooldown does not refetch inventory')
    const remote = await page.evaluate(() => { const scene = window.fixtureGame.scene.getScenes(true)[0]; return { count: scene.remotePlayers.players.size, samples: window.fixtureMoveSamples, listeners: window.fixtureListeners.size } })
    assert.equal(remote.count, 1); assert.ok(remote.samples > 0); assert.equal(remote.listeners, 1)
    await page.evaluate(() => window.fixtureChangeRevision()); await page.waitForTimeout(100)
    assert.equal(await page.evaluate(() => window.fixtureEntries.length), 1, 'normal transition revision never repeats entry restoration')
    await page.evaluate(() => window.fixtureDestroy())
    await page.waitForFunction(() => window.fixtureListeners.size === 0)
    checks.push('desktop path approach, in-range semantic position, authoritative XP/equipment/inventory reconciliation, personal cooldown and remote cleanup')

    await page.setViewportSize({ width: 390, height: 844 })
    await load('path-2')
    const mobileNode = await resource(), mobileTap = await screen(mobileNode)
    await page.touchscreen.tap(mobileTap.x, mobileTap.y)
    await page.waitForFunction(() => window.fixtureCommands.some(command => command.type === 'harvest'))
    await page.getByRole('status').filter({ hasText: 'Harvested' }).waitFor()
    assert.equal(await harvestCount(), 1)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const notification = await page.locator('.exploration-notice').boundingBox()
    assert.ok(notification.x >= 0 && notification.x + notification.width <= 391)
    const mapBox = await page.locator('.local-minimap').boundingBox()
    assert.ok(notification.y + notification.height <= mapBox.y, 'notification leaves the minimap unobstructed')
    await page.screenshot({ path: resolve(evidence, 'mobile-harvest.png') })
    checks.push('390px real touch approach and readable compact notification without overflow')

    await page.setViewportSize({ width: 1280, height: 900 })
    await load('path-3', 'peyote')
    const keyboardNode = await resource()
    const peyoteVisual = await page.evaluate(() => {
      const scene = window.fixtureGame.scene.getScenes(true)[0], node = window.fixtureArea.interactables.find(entity => entity.resourceType && entity.speciesId === 'lophophora-williamsii')
      const container = scene.wildPlants.get(node.entityId), image = container.list[0], source = image.texture.getSourceImage()
      const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height
      const context = canvas.getContext('2d'); context.drawImage(source, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data, colors = new Set()
      let transparent = 0, painted = 0
      for (let index = 0; index < pixels.length; index += 4) { if (pixels[index + 3] < 8) transparent++; if (pixels[index + 3] > 200) { painted++; colors.add([pixels[index] >> 4, pixels[index + 1] >> 4, pixels[index + 2] >> 4].join(',')) } }
      return { type: image.type, key: image.texture.key, sourceWidth: source.width, sourceHeight: source.height, width: image.displayWidth, height: image.displayHeight, originX: image.originX, originY: image.originY, transparent, painted, colors: colors.size, x: container.x, y: container.y, node }
    })
    assert.equal(peyoteVisual.type, 'Image'); assert.equal(peyoteVisual.key, 'wild-peyote-v01')
    assert.equal(peyoteVisual.width, 90); assert.ok(Math.abs(peyoteVisual.height / peyoteVisual.width - peyoteVisual.sourceHeight / peyoteVisual.sourceWidth) < .0001)
    assert.equal(peyoteVisual.originX, .5); assert.equal(peyoteVisual.originY, 1)
    assert.equal(peyoteVisual.x, peyoteVisual.node.x); assert.equal(peyoteVisual.y, peyoteVisual.node.y)
    assert.ok(peyoteVisual.transparent > 100 && peyoteVisual.painted > 1000 && peyoteVisual.colors > 24, 'transparent botanical art has visible modeled ribs/areoles and shading rather than a flat marker')
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150)
    await page.screenshot({ path: resolve(evidence, 'mobile-peyote.png') })
    await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(150)
    await page.evaluate(point => window.fixtureGame.scene.getScenes(true)[0].navigation.move(window.fixtureGame.scene.getScenes(true)[0].player, { x: point.x, y: point.y + 110 }), keyboardNode)
    await page.waitForFunction(point => Math.hypot(window.fixtureGame.scene.getScenes(true)[0].player.x - point.x, window.fixtureGame.scene.getScenes(true)[0].player.y - point.y) < 145, keyboardNode)
    await page.locator('canvas').focus()
    await page.keyboard.down('e'); await page.waitForTimeout(120); await page.keyboard.up('e')
    await page.waitForFunction(() => window.fixtureCommands.some(command => command.type === 'harvest'))
    assert.equal(await harvestCount(), 1)
    checks.push('wild Peyote uses proportional transparent botanical bitmap at authored foot; keyboard E retains the same approach and harvest path')

    await load('the-first-basin', 'landmark')
    await page.evaluate(() => window.fixtureShowJournal())
    await page.getByText('Unknown landmark', { exact: true }).first().waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Entrance Grove', exact: true }).count(), 0)
    await load('the-first-basin', 'landmark')
    const grove = await page.evaluate(() => window.fixtureArea.landmarks[0])
    await page.evaluate(point => { const scene = window.fixtureGame.scene.getScenes(true)[0]; scene.navigation.move(scene.player, { x: point.x, y: point.y - 40 }) }, grove)
    await page.waitForFunction(() => window.fixtureCommands.some(command => command.type === 'discover-landmark'))
    const during = await page.evaluate(() => { const scene = window.fixtureGame.scene.getScenes(true)[0]; return { moving: Math.hypot(scene.player.body.velocity.x, scene.player.body.velocity.y), route: scene.navigation.path.length } })
    assert.ok(during.moving > 0 && during.route > 0, 'discovery request does not interrupt the active walk')
    await page.getByRole('status').filter({ hasText: 'Landmark discovered' }).waitFor()
    await page.waitForTimeout(400)
    assert.equal(await page.evaluate(() => window.fixtureCommands.filter(command => command.type === 'discover-landmark').length), 1)
    assert.equal(await page.locator('.local-minimap').textContent().then(text => text.includes(grove.displayName)), false)
    await page.evaluate(() => window.fixtureShowJournal())
    await page.getByRole('heading', { name: grove.displayName, exact: true }).waitFor()
    await page.setViewportSize({ width: 320, height: 700 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#journal').scrollWidth <= document.querySelector('#journal').clientWidth), true)
    await page.screenshot({ path: resolve(evidence, 'mobile-journal.png') })
    checks.push('physical region entry while moving, one request, persisted projection Journal names and320px layout')

    await page.setViewportSize({ width: 1280, height: 900 })
    await load('the-first-basin', 'landmark&reject=1')
    await page.evaluate(() => { const scene = window.fixtureGame.scene.getScenes(true)[0], point = window.fixtureArea.landmarks[0]; scene.navigation.move(scene.player, { x: point.x, y: point.y - 40 }) })
    await page.getByRole('button', { name: 'Retry discovery' }).waitFor()
    await page.waitForTimeout(600)
    assert.equal(await page.evaluate(() => window.fixtureCommands.filter(command => command.type === 'discover-landmark').length), 1, 'failed entry cannot create a frame request storm')
    await page.getByRole('button', { name: 'Retry discovery' }).click()
    await page.getByRole('status').filter({ hasText: 'Landmark discovered' }).waitFor()
    const attempts = await page.evaluate(() => window.fixtureCommands.filter(command => command.type === 'discover-landmark'))
    assert.equal(attempts.length, 2); assert.equal(attempts[0].commandId, attempts[1].commandId, 'explicit retry retains the ambiguous receipt')
    checks.push('failed discovery offers explicit compact retry with unchanged receipt and no request storm')

    await page.goto(`http://127.0.0.1:${server.address().port}/?area=path-2&reject-entry=1`)
    await page.getByRole('button', { name: 'Retry field record' }).waitFor()
    await page.waitForTimeout(200)
    assert.equal(await page.evaluate(() => window.fixtureEntries.length), 1)
    await page.getByRole('button', { name: 'Retry field record' }).click()
    await page.waitForFunction(() => !!window.fixtureExploration.projection)
    const entryAttempts = await page.evaluate(() => window.fixtureEntries)
    assert.equal(entryAttempts.length, 2); assert.equal(entryAttempts[0].commandId, entryAttempts[1].commandId)
    assert.equal(await page.getByRole('button', { name: 'Retry field record' }).count(), 0)
    checks.push('session entry failure is explicit, retries the same restoration receipt, and never loops on normal world revisions')

    await page.setViewportSize({ width: 1280, height: 900 })
    await load('basin-cave', 'note')
    const formation = await page.evaluate(() => window.fixtureArea.interactables.find(entity => entity.kind === 'inspectable')), formationTap = await screen(formation)
    await page.mouse.click(formationTap.x, formationTap.y)
    await page.waitForFunction(() => window.fixtureCommands.some(command => command.type === 'inspect'))
    await page.getByRole('status').filter({ hasText: formation.displayName }).waitFor()
    await page.evaluate(() => window.fixtureShowJournal())
    await page.getByRole('heading', { name: formation.displayName, exact: true }).waitFor()
    assert.equal(await page.locator('#journal').textContent().then(text => text.includes(formation.description)), true)
    checks.push('cave inspectable is approachable and records the actual flavor note in Journal')
    assert.deepEqual(errors, [])
    await writeFile(resolve(evidence, 'result.json'), JSON.stringify({ checks, errors }, null, 2))
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
})
