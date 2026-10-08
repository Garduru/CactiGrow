import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const EVIDENCE = '.wrangler/first-basin-env-work'
const BASELINE_ONLY = process.env.CACTIGROW_BASIN_BASELINE_ONLY === '1'
const AREAS = ['cross-path-1', 'path-2', 'path-3', 'basin-cave', 'path-4', 'the-first-basin', 'path-5-under-construction']
// Visual acceptance checkpoints only. Runtime geography remains the saved LDtk.
const BASIN_LANDMARKS = [
  { name: 'Entrance cactus grove', x: 1060, y: 1860, props: ['wild-cactus-cluster'], minimum: 2 },
  { name: 'Stratified mesa shoulder', x: 2440, y: 1640, props: ['stratified-rock-pillar'], minimum: 1 },
  { name: 'Pale dry wash', x: 3000, y: 2380, props: ['loose-mineral-rubble'], minimum: 2, groundVariation: true },
  { name: 'Central trail cairn', x: 3680, y: 2140, props: ['trail-cairn'], minimum: 1 },
  { name: 'Eastern cactus ridge', x: 4860, y: 2500, props: ['wild-cactus-cluster', 'rockslide-barrier-debris'], minimum: 3 },
]
// Filled from actual Chrome/Phaser snapshots before the environment art changes.
const PRESERVED_GEOMETRY = {
  'cross-path-1': '6a896e0c947003ce34c3358a0dc2b935027dd89227432db3d19ace03704a92d6',
  'path-2': '72c61e662fe86d1a80b5176a55cfcfe3ed37801299014f16937e5e687e7a2b02',
  'path-3': '7932cf28d40996394b47259e1fcfcf4b28a63bc9876eec42ed0daeea041180a0',
  'basin-cave': '119cf550f9d6baf4760b7cc9ff4d48265aa992cb0a4f2ea974d7a3881dd6bf0f',
  'path-4': '25dd6e33eef2767f590305d74634561e8e8269c366dca9e29a7e6524ef9ae31d',
  'the-first-basin': 'e71f2dcfca19c2c66ffff24e77fd318a269db3bfb65564ca092125370a698a73',
  'path-5-under-construction': 'f885b66c4395602d90e3d076421cb7f7b5c45d111108a154d32fe3056eac1f20',
}
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

