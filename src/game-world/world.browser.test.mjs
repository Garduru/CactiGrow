import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('real Phaser walk-through: authored exits/spawns/bounds, locked Farm/Town and retained React HUD', { skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set an existing Chromium executable.' }, async () => {
  await mkdir('.wrangler/world-browser', { recursive: true })
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import {MemoryRouter} from 'react-router-dom';import React,{useCallback,useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {GameHeader} from './src/components/layout/GameHeader';import {WorldNav} from './src/components/layout/WorldNav';import {FeaturePanelContext} from './src/features/menu/featurePanelState';
    import {PhaserWorldCanvas} from './src/game-world/PhaserWorldHost';
    import {createFarmWorldGame} from './src/game-world/createFarmWorldGame';import {createTownWorldGame} from './src/game-world/createTownWorldGame';import {createLdtkWorldGame} from './src/game-world/createLdtkWorldGame';
    import {createFarmWorldProjection} from './src/game-world/farmWorldProjection';import {townWorldProjection} from './src/game-world/townWorldProjection';import {createInitialGameState} from './src/game/gameState';
    import {authoredRoadExit,findArea,initialLocation} from './shared/world/world';
    const state=createInitialGameState(Date.now(),true), farm=createFarmWorldProjection(state.property,state.geneticsLab,[],{}), owner='00000000-0000-4000-8000-000000000001';
    farm.gardenDisplays=[{slotId:'bed-1',specimenId:'fixture',x:2250,y:390,visual:{visualRevision:'fixture',baseAsset:null,silhouette:'columnar',specialTreatmentKey:null,pigmentationRecipeKeys:[],variation:{paletteIndex:0,scaleBucket:0,orientationIndex:1},spineRecipeKey:null}}];
    let pending=false, transition;const camera={};
    function App(){const [travelHost,setTravelHost]=useState(null);const [location,setLocation]=useState(initialLocation(owner));window.worldLocation=location;window.recreateWorld=()=>setLocation({...location}); const area=findArea(location.areaId);
      transition=async id=>{if(pending)return;pending=true;const r=await fetch('/transition',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({exitId:id,expectedRevision:location.revision,commandId:crypto.randomUUID(),v:1})});const s=await r.json();pending=false;if(r.ok)setLocation(s);else window.routeError=s.error;};
      const createGame=useCallback((parent,bridge)=>{const o={area,position:location.position,camera,debug:window.explicitDebug===true,pending:()=>pending,onExit:id=>transition(id)};const g=area.areaType==='farm'?createFarmWorldGame(parent,bridge,{spawnId:'default',foundation:o}):area.areaType==='town'?createTownWorldGame(parent,bridge,{spawnId:'farm-arrival',foundation:o}):createLdtkWorldGame(parent,o);window.worldGame=g;return g;},[location]);
      return <FeaturePanelContext.Provider value={{feature:null,travelHost,setTravelHost,openFeature(){}}}><div id='persistent-hud'><GameHeader/></div><WorldNav sceneName={area.displayName} destinations={[]} onTravel={()=>{}}/><PhaserWorldCanvas projection={area.areaType==='farm'?farm:area.areaType==='town'?townWorldProjection:{locations:[]}} onIntent={i=>{if(i.type==='ENTER_LOCATION'&&(i.locationId==='town'||i.locationId==='farm'))transition(authoredRoadExit(area).exitId)}} createGame={createGame}/></FeaturePanelContext.Provider>}
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/world']}><App/></MemoryRouter>);
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ MODE: 'staging', DEV: false }), 'process.env.NODE_ENV': '"development"' },plugins:[{name:'hud-read-projections',setup(p){
    const stubs={useGameState:"export const useGameState=()=>({state:{player:{tokens:11022}}})",useGrowerAuthority:"export const useGrowerAuthority=()=>({state:{authority:'local'}})",useSocialState:"export const useSocialState=()=>({state:{status:'ready',overview:{ownProfile:{displayName:'Staging Tester'}}},profileTarget:{open:false}})",useSocialPanel:"export const useSocialPanel=()=>({chatDockExpanded:false,activeTab:'world-chat',setChatDockExpanded(){},setActiveTab(){}})",useOwnPublicSkills:"export const useOwnPublicSkills=()=>null",UtilityMenu:"export const MenuDropdown=()=>null"};
    p.onResolve({filter:/\/(useGameState|useGrowerAuthority|useSocialState|useSocialPanel|useOwnPublicSkills|UtilityMenu)$/},a=>({path:a.path.split('/').at(-1),namespace:'hud'}));p.onLoad({filter:/.*/,namespace:'hud'},a=>({contents:stubs[a.path]}))
  }}] })
  const serverBundle = resolve('node_modules/.tmp/world-browser-server.mjs')
  await build({ stdin: { contents: "export { resolveExit } from './server/world/WorldService.ts'; export { initialLocation, WORLD } from './shared/world/world.ts'", resolveDir: process.cwd() }, bundle: true, platform: 'node', packages: 'external', format: 'esm', outfile: serverBundle })
  const { resolveExit, initialLocation, WORLD } = await import(pathToFileURL(serverBundle).href)
  const owner = '00000000-0000-4000-8000-000000000001'; let current = initialLocation(owner), transitionRequests=0
  const gameCss=(await Promise.all(['src/styles/tokens.css','src/index.css','src/styles/game.css'].map(f=>readFile(f,'utf8')))).join('\n')
  const css = gameCss + '.phaser-world-host,#root,body,html{width:100%;height:100%;margin:0;overflow:hidden}'
  const server = createServer(async (req, res) => {
    if (req.url === '/') { res.setHeader('content-type','text/html'); res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`); return }
    if (req.url === '/transition') { transitionRequests++; let body='';for await(const chunk of req)body+=chunk;try{current=resolveExit(current,JSON.parse(body),owner);res.setHeader('content-type','application/json');res.end(JSON.stringify(current))}catch(e){res.statusCode=409;res.end(JSON.stringify({error:e.message}))}return }
    try { const path = resolve('public', '.' + req.url); if (!path.startsWith(resolve('public') + '\\')) throw new Error('Invalid path'); res.end(await readFile(path)) } catch { res.statusCode=404;res.end() }
  })
  await new Promise(r => server.listen(0,'127.0.0.1',r))
  const { chromium } = await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE, headless: true, args:['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width:1280,height:900 } }), errors=[]
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const ready = () => page.waitForFunction(() => { const s=window.worldGame?.scene.getScenes(true)[0];return s?.player?.body && (s.options?.area??s.foundation?.area)?.areaId===window.worldLocation.areaId })
    try { await ready() } catch(e) { throw new Error(JSON.stringify(errors), {cause:e}) }; await page.evaluate(() => { window.savedHud=document.getElementById('persistent-hud') })
    async function walk(exitId) {
      const before=await page.evaluate(() => window.worldLocation.areaId)
      const beforeRequests=transitionRequests
      // Route toward alternating lanes across each opening, then use keyboard movement to cross.
      const lane=await page.evaluate(({id,side})=>{
        const s=window.worldGame.scene.getScenes(true)[0],a=s.options?.area??s.foundation.area,e=a.exits.find(e=>e.exitId===id),map=s.navigation.map
        const horizontal=e.width>e.height;let from,key,target
        for(const f of [side*.3,side*.2,side*.1,0]) {
          const q=horizontal?{x:e.x+e.width*f,y:e.y}:{x:e.x,y:e.y+e.height*f},p={...q}
          if(horizontal){const south=e.y>a.height/2;p.y=e.y+(south?-1:1)*(e.height/2+20);key=south?'ArrowDown':'ArrowUp'}
          else {const east=e.x>a.width/2;p.x=e.x+(east?-1:1)*(e.width/2+20);key=east?'ArrowRight':'ArrowLeft'}
          if(map.walkable(q)&&map.walkable(p)&&map.route(s.player,p)&&map.route(p,q)){target=q;from=p;break}
        }
        if(!from)throw Error('Invalid lane approach '+a.areaId+'/'+id)
        window.worldGame.canvas.focus();s.navigation.move(s.player,from);return {...from,key,offset:Math.hypot(target.x-e.x,target.y-e.y)}
      },{id:exitId,side:beforeRequests%2?1:-1})
      await page.waitForFunction(p=>{const s=window.worldGame.scene.getScenes(true)[0];return Math.hypot(s.player.x-p.x,s.player.y-p.y)<5},lane,{timeout:20000})
      await page.keyboard.down(lane.key)
      try{await page.waitForFunction(id=>window.worldLocation.areaId!==id,before,{timeout:5000})}finally{await page.keyboard.up(lane.key)}
      await ready();await page.waitForTimeout(180)
      assert.equal(transitionRequests,beforeRequests+1,'one automatic request; no bounce or interaction intent')
      const actual = await page.evaluate(() => {const s=window.worldGame.scene.getScenes(true)[0];return{location:window.worldLocation,x:s.player.x,y:s.player.y,w:s.physics.world.bounds.width,h:s.physics.world.bounds.height,cameraW:s.cameras.main.getBounds().width,cameraH:s.cameras.main.getBounds().height,zoom:s.cameras.main.zoom,radius:s.player.body.radius,character:s.player.list.map(o=>({type:o.type,width:o.width,height:o.height,name:o.name})),scaleX:s.player.scaleX,debugTriggers:s.children.list.filter(o=>o.name==='area-debug-trigger'||o.name==='area-debug-spawn').length,debugLabels:s.children.list.filter(o=>o.name==='area-debug-label').length,hud:window.savedHud===document.getElementById('persistent-hud')}})
      const a=WORLD.areas.find(a=>a.areaId===actual.location.areaId),spawn=a.spawns.find(s=>s.entryId===actual.location.entryId)
      assert.equal(actual.w,a.width);assert.equal(actual.h,a.height);assert.equal(actual.cameraW,a.width);assert.equal(actual.cameraH,a.height)
      assert.ok(Math.hypot(actual.x-spawn.x,actual.y-spawn.y)<8);assert.equal(actual.hud,true);assert.equal(actual.zoom,1.18);assert.equal(actual.radius,27);assert.equal(actual.scaleX,1);assert.equal(actual.debugLabels,0);assert.equal(actual.debugTriggers,0);assert.deepEqual(actual.character.map(o=>o.type),['Rectangle','Arc']);assert.equal(actual.character[0].width,34);assert.equal(actual.character[1].width,40)
    }
    const route = ['to-path-1','to-cross-path-1','to-player-farm','to-cross-path-1','to-player-farm','to-cross-path-1','to-path-2','to-town-p1','to-path-2','to-town-p1','to-path-2','to-cross-path-1','to-path-3','to-basin-cave','to-path-3','to-path-4','to-the-first-basin','to-path-4','to-path-3','to-cross-path-1','to-path-1','to-starting-spawn-tutorial','to-path-1','to-cross-path-1','to-path-3','to-path-5-under-construction']
    for(const exit of route) await walk(exit)
    await page.evaluate(() => { const s=window.worldGame.scene.getScenes(true)[0],e=s.options.area.exits.find(e=>e.blocked);window.worldGame.canvas.focus();s.navigation.move(s.player,e) })
    await page.waitForFunction(() => window.routeError?.includes('under construction'))
    assert.equal(await page.evaluate(()=>window.worldLocation.areaId),'path-5-under-construction')
    const blockedRequests=transitionRequests;await page.waitForTimeout(500);assert.equal(transitionRequests,blockedRequests,'blocked overlap does not spam')
    await page.setViewportSize({width:390,height:844})
    await page.waitForFunction(() => { const g=window.worldGame,s=g.scene.getScenes(true)[0];return g.scale.width===390&&g.scale.height===844&&s.cameras.main.worldView.contains(s.player.x,s.player.y) })
    assert.equal(await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].cameras.main.zoom),.72)
    for(const width of [320,360,390]){
      await page.setViewportSize({width,height:844});await page.waitForFunction(w=>innerWidth===w,width)
      const hud=await page.evaluate(()=>[...document.querySelectorAll('.game-header button')].filter(e=>!e.hidden&&!e.closest('[hidden]')).map(e=>{const b=e.getBoundingClientRect();return{name:e.getAttribute('aria-label')||e.textContent,x:b.left,right:b.right,y:b.top,bottom:b.bottom}}))
      assert.equal(hud.length,6);assert.ok(hud.some(c=>c.name==='Travel'));assert.ok(hud.every(c=>c.x>=0&&c.right<=width));assert.ok(Math.max(...hud.map(c=>c.y))<Math.min(...hud.map(c=>c.bottom)),'HUD stays one row')
    }
    await page.screenshot({path:'.wrangler/world-browser/mobile.png'})
    await page.evaluate(()=>{window.explicitDebug=true;window.recreateWorld()});await ready()
    assert.equal(await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].player.list.some(o=>o.name==='player-debug-body')),true)
    assert.ok(await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].children.list.some(o=>o.name==='area-debug-trigger')))
    assert.deepEqual(errors,[])
    await writeFile('.wrangler/world-browser/result.json',JSON.stringify({pass:true,transitions:route.length,blocked:true,viewport:[390,844],errors},null,2))
  } finally { await browser.close();await new Promise(r=>server.close(r)) }
})
