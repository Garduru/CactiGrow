import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'

for (const mode of ['staging', 'production']) test(`Chat/mail ${mode}: compact mobile layouts, keyboard restoration, input isolation and unread/claim UI`, { skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set an existing headless Chromium executable.' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cactigrow-social-viewport-'))
  const fixture = `
    import React,{useState,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
    import {InGameChatHud} from './src/features/social/InGameChatHud';import {SocialContext} from './src/features/social/socialContextState';import {SocialPanelContext} from './src/features/social/socialPanelState';
    import {FeaturePanelProvider} from './src/features/menu/FeaturePanelProvider';import {FeaturePanelOverlay} from './src/features/menu/FeaturePanelOverlay';import {useFeaturePanel} from './src/features/menu/featurePanelState';
    import {MailPage} from './src/features/mail/MailPage';import {MailStatus} from './src/features/mail/mailStatusContext';
    import {GrowerAuthorityContext} from './src/app/GrowerAuthorityContext';import {PlantLifecycleContext} from './src/app/PlantLifecycleContext';import {GardenAuthorityContext} from './src/app/GardenAuthorityContext';
    import {bindWorldKeyboardFocus} from './src/game-world/worldKeyboardFocus';
    const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',plant='33333333-3333-4333-8333-333333333333';
    const viewport=Object.assign(new EventTarget(),{width:390,height:844,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{value:viewport});
    const peer={publicId:other,displayName:'Offline Friend'};const overview={ownProfile:{publicId:own,displayName:'Owner'},friends:[peer],blockedPlayers:[]};let sends=0,worldInputs=0,worldKeys=0,mounts=0,unmounts=0,claims=0,reads=0,mailReads=0;
    let inbox=[{id:'44444444-4444-4444-8444-444444444444',senderPublicId:other,senderName:'Offline Friend',recipientPublicId:own,recipientName:'Owner',subject:'Offline delivery',text:'Persistent message',sentAt:new Date().toISOString(),readAt:null,claimedAt:null,attachment:{kind:'currency',quantity:1}}];
    globalThis.__socialApi={searchPlayers:async()=>({results:[{profile:peer,relationship:{isSelf:false,blockedByMe:false,blocksMe:false}}]}),getPublicPlayerProfile:async()=>({profile:peer}),getMailbox:async()=>{mailReads++;return {projectionVersion:1,inbox:structuredClone(inbox),sent:[],unreadCount:inbox.filter(m=>!m.readAt).length,hasMoreInbox:false,hasMoreSent:false}},mutateMail:async command=>{if(command.type==='read'){reads++;inbox[0].readAt=new Date().toISOString()}if(command.type==='claim'){claims++;inbox[0].claimedAt=new Date().toISOString()}return {mailId:inbox[0].id}}};
    const keyboard={enabled:true,manager:{enabled:true},resetKeys(){}};
    function World(){useEffect(()=>{mounts++;const canvas=document.getElementById('world');const cleanup=bindWorldKeyboardFocus(canvas,keyboard);return()=>{unmounts++;cleanup()}},[]);return <canvas id="world" tabIndex={0} data-position="1234,567" style={{width:'100%',height:'100%'}}/>}
    function Surface(){const menu=useFeaturePanel();const [mode,setMode]=useState('world-chat'),[expanded,setExpanded]=useState(true),[recipient,setRecipient]=useState(other),[unread,setUnread]=useState(1);return <MailStatus.Provider value={{unread,setUnread}}><SocialContext.Provider value={{state:{status:'ready',overview},profileTarget:{open:false},openProfile(){},chatLocation:{areaId:'farm-'+own,areaName:'Farm',zoneName:'Starter Zone',zoneId:'starter-zone',town:false},chatConnected:true,chatStatus:'Connected',chatMessages:[],chatError:'',directRecipientPublicId:recipient,setDirectRecipient:setRecipient,sendPublicMessage(){sends++;return true},sendDirectMessage(){sends++;return true}}}><SocialPanelContext.Provider value={{open:false,activeTab:mode,setActiveTab:setMode,setChatDockExpanded:setExpanded}}>
      <div id="hud" style={{position:'absolute',top:0,left:0}}><button onClick={()=>menu.openFeature('mail')}>Open Mail</button><output id="unread">{unread}</output></div>
      <div className="world-page__viewport" style={{position:'absolute',inset:0}}><World/>{expanded&&<InGameChatHud mode={mode} onModeChange={setMode}/>}</div><FeaturePanelOverlay/>
    </SocialPanelContext.Provider></SocialContext.Provider></MailStatus.Provider>}
    const lifecycle={state:{authority:'server',status:'ready',projection:{seedStacks:[{speciesId:'echinopsis-pachanoi',quantity:4},{speciesId:'lophophora-williamsii',quantity:2}],ownedSpecimens:[{specimenId:plant,speciesId:'echinopsis-pachanoi'}]}},refresh:async()=>true};
    const grower={state:{authority:'server',status:'ready',projection:{player:{tokenBalance:100}}},refresh:async()=>true};const garden={projection:{organization:{},displayAssignments:{}},mutate:async()=>true};
    createRoot(document.getElementById('root')).render(<MemoryRouter><GrowerAuthorityContext.Provider value={grower}><PlantLifecycleContext.Provider value={lifecycle}><GardenAuthorityContext.Provider value={garden}><FeaturePanelProvider><Surface/></FeaturePanelProvider></GardenAuthorityContext.Provider></PlantLifecycleContext.Provider></GrowerAuthorityContext.Provider></MemoryRouter>);
    for(const name of ['pointerdown','mousedown','touchstart','touchmove','wheel'])window.addEventListener(name,()=>worldInputs++);window.addEventListener('keydown',()=>{if(keyboard.enabled)worldKeys++});
    const wait=()=>new Promise(r=>setTimeout(r,40));const check=(value,message)=>{if(!value)throw Error(message)};const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent===name);const click=async name=>{const b=button(name);check(b,'Missing button '+name);b.click();await wait()};
    const input=async(el,value)=>{const setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));await wait()};
    function contained(el){const before=worldInputs;for(const name of ['pointerdown','mousedown','touchstart','touchmove','wheel'])el.dispatchEvent(new Event(name,{bubbles:true}));check(worldInputs===before,'Input reached world')}
    async function run(){await wait();const hud=document.getElementById('hud'),world=document.getElementById('world');const bodyStyle=document.body.getAttribute('style')||'',rootStyle=document.documentElement.getAttribute('style')||'';
      function sameWorld(){check(document.getElementById('hud')===hud&&document.getElementById('world')===world&&mounts===1&&unmounts===0,'HUD/world lifetime changed');check(world.dataset.position==='1234,567','World position changed')}
      await click('Local');check(document.querySelector('.chat-conversation header').textContent.includes('Local'),'Local label missing');await click('Town');check(document.querySelector('.chat-conversation').textContent.includes('Enter Town to join Town chat'),'Town unavailable reason missing');await click('DMs');check(!document.querySelector('.chat-conversation').textContent.includes('Enter Town'),'DM incorrectly gated by Town');
      const chat=document.getElementById('world-chat-hud'),field=document.querySelector('.chat-conversation__composer input');field.focus();await input(field,'wasd');check(!keyboard.enabled,'Typing did not suspend gameplay');contained(chat);
      field.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));check(worldKeys===0,'Typing reached world keyboard');
      viewport.height=504;viewport.offsetTop=35;viewport.dispatchEvent(new Event('resize'));viewport.dispatchEvent(new Event('scroll'));await wait();
      function chatLayout(){const p=chat.getBoundingClientRect(),f=field.getBoundingClientRect(),send=document.querySelector('.chat-conversation__composer button').getBoundingClientRect();check(p.top>=viewport.offsetTop-1&&p.bottom<=viewport.offsetTop+viewport.height+1,'Chat outside keyboard viewport');check(f.bottom<=viewport.offsetTop+viewport.height&&send.bottom<=viewport.offsetTop+viewport.height,'Composer behind keyboard');check(p.right<=viewport.width+viewport.offsetLeft,'Chat horizontal overflow');check(getComputedStyle(field).fontSize==='16px','iOS input zoom risk');sameWorld()}
      chatLayout();await click('Send');check(sends===1,'Enter/send isolation failed');check(document.body.style.position==='fixed','Chat document not locked');
      viewport.height=844;viewport.offsetTop=0;viewport.dispatchEvent(new Event('resize'));field.blur();await new Promise(r=>setTimeout(r,700));check(chat.style.getPropertyValue('--chat-keyboard-inset')==='0px','Chat bottom inset did not restore');check((document.body.getAttribute('style')||'')===bodyStyle,'Chat body styles did not restore');check((document.documentElement.getAttribute('style')||'')===rootStyle,'Chat root styles did not restore');world.focus();check(keyboard.enabled,'Gameplay keyboard did not resume');sameWorld();
      await click('Open Mail');await wait();check(document.getElementById('unread').textContent==='1','Unread badge missing');check(mailReads===1,'Duplicate mailbox startup requests');const summary=document.querySelector('.mail-message__summary');summary.click();await wait();check(reads===1&&document.getElementById('unread').textContent==='0','Read/unread reconciliation failed');await click('Claim');check(claims===1&&button('Claimed').disabled,'Claim UI not exactly once');
      await click('Compose');const search=document.querySelector('.recipient-search input');await input(search,'Off');await click('Find');await click('Offline Friend');
      const subject=document.querySelector('.mail-compose input:not(.recipient-search input)');await input(subject,'Subject');await input(document.querySelector('.mail-compose textarea'),'x'.repeat(2000));
      function mailLayout(){const overlay=document.querySelector('.feature-overlay'),panel=document.querySelector('.feature-panel'),content=document.querySelector('.feature-panel__content'),p=panel.getBoundingClientRect();check(p.top>=viewport.offsetTop&&p.bottom<=viewport.offsetTop+viewport.height+1,'Mail outside visible viewport');check(p.left>=viewport.offsetLeft&&p.right<=viewport.offsetLeft+viewport.width+1,'Mail width overflow');check(document.documentElement.scrollWidth<=window.innerWidth,'Document overflow');check(getComputedStyle(content).overflowY==='auto','Mail must scroll internally');check(document.body.style.position==='fixed','Mail document not locked');contained(document.querySelector('.mail-page'));sameWorld()}
      const textarea=document.querySelector('.mail-compose textarea');textarea.focus();viewport.height=504;viewport.offsetTop=35;viewport.dispatchEvent(new Event('resize'));await wait();mailLayout();check(getComputedStyle(textarea).fontSize==='16px','Mail iOS zoom risk');
      const attachment=document.querySelector('.mail-compose select');for(const kind of ['currency','commodity','specimen']){await input(attachment,kind);mailLayout();for(const el of document.querySelectorAll('.mail-compose input,.mail-compose select,.mail-compose textarea'))check(el.getBoundingClientRect().right<=viewport.width+viewport.offsetLeft,'Attachment picker overflow')}
      viewport.width=320;viewport.offsetLeft=12;viewport.height=300;viewport.dispatchEvent(new Event('resize'));await wait();mailLayout();
      viewport.width=390;viewport.offsetLeft=0;viewport.height=844;viewport.offsetTop=0;viewport.dispatchEvent(new Event('resize'));await wait();document.querySelector('.feature-panel__header button').click();await wait();await new Promise(r=>setTimeout(r,700));check(!document.querySelector('.feature-overlay'),'Mail overlay failed to close');check((document.body.getAttribute('style')||'')===bodyStyle&&(document.documentElement.getAttribute('style')||'')===rootStyle,'Mail document styles did not restore');check(viewport.scale===1,'Viewport zoom changed');sameWorld();
      document.getElementById('result').textContent='PASS';
    }run().catch(error=>{document.getElementById('result').textContent='FAIL: '+error.message});
  `
  try {
    const bundle = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ MODE: mode, DEV: false }), 'import.meta.env.MODE': JSON.stringify(mode), 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'isolated-social-fixture', setup(plugin) {
      plugin.onResolve({ filter: /\/browserApiClient(\.ts)?$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      plugin.onLoad({ filter: /^api$/, namespace: 'fixture' }, () => ({ contents: 'export const browserApiClient=new Proxy({}, {get(_target,key){return (...args)=>globalThis.__socialApi[key](...args)}});' }))
      plugin.onResolve({ filter: /\/FeatureContent$/ }, () => ({ path: 'content', namespace: 'fixture' }))
      plugin.onLoad({ filter: /^content$/, namespace: 'fixture' }, () => ({ contents: "import {MailPage} from './src/features/mail/MailPage';export function FeatureContent(){return <MailPage/>}", loader: 'tsx', resolveDir: process.cwd() }))
    } }] })
    const css = (await Promise.all(['src/styles/tokens.css', 'src/index.css', 'src/styles/game.css'].map(file => readFile(file, 'utf8')))).join('\n')
    const html = join(directory, 'test.html')
    await writeFile(html, `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><output id="result">WAITING</output><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script>`)
    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE, ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=390,844', '--virtual-time-budget=10000', '--dump-dom', pathToFileURL(html).href], { windowsHide: true })
      let stdout = ''; child.stdout.on('data', data => { stdout += data }); child.stderr.resume()
      const timeout = setTimeout(() => { child.kill(); reject(new Error('Headless fixture timeout')) }, 30000)
      child.on('error', reject); child.on('close', code => { clearTimeout(timeout); code === 0 ? resolve(stdout) : reject(new Error('Headless browser exited ' + code)) })
    })
    const result = output.match(/<output id="result">([^<]+)<\/output>/)?.[1]
    assert.equal(result, 'PASS', result ?? 'Fixture did not finish')
  } finally {
    const target = join(directory, 'test.html')
    assert.ok(target.startsWith(tmpdir()), 'Fixture cleanup must stay inside temporary storage')
    await rm(directory, { recursive: true, force: true })
  }
})