const entry = `
import React,{useState,useCallback} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
import {GameHeader} from './src/components/layout/GameHeader';import {WorldNav} from './src/components/layout/WorldNav';import {FeaturePanelContext} from './src/features/menu/featurePanelState';
import {PhaserWorldCanvas} from './src/game-world/PhaserWorldHost';import {createLdtkWorldGame} from './src/game-world/createLdtkWorldGame';
import {findArea} from './shared/world/world';import {getChatLocation} from './shared/realtime/chatLocation';
import {LocalMinimapStore,minimapSurfaces} from './src/game-world/localMinimap';import {LocalMinimapContext} from './src/game-world/LocalMinimapContext';import {LocalMinimap} from './src/game-world/LocalMinimapView';
import {CHARACTER_MODULES} from './src/characters/characterArt';
const area=findArea(new URLSearchParams(location.search).get('area'));window.fixtureArea=area;
window.fixtureModules=Object.keys(CHARACTER_MODULES);window.fixtureAppearance={body:1,skin:2,shirt:1,hair:3,hairColor:1,pants:1,hat:2,accessory:1};
window.fixtureExits=[];window.fixtureMinimap=new LocalMinimapStore();window.fixtureMinimap.open=true;
window.fixtureSurfaces=()=>minimapSurfaces(area);window.fixtureChatLocation=getChatLocation(area.areaId);
function App(){const [open,setOpen]=useState(true),[travelHost,setTravelHost]=useState(null);const toggle=()=>setOpen(window.fixtureMinimap.toggleOpen());
 const createGame=useCallback(parent=>{const game=createLdtkWorldGame(parent,{area,position:area.spawns.find(s=>s.entryId==='default'),appearance:window.fixtureAppearance,camera:{},minimap:window.fixtureMinimap,pending:()=>false,onExit:id=>window.fixtureExits.push(id)});window.fixtureGame=game;return game},[]);
 return <LocalMinimapContext.Provider value={{store:window.fixtureMinimap,open,toggle}}><FeaturePanelContext.Provider value={{feature:null,travelHost,setTravelHost,openFeature(){}}}>
 <div id='persistent-hud'><GameHeader/></div><WorldNav sceneName={area.displayName} destinations={[]} onTravel={()=>{}}/><PhaserWorldCanvas projection={{locations:[]}} onIntent={()=>{}} createGame={createGame}/><LocalMinimap areaId={area.areaId} hidden={false}/></FeaturePanelContext.Provider></LocalMinimapContext.Provider>}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/world']}><App/></MemoryRouter>);
window.fixtureCapture=()=>{const scene=window.fixtureGame.scene.getScenes(true)[0],map=scene.navigation.map,start=area.spawns.find(s=>s.entryId==='default');
 const regions=[];for(let row=0;row<4;row++)for(let col=0;col<4;col++){const x=(col+.5)*area.width/4,y=(row+.5)*area.height/4;if(map.walkable({x,y}))regions.push({id:'region-'+col+'-'+row,x,y})}
 const points=[...area.spawns.map(p=>({id:'spawn:'+p.entryId,x:p.x,y:p.y})),...area.exits.map(p=>({id:'exit:'+p.exitId,x:p.x,y:p.y})),...regions];
 const solids=scene.physics.world.staticBodies.entries.map(b=>({x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,height:b.height}));
 return {areaId:area.areaId,identifier:area.identifier,zoneId:area.zoneId,width:scene.physics.world.bounds.width,height:scene.physics.world.bounds.height,topology:area.topology,cameraBounds:{width:scene.cameras.main.getBounds().width,height:scene.cameras.main.getBounds().height},player:{width:scene.player.width,height:scene.player.height,radius:scene.player.body.radius,depth:scene.player.depth,scaleX:scene.player.scaleX,scaleY:scene.player.scaleY},solids,spawns:area.spawns,exits:area.exits,travel:{id:area.travelDestinationId,spawn:area.travelSpawnId},navigation:{obstacles:map.obstacles,nodes:map.nodes,routes:points.map(p=>({id:p.id,walkable:map.walkable(p),path:map.route(start,p)}))}};
};
`

