import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('collection cards, filtered selection, Favorite, research and mobile input remain coherent with 121 specimens', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://collection.test/garden', pretendToBeVisual: true })
  const originals = new Map<string, PropertyDescriptor | undefined>()
  for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent']) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: dom.window[key as keyof typeof dom.window] })
  }
  originals.set('IS_REACT_ACT_ENVIRONMENT', Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT'))
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true })
  const out = resolve('node_modules/.tmp/collection-runtime.mjs')
  await mkdir(resolve('node_modules/.tmp'), { recursive: true })
  const fixture = `
    import React,{act,useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {ServerGardenPage} from './src/features/garden/ServerGardenPage';
    import {GameStateContext} from './src/game/GameStateContext';
    import {PlantLifecycleContext} from './src/app/PlantLifecycleContext';
    import {GardenAuthorityContext} from './src/app/GardenAuthorityContext';
    import {GrowerAuthorityContext} from './src/app/GrowerAuthorityContext';
    import {createInitialGameState,gameStateReducer} from './src/game/gameState';
    import {observeCloneLine,analyzeCloneLine} from './src/features/research/researchModel';
    import {getLevelFromXp} from './src/features/progression/progressionModel';
    const initial=createInitialGameState(Date.now());
    const base=gameStateReducer(initial,{type:'plant/collected',slotId:'slot-3',now:Date.now()}).ownedPlants[0];
    initial.ownedPlants=Array.from({length:121},(_,i)=>({...base,id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),cloneLineId:'clone-'+i,isListedForSale:i===120}));
    initial.geneticsResearch={records:{},completedDiscoveryMilestoneIds:[]};
    for(const plant of initial.ownedPlants.slice(0,11)) initial.geneticsResearch=observeCloneLine(initial.geneticsResearch,plant,Date.now()).research;
    initial.gardenOrganization={}; initial.property.buildings.garden.level=1;
    export let current; export const requests=[]; export let removeOwned; export let setGardenLevel;
    function Fixture(){
      const [state,setState]=useState(initial); current=state; setGardenLevel=level=>setState(s=>({...s,property:{...s.property,buildings:{...s.property.buildings,garden:{...s.property.buildings.garden,level}}}})); removeOwned=id=>setState(s=>({...s,ownedPlants:s.ownedPlants.filter(p=>p.id!==id)}));
      const game={state,setGardenFavorite:async(id,favorite)=>{requests.push('favorite');setState(s=>({...s,gardenOrganization:{...s.gardenOrganization,[id]:{specimenId:id,favorite,tags:[]}}}));return true;},assignGardenDisplay:async()=>true,clearGardenDisplay:async()=>true,addGardenTag:async()=>true,removeGardenTag:async()=>true,sellPlantToNpc:async()=>null};
      const projection={ownedSpecimens:state.ownedPlants.map(p=>({...p,specimenId:p.id,version:1})),bredSeeds:[],seedStacks:[],nursery:{slots:[],capacity:6}};
      const grower={state:{authority:'server',status:'ready',projection:{}},mutate:async command=>{
        requests.push(command.type);let research=state.geneticsResearch;let xp=0;const succeeded=[],skipped=[];
        for(const id of command.specimenIds){const plant=state.ownedPlants.find(p=>p.id===id);if(!plant){skipped.push({specimenId:id,reason:'not owned'});continue;}
          const result=research.records[plant.cloneLineId]?analyzeCloneLine(research,plant,getLevelFromXp(state.player.skills.genetics.xp),Date.now()):observeCloneLine(research,plant,Date.now());
          if(result.changed){research=result.research;xp+=result.xpAwarded;succeeded.push(id)}else skipped.push({specimenId:id,reason:'no milestone'});
        }
        setState(s=>({...s,geneticsResearch:research,player:{...s.player,skills:{...s.player.skills,genetics:{xp:s.player.skills.genetics.xp+xp}}}}));return {researchBatch:{succeeded,skipped}};
      }};
      return <GameStateContext.Provider value={game}><PlantLifecycleContext.Provider value={{state:{authority:'server',status:'ready',projection},breed:async()=>null}}><GardenAuthorityContext.Provider value={{projection:{organization:state.gardenOrganization,displayAssignments:state.gardenDisplayAssignments},loading:false,error:false,mutate:async()=>true}}><GrowerAuthorityContext.Provider value={grower}><ServerGardenPage/></GrowerAuthorityContext.Provider></GardenAuthorityContext.Provider></PlantLifecycleContext.Provider></GameStateContext.Provider>;
    }
    export {act}; export function mount(){const root=createRoot(document.getElementById('root'));root.render(<Fixture/>);return root;}
  `
  await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', outfile: out, define: { 'import.meta.env': JSON.stringify({ DEV: false }) } })
  if (process.env.CACTIGROW_COLLECTION_PREVIEW_DIR) {
    const folder = process.env.CACTIGROW_COLLECTION_PREVIEW_DIR
    await mkdir(folder, { recursive: true })
    await build({ stdin: { contents: fixture + '\nmount();', loader: 'tsx', resolveDir: process.cwd() }, bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic', outfile: resolve(folder, 'collection.js'), define: { 'import.meta.env': JSON.stringify({ DEV: false }) } })
    await writeFile(resolve(folder, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/game.css"><title>Collection QA fixture</title></head><body><main class="game-main location-page"><div class="location-page__content" id="root"></div></main><script type="module" src="collection.js"></script></body></html>')
  }
  let root: { unmount(): void } | undefined
  let act: (callback: () => void | Promise<void>) => Promise<void> = async () => {}
  try {
    const fixtureModule = await import(pathToFileURL(out).href)
    act = fixtureModule.act
    await act(() => { root = fixtureModule.mount() })
    const doc = dom.window.document
    const click = async (text: string) => { const button = [...doc.querySelectorAll('button')].find((node) => node.textContent?.trim() === text); assert.ok(button, text); await act(async () => { button.click() }) }
    assert.equal(doc.querySelectorAll('.garden-specimen').length, 60, 'bounded render window')
    assert.equal(fixtureModule.requests.length, 0, 'card rendering makes no API requests')
    assert.match(doc.body.textContent!, /Studied.*Observed/)
    assert.match(doc.body.textContent!, /Unresearched/)
    assert.equal(doc.querySelector('.garden-specimen .nursery-stage'), null)
    assert.ok(![...doc.querySelectorAll('button, option')].some((node) => /^(Mature|Maturity)$/.test(node.textContent!)))
    await act(() => doc.querySelector<HTMLButtonElement>('.garden-specimen__quick-view')!.click())
    assert.ok(![...doc.querySelectorAll('[role="dialog"] dt')].some((node) => node.textContent === 'Stage'))
    await act(() => doc.querySelector<HTMLButtonElement>('[aria-label="Close quick preview"]')!.click())
    const favorite = doc.querySelector<HTMLButtonElement>('.collection-favorite__button')!
    let movement = 0
    dom.window.addEventListener('mousedown', () => { movement++ })
    dom.window.addEventListener('touchstart', () => { movement++ })
    await act(async () => {
      favorite.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true }))
      favorite.dispatchEvent(new dom.window.Event('touchstart', { bubbles: true }))
      favorite.click()
    })
    assert.equal(movement, 0)
    assert.equal(doc.querySelector('.collection-favorite__button')?.getAttribute('aria-pressed'), 'true')
    await click('Select')
    const researchButton = () => [...doc.querySelectorAll<HTMLButtonElement>('button')].find((node) => node.textContent === 'Research Selected')!
    assert.equal(researchButton().disabled, true)
    assert.match(doc.querySelector('.collection-research-action')!.textContent!, /Requires Organized Beds \(Garden Level 2\)/)
    await act(() => doc.querySelector<HTMLButtonElement>('.garden-specimen__select')!.click())
    await click('Research Selected')
    assert.equal(doc.querySelector('[role="dialog"]'), null, 'locked click sends no research')
    await act(() => fixtureModule.setGardenLevel(2))
    assert.equal(researchButton().disabled, true)
    assert.match(doc.querySelector('.collection-research-action')!.textContent!, /No selected specimens have an available research milestone/)
    await click('Clear')
    assert.match(doc.querySelector('.collection-research-action')!.textContent!, /Select specimens/)
    await click('Select filtered (121)')
    assert.equal(researchButton().disabled, true)
    assert.match(doc.querySelector('.collection-research-action')!.textContent!, /Select at most 100/)
    await click('Clear')
    await act(() => {
      const buttons = doc.querySelectorAll<HTMLButtonElement>('.garden-specimen__select')
      buttons[0].click(); buttons[11].click()
    })
    assert.equal(researchButton().disabled, false)
    assert.match(doc.querySelector('.collection-research-action')!.textContent!, /1 eligible · 1 skipped/)
    await click('Research Selected'); await click('Confirm research')
    assert.match(doc.querySelector('[role="dialog"]')!.textContent!, /1 researched · 1 skipped/)
    await click('Done'); await click('Clear'); await click('Select page (60)')
    assert.match(doc.querySelector('.garden-selection-bar')!.textContent!, /60 specimens selected/)
    await click('★ Favorites')
    assert.equal(doc.querySelectorAll('.garden-specimen').length, 1)
    assert.match(doc.querySelector('.garden-selection-bar')!.textContent!, /60 specimens selected/, 'filtering retains selected ownership')
    const favoriteId = Object.keys(fixtureModule.current.gardenOrganization)[0]
    await act(() => fixtureModule.removeOwned(favoriteId))
    assert.match(doc.querySelector('.garden-selection-bar')!.textContent!, /59 specimens selected/, 'lost ownership reconciles selection')
    await click('All'); await click('Clear'); await click('Unresearched'); await click('Select page (60)'); await click('Research Selected')
    assert.equal(doc.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby'), 'batch-research-title')
    assert.match(doc.querySelector('[role="dialog"]')!.textContent!, /60 eligible · 0 skipped/)
    const dialogButtons = [...doc.querySelectorAll<HTMLButtonElement>('[role="dialog"] button:not(:disabled)')]
    await act(async () => {
      dialogButtons.at(-1)!.focus()
      doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    })
    assert.equal(doc.activeElement, dialogButtons[0], 'Tab stays inside the research modal')
    await act(async () => { doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })) })
    assert.equal(doc.activeElement, dialogButtons.at(-1), 'Shift Tab stays inside the research modal')
    await click('Confirm research')
    assert.match(doc.querySelector('[role="dialog"]')!.textContent!, /60 researched · 0 skipped · 0 failed/)
    assert.equal(fixtureModule.requests.filter((type: string) => type === 'research-specimens').length, 2)
    assert.match(doc.querySelector('.collection-tools__tabs')!.textContent!, /49 of 120/, 'research projection updates filter without reload')
    await click('Done')
    await click('All'); await click('Next')
    assert.match(doc.body.textContent!, /Listed on Marketplace/)
    const listedFavorite = [...doc.querySelectorAll<HTMLButtonElement>('.collection-favorite__button')].find((node) => node.disabled)
    assert.ok(listedFavorite)
    assert.match(listedFavorite.title, /Cancel/)
    await act(() => { root!.unmount() }); root = undefined
    const providerOut = resolve('node_modules/.tmp/collection-provider-runtime.mjs')
    await build({ stdin: { contents: `
      import React,{act} from 'react'; import {createRoot} from 'react-dom/client';
      import {GardenAuthorityProvider} from './src/app/GardenAuthorityProvider'; import {useGardenAuthority} from './src/app/useGardenAuthority';
      export let garden; function Probe(){garden=useGardenAuthority();return <div/>}
      export {act}; export function mount(){const root=createRoot(document.getElementById('root'));root.render(<GardenAuthorityProvider><Probe/></GardenAuthorityProvider>);return root;}
    `, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, packages: 'external', platform: 'node', format: 'esm', jsx: 'automatic', outfile: providerOut, define: { 'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false }) }, plugins: [{ name: 'garden-api-fixture', setup(plugin) {
      plugin.onResolve({ filter: /\/browserApiClient(\.ts)?$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `let calls=0;let projection={projectionVersion:1,organization:{},displayAssignments:{}};export const browserApiClient={getGarden:async()=>projection,mutateGarden:async(command)=>{if(++calls===1)throw new Error('Cancel the Marketplace listing first.');projection={...projection,organization:{[command.specimenId]:{specimenId:command.specimenId,favorite:command.favorite,tags:[]}}};return projection;}};` }))
    } }] })
    const provider = await import(pathToFileURL(providerOut).href)
    act = provider.act
    await act(async () => { root = provider.mount() })
    await act(async () => { await assert.rejects(provider.garden.mutate({ type: 'favorite', specimenId: favoriteId, favorite: true }), /Cancel/) })
    await act(async () => { assert.equal(await provider.garden.mutate({ type: 'favorite', specimenId: favoriteId, favorite: true }), true) })
    assert.equal(provider.garden.projection.organization[favoriteId].favorite, true, 'a rejected Favorite does not poison the mutation queue')
  } finally {
    if (root) await act(() => { root!.unmount() })
    dom.window.close()
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key) }
  }
})
