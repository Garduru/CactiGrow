import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

// Actual Chrome/Phaser capture before Settlement Art V1 changed either scene.
// Includes static bodies, registered locked images, interactions, entries,
// display anchors, inflated obstacles, graph nodes and deterministic routes.
const PRESERVED_GEOMETRY = {
  'player-farm': '0cb3f33ef5a90ab551e063d96094139d06446469cce95530a598969d93ab7a5c',
  'town-p1': 'e06a0f59de80a6d6aff61df39831d4bba6fa22eb42bc6c82d2e9e2621490ae06',
}
const EVIDENCE = '.wrangler/settlement-art-work'
const REQUIRE_ART = process.env.CACTIGROW_SETTLEMENT_BASELINE_ONLY !== '1'
const AREAS = process.env.CACTIGROW_SETTLEMENT_AREA ? [process.env.CACTIGROW_SETTLEMENT_AREA] : ['player-farm', 'town-p1']

const fixtureEntry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {WorldBridge} from './src/game-world/WorldBridge';
import {createFarmWorldGame} from './src/game-world/createFarmWorldGame';
import {createTownWorldGame} from './src/game-world/createTownWorldGame';
import {createFarmWorldProjection} from './src/game-world/farmWorldProjection';
import {townWorldProjection} from './src/game-world/townWorldProjection';
import {createInitialGameState} from './src/game/gameState';
import {findArea} from './shared/world/world';
import {farmWorldSpawns,MAILBOX_APPROACH_POINTS} from './src/game-world/farmWorldLayout';
import {townWorldSpawns} from './src/game-world/townWorldLayout';
import {GARDEN_DISPLAY_ANCHORS} from './src/game-world/gardenDisplayAnchors';
import {LocalMinimapStore,minimapSurfaces} from './src/game-world/localMinimap';
import {LocalMinimapContext} from './src/game-world/LocalMinimapContext';
import {LocalMinimap} from './src/game-world/LocalMinimapView';
import {CHARACTER_MODULES} from './src/characters/characterArt';
const id=new URLSearchParams(location.search).get('area')||'player-farm', area=findArea(id);
const state=createInitialGameState(Date.now(),true), farm=createFarmWorldProjection(state.property,state.geneticsLab,[],{});
window.fixtureIntents=[];window.fixtureExits=[];window.fixtureGuidance=null;
window.fixtureModules=Object.keys(CHARACTER_MODULES);window.fixtureSpawns=id==='player-farm'?farmWorldSpawns:townWorldSpawns;
window.fixtureSurfaces=()=>minimapSurfaces(area);
window.fixtureMailbox=MAILBOX_APPROACH_POINTS;window.fixtureGardenAnchors=GARDEN_DISPLAY_ANCHORS;
window.fixtureMinimap=new LocalMinimapStore();window.fixtureMinimap.open=true;
const bridge=new WorldBridge(id==='player-farm'?farm:townWorldProjection,i=>window.fixtureIntents.push(i));
const appearance={body:1,skin:2,shirt:1,hair:3,hairColor:1,pants:1,hat:2,accessory:1};
let remotes=[{presenceId:'00000000-0000-4000-8000-000000000002',publicId:'00000000-0000-4000-8000-000000000002',generation:1,label:'Masculine Fixture',appearance:{body:0,skin:1,shirt:2,hair:0,hairColor:0,pants:2,hat:0,accessory:0},sequence:0,position:{x:1000,y:900},facing:'south',movement:'stopped'},
{presenceId:'00000000-0000-4000-8000-000000000003',publicId:'00000000-0000-4000-8000-000000000003',generation:1,label:'Feminine Fixture',appearance,sequence:0,position:{x:1190,y:900},facing:'south',movement:'stopped'},
{presenceId:'00000000-0000-4000-8000-000000000004',publicId:'00000000-0000-4000-8000-000000000004',generation:1,label:'Legacy Fixture',appearance:'placeholder',sequence:0,position:{x:1390,y:1000},facing:'south',movement:'stopped'}];
const listeners=new Set();window.fixtureListeners=listeners;
const connection={getSnapshot:()=>({status:'connected',remotes,chatMessages:[]}),subscribe:l=>{listeners.add(l);return()=>listeners.delete(l)},sampleMovement(){}};
window.fixturePublishRemote=(index,position,facing,movement)=>{remotes=remotes.map((p,i)=>i===index?{...p,sequence:p.sequence+1,position,facing,movement}:p);listeners.forEach(l=>l())};
const foundation={area,position:area.spawns.find(s=>s.entryId==='default'),appearance,camera:{},minimap:window.fixtureMinimap,pending:()=>false,guidance:()=>window.fixtureGuidance,onExit:id=>window.fixtureExits.push(id)};
window.fixtureGame=id==='player-farm'?createFarmWorldGame(document.getElementById('root'),bridge,{spawnId:'default',foundation}):createTownWorldGame(document.getElementById('root'),bridge,{spawnId:'farm-arrival',foundation,connection});
function MapControls(){const [open,setOpen]=useState(true);const toggle=()=>setOpen(window.fixtureMinimap.toggleOpen());return <LocalMinimapContext.Provider value={{store:window.fixtureMinimap,open,toggle}}><button className='fixture-map-toggle' onClick={toggle}>Map</button><LocalMinimap areaId={id} hidden={false}/></LocalMinimapContext.Provider>}
createRoot(document.getElementById('map-root')).render(<MapControls/>);
window.fixtureCapture=()=>{
const s=window.fixtureGame.scene.getScenes(true)[0], map=s.navigation.map, area=s.foundation.area;
const solid=o=>{const b=o.body;return{x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,height:b.height}};
// Gate art may change. These seven building registrations are locked.
const visuals=[...s.editorVisuals].filter(([id,v])=>id!=='town'&&id!=='farm'&&v.main.type==='Image').map(([id,v])=>({id,texture:v.main.texture.key,x:v.main.x,y:v.main.y,width:v.main.displayWidth,height:v.main.displayHeight,originX:v.main.originX,originY:v.main.originY,depth:v.main.depth}));
const interactions=s.interactionTargets.map(t=>({id:t.location.id,route:t.location.route,layout:t.layout,center:s.getInteractionCenter?s.getInteractionCenter(t.layout):s.getInteraction(t.layout),radius:s.getInteractionRadius?s.getInteractionRadius(t.layout):s.getInteraction(t.layout).radius}));
const points=[...Object.entries(window.fixtureSpawns).map(([id,p])=>({id,...p})),...interactions.map(t=>({id:t.id+'-approach',x:t.layout.approachX,y:t.layout.approachY})),...area.exits.map(e=>({id:e.exitId,x:e.x,y:e.y})),...(area.areaType==='farm'?window.fixtureMailbox.map(p=>({id:'mail-'+p.name,x:p.x,y:p.y})):[])];
const routes=points.map(p=>({id:p.id,walkable:map.walkable(p),fromSpawn:map.route(area.spawns.find(s=>s.entryId==='default'),p)}));
return {areaId:area.areaId,width:s.physics.world.bounds.width,height:s.physics.world.bounds.height,cameraBounds:{width:s.cameras.main.getBounds().width,height:s.cameras.main.getBounds().height},player:{width:s.player.width,height:s.player.height,radius:s.player.body.radius,depth:s.player.depth},solids:s.staticColliders.map(solid),ownedSolids:[...s.ownedColliders].map(([id,objects])=>({id,solids:objects.map(solid)})),visuals,interactions,spawns:window.fixtureSpawns,authoredSpawns:area.spawns,exits:area.exits,gardenAnchors:area.areaType==='farm'?window.fixtureGardenAnchors:[],mailboxApproaches:area.areaType==='farm'?window.fixtureMailbox:[],navigation:{obstacles:map.obstacles,nodes:map.nodes,routes}};
};
`

test((REQUIRE_ART ? 'Settlement Art V1' : 'Settlement pre-art fixture') + ' preserves actual Farm/Town geometry, doors, walking, minimap and guidance', {
  skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set an existing Chromium executable.',
  timeout: 360000,
}, async () => {
  await mkdir(EVIDENCE, { recursive: true })
  const compiled = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: fixtureEntry }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ MODE: 'staging', DEV: false }) }, logLevel: 'silent' })
  const css = (await Promise.all(['src/styles/tokens.css', 'src/index.css', 'src/styles/game.css', 'src/game-world/localMinimap.css'].map(f => readFile(f, 'utf8')))).join('\n') + '\nhtml,body,#root{width:100%;height:100%;margin:0;overflow:hidden}.fixture-map-toggle{position:fixed;top:12px;left:12px;z-index:20;padding:12px;background:#211710;color:#fff3dc;border:1px solid #9f5b34;border-radius:8px}'
  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/assets/')) { const path = resolve('public', '.' + req.url); if (!path.startsWith(resolve('public') + sep)) throw Error('Invalid asset path'); res.end(await readFile(path)); return }
      res.setHeader('content-type', 'text/html'); res.end('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + css + '</style><div id="root"></div><div id="map-root"></div><script>' + compiled.outputFiles[0].text + '</script>')
    } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const { chromium } = await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE, headless: true, args: ['--no-sandbox'] })
  const errors = [], results = []
  let page, phase = 'boot'
  try {
    page = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true })
    page.on('pageerror', e => errors.push(e.message))
    const ready = () => page.waitForFunction(() => {
      const s = window.fixtureGame?.scene.getScenes(true)[0]
      if (!s?.player?.body || !window.fixtureMinimap.snapshot() || !window.fixtureModules.every(key => s.textures.exists('character-module:' + key))) return false
      const art = s.player.list.find(o => o.name === 'character-art-v1'), canvas = art?.texture.getSourceImage()
      if (!canvas?.getContext || canvas.width !== 320 || canvas.height !== 448) return false
      const pixels = canvas.getContext('2d').getImageData(art.frame.cutX, art.frame.cutY, art.frame.cutWidth, art.frame.cutHeight).data
      let opaque = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) opaque++
      return opaque > 600
    })
    const walk = async point => {
      await page.locator('canvas').focus()
      const destination = await page.evaluate(p => { const s = window.fixtureGame.scene.getScenes(true)[0]; return s.navigation.move(s.player, p) ? s.navigation.destination : null }, point)
      assert.ok(destination, 'existing navigation resolves a reachable destination')
      await page.waitForFunction(p => { const s = window.fixtureGame.scene.getScenes(true)[0]; return Math.hypot(s.player.x - p.x, s.player.y - p.y) < 5 && s.navigation.destination === null }, destination, { timeout: 20000 })
      await page.waitForFunction(() => !window.fixtureGame.scene.getScenes(true)[0].player.getData('characterMotion').moving)
    }
    const screenPoint = point => page.evaluate(p => { const s = window.fixtureGame.scene.getScenes(true)[0], c = s.cameras.main, b = s.game.canvas.getBoundingClientRect(); return { x: b.x + (p.x - c.worldView.x) * c.zoom, y: b.y + (p.y - c.worldView.y) * c.zoom } }, point)
    const resize = async (width, height) => {
      await page.setViewportSize({ width, height })
      await page.waitForFunction(({ width, height }) => { const s = window.fixtureGame.scene.getScenes(true)[0]; return s.scale.width === width && s.scale.height === height && s.cameras.main.worldView.contains(s.player.x, s.player.y) }, { width, height })
      await page.waitForTimeout(200)
    }
    const mapOpen = async open => { if (await page.getByLabel('Local minimap', { exact: true }).isVisible() !== open) await page.getByRole('button', { name: 'Map', exact: true }).click() }
    for (const areaId of AREAS) {
      phase = areaId + ': arrival'
      assert.ok(PRESERVED_GEOMETRY[areaId], 'only the two authored settlement Areas are accepted')
      await page.goto('http://127.0.0.1:' + server.address().port + '/?area=' + areaId); await ready()
      const geometry = await page.evaluate(() => window.fixtureCapture())
      assert.equal(createHash('sha256').update(JSON.stringify(geometry)).digest('hex'), PRESERVED_GEOMETRY[areaId], areaId + ': all captured gameplay geometry and locked artwork registration stay exact')
      assert.ok(geometry.navigation.routes.every(r => r.fromSpawn), 'every exterior spawn, approach and exit retains a reachable route or its existing boundary projection')
      assert.deepEqual(await page.evaluate(() => window.fixtureMinimap.snapshot().blocked), geometry.navigation.obstacles)
      const result = { areaId, bodies: geometry.solids.length, graphNodes: geometry.navigation.nodes.length, buildings: [], mailboxSides: [], guidance: [], minimap: false, minimapTouch: false, automaticExit: false, mobileWidths: [], remotes: [], art: null }
      results.push(result)
      if (REQUIRE_ART) {
        const art = await page.evaluate(() => {
          const s = window.fixtureGame.scene.getScenes(true)[0], area = s.foundation.area
          const layers = (area.visualLayers ?? []).map(layer => { const key = 'terrain:' + layer.tileset.uid; return { name: layer.name, tilesetUID: layer.tileset.uid, tiles: layer.tiles.length, texture: s.textures.exists(key), drawn: s.children.list.filter(o => o.name === 'settlement:' + layer.name && (o.texture?.key === key || o.texture?.key.startsWith(key + ':'))).length } })
          const atlases = [...new Map((area.visualLayers ?? []).map(layer => [layer.tileset.uid, layer.tileset])).values()].map(tileset => {
            const key = 'terrain:' + tileset.uid, texture = s.textures.get(key), image = texture.getSourceImage()
            return { key, path: tileset.path, width: image.width, height: image.height, decodedRGBABytes: image.width * image.height * 4, registeredFrames: Object.keys(texture.frames).filter(name => name !== '__BASE').length }
          })
          const generated = s.textures.getTextureKeys().filter(key => key.startsWith('terrain:') && !/^terrain:\d+$/.test(key)).map(key => {
            const source = s.textures.get(key).getSourceImage()
            return { key, canvas: source instanceof HTMLCanvasElement, width: source.width, height: source.height, decodedRGBABytes: source.width * source.height * 4 }
          })
          const atlasBytes = atlases.reduce((sum, atlas) => sum + atlas.decodedRGBABytes, 0), canvasBytes = generated.reduce((sum, texture) => sum + texture.decodedRGBABytes, 0)
          return { rendered: s.settlementRendered, layers, surfaces: window.fixtureSurfaces(), textureMemory: { estimate: 'RGBA8 source pixels only; GPU storage, mipmaps and object metadata are not measured', atlases, atlasDecodedRGBABytes: atlasBytes, generatedTerrainCanvasCount: generated.length, generatedTerrainCanvases: generated, incrementalCanvasRGBABytes: canvasBytes, incrementalCanvasToAtlasRatio: atlasBytes ? canvasBytes / atlasBytes : 0, registeredAtlasFrameCount: atlases.reduce((sum, atlas) => sum + atlas.registeredFrames, 0), framesShareAtlasPixels: true, settlementImageCount: s.children.list.filter(o => o.name.startsWith('settlement:')).length } }
        })
        assert.equal(art.rendered, true, 'the settlement source atlas has loaded and replaced template visuals')
        assert.equal(art.textureMemory.settlementImageCount, art.layers.reduce((sum, layer) => sum + layer.tiles, 0), 'each settlement image is counted once across canonical layers and tilesets')
        assert.ok(art.layers.every(layer => layer.texture && layer.drawn === layer.tiles), 'each source layer is drawn from its own authored tileset')
        for (const name of ['Ground', 'GroundVariation', 'Paths', 'StructureGrounding', 'BoundaryEdges', 'Decorations']) {
          assert.ok(art.layers.filter(layer => layer.name === name).reduce((sum, layer) => sum + layer.tiles, 0) > 0, name + ' is authored and rendered completely')
        }
        assert.ok(art.surfaces.length > 0)
        const surfaces = await page.locator('[data-minimap-layer]').evaluateAll(elements => elements.map(e => ({ layer: e.getAttribute('data-minimap-layer'), x: Number(e.getAttribute('x')), y: Number(e.getAttribute('y')), width: Number(e.getAttribute('width')), height: Number(e.getAttribute('height')) })))
        assert.deepEqual(surfaces, art.surfaces, 'the minimap uses the same authored roads and courtyards')
        assert.ok(art.textureMemory.generatedTerrainCanvases.every(texture => texture.canvas), 'blended terrain cache contains actual canvas sources')
        for (const atlas of art.textureMemory.atlases) {
          const file = await readFile(resolve('public', '.' + atlas.path))
          atlas.compressedBytes = file.length; atlas.fileSha256 = createHash('sha256').update(file).digest('hex')
        }
        result.art = { layers: art.layers, surfaces: art.surfaces.length, textureMemory: art.textureMemory }
      }
      await mapOpen(false)
      // Make the full composition available before the longer interaction walk.
      const initialZoom = await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0], c = s.cameras.main, zoom = c.zoom; c.stopFollow(); c.setZoom(Math.min(s.scale.width / s.foundation.area.width, s.scale.height / s.foundation.area.height)); c.centerOn(s.foundation.area.width / 2, s.foundation.area.height / 2); return zoom })
      await page.waitForTimeout(100)
      await page.screenshot({ path: EVIDENCE + '/' + areaId + '-overview.png' })
      await page.evaluate(zoom => { const s = window.fixtureGame.scene.getScenes(true)[0], c = s.cameras.main; c.setZoom(zoom); c.centerOn(s.player.x, s.player.y); c.startFollow(s.player, true, .1, .1) }, initialZoom)
      await page.waitForTimeout(100)
      await page.screenshot({ path: EVIDENCE + '/' + areaId + '-arrival-desktop.png' })
      for (const target of geometry.interactions) {
        phase = areaId + ': ' + target.id + ' entrance'
        const point = { x: target.layout.approachX, y: target.layout.approachY + 120 }
        await walk(point)
        const before = await page.evaluate(() => window.fixtureIntents.length)
        const body = geometry.ownedSolids.find(o => o.id === target.id).solids.reduce((a, b) => a.y + a.height / 2 > b.y + b.height / 2 ? a : b)
        const click = await screenPoint({ x: body.x, y: body.y + body.height / 2 - 3 })
        assert.ok(click.x > 0 && click.x < 1280 && click.y > 0 && click.y < 900, target.id + ' body is visibly selectable')
        await page.mouse.click(click.x, click.y)
        await page.waitForFunction(n => window.fixtureIntents.length === n + 1, before, { timeout: 20000 })
        assert.deepEqual(await page.evaluate(() => window.fixtureIntents.at(-1)), { type: 'ENTER_LOCATION', locationId: target.id })
        await page.waitForFunction(() => !window.fixtureGame.scene.getScenes(true)[0].player.getData('characterMotion').moving)
        await page.screenshot({ path: EVIDENCE + '/' + areaId + '-' + target.id + '-desktop.png' })
        await page.locator('canvas').focus(); await page.keyboard.press('e')
        assert.equal(await page.evaluate(() => window.fixtureIntents.length), before + 2, 'E activates the same nearby target once')
        result.buildings.push(target.id)
      }
      if (areaId === 'player-farm') {
        for (const p of geometry.mailboxApproaches) {
          phase = areaId + ': Mail from ' + p.name
          const start = { x: p.x + (p.name === 'LEFT' ? -90 : p.name === 'RIGHT' ? 90 : 0), y: p.y + (p.name === 'BACK' ? -90 : p.name === 'FRONT' ? 90 : 0) }
          await walk(start)
          const chosen = await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].getNearestMailboxApproach())
          assert.ok(geometry.mailboxApproaches.some(a => a.x === chosen.x && a.y === chosen.y), p.name + ' uses an existing reachable authored approach')
          const before = await page.evaluate(() => window.fixtureIntents.length), click = await screenPoint({ x: 1120, y: 1575 })
          await page.mouse.click(click.x, click.y); await page.waitForFunction(n => window.fixtureIntents.length === n + 1, before)
          assert.equal(await page.evaluate(() => window.fixtureIntents.at(-1).locationId), 'mail')
          result.mailboxSides.push({ from: p.name, chosen: chosen.name })
        }
        for (const key of ['nursery', 'garden', 'lab']) {
          phase = areaId + ': ' + key + ' guidance'
          const target = geometry.interactions.find(t => t.id === key)
          await walk({ x: target.layout.approachX, y: target.layout.approachY })
          await page.evaluate(key => { window.fixtureGuidance = 'building:' + key }, key)
          await page.waitForFunction(() => window.fixtureGame.scene.getScenes(true)[0].children.list.find(o => o.name === 'tutorial-guidance')?.visible)
          assert.equal(await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].children.list.find(o => o.name === 'tutorial-guidance').depth), 145)
          await page.screenshot({ path: EVIDENCE + '/farm-guidance-' + key + '-desktop.png' })
          await resize(390, 844)
          await page.screenshot({ path: EVIDENCE + '/farm-guidance-' + key + '-mobile.png' })
          await resize(1280, 900); result.guidance.push(key)
        }
        await page.evaluate(() => { window.fixtureGuidance = null })
      } else {
        for (let index = 0; index < 3; index++) {
          phase = areaId + ': remote ' + index
          const initial = await page.evaluate(i => {
            const s = window.fixtureGame.scene.getScenes(true)[0], remote = [...s.remotePlayers.players.values()][i]
            const art = remote.avatar.list.find(o => o.name === 'character-art-v1')
            return { publicId: remote.presence.publicId, position: remote.rendered, appearance: remote.avatar.getData('characterAppearance'), depth: remote.avatar.depth, physical: !!remote.avatar.body, size: [art.texture.getSourceImage().width, art.texture.getSourceImage().height] }
          }, index)
          assert.equal(initial.depth, 80); assert.equal(initial.physical, false); assert.deepEqual(initial.size, [320, 448])
          assert.equal(initial.appearance.body, index === 1 ? 1 : 0, 'saved and legacy appearances retain their body choice')
          const end = { x: initial.position.x + 60, y: initial.position.y }
          await page.evaluate(({ index, end }) => window.fixturePublishRemote(index, end, 'east', 'moving'), { index, end })
          await page.waitForFunction(i => [...window.fixtureGame.scene.getScenes(true)[0].remotePlayers.players.values()][i].avatar.getData('characterMotion').moving, index)
          await page.waitForFunction(({ index, end }) => Math.abs([...window.fixtureGame.scene.getScenes(true)[0].remotePlayers.players.values()][index].rendered.x - end.x) < 0.1, { index, end })
          await page.evaluate(({ index, end }) => window.fixturePublishRemote(index, end, 'east', 'stopped'), { index, end })
          await page.waitForFunction(i => { const motion = [...window.fixtureGame.scene.getScenes(true)[0].remotePlayers.players.values()][i].avatar.getData('characterMotion'); return !motion.moving && motion.facing === 'east' && motion.frame === 0 }, index)
          await walk({ x: end.x - 145, y: end.y + 90 })
          const before = await page.evaluate(() => window.fixtureIntents.length), click = await screenPoint({ x: end.x, y: end.y - 32 })
          await page.mouse.click(click.x, click.y)
          await page.waitForFunction(n => window.fixtureIntents.length === n + 1, before)
          assert.deepEqual(await page.evaluate(() => window.fixtureIntents.at(-1)), { type: 'OPEN_PLAYER_PROFILE', publicId: initial.publicId })
          await page.screenshot({ path: EVIDENCE + '/town-remote-' + index + '-desktop.png' })
          result.remotes.push({ publicId: initial.publicId, body: initial.appearance.body, interpolation: true, idleFacing: 'east', profile: true })
        }
      }
      await walk({ x: areaId === 'player-farm' ? 1500 : 1100, y: areaId === 'player-farm' ? 1100 : 850 })
      phase = areaId + ': minimap'
      await mapOpen(true)
      const svg = page.locator('.local-minimap svg')
      const before = await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0]; return { x: s.player.x, y: s.player.y } })
      const destination = { x: before.x, y: before.y + 140 }
      const mapPoint = await svg.evaluate((el, p) => { const point = el.createSVGPoint(); point.x = p.x; point.y = p.y; const q = point.matrixTransform(el.getScreenCTM()); return { x: q.x, y: q.y } }, destination)
      await page.mouse.click(mapPoint.x, mapPoint.y)
      await page.waitForFunction(() => window.fixtureGame.scene.getScenes(true)[0].player.getData('characterMotion').moving)
      await page.waitForFunction(p => { const s = window.fixtureGame.scene.getScenes(true)[0]; return Math.hypot(s.player.x - p.x, s.player.y - p.y) < 25 && s.navigation.destination === null }, destination)
      await page.waitForFunction(() => { const s = window.fixtureGame.scene.getScenes(true)[0]; return Math.abs(Number(document.querySelector('.local-minimap__player')?.getAttribute('cx')) - s.player.x) < 5 })
      const blocked = geometry.navigation.obstacles[0], bad = await svg.evaluate((el, p) => { const point = el.createSVGPoint(); point.x = p.x; point.y = p.y; const q = point.matrixTransform(el.getScreenCTM()); return { x: q.x, y: q.y } }, { x: (blocked.left + blocked.right) / 2, y: (blocked.top + blocked.bottom) / 2 })
      await page.mouse.click(bad.x, bad.y); await page.getByText('That point cannot be reached.', { exact: true }).waitFor(); result.minimap = true
      await page.screenshot({ path: EVIDENCE + '/' + areaId + '-minimap-desktop.png' })
      await mapOpen(false)
      for (const width of [320, 360, 390]) {
        phase = areaId + ': mobile ' + width
        await resize(width, 844)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        assert.equal(await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0]; return s.cameras.main.worldView.contains(s.player.x, s.player.y) }), true)
        await mapOpen(true)
        const box = await page.getByLabel('Local minimap', { exact: true }).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width)
        await page.screenshot({ path: EVIDENCE + '/' + areaId + '-minimap-' + width + '.png' }); await mapOpen(false)
        await page.screenshot({ path: EVIDENCE + '/' + areaId + '-mobile-' + width + '.png' }); result.mobileWidths.push(width)
        if (width === 390) {
          await mapOpen(true)
          const touchDestination = await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0]; return { x: s.player.x, y: s.player.y + 90 } })
          const touchPoint = await page.locator('.local-minimap svg').evaluate((el, p) => { const point = el.createSVGPoint(); point.x = p.x; point.y = p.y; const q = point.matrixTransform(el.getScreenCTM()); return { x: q.x, y: q.y } }, touchDestination)
          await page.touchscreen.tap(touchPoint.x, touchPoint.y)
          await page.waitForFunction(() => window.fixtureGame.scene.getScenes(true)[0].player.getData('characterMotion').moving)
          await page.waitForFunction(p => { const s = window.fixtureGame.scene.getScenes(true)[0]; return Math.hypot(s.player.x - p.x, s.player.y - p.y) < 5 && s.navigation.destination === null }, touchDestination)
          result.minimapTouch = true; await mapOpen(false)
        }
      }
      await resize(1280, 900)
      phase = areaId + ': exit opening'
      const exit = geometry.exits[0]
      await walk({ x: exit.x, y: exit.y - exit.height / 2 - 25 })
      const beforeExits = await page.evaluate(() => window.fixtureExits.length)
      await page.locator('canvas').focus(); await page.keyboard.down('ArrowDown')
      try { await page.waitForFunction(n => window.fixtureExits.length === n + 1, beforeExits) } finally { await page.keyboard.up('ArrowDown') }
      assert.equal(await page.evaluate(() => window.fixtureExits.at(-1)), exit.exitId)
      await page.waitForTimeout(200); assert.equal(await page.evaluate(() => window.fixtureExits.length), beforeExits + 1, 'standing in the opening emits no repeated exit'); result.automaticExit = true
      await page.screenshot({ path: EVIDENCE + '/' + areaId + '-gate-desktop.png' })
      // Allow a deliberate overview capture without changing gameplay camera defaults.
      await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0], c = s.cameras.main; c.stopFollow(); c.setZoom(Math.min(s.scale.width / s.foundation.area.width, s.scale.height / s.foundation.area.height)); c.centerOn(s.foundation.area.width / 2, s.foundation.area.height / 2) })
      await page.screenshot({ path: EVIDENCE + '/' + areaId + '-overview.png' })
      const destroyed = await page.evaluate(() => new Promise(resolve => { const s = window.fixtureGame.scene.getScenes(true)[0]; window.fixtureGame.events.once('destroy', () => resolve({ listeners: window.fixtureListeners.size, minimap: window.fixtureMinimap.snapshot(), motionListeners: s.events.listenerCount('postupdate') })); window.fixtureGame.destroy(true) }))
      assert.deepEqual(destroyed, { listeners: 0, minimap: null, motionListeners: 0 })
    }
    assert.deepEqual(errors, [])
    await writeFile(EVIDENCE + '/settlement-acceptance.json', JSON.stringify({ pass: true, capturedAt: new Date().toISOString(), fixtureBundleSha256: createHash('sha256').update(compiled.outputFiles[0].text).digest('hex'), baselineOnly: !REQUIRE_ART, areas: AREAS, results, errors }, null, 2))
  } catch (error) {
    await page?.screenshot({ path: EVIDENCE + '/settlement-failure.png' })
    const snapshot = await page?.evaluate(() => { const s = window.fixtureGame?.scene.getScenes(true)[0]; return s?.player ? { area: s.foundation.area.areaId, player: { x: s.player.x, y: s.player.y }, destination: s.navigation.destination, path: s.navigation.path, camera: { x: s.cameras.main.worldView.x, y: s.cameras.main.worldView.y, width: s.cameras.main.worldView.width, height: s.cameras.main.worldView.height }, intents: window.fixtureIntents, exits: window.fixtureExits } : null }).catch(() => null)
    await writeFile(EVIDENCE + '/settlement-failure.json', JSON.stringify({ error: error.message, phase, snapshot, errors, results }, null, 2)); throw error
  } finally { await browser.close(); await new Promise(r => server.close(r)) }
})
