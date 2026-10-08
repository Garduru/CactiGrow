import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const evidence = resolve('.wrangler/field-survey-browser')
const entry = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
import {PlayerBootstrapContext} from './src/app/PlayerBootstrapContext';import {PlantLifecycleContext} from './src/app/PlantLifecycleContext';import {StartingContext} from './src/features/starting/StartingContext';import {WorldLocationContext} from './src/game-world/WorldLocationContext';
import {FieldSurveyProvider} from './src/features/field-survey/FieldSurveyProvider';import {useFieldSurvey} from './src/features/field-survey/FieldSurveyContext';import {FieldSurveyObjective} from './src/features/field-survey/FieldSurveyObjective';import {FieldSurveyDevInspection} from './src/features/field-survey/FieldSurveyDevInspection';
import {ExplorationProvider} from './src/features/exploration/ExplorationProvider';import {useExploration} from './src/features/exploration/ExplorationContext';import {FieldJournalPage} from './src/features/journal/FieldJournalPage';import {LdtkWorldPage} from './src/game-world/LdtkWorldPage';
import {GameHeader} from './src/components/layout/GameHeader';import {FeaturePanelContext} from './src/features/menu/featurePanelState';import {LocalMinimapProvider} from './src/game-world/LocalMinimapProvider';
import {FIELD_SURVEY} from './shared/api/fieldSurveyV1';import {WORLD,findArea} from './shared/world/world';import {createInitialGameState} from './src/game/gameState';
const owner='47511805-24fb-4934-8fb8-bd495bc3ad55',at=new Date().toISOString(),mara=findArea(FIELD_SURVEY.npcAreaId).interactables.find(e=>e.entityId===FIELD_SURVEY.npcEntityId),params=new URLSearchParams(location.search);
window.fixtureWorld=WORLD;window.fixtureCommands=[];window.fixtureSurveyReads=0;window.fixtureEntries=0;window.fixtureLifecycleReads=0;window.fixtureGrowerReads=0;window.fixtureGameCreations=0;window.fixtureListeners=new Set();window.fixtureGameState=createInitialGameState(Date.now(),true);
const saved=JSON.parse(sessionStorage.getItem('survey-server')||'null');
window.fixtureServer=saved||{projection:{projectionVersion:1,revision:0,progressRevision:0,status:params.has('locked')?'locked':'available',acceptedAt:null,completedAt:null,rewardClaimed:false,objectives:{landmarks:FIELD_SURVEY.landmarkIds.map((landmarkId,i)=>({landmarkId,discoveredAt:i===0?at:null})),sanPedroHarvested:true,peyoteHarvested:false,caveEntered:false,caveLandmarkDiscovered:false,caveNoteInspected:false}},starting:{projectionVersion:1,revision:1,compatibilityComplete:false,nameComplete:true,appearance:{skin:0,shirt:0},appearanceComplete:true,spawnTutorialComplete:true,farmTutorialComplete:!params.has('locked'),spawnStage:'complete',farmStage:params.has('locked')?'nursery':'complete',equipment:{tool:'field-knife',head:null,body:null,accessory:null},ownedEquipment:['field-knife'],harvestingXp:10,tutorialSeedAvailable:false,pot:null,tutorialParentIds:[],offspringSeedId:null},currency:0,rewardCount:0};
window.fixtureExplorationState={projectionVersion:1,revision:0,serverNow:at,harvestingXp:10,nodes:WORLD.areas.flatMap(a=>(a.interactables||[]).filter(e=>e.resourceType).map(e=>({entityId:e.entityId,areaId:a.areaId,readyAt:null}))),landmarks:WORLD.areas.flatMap(a=>(a.landmarks||[]).map(e=>({landmarkId:e.landmarkId,areaId:a.areaId,discoveredAt:e.landmarkId==='entrance-grove'?at:null}))),notes:WORLD.areas.flatMap(a=>(a.interactables||[]).filter(e=>e.noteId).map(e=>({noteId:e.noteId,areaId:a.areaId,discoveredAt:null})))};
const save=()=>sessionStorage.setItem('survey-server',JSON.stringify(window.fixtureServer)),ready=()=>{const p=window.fixtureServer.projection,o=p.objectives;if(p.acceptedAt&&p.status!=='complete')p.status=o.landmarks.every(l=>l.discoveredAt)&&o.sanPedroHarvested&&o.peyoteHarvested&&o.caveEntered&&o.caveLandmarkDiscovered&&o.caveNoteInspected?'ready-to-report':'active';save()},surveyResult=()=>structuredClone({projection:window.fixtureServer.projection,starting:window.fixtureServer.starting}),explorationResult=()=>({...surveyResult(),projection:structuredClone(window.fixtureExplorationState),fieldSurvey:structuredClone(window.fixtureServer.projection)});
window.fixtureConnection={getSnapshot:()=>({status:'connected',remotes:[],chatMessages:[]}),subscribe:f=>{window.fixtureListeners.add(f);return()=>window.fixtureListeners.delete(f)},sampleMovement(){}};
window.fixtureGrower={state:{authority:'local'},refresh:async()=>{window.fixtureGrowerReads++;window.fixtureGameState.player.tokens=window.fixtureServer.currency;return true}};
window.fixtureApi={async restoreExplorationEntry(){window.fixtureEntries++;return explorationResult()},async getExploration(){return explorationResult()},async getFieldSurvey(){window.fixtureSurveyReads++;const p=window.fixtureServer.projection;if(window.fixtureLocation.areaId==='basin-cave'){p.objectives.caveEntered=true;p.progressRevision++}if(window.fixtureServer.starting.farmTutorialComplete&&p.status==='locked'){p.status='available';p.progressRevision++}ready();return surveyResult()},async fieldSurveyCommand(c){window.fixtureCommands.push(c);const s=window.fixtureServer,p=s.projection;if(c.type==='accept'){p.acceptedAt=at;p.status='active'}else{p.completedAt=at;p.status='complete';if(!p.rewardClaimed){p.rewardClaimed=true;s.currency+=25;s.starting.harvestingXp+=30;s.rewardCount++}}p.revision++;p.progressRevision++;ready();const r=surveyResult();if(c.type==='report'&&s.rewardCount===1)r.reward={harvestingXp:30,currency:25};return r},async resetFieldSurvey(){const p=window.fixtureServer.projection;p.revision++;p.progressRevision++;p.status='available';p.acceptedAt=null;p.completedAt=null;save();return surveyResult()},async explorationCommand(c){window.fixtureCommands.push(c);const p=window.fixtureServer.projection,o=p.objectives,e=window.fixtureExplorationState;e.revision++;p.progressRevision++;if(c.type==='discover-landmark'){e.landmarks.find(l=>l.landmarkId===c.landmarkId).discoveredAt=at;const l=o.landmarks.find(l=>l.landmarkId===c.landmarkId);if(l)l.discoveredAt=at;if(c.landmarkId===FIELD_SURVEY.caveLandmarkId)o.caveLandmarkDiscovered=true}else if(c.type==='inspect'){const entity=WORLD.areas.flatMap(a=>a.interactables||[]).find(e=>e.entityId===c.entityId);e.notes.find(n=>n.noteId===entity.noteId).discoveredAt=at;if(entity.noteId===FIELD_SURVEY.caveNoteId)o.caveNoteInspected=true}else{o.peyoteHarvested=true;e.nodes.find(n=>n.entityId===c.entityId).readyAt=new Date(Date.now()+60000).toISOString();window.fixtureServer.starting.harvestingXp+=10;e.harvestingXp+=10}ready();return {...explorationResult(),...(c.type==='harvest'?{reward:{name:'Wild Peyote',speciesId:'lophophora-williamsii',quantity:6,harvestingXp:10}}:{})}},async resetExploration(){return explorationResult()}};
function View(){const survey=useFieldSurvey(),exploration=useExploration();window.fixtureSurvey=survey;window.fixtureExploration=exploration;const [feature,setFeature]=useState(null),[travelHost,setTravelHost]=useState(null);window.fixtureShowJournal=()=>setFeature('journal');window.fixtureCloseJournal=()=>setFeature(null);return <FeaturePanelContext.Provider value={{feature,travelHost,setTravelHost,openFeature:setFeature,closeFeature:()=>setFeature(null)}}><GameHeader/><main className='game-main'><FieldSurveyObjective/><LdtkWorldPage/></main>{feature==='journal'&&<div id='fixture-journal'><FieldJournalPage/></div>}<div hidden><FieldSurveyDevInspection enabled recordAction={()=>{}}/></div></FeaturePanelContext.Provider>}
function Session(){const [starting,setStarting]=useState(window.fixtureServer.starting),[world,setWorld]=useState({v:1,revision:1,areaId:'cross-path-1',zoneId:'first-basin',entryId:'fixture',position:{x:mara.x,y:mara.y+175},discoveredAreaIds:['player-farm','town-p1','cross-path-1'],discoveredTravelDestinationIds:WORLD.areas.filter(a=>a.travelDestinationId).map(a=>a.travelDestinationId)});window.fixtureLocation=world;window.fixtureEnter=(areaId,position)=>setWorld(previous=>({...previous,areaId,position,revision:previous.revision+1}));window.fixtureCompleteFarm=()=>{window.fixtureServer.starting={...window.fixtureServer.starting,farmTutorialComplete:true,farmStage:'complete'};setStarting(window.fixtureServer.starting)};const startingValue={active:true,state:starting,now:()=>Date.now(),pending:false,error:'',applyProjection:setStarting,execute:async()=>false,refresh:async()=>{}};return <WorldLocationContext.Provider value={{active:true,location:world,pending:false,error:'',transition:async()=>{},travel:async()=>{},reload(){}}}><StartingContext.Provider value={startingValue}><PlantLifecycleContext.Provider value={{state:{authority:'local'},refresh:async()=>{window.fixtureLifecycleReads++;return true}}}><FieldSurveyProvider><ExplorationProvider><LocalMinimapProvider><View/></LocalMinimapProvider></ExplorationProvider></FieldSurveyProvider></PlantLifecycleContext.Provider></StartingContext.Provider></WorldLocationContext.Provider>}
const root=createRoot(document.getElementById('root'));window.fixtureDestroy=()=>root.unmount();root.render(<MemoryRouter initialEntries={['/world']}><PlayerBootstrapContext.Provider value={{status:'authenticated',bootstrap:{player:{playerId:owner}},requestId:'fixture'}}><Session/></PlayerBootstrapContext.Provider></MemoryRouter>);
window.fixtureScreen=point=>{const scene=window.fixtureGame.scene.getScenes(true)[0],camera=scene.cameras.main,rect=scene.game.canvas.getBoundingClientRect();return{x:rect.x+(point.x-camera.worldView.x)*camera.zoom,y:rect.y+(point.y-camera.worldView.y)*camera.zoom}};
`

test('actual survey host and provider: optional unlock, prior progress, real NPC report, live exploration, mobile and stale responses', {
  skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set an existing Chromium executable.', timeout: 240000,
}, async () => {
  await mkdir(evidence, { recursive: true })
  const stubs = {
    useGameState: 'export const useGameState=()=>({state:window.fixtureGameState})',
    useGrowerAuthority: 'export const useGrowerAuthority=()=>window.fixtureGrower',
    useGardenAuthority: 'export const useGardenAuthority=()=>({projection:null})',
    useSocialState: "export const useSocialState=()=>({state:{status:'ready',overview:{ownProfile:{displayName:'Survey fixture'}}},profileTarget:{open:false},connection:window.fixtureConnection,openProfile(){}})",
    useSocialPanel: "export const useSocialPanel=()=>({chatDockExpanded:false,activeTab:'world-chat',setChatDockExpanded(){},setActiveTab(){}})",
    useOwnPublicSkills: 'export const useOwnPublicSkills=()=>null',
    UtilityMenu: 'export const MenuDropdown=()=>null',
  }
  const bundle = await build({ stdin: { contents: entry, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ MODE: 'staging', DEV: false }) }, logLevel: 'silent', plugins: [{ name: 'survey-response-fixture', setup(plugin) {
    plugin.onResolve({ filter: /\/browserApiClient$/ }, () => ({ path: 'api', namespace: 'fixture' }))
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const browserApiClient=new Proxy({},{get:(_,key)=>(...args)=>window.fixtureApi[key](...args)})' }))
    plugin.onResolve({ filter: /\/(useGameState|useGrowerAuthority|useGardenAuthority|useSocialState|useSocialPanel|useOwnPublicSkills|UtilityMenu)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'stubs' }))
    plugin.onLoad({ filter: /.*/, namespace: 'stubs' }, args => ({ contents: stubs[args.path] }))
    plugin.onResolve({ filter: /\/createLdtkWorldGame$/ }, () => ({ path: 'game', namespace: 'game' }))
    plugin.onLoad({ filter: /.*/, namespace: 'game' }, () => ({ resolveDir: process.cwd(), contents: "import {createLdtkWorldGame as create} from './src/game-world/createLdtkWorldGame.ts';export function createLdtkWorldGame(...args){window.fixtureGameCreations++;return window.fixtureGame=create(...args)}" }))
  } }] })
  const css = (await Promise.all(['src/styles/tokens.css', 'src/index.css', 'src/styles/game.css', 'src/game-world/localMinimap.css', 'src/features/starting/starting.css', 'src/features/exploration/exploration.css', 'src/features/field-survey/fieldSurvey.css'].map(path => readFile(path, 'utf8')))).join('\n') + '\nhtml,body,#root{width:100%;height:100%;margin:0;overflow:hidden}#fixture-journal{position:absolute;inset:76px 12px 12px;overflow:auto;padding:16px;background:var(--cg-surface);z-index:180;box-sizing:border-box;}'
  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/assets/')) { const path = resolve('public', '.' + req.url); if (!path.startsWith(resolve('public') + sep)) throw Error('Invalid path'); res.end(await readFile(path)); return }
      res.setHeader('content-type', 'text/html'); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style><div id="root"></div><script>' + bundle.outputFiles[0].text + '</script>')
    } catch { res.statusCode = 404; res.end() }
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const { chromium } = await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE, headless: true, args: ['--no-sandbox'] })
  const checks = [], errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true })
    page.on('pageerror', error => errors.push(error.message))
    const url = `http://127.0.0.1:${server.address().port}/`
    const ready = async () => { try { await page.waitForFunction(() => window.fixtureGame?.scene.getScenes(true)[0]?.player?.body && window.fixtureSurvey?.projection && window.fixtureExploration?.projection) } catch (error) { throw new Error(JSON.stringify({ errors, state: await page.evaluate(() => ({ game: !!window.fixtureGame, survey: window.fixtureSurvey?.projection, exploration: window.fixtureExploration?.projection, html: document.body.innerText.slice(0, 1000) })) }), { cause: error }) } }
    const screen = point => page.evaluate(point => window.fixtureScreen(point), point)
    const station = () => page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].options.area.interactables.find(entity => entity.entityId === 'mara-basin-survey'))
    const meet = async (touch = false) => { const point = await screen(await station()); if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y); await page.getByRole('dialog').waitFor() }
    await page.goto(url + '?locked=1'); await ready()
    assert.equal(await station(), undefined, 'survey Mara is absent before Farm onboarding completes')
    assert.equal(await page.locator('.field-survey-objective').count(), 0)
    assert.equal(await page.evaluate(() => window.fixtureSurveyReads), 0, 'no quest bootstrap request during onboarding')
    await page.evaluate(() => window.fixtureCompleteFarm()); await page.getByRole('button', { name: 'First Basin Field Survey' }).waitFor()
    await page.waitForFunction(() => window.fixtureGame?.scene.getScenes(true)[0]?.options.area.interactables.some(entity => entity.entityId === 'mara-basin-survey'))
    assert.equal(await page.evaluate(() => window.fixtureSurveyReads), 1, 'Farm completion requires one targeted eligibility reconciliation')
    await meet(); await page.getByRole('button', { name: 'Maybe later' }).click()
    await page.locator('canvas').focus()
    await page.waitForFunction(() => window.fixtureGame.scene.getScenes(true)[0]?.interactionPrompt?.visible)
    const maraPrompt = await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].interactionPrompt.text)
    assert.ok(maraPrompt.includes('Mara') && maraPrompt.includes('E / tap to talk'), 'nearby authored NPC prompt offers conversation')
    assert.equal(maraPrompt.includes('Pods regrowing'), false, 'NPCs never inherit harvest cooldown wording')
    assert.equal(await page.evaluate(() => window.fixtureCommands.length), 0, 'optional dialogue can be dismissed without starting a quest')
    checks.push('Farm prerequisite hides the authored survey station and objective; one unlock read; optional decline')
    const sceneCreations = await page.evaluate(() => window.fixtureGameCreations)
    await meet(); await page.getByRole('button', { name: 'Accept Field Survey' }).click()
    await page.waitForFunction(() => window.fixtureSurvey.projection.status === 'active')
    assert.equal(await page.locator('.field-survey-dialog').getByText('1 / 3', { exact: true }).count(), 1, 'prior landmark counts immediately')
    assert.equal(await page.evaluate(() => window.fixtureSurvey.projection.objectives.sanPedroHarvested), true, 'prior wild harvest counts immediately')
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    const accepted = await page.evaluate(() => window.fixtureCommands.find(command => command.type === 'accept'))
    const mara = await station(); assert.equal(accepted.entityId, 'mara-basin-survey'); assert.equal(accepted.expectedWorldRevision, 1); assert.ok(Math.hypot(accepted.position.x - mara.x, accepted.position.y - mara.y) <= 96)
    assert.equal(await page.evaluate(() => window.fixtureGameCreations), sceneCreations, 'acceptance and objective updates preserve Phaser')
    const raceRevision = await page.evaluate(async () => {
      const get = window.fixtureApi.getFieldSurvey, old = structuredClone(window.fixtureSurvey.projection)
      let release
      window.fixtureApi.getFieldSurvey = () => new Promise(resolve => { release = resolve })
      const request = window.fixtureSurvey.refresh()
      const fresh = { ...old, progressRevision: old.progressRevision + 1 }
      window.fixtureServer.projection.progressRevision = fresh.progressRevision
      window.fixtureSurvey.applyProjection(fresh)
      release({ projection: old, starting: window.fixtureServer.starting })
      await request; window.fixtureApi.getFieldSurvey = get
      return fresh.progressRevision
    })
    assert.equal(await page.evaluate(() => window.fixtureSurvey.projection.progressRevision), raceRevision, 'delayed old GET cannot replace a newer exploration projection')
    await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.getByLabel('Local minimap', { exact: true }).waitFor()
    const before = await page.evaluate(() => { const p = window.fixtureGame.scene.getScenes(true)[0].player; return { x: p.x, y: p.y } })
    await page.getByRole('button', { name: 'First Basin Field Survey' }).click(); await page.waitForTimeout(100)
    const after = await page.evaluate(() => { const p = window.fixtureGame.scene.getScenes(true)[0].player; return { x: p.x, y: p.y } }); assert.deepEqual(after, before, 'collapse control never becomes world movement')
    await page.getByRole('button', { name: 'First Basin Field Survey' }).click()
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(100)
      const fit = await page.evaluate(() => { const objective = document.querySelector('.field-survey-objective').getBoundingClientRect(), map = document.querySelector('.local-minimap').getBoundingClientRect(), controls = [...document.querySelectorAll('.game-header button:not([hidden])')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getBoundingClientRect()); return { overflow: document.documentElement.scrollWidth > innerWidth, objective: objective.right <= innerWidth && objective.left >= 0, map: map.right <= innerWidth && map.left >= 0, hudRows: Math.max(...controls.map(b => b.y)) - Math.min(...controls.map(b => b.y)) < 16 } })
      assert.deepEqual(fit, { overflow: false, objective: true, map: true, hudRows: true })
      await page.screenshot({ path: resolve(evidence, `objective-map-${width}.png`) })
      await page.getByRole('button', { name: 'First Basin Field Survey' }).click()
      await meet(true); assert.equal(await page.evaluate(() => { const p = document.querySelector('.field-survey-dialog'); return p.scrollWidth <= p.clientWidth && p.getBoundingClientRect().right <= innerWidth }), true)
      await page.screenshot({ path: resolve(evidence, `dialog-${width}.png`) }); await page.getByRole('button', { name: 'Close', exact: true }).click()
      await page.getByRole('button', { name: 'First Basin Field Survey' }).click()
      await page.evaluate(() => window.fixtureShowJournal()); await page.getByRole('heading', { name: 'First Basin Field Survey', exact: true }).waitFor()
      await page.locator('.field-survey-journal').scrollIntoViewIfNeeded()
      assert.equal(await page.evaluate(() => { const p = document.querySelector('#fixture-journal'); return p.scrollWidth <= p.clientWidth }), true)
      await page.screenshot({ path: resolve(evidence, `journal-${width}.png`) }); await page.evaluate(() => window.fixtureCloseJournal())
    }
    checks.push('real NPC approach/acceptance with persisted prior progress; collapse input isolation; preserved scene; 320/360/390 dialog, Journal, minimap and one-row HUD')
    await page.setViewportSize({ width: 1280, height: 900 }); await page.getByRole('button', { name: 'Map', exact: true }).click()
    const enter = async (areaId, position) => { const creations = await page.evaluate(() => window.fixtureGameCreations); await page.evaluate(({ areaId, position }) => window.fixtureEnter(areaId, position), { areaId, position }); await page.waitForFunction(({ areaId, creations }) => window.fixtureGameCreations > creations && window.fixtureGame.scene.getScenes(true)[0]?.options.area.areaId === areaId && window.fixtureGame.scene.getScenes(true)[0]?.player?.body, { areaId, creations }); await page.waitForTimeout(120) }
    await page.evaluate(() => { const old = structuredClone(window.fixtureSurvey.projection); old.progressRevision = Math.max(0, old.progressRevision - 1); old.objectives.sanPedroHarvested = false; window.fixtureSurvey.applyProjection(old) })
    assert.equal(await page.evaluate(() => window.fixtureSurvey.projection.objectives.sanPedroHarvested), true, 'late older projection cannot reverse existing progress')
    const peyote = await page.evaluate(() => window.fixtureWorld.areas.find(area => area.areaId === 'path-3').interactables.find(entity => entity.resourceType && entity.speciesId === 'lophophora-williamsii'))
    await enter('path-3', { x: peyote.x, y: peyote.y + 180 })
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Map', exact: true }).click()
    await page.getByRole('button', { name: 'First Basin Field Survey' }).click()
    const peyoteTap = await screen(peyote); await page.touchscreen.tap(peyoteTap.x, peyoteTap.y)
    await page.waitForFunction(() => window.fixtureSurvey.projection.objectives.peyoteHarvested)
    await page.getByRole('status').filter({ hasText: 'Harvested' }).waitFor()
    assert.equal(await page.locator('.field-survey-objective').isVisible(), false, 'map-open harvest feedback temporarily hides the tracker')
    const feedbackFit = await page.locator('.exploration-notice').boundingBox(); assert.ok(feedbackFit.x >= 0 && feedbackFit.x + feedbackFit.width <= 391)
    await page.evaluate(() => window.fixtureExploration.dismissNotice()); await page.locator('.field-survey-objective').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Map', exact: true }).click(); await page.setViewportSize({ width: 1280, height: 900 })
    const caveLandmark = await page.evaluate(() => window.fixtureWorld.areas.find(area => area.areaId === 'basin-cave').landmarks.find(landmark => landmark.landmarkId === 'seeping-stone'))
    await enter('basin-cave', { x: caveLandmark.x, y: caveLandmark.y + caveLandmark.height / 2 + 70 })
    await page.waitForFunction(() => window.fixtureSurvey.projection.objectives.caveEntered)
    const caveReads = await page.evaluate(() => window.fixtureSurveyReads)
    await page.waitForTimeout(250); assert.equal(await page.evaluate(() => window.fixtureSurveyReads), caveReads, 'cave read does not poll')
    const discover = async landmark => { const point = await screen({ x: landmark.x, y: landmark.y + landmark.height / 2 - 30 }); await page.mouse.click(point.x, point.y); await page.waitForFunction(id => window.fixtureExploration.projection.landmarks.find(record => record.landmarkId === id)?.discoveredAt, landmark.landmarkId) }
    await discover(caveLandmark)
    const caveNote = await page.evaluate(() => window.fixtureGame.scene.getScenes(true)[0].options.area.interactables.find(entity => entity.noteId === 'cave-mineral-seam-note'))
    const noteTap = await screen(caveNote); await page.mouse.click(noteTap.x, noteTap.y); await page.waitForFunction(() => window.fixtureSurvey.projection.objectives.caveNoteInspected)
    for (const landmarkId of ['dry-wash', 'eastern-ridge']) {
      const landmark = await page.evaluate(id => window.fixtureWorld.areas.find(area => area.areaId === 'the-first-basin').landmarks.find(landmark => landmark.landmarkId === id), landmarkId)
      await enter('the-first-basin', { x: landmark.x, y: landmark.y + landmark.height / 2 + 70 }); await discover(landmark)
    }
    await page.waitForFunction(() => window.fixtureSurvey.projection.status === 'ready-to-report')
    assert.equal(await page.evaluate(() => window.fixtureServer.rewardCount), 0, 'fieldwork alone never grants completion reward')
    await enter('cross-path-1', { x: mara.x, y: mara.y + 175 }); await meet()
    await page.getByRole('button', { name: 'Report findings to Mara' }).click(); await page.waitForFunction(() => window.fixtureSurvey.projection.status === 'complete')
    assert.equal(await page.evaluate(() => window.fixtureServer.rewardCount), 1); assert.equal(await page.evaluate(() => window.fixtureGrowerReads), 1, 'one targeted currency refresh after report')
    await page.getByRole('button', { name: 'Close', exact: true }).click(); assert.equal(await page.locator('.field-survey-objective').count(), 0)
    await page.reload(); await ready(); assert.equal(await page.evaluate(() => window.fixtureSurvey.projection.status), 'complete'); assert.equal(await page.evaluate(() => window.fixtureServer.rewardCount), 1)
    await page.evaluate(() => window.fixtureShowJournal()); await page.getByText('Optional survey · Complete', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: /mark complete|I did it|confirm objective/i }).count(), 0)
    checks.push('real touch Peyote harvest, walking landmark discovery and cave inspection update the quest directly; map-open feedback remains readable; stale responses rejected; one cave-entry read; wilderness requires real Mara report; targeted reward refresh and reload Journal persistence')
    await page.evaluate(() => window.fixtureDestroy()); await page.waitForFunction(() => window.fixtureListeners.size === 0)
    assert.deepEqual(errors, [])
    await writeFile(resolve(evidence, 'result.json'), JSON.stringify({ checks, errors, evidence: 'Controlled authoritative response fixture; actual React providers, LdtkWorldPage, Phaser NPC approach, Journal and HUD. Not live authentication or physical-device acceptance.' }, null, 2))
  } finally { await browser.close(); await new Promise(done => server.close(done)) }
})
