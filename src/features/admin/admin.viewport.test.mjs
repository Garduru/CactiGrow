import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

for (const mode of ['staging', 'production']) test(`Admin ${mode} mobile overlay contains forms, visual viewport keyboard/pan and internal scrolling; restores document and preserves HUD/world`, { skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set an existing headless Chromium executable.' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cactigrow-admin-viewport-'))
  const fixture = `
    import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
    import Phaser from 'phaser';import {PhaserWorldCanvas} from './src/game-world/PhaserWorldHost';import {townWorldProjection} from './src/game-world/townWorldProjection';
    import {AdminAccessContext} from './src/features/admin/adminAccess';import {permissionsForRole} from './shared/api/adminV1';
    import {FeaturePanelProvider} from './src/features/menu/FeaturePanelProvider';import {FeaturePanelOverlay} from './src/features/menu/FeaturePanelOverlay';import {useFeaturePanel} from './src/features/menu/featurePanelState';
    import {GrowerAuthorityContext} from './src/app/GrowerAuthorityContext';import {PlantLifecycleContext} from './src/app/PlantLifecycleContext';
    const owner='11111111-1111-4111-8111-111111111111', target='22222222-2222-4222-8222-222222222222';
    const viewport=Object.assign(new EventTarget(),{width:390,height:844,offsetTop:0,offsetLeft:0,scale:1});
    Object.defineProperty(window,'visualViewport',{value:viewport});
    const session={playerId:owner,displayName:'Owner A',role:'OWNER',permissions:permissionsForRole('OWNER'),environment:'${mode}',version:'test'};
    const summary={playerId:target,publicId:target,displayName:'Dom',joinedAt:'2026-01-01',role:'MODERATOR',totalLevel:14,status:'registered'};
    const state={player:summary,currency:100,skills:[],seeds:[]};const receipts=new Map();let mounts=0,unmounts=0,worldInputs=0,sent=[];
    window.addEventListener('pointerdown',()=>worldInputs++);window.addEventListener('mousedown',()=>worldInputs++);window.addEventListener('touchstart',()=>worldInputs++);
    globalThis.__adminViewportApi={getAdminSession:async()=>session,searchAdminPlayers:async()=>({items:[summary]}),inspectAdminPlayer:async()=>structuredClone(state),mutateAdmin:async(id,action,command)=>{sent.push({id,action,command});const existing=receipts.get(command.commandId);if(existing)return {...existing,replayed:true};const before=state.currency;state.currency+=command.delta;const result={replayed:false,audit:{id:crypto.randomUUID(),commandId:command.commandId,actorPlayerId:owner,targetPlayerId:id,action:'CURRENCY_ADJUSTED',reason:command.reason,before:{balance:before},after:{balance:state.currency,appliedDelta:command.delta}}};receipts.set(command.commandId,result);return globalThis.__wrongReceipt?{...result,audit:{...result.audit,targetPlayerId:owner}}:result}};
    let game,player;const createGame=parent=>game=new Phaser.Game({type:Phaser.CANVAS,parent,width:'100%',height:'100%',scale:{mode:Phaser.Scale.RESIZE},scene:{create(){player=this.add.rectangle(1234,567,24,24,0xffaa33);this.cameras.main.setZoom(.84);this.cameras.main.setScroll(103,207)}}});const onIntent=()=>{};
    function World(){useEffect(()=>{mounts++;return()=>unmounts++},[]);return <main id="world" data-position="1234,567" style={{position:'fixed',inset:0,display:'flex'}}><PhaserWorldCanvas projection={townWorldProjection} onIntent={onIntent} createGame={createGame}/></main>}
    function Controls(){const p=useFeaturePanel();return <><header id="hud" className="game-header"><div className="game-header__inner"><button className="game-header__menu-toggle" onClick={()=>p.openFeature('admintools')}>Open Admin</button></div></header><World/><FeaturePanelOverlay/></>}
    createRoot(document.getElementById('root')).render(<MemoryRouter><AdminAccessContext.Provider value={{session,status:'ready',refresh:async()=>session}}><GrowerAuthorityContext.Provider value={{state:{authority:'local'},refresh:async()=>{throw Error('Actor must not refresh for target correction')}}}><PlantLifecycleContext.Provider value={{applyProjection(){}}}><FeaturePanelProvider><Controls/></FeaturePanelProvider></PlantLifecycleContext.Provider></GrowerAuthorityContext.Provider></AdminAccessContext.Provider></MemoryRouter>);
    const wait=()=>new Promise(r=>setTimeout(r,40));const check=(condition,message)=>{if(!condition)throw Error(message)};
    const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
    const click=async text=>{check(button(text),'Missing button '+text);button(text).click();await wait()};
    const input=async(element,value)=>{element.focus();const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));await wait()};
    function layout(){const panel=document.querySelector('.feature-panel'),close=button('Close'),content=document.querySelector('.feature-panel__content');const p=panel.getBoundingClientRect(),c=close.getBoundingClientRect();check(p.top>=viewport.offsetTop && p.bottom<=viewport.offsetTop+viewport.height+1,'Panel outside visible height');check(p.left>=viewport.offsetLeft && p.right<=viewport.offsetLeft+viewport.width+1,'Panel outside visible width');check(c.top>=viewport.offsetTop && c.bottom<=viewport.offsetTop+viewport.height,'Close unreachable');check(document.documentElement.scrollWidth<=window.innerWidth,'Document horizontal overflow');check(getComputedStyle(content).overflowY==='auto' && getComputedStyle(content).overflowX==='hidden','Internal content must own scrolling');check(document.body.style.position==='fixed','Document not locked');check(document.getElementById('hud')===hud && document.getElementById('world')===world,'HUD/world remounted');check(mounts===1 && unmounts===0,'World lifetime changed');check(world.dataset.position==='1234,567','World position changed')}
    const geometry=element=>{const r=element.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};const camera=()=>{const c=game.scene.scenes[0].cameras.main;return [c.zoom,c.scrollX,c.scrollY]};
    let documentX=0,documentY=0;Object.defineProperties(window,{scrollX:{get:()=>documentX},scrollY:{get:()=>documentY}});window.scrollTo=(x,y)=>{documentX=x;documentY=y};
    async function run(){await wait();await wait();globalThis.hud=document.getElementById('hud');globalThis.world=document.getElementById('world');const bodyStyle=document.body.getAttribute('style')||'',rootStyle=document.documentElement.getAttribute('style')||'',initialGame=game,initialPlayer=player,initialCamera=camera(),initialGeometry=[geometry(hud),geometry(world),geometry(document.getElementById('root'))];await click('Open Admin');await click('Players');await input(document.querySelector('.admin-tools input'),'Dom');await click('Search players');await click('Dom · Level 14 · MODERATOR');await click('Support');layout();check(document.querySelector('.admin-tools').textContent.includes(target),'Target lost across tabs');for(const field of document.querySelectorAll('.admin-tools input,.admin-tools select,.admin-tools textarea'))check(parseFloat(getComputedStyle(field).fontSize)>=16,'iOS input autozoom threshold');
      const amount=document.querySelector('input[type="number"]');await input(amount,'1');viewport.height=504;viewport.offsetTop=35;viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));await wait();layout();await input(document.querySelector('.admin-tools textarea'),'Cross-player mobile acceptance');layout();check(viewport.scale===1,'Zoom altered');const overlay=document.querySelector('.feature-overlay'),content=document.querySelector('.feature-panel__content');const scroll=window.scrollY;content.scrollTop=150;content.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));content.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));content.dispatchEvent(new Event('touchstart',{bubbles:true}));check(worldInputs===0,'Panel events reached game');check(window.scrollY===scroll,'Panel scrolled document');await click('Review correction');await click('Confirm action');check(sent.length===1 && sent[0].id===target,'Wrong mutation target');check(document.querySelector('.admin-tools__feedback').textContent.includes('$100 → $101 (+1)'),'Missing target balance feedback');
      globalThis.__wrongReceipt=true;await input(document.querySelector('.admin-tools textarea'),'Receipt identity verification');await click('Review correction');await click('Confirm action');check(document.querySelector('.admin-tools__feedback').textContent.includes('does not match'),'Wrong-target receipt reported as success');check(!document.querySelector('.admin-tools__feedback dl'),'Wrong-target success receipt shown');globalThis.__wrongReceipt=false;await click('Retry same command');check(sent[1].command.commandId===sent[2].command.commandId && state.currency===102,'Unresolved replay changed target twice');
      for(const section of ['Players','Roles','Audit Log']){await click(section);const field=document.querySelector('.admin-tools input');await input(field,'Dom');viewport.width=320;viewport.offsetLeft=12;viewport.height=300;viewport.dispatchEvent(new Event('resize'));await wait();layout()}
      viewport.width=390;viewport.height=844;viewport.offsetTop=0;viewport.offsetLeft=0;viewport.dispatchEvent(new Event('resize'));await wait();layout();await click('Close');check(!document.querySelector('.feature-overlay'),'Overlay did not close');check((document.body.getAttribute('style')||'')===bodyStyle,'Body styles not restored');check((document.documentElement.getAttribute('style')||'')===rootStyle,'Root styles not restored');check(window.scrollY===scroll,'Document scroll not restored');check(document.getElementById('hud')===hud && document.getElementById('world')===world && mounts===1,'Game changed on close');window.dispatchEvent(new PointerEvent('pointerdown'));check(worldInputs===1,'Normal input did not resume');check(!document.querySelector('meta[name="viewport"]').content.includes('user-scalable=no'),'Accessibility zoom disabled');
      let layoutEvents=0;const countResize=()=>layoutEvents++;window.addEventListener('resize',countResize);
      for(const section of ['Overview','Support','Players','Roles']){
        await click('Open Admin');
        if(section==='Support'){await click('Players');await input(document.querySelector('.admin-tools input'),'Dom');await click('Search players');await click('Dom · Level 14 · MODERATOR')}
        if(section!=='Overview')await click(section);
        const overlay=document.querySelector('.feature-overlay');let field=document.querySelector('.admin-tools textarea')||document.querySelector('.admin-tools input');
        if(section==='Support')await input(document.querySelector('input[type="number"]'),'1');else if(field)await input(field,'1');
        viewport.height=504;viewport.offsetTop=35;viewport.dispatchEvent(new Event('resize'));await wait();
        if(section==='Support'){field=document.querySelector('.admin-tools textarea');await input(field,'Mobile close acceptance')}
        if(field){field.blur();await wait()}
        viewport.height=844;viewport.offsetTop=0;viewport.dispatchEvent(new Event('resize'));await wait();
        layoutEvents=0;await click('Close');
        check(!document.querySelector('.feature-overlay'),'Close failed from '+section);
        check(JSON.stringify([geometry(hud),geometry(world),geometry(document.getElementById('root'))])===JSON.stringify(initialGeometry),'Immediate normal HUD/game geometry not restored');
        for(const name of ['--admin-viewport-top','--admin-viewport-left','--admin-viewport-width','--admin-viewport-height','--admin-hud-space'])check(overlay.style.getPropertyValue(name)==='','Temporary viewport property leaked: '+name);
        // Simulate WebKit's late document pan/viewport event after focus restoration and synchronous cleanup.
        documentY=71;viewport.offsetTop=71;viewport.dispatchEvent(new Event('scroll'));await wait();
        viewport.offsetTop=0;viewport.dispatchEvent(new Event('resize'));await new Promise(r=>setTimeout(r,180));
        check(window.scrollY===0 && window.scrollX===0,'Late keyboard-dismiss document pan was not restored');
        check((document.body.getAttribute('style')||'')===bodyStyle && (document.documentElement.getAttribute('style')||'')===rootStyle,'Document styles leaked on '+section);
        check(JSON.stringify([geometry(hud),geometry(world),geometry(document.getElementById('root'))])===JSON.stringify(initialGeometry),'Normal HUD/game geometry not restored');
        check(game===initialGame && player===initialPlayer && mounts===1 && unmounts===0,'Phaser instance or world changed');
        check(player.x===1234 && player.y===567 && JSON.stringify(camera())===JSON.stringify(initialCamera),'Player/camera changed');
        check(viewport.scale===1 && document.documentElement.scrollWidth<=window.innerWidth,'Scale/overflow did not restore');check(layoutEvents===1,'Expected one normal game layout reconciliation');
        layoutEvents=0;viewport.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,150));check(layoutEvents===0,'Post-close listeners leaked');
      }
      // Rapid reopening cancels any pending cleanup instead of unlocking/resizing the new panel.
      await click('Open Admin');await click('Close');await click('Open Admin');await new Promise(r=>setTimeout(r,700));layout();await click('Close');await new Promise(r=>setTimeout(r,700));
      window.removeEventListener('resize',countResize);document.getElementById('result').textContent='PASS';
    }
    run().catch(error=>{document.getElementById('result').textContent='FAIL: '+error.message});
  `
  try {
    const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ MODE: mode, DEV: false }), 'import.meta.env.MODE': JSON.stringify(mode), 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'isolated-admin-fixture', setup(plugin) {
      plugin.onResolve({ filter: /\/browserApiClient(\.ts)?$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      plugin.onLoad({ filter: /^api$/, namespace: 'fixture' }, () => ({ contents: 'export const browserApiClient=new Proxy({}, {get(_target,key){return (...args)=>globalThis.__adminViewportApi[key](...args)}});' }))
      plugin.onResolve({ filter: /\/FeatureContent$/ }, () => ({ path: 'content', namespace: 'fixture' }))
      plugin.onLoad({ filter: /^content$/, namespace: 'fixture' }, () => ({ contents: "import {AdminToolsPanel} from './src/features/admin/AdminToolsPanel';export function FeatureContent(){return <AdminToolsPanel/>}", loader: 'tsx', resolveDir: process.cwd() }))
      plugin.onResolve({ filter: /\/useSocial(State|Panel)$/ }, args => ({ path: args.path.endsWith('State') ? 'social' : 'panel', namespace: 'fixture' }))
      plugin.onLoad({ filter: /^(social|panel)$/, namespace: 'fixture' }, args => ({ contents: args.path === 'social' ? 'export function useSocialState(){return {profileTarget:{open:false}}}' : 'export function useSocialPanel(){return {open:false}}' }))
    } }] })
    const css = (await Promise.all(['src/styles/tokens.css', 'src/index.css', 'src/styles/game.css', 'src/features/admin/adminTools.css'].map(file => readFile(file, 'utf8')))).join('\n')
    const html = join(directory, 'test.html')
    await writeFile(html, `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><output id="result">WAITING</output><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`)
    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=390,844', '--virtual-time-budget=10000', '--dump-dom', pathToFileURL(html).href], { windowsHide: true })
      let stdout = ''; child.stdout.on('data', data => { stdout += data }); child.stderr.resume()
      const timeout = setTimeout(() => { child.kill(); reject(new Error('Headless fixture timeout')) }, 30000)
      child.on('error', reject); child.on('close', code => { clearTimeout(timeout); code === 0 ? resolve(stdout) : reject(new Error('Headless browser exited ' + code)) })
    })
    assert.match(output, /<output id="result">PASS<\/output>/, output.match(/<output id="result">[^<]+<\/output>/)?.[0] ?? 'Fixture did not finish')
  } finally { await rm(directory, { recursive: true, force: true }) }
})