test('First Basin environment preserves actual seven-Area collision/navigation, minimap and mobile HUD', {
  skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set an existing Chromium executable.',
  timeout: 480000,
}, async () => {
  await mkdir(EVIDENCE, { recursive: true })
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: entry, loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ MODE: 'staging', DEV: false }) }, logLevel: 'silent', plugins: [{ name: 'read-only-hud-projections', setup(plugin) {
    const stubs = { useGameState: "export const useGameState=()=>({state:{player:{tokens:0}}})", useGrowerAuthority: "export const useGrowerAuthority=()=>({state:{authority:'local'}})", useSocialState: "export const useSocialState=()=>({state:{status:'ready',overview:{ownProfile:{displayName:'Environment Tester'}}},profileTarget:{open:false}})", useSocialPanel: "export const useSocialPanel=()=>({chatDockExpanded:false,activeTab:'world-chat',setChatDockExpanded(){},setActiveTab(){}})", useOwnPublicSkills: 'export const useOwnPublicSkills=()=>null', UtilityMenu: 'export const MenuDropdown=()=>null' }
    plugin.onResolve({ filter: /\/(useGameState|useGrowerAuthority|useSocialState|useSocialPanel|useOwnPublicSkills|UtilityMenu)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'hud' }))
    plugin.onLoad({ filter: /.*/, namespace: 'hud' }, args => ({ contents: stubs[args.path] }))
  } }] })
  const raw = JSON.parse(await readFile('world/cactigrow-world.ldtk', 'utf8'))
  const css = (await Promise.all(['src/styles/tokens.css', 'src/index.css', 'src/styles/game.css', 'src/game-world/localMinimap.css'].map(path => readFile(path, 'utf8')))).join('\n') + '\nhtml,body,#root,.phaser-world-host{width:100%;height:100%;margin:0;overflow:hidden}'
  const requests = []
  const server = createServer(async (req, res) => {
    requests.push(req.url)
    try {
      if (req.url.startsWith('/assets/')) { const path = resolve('public', '.' + req.url); if (!path.startsWith(resolve('public') + sep)) throw Error('Invalid path'); res.end(await readFile(path)); return }
      if (!req.url.startsWith('/?area=')) { res.statusCode = 404; res.end(); return }
      res.setHeader('content-type', 'text/html'); res.end('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>' + css + '</style><div id="root"></div><script>' + bundle.outputFiles[0].text + '</script>')
    } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const { chromium } = await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE, headless: true, args: ['--no-sandbox'] })
  let page, phase = 'boot'
  const errors = [], results = [], baseline = {}
  try {
    page = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true })
    page.on('pageerror', error => errors.push(error.message))
    const ready = () => page.waitForFunction(() => {
      const scene = window.fixtureGame?.scene.getScenes(true)[0], art = scene?.player?.list.find(o => o.name === 'character-art-v1'), canvas = art?.texture.getSourceImage()
      if (!scene?.player?.body || !window.fixtureMinimap.snapshot() || !window.fixtureModules.every(key => scene.textures.exists('character-module:' + key)) || !canvas?.getContext || canvas.width !== 320 || canvas.height !== 448) return false
      const pixels = canvas.getContext('2d').getImageData(art.frame.cutX, art.frame.cutY, art.frame.cutWidth, art.frame.cutHeight).data
      let solid = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 128) solid++
      return solid > 600
    })
    const openMap = async open => { if (await page.getByLabel('Local minimap', { exact: true }).isVisible() !== open) await page.getByRole('button', { name: 'Map', exact: true }).click() }
    const toMap = point => page.locator('.local-minimap svg').evaluate((svg, point) => { const p = svg.createSVGPoint(); p.x = point.x; p.y = point.y; const screen = p.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y } }, point)
    const idle = async destination => {
      await page.waitForFunction(p => { const s = window.fixtureGame.scene.getScenes(true)[0], motion = s.player.getData('characterMotion'); return Math.hypot(s.player.x - p.x, s.player.y - p.y) < 5 && s.navigation.destination === null && !motion.moving && motion.frame === 0 }, destination, { timeout: 20000 })
    }
    for (const areaId of AREAS) {
      phase = areaId + ': arrival'
      await page.goto('http://127.0.0.1:' + server.address().port + '/?area=' + areaId); await ready()
      const geometry = await page.evaluate(() => window.fixtureCapture()), hash = sha(geometry)
      baseline[areaId] = { sha256: hash, geometry }
      if (!BASELINE_ONLY) assert.equal(hash, PRESERVED_GEOMETRY[areaId], areaId + ': complete actual collision/navigation snapshot is preserved')
      assert.equal(geometry.solids.length, geometry.navigation.obstacles.length)
      assert.ok(geometry.navigation.routes.filter(route => !route.id.startsWith('region-')).every(route => route.walkable && route.path), 'every authored entry/exit stays connected to the default entry')
      assert.deepEqual(await page.evaluate(() => window.fixtureMinimap.snapshot().blocked), geometry.navigation.obstacles)
      assert.deepEqual(await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].player.getData('characterAppearance')), await page.evaluate(() => window.fixtureAppearance))
      const chat = await page.evaluate(() => window.fixtureChatLocation)
      assert.equal(chat.areaId, areaId); assert.equal(chat.zoneId, 'first-basin'); assert.equal(chat.zoneName, 'The First Basin')
      const result = { areaId, geometrySha256: hash, bodies: geometry.solids.length, graphNodes: geometry.navigation.nodes.length, connectedRoutes: geometry.navigation.routes.filter(route => route.path).length, preservedDisconnectedSamples: geometry.navigation.routes.filter(route => !route.path).map(route => route.id), chat, mobile: [], art: null }
      results.push(result)
      if (!BASELINE_ONLY) {
        phase = areaId + ': terrain'
        const art = await page.evaluate(() => {
          const scene = window.fixtureGame.scene.getScenes(true)[0], area = window.fixtureArea
          const canonical = new Map()
          for (const layer of area.visualLayers ?? []) { const id = layer.name + ':' + layer.tileset.uid, record = canonical.get(id) ?? { name: layer.name, uid: layer.tileset.uid, tiles: 0 }; record.tiles += layer.tiles.length; canonical.set(id, record) }
          const layers = [...canonical.values()].map(layer => { const objects = scene.children.list.filter(o => o.name === 'basin:' + layer.name && (o.texture?.key === 'terrain:' + layer.uid || o.texture?.key.startsWith('terrain:' + layer.uid + ':'))); return { ...layer, drawn: objects.length, depths: [...new Set(objects.map(object => object.depth))] } })
          const atlases = [...new Map((area.visualLayers ?? []).map(layer => [layer.tileset.uid, layer.tileset])).values()].map(tileset => { const texture = scene.textures.get('terrain:' + tileset.uid), source = texture.getSourceImage(); return { uid: tileset.uid, path: tileset.path, width: source.width, height: source.height, decodedRGBABytes: source.width * source.height * 4, frames: Object.keys(texture.frames).filter(name => name !== '__BASE').length } })
          const cache = scene.textures.getTextureKeys().filter(key => key.startsWith('terrain:') && !/^terrain:\d+$/.test(key)).map(key => { const source = scene.textures.get(key).getSourceImage(); return { key, width: source.width, height: source.height, decodedRGBABytes: source.width * source.height * 4, canvas: source instanceof HTMLCanvasElement } })
          const sourceFrames = [], sampled = new Set(), canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128
          const context = canvas.getContext('2d', { willReadFrequently: true })
          for (const layer of area.visualLayers ?? []) for (const tile of layer.tiles) {
            const id = layer.tileset.uid + ':' + tile.sourceX + ':' + tile.sourceY; if (sampled.has(id)) continue; sampled.add(id)
            context.clearRect(0, 0, 128, 128); context.drawImage(scene.textures.get('terrain:' + layer.tileset.uid).getSourceImage(), tile.sourceX, tile.sourceY, layer.tileset.tileSize, layer.tileset.tileSize, 0, 0, 128, 128)
            const pixels = context.getImageData(0, 0, 128, 128).data; let painted = 0; for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 32) painted++
            sourceFrames.push({ id, paintedPixels: painted })
          }
          return { layers, atlases, cache, sourceFrames, surfaces: window.fixtureSurfaces(), atlasRGBABytes: atlases.reduce((sum, item) => sum + item.decodedRGBABytes, 0), incrementalCacheRGBABytes: cache.reduce((sum, item) => sum + item.decodedRGBABytes, 0), imageCount: scene.children.list.filter(o => o.type === 'Image' && o.name.startsWith('basin:')).length, sceneObjectCounts: scene.children.list.reduce((counts, object) => ({ ...counts, [object.type]: (counts[object.type] ?? 0) + 1 }), {}), visualLayers: area.visualLayers, noDebug: !scene.children.list.some(o => ['area-debug-trigger', 'area-debug-label', 'collision-debug-boundary'].includes(o.name)) }
        })
        assert.ok(art.layers.some(layer => layer.name === 'Ground' && layer.tiles > 0))
        assert.ok(art.layers.some(layer => layer.name === 'BoundaryEdges' && layer.tiles > 0))
        assert.ok(art.layers.some(layer => layer.name === 'Paths' && layer.tiles > 0), 'every target Area has authored path/minimap cues')
        assert.ok(art.sourceFrames.every(frame => frame.paintedPixels > 32), 'every used terrain source frame contains visible art')
        assert.ok(art.layers.every(layer => layer.drawn === layer.tiles), 'all canonical layer tiles render once from their own atlas')
        const depths = { Ground: 0, GroundVariation: 5, Paths: 10, StructureGrounding: 15, Decorations: 20, BoundaryEdges: 20 }
        for (const layer of art.layers.filter(layer => layer.tiles)) assert.deepEqual(layer.depths, [depths[layer.name]], 'visual layer retains its intended ground/road/prop depth')
        assert.ok(art.surfaces.some(surface => surface.layer === 'Paths'))
        const mapSurfaces = await page.locator('[data-minimap-layer]').evaluateAll(rects => rects.map(rect => ({ layer: rect.getAttribute('data-minimap-layer'), x: Number(rect.getAttribute('x')), y: Number(rect.getAttribute('y')), width: Number(rect.getAttribute('width')), height: Number(rect.getAttribute('height')) })))
        assert.deepEqual(mapSurfaces, art.surfaces, 'minimap surfaces use the exact imported visual layers')
        assert.equal(art.imageCount, art.layers.reduce((sum, layer) => sum + layer.tiles, 0)); assert.equal(art.noDebug, true)
        const level = raw.levels.find(level => level.identifier === geometry.identifier), grid = level.layerInstances.find(layer => layer.__type === 'IntGrid')
        const boundary = art.visualLayers.filter(layer => layer.name === 'BoundaryEdges')
        const covers = (x, y) => boundary.some(layer => layer.tiles.some(tile => x >= tile.x + layer.offsetX && x <= tile.x + layer.offsetX + (tile.width ?? layer.cellWidth) && y >= tile.y + layer.offsetY && y <= tile.y + layer.offsetY + (tile.height ?? layer.cellHeight)))
        let blockedCells = 0, openExitSamples = 0, rimSamples = 0
        for (let row = 0; row < grid.__cHei; row++) for (let col = 0; col < grid.__cWid; col++) if (grid.intGridCsv[row * grid.__cWid + col] === 1) {
          const x = (grid.__pxTotalOffsetX + (col + .5) * grid.__gridSize) * geometry.width / geometry.topology.width, y = (grid.__pxTotalOffsetY + (row + .5) * grid.__gridSize) * geometry.height / geometry.topology.height
          assert.ok(covers(x, y), areaId + ': every accepted blocked cell has boundary art'); blockedCells++
        }
        const openingPoints = geometry.exits.filter(exit => !exit.blocked).flatMap(exit => {
          const points = []; for (let x = exit.x - exit.width / 2 + 32; x < exit.x + exit.width / 2; x += 24) for (let y = exit.y - exit.height / 2 + 32; y < exit.y + exit.height / 2; y += 24) points.push({ x, y }); return points
        })
        const openPoints = await page.evaluate(points => { const map = window.fixtureGame.scene.getScenes(true)[0].navigation.map; return points.filter(point => map.walkable(point)) }, openingPoints)
        for (const point of openPoints) { assert.equal(covers(point.x, point.y), false, areaId + ': walkable exit opening has no boundary artwork'); openExitSamples++ }
        const insideExit = p => geometry.exits.some(exit => !exit.blocked && Math.abs(p.x - exit.x) <= exit.width / 2 && Math.abs(p.y - exit.y) <= exit.height / 2)
        for (let x = 40; x < geometry.width; x += 80) for (const y of [1, geometry.height - 1]) if (!insideExit({ x, y })) { assert.ok(covers(x, y), areaId + ': horizontal outer rim'); rimSamples++ }
        for (let y = 40; y < geometry.height; y += 80) for (const x of [1, geometry.width - 1]) if (!insideExit({ x, y })) { assert.ok(covers(x, y), areaId + ': vertical outer rim'); rimSamples++ }
        if (areaId === 'the-first-basin') {
          const extension = raw.defs.tilesets.find(tileset => tileset.identifier === 'CactiGrowFirstBasinExtensionV1')
          assert.ok(extension)
          const registrations = new Map(extension.customData.filter(record => record.data.startsWith('{')).map(record => [record.tileId, JSON.parse(record.data)]))
          const props = art.visualLayers.filter(layer => layer.name === 'Decorations' && layer.tileset.uid === extension.uid).flatMap(layer => layer.tiles.map(tile => {
            const index = tile.sourceY / layer.tileset.tileSize * extension.__cWid + tile.sourceX / layer.tileset.tileSize, metadata = registrations.get(index)
            assert.ok(metadata, 'landmark source slot has semantic display metadata')
            return { name: metadata.name, sourceTile: index, x: tile.x + layer.offsetX + tile.width / 2, y: tile.y + layer.offsetY + (metadata.footBaseline - 1) / (layer.tileset.tileSize - 2) * tile.height, width: tile.width, height: tile.height }
          }))
          result.landmarks = BASIN_LANDMARKS.map(landmark => {
            const matching = props.filter(prop => landmark.props.includes(prop.name) && Math.hypot(prop.x - landmark.x, prop.y - landmark.y) < 550)
            assert.ok(matching.length >= landmark.minimum, landmark.name + ': distinctive authored prop group is present')
            if (landmark.groundVariation) assert.ok(art.visualLayers.filter(layer => layer.name === 'GroundVariation').some(layer => layer.tiles.some(tile => Math.hypot(tile.x + layer.offsetX - landmark.x, tile.y + layer.offsetY - landmark.y) < 450)), 'dry wash has its actual light ground variation')
            return { name: landmark.name, checkpoint: { x: landmark.x, y: landmark.y }, props: matching }
          })
          assert.ok(result.landmarks.length >= 3 && result.landmarks.length <= 5)
        }
        delete art.visualLayers; result.art = { ...art, blockedCells, openExitSamples, rimSamples, memoryEstimate: 'RGBA8 source/cache pixels only; GPU, mipmaps and object metadata are not measured' }
      }
      await openMap(false)
      await page.screenshot({ path: EVIDENCE + '/' + (BASELINE_ONLY ? 'baseline-' : '') + areaId + '-desktop.png' })
      await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0], c = s.cameras.main, area = window.fixtureArea; c.stopFollow(); c.setZoom(Math.min(s.scale.width / area.width, s.scale.height / area.height)); c.centerOn(area.width / 2, area.height / 2) })
      await page.waitForTimeout(100)
      await page.screenshot({ path: EVIDENCE + '/' + (BASELINE_ONLY ? 'baseline-' : '') + areaId + '-overview.png' })
      await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0]; s.cameras.main.startFollow(s.player, true, .1, .1); s.cameras.main.setZoom(1.18) })
      if (!BASELINE_ONLY) {
        phase = areaId + ': minimap mouse and replacement'
        await openMap(true)
        const targets = await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0], p = s.player, map = s.navigation.map; return [{ x: p.x + 160, y: p.y }, { x: p.x - 160, y: p.y }, { x: p.x, y: p.y + 160 }, { x: p.x, y: p.y - 160 }].filter(t => map.clear(p, t)) })
        assert.ok(targets.length >= 2, areaId + ': two local reachable map targets')
        const one = await toMap(targets[0]), two = await toMap(targets[1]), before = await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0]; return { x: s.player.x, y: s.player.y } })
        await page.mouse.click(one.x, one.y)
        if (result.preservedDisconnectedSamples.length) {
          const [, col, row] = result.preservedDisconnectedSamples[0].split('-').map(Number)
          const unreachable = { x: (col + .5) * geometry.width / 4, y: (row + .5) * geometry.height / 4 }
          assert.equal(await page.evaluate(p => { const s = window.fixtureGame.scene.getScenes(true)[0]; return s.navigation.map.walkable(p) && s.navigation.map.route(s.player, p) === null }, unreachable), true, 'existing disconnected region remains structurally walkable but unreachable')
          const activeDestination = await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].navigation.destination), rejected = await toMap(unreachable)
          await page.mouse.click(rejected.x, rejected.y); await page.getByText('That point cannot be reached.', { exact: true }).waitFor()
          assert.deepEqual(await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].navigation.destination), activeDestination, 'unreachable target preserves the valid active route')
          result.unreachableRejected = true
        }
        await page.mouse.click(two.x, two.y)
        const destination = await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].navigation.destination)
        assert.ok(destination && Math.hypot(destination.x - targets[1].x, destination.y - targets[1].y) < 40, 'latest map click replaces the first route')
        const immediate = await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0]; return { x: s.player.x, y: s.player.y } })
        assert.ok(Math.hypot(immediate.x - before.x, immediate.y - before.y) < 60, 'map walking does not teleport')
        await idle(destination)
        await page.waitForFunction(() => { const s = window.fixtureGame.scene.getScenes(true)[0], marker = document.querySelector('.local-minimap__player'); return Math.abs(Number(marker?.getAttribute('cx')) - s.player.x) < 5 && Math.abs(Number(marker?.getAttribute('cy')) - s.player.y) < 5 })
        const blocked = geometry.navigation.obstacles[0], bad = await toMap({ x: (blocked.left + blocked.right) / 2, y: (blocked.top + blocked.bottom) / 2 })
        await page.mouse.click(bad.x, bad.y); await page.getByText('That point cannot be reached.', { exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].navigation.destination), null)
        result.minimapMouse = true; result.rapidReplacement = true; result.blockedRejected = true
        for (const width of [320, 360, 390]) {
          phase = areaId + ': mobile ' + width
          await page.setViewportSize({ width, height: 844 })
          await page.waitForFunction(width => { const s = window.fixtureGame.scene.getScenes(true)[0]; return s.scale.width === width && s.cameras.main.worldView.contains(s.player.x, s.player.y) }, width)
          const hud = await page.evaluate(() => [...document.querySelectorAll('.game-header button')].filter(button => !button.hidden && !button.closest('[hidden]')).map(button => { const r = button.getBoundingClientRect(); return { name: button.getAttribute('aria-label') || button.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom } }))
          assert.equal(hud.length, 7); assert.ok(hud.every(button => button.left >= 0 && button.right <= width)); assert.ok(Math.max(...hud.map(button => button.top)) < Math.min(...hud.map(button => button.bottom)), 'mobile HUD remains one row')
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
          assert.equal(await page.locator('.local-minimap').getAttribute('data-area-id'), areaId)
          await page.screenshot({ path: EVIDENCE + '/' + areaId + '-map-' + width + '.png' }); await openMap(false)
          await page.screenshot({ path: EVIDENCE + '/' + areaId + '-mobile-' + width + '.png' }); await openMap(true)
          result.mobile.push({ width, hudControls: hud.length, oneRow: true, playerVisible: true, minimapArea: areaId })
        }
        phase = areaId + ': true touch walking'
        const target = await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0], p = s.player; return [{ x: p.x + 110, y: p.y }, { x: p.x - 110, y: p.y }, { x: p.x, y: p.y + 110 }, { x: p.x, y: p.y - 110 }].find(t => s.navigation.map.clear(p, t)) })
        assert.ok(target); const screen = await toMap(target); await page.touchscreen.tap(screen.x, screen.y)
        const touchDestination = await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].navigation.destination); assert.ok(touchDestination); await idle(touchDestination); result.minimapTouch = true
        const touchBad = await toMap({ x: (blocked.left + blocked.right) / 2, y: (blocked.top + blocked.bottom) / 2 }); await page.touchscreen.tap(touchBad.x, touchBad.y); await page.getByText('That point cannot be reached.', { exact: true }).waitFor()
        await page.setViewportSize({ width: 1280, height: 900 })
        phase = areaId + ': cache plateau and desktop frame observation'
        const observation = await page.evaluate(() => new Promise(resolve => {
          const game = window.fixtureGame, scene = game.scene.getScenes(true)[0], started = performance.now(), timestamps = []
          const onRender = () => timestamps.push(performance.now())
          game.events.on('postrender', onRender)
          setTimeout(() => {
            game.events.off('postrender', onRender)
            const elapsedMs = performance.now() - started, frameIntervals = timestamps.slice(1).map((time, index) => time - timestamps[index]).sort((a, b) => a - b)
            resolve({ renderer: { type: game.renderer.type, constructor: game.renderer.constructor.name, canvasWidth: game.canvas.width, canvasHeight: game.canvas.height, devicePixelRatio }, sampleMs: elapsedMs, renderedFrames: timestamps.length, observedFramesPerSecond: timestamps.length * 1000 / elapsedMs, medianFrameIntervalMs: frameIntervals[Math.floor(frameIntervals.length / 2)] ?? null, phaserActualFPS: game.loop.actualFps, cacheKeysAfterWalking: scene.textures.getTextureKeys().filter(key => key.startsWith('terrain:') && !/^terrain:\d+$/.test(key)).sort(), basinImagesAfterWalking: scene.children.list.filter(o => o.type === 'Image' && o.name.startsWith('basin:')).length, limitation: 'Short headless Windows Chrome desktop observation; not physical mobile-device performance or GPU-memory measurement' })
          }, 1000)
        }))
        assert.deepEqual(observation.cacheKeysAfterWalking, result.art.cache.map(item => item.key).sort(), 'walking, map toggles and 320/360/390 resizing do not grow the material cache')
        assert.equal(observation.basinImagesAfterWalking, result.art.imageCount, 'movement and mobile map toggles do not duplicate terrain images')
        assert.ok(observation.renderedFrames > 0)
        result.art.runtimeObservation = observation
      }
      phase = areaId + ': cleanup'
      const cleanup = await page.evaluate(() => new Promise(resolve => { const scene = window.fixtureGame.scene.getScenes(true)[0]; window.fixtureGame.events.once('destroy', () => resolve({ minimap: window.fixtureMinimap.snapshot(), motionListeners: scene.events.listenerCount('postupdate') })); window.fixtureGame.destroy(true) }))
      assert.equal(cleanup.minimap, null); assert.equal(cleanup.motionListeners, 0); result.cleanup = true
    }
    if (!BASELINE_ONLY) {
      phase = 'cave: failed-atlas fallback'
      await page.route('**/assets/world/tiles/world-first-basin-extension-v01.png', route => route.abort('failed'))
      await page.goto('http://127.0.0.1:' + server.address().port + '/?area=basin-cave'); await ready()
      const geometry = await page.evaluate(() => window.fixtureCapture())
      assert.equal(sha(geometry), PRESERVED_GEOMETRY['basin-cave'], 'failed art keeps exact physics and navigation')
      const fallback = await page.evaluate(() => { const s = window.fixtureGame.scene.getScenes(true)[0]; return { ground: s.children.list.filter(o => o.name === 'basin:fallback-ground').length, boundaries: s.children.list.filter(o => o.name === 'basin:fallback-boundary').length, physical: s.children.list.filter(o => o.name.startsWith('basin:fallback') && o.body).length } })
      assert.deepEqual(fallback, { ground: 1, boundaries: geometry.solids.length, physical: 0 }, 'failed atlas fallback keeps existing walls visible without adding colliders')
      await page.screenshot({ path: EVIDENCE + '/basin-cave-failed-atlas-fallback.png' })
      results.find(result => result.areaId === 'basin-cave').failedAtlasFallback = true
      await page.evaluate(() => window.fixtureGame.destroy(true))
    }
    assert.deepEqual(errors, [])
    assert.equal(requests.some(path => path.startsWith('/api/')), false, 'terrain, character motion and minimap add no HTTP API calls in this isolated scene fixture')
    await writeFile(EVIDENCE + (BASELINE_ONLY ? '/runtime-geometry-baseline.json' : '/basin-environment-acceptance.json'), JSON.stringify({ pass: true, baselineOnly: BASELINE_ONLY, capturedAt: new Date().toISOString(), fixtureBundleSha256: createHash('sha256').update(bundle.outputFiles[0].text).digest('hex'), results, baseline: BASELINE_ONLY ? baseline : undefined, requests, errors }, null, 2))
  } catch (error) {
    await page?.screenshot({ path: EVIDENCE + '/basin-environment-failure.png' }).catch(() => {})
    const snapshot = await page?.evaluate(() => { const s = window.fixtureGame?.scene.getScenes(true)[0]; return s?.player ? { area: window.fixtureArea.areaId, player: { x: s.player.x, y: s.player.y }, destination: s.navigation.destination, camera: { x: s.cameras.main.worldView.x, y: s.cameras.main.worldView.y, width: s.cameras.main.worldView.width, height: s.cameras.main.worldView.height }, exits: window.fixtureExits } : null }).catch(() => null)
    await writeFile(EVIDENCE + '/basin-environment-failure.json', JSON.stringify({ phase, error: error.message, snapshot, results, errors }, null, 2)); throw error
  } finally { await browser.close(); await new Promise(r => server.close(r)) }
})
