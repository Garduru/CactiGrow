import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('actual foundation page restores HUD Travel, Farm interiors and discovered world destinations', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://dev.cactigrow.com/world', pretendToBeVisual: true })
  const saved = new Map()
  for (const [key, value] of Object.entries({window:dom.window,document:dom.window.document,Node:dom.window.Node,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) {
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
  }
  const file=resolve('node_modules/.tmp/world-travel-'+crypto.randomUUID()+'.mjs')
  await mkdir('node_modules/.tmp',{recursive:true})
  try {
    const built=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
      import React,{act,useState} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';
      import {GameHeader} from './src/components/layout/GameHeader';import {LdtkWorldPage} from './src/game-world/LdtkWorldPage';import {FeaturePanelContext} from './src/features/menu/featurePanelState';
      import {createInitialGameState} from './src/game/gameState';import {initialLocation,findArea,runtimeAreaId} from './shared/world/world';
      const game=createInitialGameState(Date.now(),true), calls=[];let location=initialLocation('00000000-0000-4000-8000-000000000001');
      globalThis.travelFixture={game,world:{active:true,pending:false,error:'',get location(){return location},transition:async id=>calls.push(['exit',id]),travel:async id=>calls.push(['travel',id])}};
      function Path(){return <output id='path'>{JSON.stringify(useLocation())}</output>}
      function App(){const [host,setHost]=useState(null);return <FeaturePanelContext.Provider value={{feature:null,travelHost:host,setTravelHost:setHost,openFeature(){}}}><GameHeader/><LdtkWorldPage/><Path/></FeaturePanelContext.Provider>}
      export {act,calls};export function mount(areaId,discovered=[]){const a=findArea(areaId);location={...initialLocation('00000000-0000-4000-8000-000000000001'),areaId,zoneId:a.zoneId,runtimeAreaId:runtimeAreaId(a,'00000000-0000-4000-8000-000000000001'),position:a.spawns[0],discoveredAreaIds:discovered,discoveredTravelDestinationIds:discovered};const root=createRoot(document.getElementById('root'));root.render(<MemoryRouter initialEntries={['/world']}><App/></MemoryRouter>);return root}
    `},bundle:true,write:false,platform:'node',format:'esm',packages:'external',jsx:'automatic',define:{'import.meta.env':JSON.stringify({MODE:'staging',DEV:false})},plugins:[{name:'read-only-fixtures',setup(plugin){
      const stubs={
        useWorldLocation:'return globalThis.travelFixture.world',
        useGameState:'return {state:globalThis.travelFixture.game}',
        usePlantLifecycle:"return {state:{authority:'local'}}",
        useGardenAuthority:'return {}',
        useSocialState:"return {state:{status:'ready',overview:{ownProfile:{displayName:'Tester'}}},profileTarget:{open:false},openProfile(){}}",
        useSocialPanel:"return {chatDockExpanded:false,activeTab:'world-chat',setChatDockExpanded(){},setActiveTab(){},openPanel(){},closePanel(){}}",
        useGrowerAuthority:"return {state:{authority:'local'}}",
        useOwnPublicSkills:'return null',
        PhaserWorldCanvas:'return null',MenuDropdown:'return null',InGameChatHud:'return null',
        createFarmWorldGame:'return null',createTownWorldGame:'return null',createLdtkWorldGame:'return null',
      }
      plugin.onResolve({filter:/\/(WorldLocationContext|useGameState|usePlantLifecycle|useGardenAuthority|useSocialState|useSocialPanel|useGrowerAuthority|useOwnPublicSkills|PhaserWorldHost|UtilityMenu|InGameChatHud|createFarmWorldGame|createTownWorldGame|createLdtkWorldGame)$/},args=>({path:args.path.split('/').at(-1),namespace:'fixture'}))
      plugin.onLoad({filter:/.*/,namespace:'fixture'},args=>{const key={WorldLocationContext:'useWorldLocation',PhaserWorldHost:'PhaserWorldCanvas',UtilityMenu:'MenuDropdown'}[args.path]??args.path;return{contents:'export function '+key+'(){'+stubs[key]+'}',loader:'js'}})
    }}]})
    await writeFile(file,built.outputFiles[0].contents)
    const {mount,act,calls}=await import(pathToFileURL(file).href)
    for (const [area,discovered,expected] of [
      ['path-1',[],[]],['cross-path-1',['player-farm'],['Farm']],['path-2',['player-farm','town-p1'],['Farm','Town']],
      ['player-farm',['player-farm','town-p1'],['Home','Nursery','Garden','Genetics Lab','Mailbox','Town']],
    ]) {
      let root;await act(async()=>{root=mount(area,discovered)})
      const travel=[...document.querySelectorAll('button')].find(b=>b.textContent==='Travel');assert.ok(travel)
      assert.ok(document.querySelector('.game-header__travel').contains(travel))
      await act(async()=>travel.click())
      const buttons=[...document.querySelectorAll('#world-travel-menu button')]
      assert.deepEqual(buttons.map(b=>b.textContent),expected)
      if(area==='path-2'){await act(async()=>buttons[0].click());assert.deepEqual(calls.at(-1),['travel','player-farm'])}
      if(area==='player-farm'){await act(async()=>buttons[1].click());const path=JSON.parse(document.querySelector('#path').textContent);assert.equal(path.pathname,'/nursery');assert.equal(path.state.worldReturnTo,'/world')}
      await act(async()=>root.unmount())
    }
  } finally {await unlink(file).catch(()=>{});delete globalThis.travelFixture;dom.window.close();for(const [key,d] of saved){if(d)Object.defineProperty(globalThis,key,d);else Reflect.deleteProperty(globalThis,key)}}
})
