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
    import {LocalMinimapProvider} from './src/game-world/LocalMinimapProvider';import {useLocalMinimap} from './src/game-world/LocalMinimapContext';import {LocalMinimap} from './src/game-world/LocalMinimapView';import {MemoryRouter} from 'react-router-dom';import React,{useCallback,useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {GameHeader} from './src/components/layout/GameHeader';import {WorldNav} from './src/components/layout/WorldNav';import {FeaturePanelContext} from './src/features/menu/featurePanelState';
    import {PhaserWorldCanvas} from './src/game-world/PhaserWorldHost';
    import {createFarmWorldGame} from './src/game-world/createFarmWorldGame';import {createTownWorldGame} from './src/game-world/createTownWorldGame';import {createLdtkWorldGame} from './src/game-world/createLdtkWorldGame';
    import {createFarmWorldProjection} from './src/game-world/farmWorldProjection';import {townWorldProjection} from './src/game-world/townWorldProjection';import {createInitialGameState} from './src/game/gameState';
    import {authoredRoadExit,findArea,initialLocation} from './shared/world/world';
    import {isPublicPresenceV1} from './shared/realtime/protocolV1';import {CHARACTER_MODULES,paintCharacterArt,resolveCharacterComposition} from './src/characters/characterArt';import {createPlayerCharacter} from './src/game-world/PlayerCharacter';import {DEFAULT_APPEARANCE,resolveCharacterAppearance} from './shared/characters/appearance';
    window.fixtureCharacterArt={paintCharacterArt,resolveCharacterComposition,createPlayerCharacter};
    const state=createInitialGameState(Date.now(),true), farm=createFarmWorldProjection(state.property,state.geneticsLab,[],{}), owner='00000000-0000-4000-8000-000000000001';
    const appearance={body:1,skin:2,shirt:1,hair:3,hairColor:1,pants:1,hat:2,accessory:1};window.fixtureAppearance=appearance;window.fixtureModules=Object.keys(CHARACTER_MODULES);
    const remoteAppearance={body:0,skin:1,shirt:2,hair:0,hairColor:0,pants:2,hat:0,accessory:0};window.fixtureRemoteAppearance=remoteAppearance;
    let remote={presenceId:'00000000-0000-4000-8000-000000000002',publicId:'00000000-0000-4000-8000-000000000002',generation:1,label:'Art Fixture Grower',appearance:remoteAppearance,sequence:0,position:{x:1100,y:1000},facing:'south',movement:'stopped'};
    let legacyRemote={...remote,presenceId:'00000000-0000-4000-8000-000000000003',publicId:'00000000-0000-4000-8000-000000000003',label:'Legacy Fixture',appearance:'placeholder',position:{x:1320,y:1000}};window.fixtureLegacyAppearance=resolveCharacterAppearance(DEFAULT_APPEARANCE);
    const feminineAppearance={body:1,skin:2,shirt:3,hair:2,hairColor:2,pants:0,hat:1,accessory:1};window.fixtureFeminineAppearance=feminineAppearance;
    let feminineRemote={...remote,presenceId:'00000000-0000-4000-8000-000000000004',publicId:'00000000-0000-4000-8000-000000000004',label:'Feminine Fixture',appearance:feminineAppearance,position:{x:1100,y:1150}};
    if(![remote,legacyRemote,feminineRemote].every(isPublicPresenceV1))throw Error('Invalid public presence fixture');
    const presenceListeners=new Set();const connection={getSnapshot:()=>({status:'connected',remotes:[remote,legacyRemote,feminineRemote],chatMessages:[]}),subscribe:listener=>{presenceListeners.add(listener);return()=>presenceListeners.delete(listener)},sampleMovement(){}};
    window.publishRemote=(position,facing,movement)=>{remote={...remote,sequence:remote.sequence+1,position,facing,movement};presenceListeners.forEach(listener=>listener())};
    window.publishLegacyRemote=(position,facing,movement)=>{legacyRemote={...legacyRemote,sequence:legacyRemote.sequence+1,position,facing,movement};presenceListeners.forEach(listener=>listener())};
    window.publishFeminineRemote=(position,facing,movement)=>{feminineRemote={...feminineRemote,sequence:feminineRemote.sequence+1,position,facing,movement};presenceListeners.forEach(listener=>listener())};
    farm.gardenDisplays=[{slotId:'bed-1',specimenId:'fixture',x:2250,y:390,visual:{visualRevision:'fixture',baseAsset:null,silhouette:'columnar',specialTreatmentKey:null,pigmentationRecipeKeys:[],variation:{paletteIndex:0,scaleBucket:0,orientationIndex:1},spineRecipeKey:null}}];
    let pending=false, transition;const camera={};window.disposedScenes=[];
    function App(){const minimap=useLocalMinimap();const [travelHost,setTravelHost]=useState(null);const [location,setLocation]=useState(initialLocation(owner));window.worldLocation=location;window.recreateWorld=()=>setLocation({...location}); const area=findArea(location.areaId);
      transition=async id=>{if(pending)return;pending=true;const r=await fetch('/transition',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({exitId:id,expectedRevision:location.revision,commandId:crypto.randomUUID(),v:1})});const s=await r.json();pending=false;if(r.ok)setLocation(s);else window.routeError=s.error;};
      const createGame=useCallback((parent,bridge)=>{const o={minimap:minimap.store,area,position:location.position,camera,appearance,debug:window.explicitDebug===true,pending:()=>pending,onExit:id=>transition(id)};const g=area.areaType==='farm'?createFarmWorldGame(parent,bridge,{spawnId:'default',foundation:o}):area.areaType==='town'?createTownWorldGame(parent,bridge,{spawnId:'farm-arrival',foundation:o,connection}):createLdtkWorldGame(parent,o);window.worldGame=g;return g;},[location]);
      return <FeaturePanelContext.Provider value={{feature:null,travelHost,setTravelHost,openFeature(){}}}><div id='persistent-hud'><GameHeader/></div><WorldNav sceneName={area.displayName} destinations={[]} onTravel={()=>{}}/><PhaserWorldCanvas projection={area.areaType==='farm'?farm:area.areaType==='town'?townWorldProjection:{locations:[]}} onIntent={i=>{if(i.type==='ENTER_LOCATION'&&(i.locationId==='town'||i.locationId==='farm'))transition(authoredRoadExit(area).exitId)}} createGame={createGame}/><LocalMinimap areaId={area.areaId} hidden={false}/></FeaturePanelContext.Provider>}
    createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/world']}><LocalMinimapProvider><App/></LocalMinimapProvider></MemoryRouter>);
  ` }, bundle: true, loader:{'.css':'empty'}, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'import.meta.env': JSON.stringify({ MODE: 'staging', DEV: false }), 'process.env.NODE_ENV': '"development"' },plugins:[{name:'hud-read-projections',setup(p){
    const stubs={useGameState:"export const useGameState=()=>({state:{player:{tokens:11022}}})",useGrowerAuthority:"export const useGrowerAuthority=()=>({state:{authority:'local'}})",useSocialState:"export const useSocialState=()=>({state:{status:'ready',overview:{ownProfile:{displayName:'Staging Tester'}}},profileTarget:{open:false}})",useSocialPanel:"export const useSocialPanel=()=>({chatDockExpanded:false,activeTab:'world-chat',setChatDockExpanded(){},setActiveTab(){}})",useOwnPublicSkills:"export const useOwnPublicSkills=()=>null",UtilityMenu:"export const MenuDropdown=()=>null"};
    p.onResolve({filter:/\/(useGameState|useGrowerAuthority|useSocialState|useSocialPanel|useOwnPublicSkills|UtilityMenu)$/},a=>({path:a.path.split('/').at(-1),namespace:'hud'}));p.onLoad({filter:/.*/,namespace:'hud'},a=>({contents:stubs[a.path]}))
  }}] })
  const serverBundle = resolve('node_modules/.tmp/world-browser-server.mjs')
  await build({ stdin: { contents: "export { resolveExit } from './server/world/WorldService.ts'; export { initialLocation, WORLD } from './shared/world/world.ts'", resolveDir: process.cwd() }, bundle: true, platform: 'node', packages: 'external', format: 'esm', outfile: serverBundle })
  const { resolveExit, initialLocation, WORLD } = await import(pathToFileURL(serverBundle).href)
  const owner = '00000000-0000-4000-8000-000000000001'; let current = initialLocation(owner), transitionRequests=0
  const gameCss=(await Promise.all(['src/styles/tokens.css','src/index.css','src/styles/game.css','src/game-world/localMinimap.css'].map(f=>readFile(f,'utf8')))).join('\n')
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
    const page = await browser.newPage({ viewport: { width:1280,height:900 },hasTouch:true }), errors=[]
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const ready = () => page.waitForFunction(() => { const s=window.worldGame?.scene.getScenes(true)[0];return s?.player?.body && (s.options?.area??s.foundation?.area)?.areaId===window.worldLocation.areaId && (s.options?.debug??s.foundation?.debug)===(window.explicitDebug===true)&&window.fixtureModules.every(m=>s.textures.exists('character-module:'+m)&&s.textures.get('character-module:'+m).getSourceImage().width>0)&&s.player.list.some(o=>o.name==='character-art-v1'&&o.texture.source[0].width===320&&o.texture.source[0].height===448)&&s.player.getData('characterMotion') })
    try { await ready() } catch(e) { throw new Error(JSON.stringify(errors), {cause:e}) }; await page.evaluate(() => { window.savedHud=document.getElementById('persistent-hud') })
    const captured=new Set()
    const captureArt=async areaId=>{
      if(captured.has(areaId)||!['starting-spawn-tutorial','path-1','cross-path-1'].includes(areaId))return
      captured.add(areaId);await mkdir('.wrangler/art-direction-work',{recursive:true})
      const mapOpen=await page.getByLabel('Local minimap',{exact:true}).isVisible();if(mapOpen)await page.getByRole('button',{name:'Map',exact:true}).click()
      await page.screenshot({path:`.wrangler/art-direction-work/world-art-${areaId}-desktop.png`})
      await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>window.worldGame.scale.width===390&&window.worldGame.scene.getScenes(true)[0].cameras.main.worldView.contains(window.worldGame.scene.getScenes(true)[0].player.x,window.worldGame.scene.getScenes(true)[0].player.y));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
      await page.screenshot({path:`.wrangler/art-direction-work/world-art-${areaId}-mobile.png`})
      await page.setViewportSize({width:1280,height:900});await page.waitForFunction(()=>window.worldGame.scale.width===1280&&window.worldGame.scene.getScenes(true)[0].cameras.main.zoom===1.18)
      if(mapOpen)await page.getByRole('button',{name:'Map',exact:true}).click()
    }
    await captureArt('starting-spawn-tutorial')
    const checkCharacterComposition=async()=>{
      const proof=await page.evaluate(()=>{
        const scene=window.worldGame.scene.getScenes(true)[0],api=window.fixtureCharacterArt,directions=['south','west','east','north']
        const sources=Object.fromEntries(window.fixtureModules.map(module=>[module,scene.textures.get('character-module:'+module).getSourceImage()]))
        const npc=scene.children.list.find(o=>o.getData?.('characterPreset')==='mara'),npcImage=npc.list.find(o=>o.name==='character-art-v1'),npcAtlas=npcImage.texture.getSourceImage(),npcContext=npcAtlas.getContext('2d',{willReadFrequently:true})
        const preview=document.createElement('canvas'),scaled=document.createElement('canvas');scaled.width=64;scaled.height=112
        const scaledContext=scaled.getContext('2d',{willReadFrequently:true}),comparison=document.createElement('canvas');comparison.width=256;comparison.height=448
        const comparisonContext=comparison.getContext('2d'),failures=[],closestIdle=[null,null,null,null],minimumDifference=[1,1,1,1]
        const npcPixels=Array.from({length:20},(_,pose)=>npcContext.getImageData(pose%5*64,Math.floor(pose/5)*112,64,112).data)
        const silhouette=data=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=112;const context=canvas.getContext('2d'),pixels=context.createImageData(64,112);for(let i=0;i<data.length;i+=4)pixels.data[i+3]=data[i+3]>=32?255:0;context.putImageData(pixels,0,0);return canvas}
        comparisonContext.fillStyle='#e8d4b4';comparisonContext.fillRect(0,0,256,448)
        for(let row=0;row<4;row++){
          comparisonContext.drawImage(npcAtlas,0,row*112,64,112,0,row*112,64,112)
          comparisonContext.drawImage(silhouette(npcPixels[row*5]),128,row*112)
        }
        const report=message=>{if(failures.length<8)failures.push(message)}
        let looks=0,poses=0,protectedEyeChecks=0,maximumChannelDifference=0,maximumVisibleChannelDifference=0
        const listenersBefore=scene.events.listenerCount('postupdate')
        if(npc.width!==54||npc.height!==54||npcImage.displayWidth!==64||npcImage.displayHeight!==112||npcImage.x!==0||npcImage.y!==13||npcImage.originX!==.5||npcImage.originY!==1)report('NPC bypasses the shared world registration')
        for(let pose=0;pose<20;pose++){
          const pixels=npcPixels[pose];let opaque=0,edge=0
          for(let i=3;i<pixels.length;i+=4)if(pixels[i]>=32){opaque++;const pixel=(i-3)/4,x=pixel%64,y=Math.floor(pixel/64);if(x===0||x===63||y===0||y>109)edge++}
          if(opaque<600||edge)report('Empty or clipped NPC pose: '+pose+' ('+opaque+' opaque, '+edge+' edge pixels)')
        }
        // The protected pupil coordinates were checked against the unchanged
        // source body pixels, so this detects bad hat fit even when both render
        // paths share it. Compare the same hairstyle with and without headwear.
        const eyeReferences={}
        for(let body=0;body<2;body++)for(let hair=0;hair<4;hair++)for(let frame=0;frame<5;frame++){
          const appearance={body,skin:2,shirt:1,hair,hairColor:3,pants:1,hat:0,accessory:0},options={facing:'south',frame}
          api.paintCharacterArt(preview,sources,appearance,options);scaledContext.clearRect(0,0,64,112);scaledContext.drawImage(preview,0,0,64,112)
          eyeReferences[body+':'+hair+':'+frame]={eyes:api.resolveCharacterComposition(appearance,options).protectedEyes,source:preview.getContext('2d',{willReadFrequently:true}).getImageData(0,0,128,224).data,world:scaledContext.getImageData(0,0,64,112).data}
        }
        for(let body=0;body<2;body++)for(let hair=0;hair<4;hair++)for(let hat=0;hat<3;hat++)for(let accessory=0;accessory<2;accessory++){
          const appearance={body,skin:2,shirt:1,hair,hairColor:3,pants:1,hat,accessory},label=JSON.stringify({body,hair,hat,accessory}),existingTextures=new Set(scene.textures.getTextureKeys())
          const character=api.createPlayerCharacter(scene,0,0,appearance,{externalMotion:true}),image=character.list.find(o=>o.name==='character-art-v1'),atlas=image.texture.getSourceImage(),context=atlas.getContext('2d',{willReadFrequently:true}),key=image.texture.key
          if(character.width!==54||character.height!==54||image.displayWidth!==64||image.displayHeight!==112||image.x!==0||image.y!==13||image.originX!==.5||image.originY!==1)report('World registration changed: '+label)
          for(let row=0;row<4;row++)for(let frame=0;frame<5;frame++){
            api.paintCharacterArt(preview,sources,appearance,{facing:directions[row],frame})
            scaledContext.clearRect(0,0,64,112);scaledContext.drawImage(preview,0,0,64,112)
            const expected=scaledContext.getImageData(0,0,64,112).data,actual=context.getImageData(frame*64,row*112,64,112).data,npcPose=npcPixels[row*5+frame]
            let changed=0,opaque=0,intersection=0,union=0,minX=64,maxX=-1,minY=112,maxY=-1
            for(let i=0;i<actual.length;i++){
              const difference=Math.abs(actual[i]-expected[i]);maximumChannelDifference=Math.max(maximumChannelDifference,difference)
              // Canvas exposes unpremultiplied RGB, whose rounding can differ
              // greatly at nearly transparent fringes. Compare rendered color
              // contribution and alpha, retaining a two-byte visible tolerance.
              const channel=i%4,alpha=i-channel+3,visibleDifference=channel===3?difference:Math.abs(actual[i]*actual[alpha]-expected[i]*expected[alpha])/255
              maximumVisibleChannelDifference=Math.max(maximumVisibleChannelDifference,visibleDifference);if(visibleDifference>2)changed++
              if(i%4===3){
                const playerOpaque=actual[i]>=32,npcOpaque=npcPose[i]>=32;if(playerOpaque||npcOpaque)union++;if(playerOpaque&&npcOpaque)intersection++
                if(playerOpaque){opaque++;const pixel=(i-3)/4,x=pixel%64,y=Math.floor(pixel/64);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
              }
            }
            if(changed)report('Preview/world pixels differ: '+label+'/'+directions[row]+'/'+frame+' ('+changed+' channels)')
            if(opaque<600||minX<1||maxX>62||minY<1||maxY>109)report('Empty or clipped pose: '+label+'/'+directions[row]+'/'+frame+' '+[opaque,minX,minY,maxX,maxY].join(','))
            if(row===0&&hat>0&&accessory===0){
              const reference=eyeReferences[body+':'+hair+':'+frame],source=preview.getContext('2d',{willReadFrequently:true}).getImageData(0,0,128,224).data
              let sourceChanges=0,worldChanges=0
              if(reference.eyes.length!==2)report('South pose lacks two protected source pupils: '+label+'/'+frame)
              for(const [eyeX,eyeY] of reference.eyes){
                for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
                  const offset=((Math.round(eyeY)+dy)*128+Math.round(eyeX)+dx)*4
                  for(let channel=0;channel<4;channel++)if(Math.abs(source[offset+channel]-reference.source[offset+channel])>2)sourceChanges++
                }
                const offset=(Math.floor(eyeY/2)*64+Math.floor(eyeX/2))*4
                for(let channel=0;channel<4;channel++)if(Math.abs(actual[offset+channel]-reference.world[offset+channel])>2)worldChanges++
              }
              if(sourceChanges||worldChanges)report('Headwear covers protected eyes: '+label+'/'+frame+' ('+sourceChanges+' source, '+worldChanges+' world channels)')
              protectedEyeChecks++
            }
            const difference=1-intersection/union;minimumDifference[row]=Math.min(minimumDifference[row],difference)
            if(frame===0&&(!closestIdle[row]||difference<closestIdle[row].difference)){
              closestIdle[row]={appearance,difference};comparisonContext.clearRect(64,row*112,64,112);comparisonContext.clearRect(192,row*112,64,112);comparisonContext.fillStyle='#e8d4b4';comparisonContext.fillRect(64,row*112,64,112);comparisonContext.fillRect(192,row*112,64,112)
              comparisonContext.drawImage(atlas,0,row*112,64,112,64,row*112,64,112);comparisonContext.drawImage(silhouette(actual),192,row*112)
            }
            poses++
          }
          character.destroy();if(!existingTextures.has(key))scene.textures.remove(key);looks++
        }
        for(let row=0;row<4;row++)for(let frame=0;frame<5;frame++){
          for(const appearance of [{skin:0,shirt:0},{body:1,skin:2,shirt:3,hair:3,hairColor:3,pants:2,hat:2,accessory:1}]){
            api.paintCharacterArt(preview,sources,appearance,{facing:directions[row],frame,npcId:'mara'});scaledContext.clearRect(0,0,64,112);scaledContext.drawImage(preview,0,0,64,112)
            const actual=scaledContext.getImageData(0,0,64,112).data,expected=npcPixels[row*5+frame]
            if(actual.some((channel,index)=>Math.abs(channel-expected[index])>2))report('NPC art depends on player choices or bypasses shared world composition: '+directions[row]+'/'+frame)
          }
        }
        if(scene.events.listenerCount('postupdate')!==listenersBefore)report('Composition fixture leaked a motion listener')
        return{looks,poses,protectedEyeChecks,maximumChannelDifference,maximumVisibleChannelDifference,minimumSilhouetteDifference:Object.fromEntries(directions.map((direction,row)=>[direction,minimumDifference[row]])),closestPlayerIdle:Object.fromEntries(directions.map((direction,row)=>[direction,closestIdle[row]])),npcExclusive:true,failures,comparison:comparison.toDataURL('image/png')}
      })
      const {comparison,...evidence}=proof
      await writeFile('.wrangler/art-direction-work/character-v21-mara-label-free-comparison.png',Buffer.from(comparison.split(',')[1],'base64'))
      await writeFile('.wrangler/art-direction-work/character-v21-world-art-proof.json',JSON.stringify(evidence,null,2))
      assert.equal(proof.looks,48);assert.equal(proof.poses,960);assert.equal(proof.protectedEyeChecks,80);assert.deepEqual(proof.failures,[],'all body/hair/hat/accessory poses fit the unchanged world frames, keep eyes visible and match the shared preview')
      for(const [facing,difference] of Object.entries(proof.minimumSilhouetteDifference))assert.ok(difference>.10,`Mara ${facing} silhouette remains distinct from every player geometry look at world resolution (${difference})`)
      return evidence
    }
    const artEvidence=await checkCharacterComposition()
    const motionEvidence={keyboard:{},groundClick:null,blockedKeyboard:false,rapidReplacement:false,listenersReleased:false,minimap:0,remote:0,remoteKinds:{savedMasculine:0,savedFeminine:0,legacyDefault:0},mara:false}
    const checkKeyboardMotion=async()=>{
      const center=await page.evaluate(()=>{
        const s=window.worldGame.scene.getScenes(true)[0],map=s.navigation.map,a=s.options.area,p=s.player,candidates=[]
        for(let y=300;y<a.height-300;y+=100)for(let x=300;x<a.width-300;x+=100){const c={x,y};if(map.route(p,c)&&[{x:x-205,y},{x:x+205,y},{x,y:y-205},{x,y:y+205}].every(t=>map.clear(c,t))&&!a.exits.some(e=>Math.hypot(c.x-e.x,c.y-e.y)<350))candidates.push(c)}
        candidates.sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y));if(!candidates.length)throw Error('No clear physical motion fixture');return candidates[0]
      })
      for(const [key,facing] of [['ArrowDown','south'],['ArrowLeft','west'],['ArrowRight','east'],['ArrowUp','north']]){
        await page.evaluate(c=>{const s=window.worldGame.scene.getScenes(true)[0];window.worldGame.canvas.focus();s.navigation.move(s.player,c)},center)
        await page.waitForFunction(c=>{const s=window.worldGame.scene.getScenes(true)[0];return Math.hypot(s.player.x-c.x,s.player.y-c.y)<5&&s.navigation.destination===null},center)
        await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0];window.gaitFrames=[];window.motionObserver=()=>{const m=s.player.getData('characterMotion');if(m.moving)window.gaitFrames.push({...m})};s.events.on('postupdate',window.motionObserver)})
        await page.keyboard.down(key)
        // Release at the verified distance; screenshot latency must not extend movement.
        try{await page.waitForFunction(c=>{const p=window.worldGame.scene.getScenes(true)[0].player;return Math.hypot(p.x-c.x,p.y-c.y)>172},center,{timeout:2500})}finally{await page.keyboard.up(key)}
        await page.screenshot({path:`.wrangler/art-direction-work/character-v2-keyboard-stop-${facing}.png`})
        await page.waitForFunction(()=>{const m=window.worldGame.scene.getScenes(true)[0].player.getData('characterMotion');return !m.moving&&m.frame===0})
        const frames=await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0];s.events.off('postupdate',window.motionObserver);return{frames:window.gaitFrames,state:s.player.getData('characterMotion'),frame:s.player.list.find(o=>o.name==='character-art-v1').frame.name}})
        assert.deepEqual([...new Set(frames.frames.filter(m=>m.facing===facing).map(m=>m.frame))].sort(),[1,2,3,4],`${facing} uses four actual movement frames`);assert.equal(frames.state.facing,facing);assert.equal(Number(frames.frame),['south','west','east','north'].indexOf(facing)*5);motionEvidence.keyboard[facing]=true
      }
      const stopped=await page.evaluate(()=>{const p=window.worldGame.scene.getScenes(true)[0].player;return{x:p.x,y:p.y}})
      await page.getByRole('button',{name:'Travel',exact:true}).focus();await page.keyboard.down('ArrowDown');await page.waitForTimeout(160);await page.keyboard.up('ArrowDown')
      const blocked=await page.evaluate(()=>{const p=window.worldGame.scene.getScenes(true)[0].player;return{x:p.x,y:p.y,motion:p.getData('characterMotion')}})
      assert.ok(Math.hypot(blocked.x-stopped.x,blocked.y-stopped.y)<.5,'UI keyboard focus stops physical movement');assert.equal(blocked.motion.moving,false);assert.equal(blocked.motion.frame,0);motionEvidence.blockedKeyboard=true
      await page.evaluate(()=>window.worldGame.canvas.focus())
      return center
    }
    const checkGroundClickMotion=async()=>{
      if(await page.getByLabel('Local minimap',{exact:true}).isVisible())await page.getByRole('button',{name:'Map',exact:true}).click()
      assert.equal(await page.getByLabel('Local minimap',{exact:true}).isVisible(),false)
      const click=await page.evaluate(()=>{
        const s=window.worldGame.scene.getScenes(true)[0],p=s.player,a=s.options.area,map=s.navigation.map,camera=s.cameras.main,canvas=window.worldGame.canvas,bounds=canvas.getBoundingClientRect()
        const target=[{x:p.x+190,y:p.y,facing:'east'},{x:p.x-190,y:p.y,facing:'west'},{x:p.x,y:p.y+190,facing:'south'},{x:p.x,y:p.y-190,facing:'north'}].find(t=>map.clear(p,t)&&!a.interactables.some(e=>Math.hypot(t.x-e.x,t.y-e.y)<110)&&!a.exits.some(e=>Math.hypot(t.x-e.x,t.y-e.y)<320))
        if(!target)throw Error('No reachable ground-click animation target')
        // Invert Camera.getWorldPoint so the real pointer uses the current camera/zoom,
        // rather than invoking navigation or substituting a synthetic world event.
        const origin=camera.getWorldPoint(0,0),xAxis=camera.getWorldPoint(1,0),yAxis=camera.getWorldPoint(0,1),ax=xAxis.x-origin.x,ay=xAxis.y-origin.y,bx=yAxis.x-origin.x,by=yAxis.y-origin.y,dx=target.x-origin.x,dy=target.y-origin.y,det=ax*by-ay*bx
        const x=(dx*by-dy*bx)/det,y=(dy*ax-dx*ay)/det
        window.groundClickFrames=[];window.groundMotionObserver=()=>{const m=p.getData('characterMotion');if(m.moving)window.groundClickFrames.push({...m,selected:p.list.find(o=>o.name==='character-art-v1').frame.name})};s.events.on('postupdate',window.groundMotionObserver)
        return{target,position:{x:p.x,y:p.y},screen:{x:bounds.left+x*bounds.width/window.worldGame.scale.width,y:bounds.top+y*bounds.height/window.worldGame.scale.height}}
      })
      assert.ok(click.screen.x>30&&click.screen.x<1250&&click.screen.y>90&&click.screen.y<850,'ground target is visible outside the HUD')
      await page.mouse.click(click.screen.x,click.screen.y)
      const destination=await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].navigation.destination);assert.ok(destination);assert.ok(Math.hypot(destination.x-click.target.x,destination.y-click.target.y)<3,'real canvas pointer selects the intended world point')
      await page.waitForFunction(start=>{const p=window.worldGame.scene.getScenes(true)[0].player,m=p.getData('characterMotion');return m.moving&&m.frame>0&&Math.hypot(p.x-start.x,p.y-start.y)>10},click.position)
      await page.waitForFunction(t=>{const s=window.worldGame.scene.getScenes(true)[0],m=s.player.getData('characterMotion');return Math.hypot(s.player.x-t.x,s.player.y-t.y)<5&&s.navigation.destination===null&&!m.moving&&m.frame===0},destination)
      const actual=await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0],p=s.player;s.events.off('postupdate',window.groundMotionObserver);return{frames:window.groundClickFrames,motion:p.getData('characterMotion'),selected:p.list.find(o=>o.name==='character-art-v1').frame.name}})
      const row=['south','west','east','north'].indexOf(click.target.facing),frames=[...new Set(actual.frames.map(m=>m.frame))].sort()
      assert.deepEqual(frames,[1,2,3,4],'canvas click walks through all four shared gait frames');assert.ok(actual.frames.every(m=>m.facing===click.target.facing&&Number(m.selected)===row*5+m.frame),'canvas walking uses the shared directional sprite frames');assert.deepEqual(actual.motion,{facing:click.target.facing,moving:false,frame:0});assert.equal(Number(actual.selected),row*5)
      motionEvidence.groundClick={frames,facing:click.target.facing,arrived:true,idle:true}
    }
    const checkMaraFacing=async()=>{
      const target=await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0],m=s.children.list.find(o=>o.getData?.('characterPreset')==='mara'),map=s.navigation.map;const target=[{x:m.x+150,y:m.y},{x:m.x-150,y:m.y},{x:m.x,y:m.y+150},{x:m.x,y:m.y-150}].find(t=>map.walkable(t)&&map.route(s.player,t));if(!target)throw Error('No Mara approach fixture');window.worldGame.canvas.focus();s.navigation.move(s.player,target);return target})
      await page.waitForFunction(t=>{const s=window.worldGame.scene.getScenes(true)[0];return Math.hypot(s.player.x-t.x,s.player.y-t.y)<5&&s.navigation.destination===null},target)
      await page.waitForFunction(()=>{const s=window.worldGame.scene.getScenes(true)[0],m=s.children.list.find(o=>o.getData?.('characterPreset')==='mara'),dx=s.player.x-m.x,dy=s.player.y-m.y;return m.getData('characterMotion').facing===(Math.abs(dx)>Math.abs(dy)?dx>0?'east':'west':dy>0?'south':'north')})
      const mara=await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0],m=s.children.list.find(o=>o.getData?.('characterPreset')==='mara');return{appearance:m.getData('characterAppearance'),motion:m.getData('characterMotion'),key:m.list.find(o=>o.name==='character-art-v1').texture.key,body:!!m.body}})
      assert.equal(mara.appearance.body,1);assert.equal(mara.motion.moving,false);assert.equal(mara.motion.frame,0);assert.ok(mara.key.startsWith('character-art-v2:mara:'));assert.equal(mara.body,false);motionEvidence.mara=true
      await page.screenshot({path:'.wrangler/art-direction-work/character-v2-mara-facing.png'})
    }
    const keyboardCenter=await checkKeyboardMotion()
    // Screenshot latency can carry held keys into the existing navigation margin.
    // Walk back to the verified clear center before selecting a real canvas click.
    await page.evaluate(c=>{const s=window.worldGame.scene.getScenes(true)[0];s.navigation.move(s.player,c)},keyboardCenter)
    await page.waitForFunction(c=>{const s=window.worldGame.scene.getScenes(true)[0],m=s.player.getData('characterMotion');return Math.hypot(s.player.x-c.x,s.player.y-c.y)<5&&s.navigation.destination===null&&!m.moving&&m.frame===0},keyboardCenter)
    await checkGroundClickMotion();await checkMaraFacing()
    await page.getByRole('button',{name:'Map',exact:true}).click();await page.getByLabel('Local minimap',{exact:true}).waitFor()
    assert.deepEqual(await page.locator('.game-header__right').getByRole('button').allTextContents(),['Map','Travel','Menu'])
    const rapid=await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0],p=s.player,map=s.navigation.map,pairs=[[{x:p.x+140,y:p.y},{x:p.x-140,y:p.y}],[{x:p.x,y:p.y+140},{x:p.x,y:p.y-140}]];return pairs.find(pair=>pair.every(t=>map.clear(p,t)))})
    assert.ok(rapid,'two distinct reachable rapid-click destinations')
    const svg=page.locator('.local-minimap svg'),toScreen=t=>svg.evaluate((el,t)=>{const p=el.createSVGPoint();p.x=t.x;p.y=t.y;const q=p.matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y}},t)
    const first=await toScreen(rapid[0]),last=await toScreen(rapid[1]);await page.mouse.click(first.x,first.y);await page.mouse.click(last.x,last.y)
    const latest=await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].navigation.destination);assert.ok(Math.hypot(latest.x-rapid[1].x,latest.y-rapid[1].y)<40,'newest click replaces the first destination immediately')
    await page.waitForFunction(t=>{const s=window.worldGame.scene.getScenes(true)[0];return Math.hypot(s.player.x-t.x,s.player.y-t.y)<5&&s.navigation.destination===null&&!s.player.getData('characterMotion').moving},latest);motionEvidence.rapidReplacement=true
    const checkMap=async(touch=false)=>{
      const before=await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0],map=s.navigation.map,p=s.player;const target=[{x:p.x+100,y:p.y},{x:p.x-100,y:p.y},{x:p.x,y:p.y+100},{x:p.x,y:p.y-100}].find(t=>map.walkable(t)&&map.route(p,t));return {target,position:{x:p.x,y:p.y},zoom:s.cameras.main.zoom}})
      const svg=page.locator('.local-minimap svg')
      const screen=await svg.evaluate((el,t)=>{const p=el.createSVGPoint();p.x=t.x;p.y=t.y;const q=p.matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y}},before.target)
      if(touch)await page.touchscreen.tap(screen.x,screen.y);else await page.mouse.click(screen.x,screen.y)
      assert.equal(await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].cameras.main.zoom),before.zoom)
      const destination=await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].navigation.destination);assert.ok(destination);assert.ok(Math.hypot(destination.x-before.target.x,destination.y-before.target.y)<40,'minimap pointer pixel quantization stays within a few runtime pixels');
      const immediate=await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0];return{x:s.player.x,y:s.player.y}})
      assert.ok(Math.hypot(immediate.x-before.position.x,immediate.y-before.position.y)<50,'click does not teleport')
      await page.waitForFunction(()=>window.worldGame.scene.getScenes(true)[0].player.getData('characterMotion').moving);motionEvidence.minimap++
      await page.waitForFunction(t=>{const s=window.worldGame.scene.getScenes(true)[0];return Math.hypot(s.player.x-t.x,s.player.y-t.y)<5},destination).catch(async e=>{await page.screenshot({path:'.wrangler/world-browser/minimap-failure.png'});throw new Error(JSON.stringify(await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0];return {player:{x:s.player.x,y:s.player.y},destination:s.navigation.destination,path:s.navigation.path,focus:document.activeElement?.tagName,status:document.querySelector('.local-minimap')?.textContent}})),{cause:e})})
      await page.waitForFunction(t=>Math.abs(Number(document.querySelector('.local-minimap__player')?.getAttribute('cx'))-t.x)<5,destination)
      await page.waitForFunction(()=>window.worldGame.scene.getScenes(true)[0].navigation.destination===null)
      await page.waitForFunction(()=>{const m=window.worldGame.scene.getScenes(true)[0].player.getData('characterMotion');return !m.moving&&m.frame===0})
      const blocked=await page.evaluate(()=>{const r=window.worldGame.scene.getScenes(true)[0].navigation.map.obstacles[0];return{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}})
      const bad=await svg.evaluate((el,t)=>{const p=el.createSVGPoint();p.x=t.x;p.y=t.y;const q=p.matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y}},blocked)
      if(touch)await page.touchscreen.tap(bad.x,bad.y);else await page.mouse.click(bad.x,bad.y);await page.getByText('That point cannot be reached.',{exact:true}).waitFor()
      assert.equal(await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].navigation.destination),null)
    }
    await checkMap();await page.getByRole('button',{name:'Map',exact:true}).click();await page.getByLabel('Local minimap',{exact:true}).waitFor({state:'hidden'});await page.getByRole('button',{name:'Map',exact:true}).click()
    async function walk(exitId) {
      const before=await page.evaluate(() => window.worldLocation.areaId)
      await page.evaluate(()=>window.disposedScenes.push(window.worldGame.scene.getScenes(true)[0]))
      const beforeRequests=transitionRequests
      await page.waitForFunction(id=>document.querySelector('.local-minimap')?.getAttribute('data-area-id')===id,before)
      if(['player-farm','town-p1'].includes(before)) await checkMap()
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
      const actual = await page.evaluate(() => {const s=window.worldGame.scene.getScenes(true)[0];return{location:window.worldLocation,x:s.player.x,y:s.player.y,w:s.physics.world.bounds.width,h:s.physics.world.bounds.height,cameraW:s.cameras.main.getBounds().width,cameraH:s.cameras.main.getBounds().height,zoom:s.cameras.main.zoom,radius:s.player.body.radius,character:s.player.list.map(o=>({type:o.type,width:o.width,height:o.height,name:o.name})),appearance:s.player.getData('characterAppearance'),expectedAppearance:window.fixtureAppearance,characterWidth:s.player.width,characterHeight:s.player.height,characterDepth:s.player.depth,scaleX:s.player.scaleX,debugTriggers:s.children.list.filter(o=>o.name==='area-debug-trigger'||o.name==='area-debug-spawn').length,rockTiles:s.children.list.filter(o=>o.name==='terrain-boundary'||o.name==='settlement:BoundaryEdges'||o.name==='basin:BoundaryEdges').length,collisionDebug:s.children.list.filter(o=>o.name==='collision-debug-boundary').length,debugLabels:s.children.list.filter(o=>o.name==='area-debug-label').length,hud:window.savedHud===document.getElementById('persistent-hud')}})
      const a=WORLD.areas.find(a=>a.areaId===actual.location.areaId),spawn=a.spawns.find(s=>s.entryId===actual.location.entryId)
      assert.equal(actual.w,a.width);assert.equal(actual.h,a.height);assert.equal(actual.cameraW,a.width);assert.equal(actual.cameraH,a.height)
      assert.ok(Math.hypot(actual.x-spawn.x,actual.y-spawn.y)<8);assert.equal(actual.hud,true);assert.equal(actual.zoom,1.18);assert.equal(actual.radius,27);assert.equal(actual.scaleX,1);assert.equal(actual.debugLabels,0);assert.equal(actual.debugTriggers,0);assert.equal(actual.collisionDebug,0);assert.equal(actual.rockTiles,a.visualLayers?.find(l=>l.name==='BoundaryEdges')?.tiles.length??0);assert.equal(actual.characterWidth,54);assert.equal(actual.characterHeight,54);assert.equal(actual.characterDepth,120);assert.ok(actual.character.some(o=>o.name==='character-art-v1'),'all Areas use the shared raster character');assert.deepEqual(actual.appearance,actual.expectedAppearance,'modular choices survive Farm/Town/LDtk transitions')
      if(a.areaId==='town-p1'){
        const remotes=await page.evaluate(()=>{const s=window.worldGame.scene.getScenes(true)[0],avatars=s.children.list.filter(o=>o.type==='Container'&&o.depth===80);return {expected:{savedMasculine:window.fixtureRemoteAppearance,savedFeminine:window.fixtureFeminineAppearance,legacyDefault:window.fixtureLegacyAppearance},avatars:avatars.map(o=>({appearance:o.getData('characterAppearance'),art:o.list.some(c=>c.name==='character-art-v1'),legacy:o.list.some(c=>c.type==='Rectangle')&&o.list.some(c=>c.type==='Arc')}))}})
        assert.equal(remotes.avatars.length,3);assert.ok(remotes.avatars.every(o=>o.art&&!o.legacy),'saved and legacy staging remotes all use the shared raster renderer')
        for(const fixture of [{skin:1,kind:'savedMasculine',publish:'publishRemote'},{skin:2,kind:'savedFeminine',publish:'publishFeminineRemote'},{skin:0,kind:'legacyDefault',publish:'publishLegacyRemote'}]){
          assert.deepEqual(remotes.avatars.find(o=>o.appearance.skin===fixture.skin)?.appearance,remotes.expected[fixture.kind],`${fixture.kind} renders its saved or deterministic default appearance`)
          await page.evaluate(({skin,publish})=>{const s=window.worldGame.scene.getScenes(true)[0],r=s.children.list.find(o=>o.getData?.('characterAppearance')?.skin===skin&&o.depth===80);window[publish]({x:r.x+220,y:r.y},'east','moving')},fixture)
          await page.waitForFunction(skin=>{const s=window.worldGame.scene.getScenes(true)[0],r=s.children.list.find(o=>o.getData?.('characterAppearance')?.skin===skin&&o.depth===80),m=r.getData('characterMotion'),frame=r.list.find(o=>o.name==='character-art-v1').frame.name;return m.moving&&m.facing==='east'&&m.frame>0&&Number(frame)===10+m.frame},fixture.skin,{polling:'raf'})
          await page.waitForFunction(skin=>{const s=window.worldGame.scene.getScenes(true)[0],r=s.children.list.find(o=>o.getData?.('characterAppearance')?.skin===skin&&o.depth===80),m=r.getData('characterMotion');return !m.moving&&m.frame===0&&m.facing==='east'},fixture.skin)
          await page.evaluate(({skin,publish})=>{const s=window.worldGame.scene.getScenes(true)[0],r=s.children.list.find(o=>o.getData?.('characterAppearance')?.skin===skin&&o.depth===80);window[publish]({x:r.x,y:r.y},'north','stopped')},fixture)
          await page.waitForFunction(skin=>{const s=window.worldGame.scene.getScenes(true)[0],r=s.children.list.find(o=>o.getData?.('characterAppearance')?.skin===skin&&o.depth===80),m=r.getData('characterMotion'),frame=r.list.find(o=>o.name==='character-art-v1').frame.name;return m.facing==='north'&&!m.moving&&m.frame===0&&Number(frame)===15&&!r.body},fixture.skin)
          motionEvidence.remote++;motionEvidence.remoteKinds[fixture.kind]++
        }
        await page.screenshot({path:'.wrangler/art-direction-work/town-modular-remote.png'})
        await page.screenshot({path:'.wrangler/art-direction-work/character-v2-town.png'})
      }
      if(a.areaId==='player-farm')await page.screenshot({path:'.wrangler/art-direction-work/character-v2-farm.png'})
      await captureArt(a.areaId)
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
      assert.equal(hud.length,7);assert.ok(hud.some(c=>c.name==='Travel'));assert.ok(hud.every(c=>c.x>=0&&c.right<=width));assert.ok(Math.max(...hud.map(c=>c.y))<Math.min(...hud.map(c=>c.bottom)),'HUD stays one row')
    }
    await checkMap(true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.wrangler/world-browser/mobile.png'})
    await page.evaluate(()=>{window.explicitDebug=true;window.recreateWorld()});await ready()
    assert.equal(await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].player.list.some(o=>o.name==='player-debug-body')),true)
    assert.ok(await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].children.list.some(o=>o.name==='area-debug-trigger')))
    assert.ok(await page.evaluate(()=>window.worldGame.scene.getScenes(true)[0].children.list.some(o=>o.name==='collision-debug-boundary')));
    assert.equal(await page.evaluate(()=>window.disposedScenes.length>=26&&window.disposedScenes.every(s=>!s.events?.listenerCount('postupdate'))),true,'disposed scenes release every motion/presence postupdate listener');motionEvidence.listenersReleased=true
    assert.deepEqual(errors,[])
    await writeFile('.wrangler/world-browser/result.json',JSON.stringify({pass:true,transitions:route.length,blocked:true,viewport:[390,844],artEvidence,motionEvidence,errors},null,2))
  } finally { await browser.close();await new Promise(r=>server.close(r)) }
})
