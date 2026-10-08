import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { verifyCreatorViewport } from '../../../server/starting/creatorViewportAcceptance.mjs'

test('actual mobile creator fills visual viewport, keeps art/actions visible and restores viewport ownership', { skip: !process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE && 'Set CACTIGROW_TEST_BROWSER_EXECUTABLE.', timeout:60_000 }, async () => {
  const folder='.wrangler/character-v21-work'; await mkdir(folder,{recursive:true})
  const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import{AppearanceSetup}from'./src/features/starting/AppearanceSetup';import{StartingContext}from'./src/features/starting/StartingContext';
    import{WorldLocationContext}from'./src/game-world/WorldLocationContext';import{PlayerBootstrapContext}from'./src/app/PlayerBootstrapContext';import{SocialContext}from'./src/features/social/socialContextState';
    window.creatorWrites=[];function Fixture(){const[done,setDone]=useState(false);return <PlayerBootstrapContext.Provider value={{status:'unauthenticated'}}><SocialContext.Provider value={{refresh(){}}}><StartingContext.Provider value={{active:true,state:{appearance:{skin:0,shirt:0}},pending:false,error:'',now:()=>Date.now(),refresh:async()=>{},execute:async command=>{window.creatorWrites.push(command);return true}}}><WorldLocationContext.Provider value={{reload:()=>setDone(true)}}>{done?<p>Creator saved</p>:<AppearanceSetup/>}</WorldLocationContext.Provider></StartingContext.Provider></SocialContext.Provider></PlayerBootstrapContext.Provider>}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `},bundle:true,jsx:'automatic',platform:'browser',format:'iife',write:false,define:{'import.meta.env':JSON.stringify({MODE:'staging',DEV:false})},loader:{'.css':'empty'},logLevel:'silent'})
  const css=(await Promise.all(['src/index.css','src/styles/tokens.css','src/styles/game.css','src/features/starting/starting.css'].map(file=>readFile(file,'utf8')))).join('\n')
  const server=createServer(async(request,response)=>{
    try{
      if(request.url.startsWith('/assets/')){const path=resolve('public','.'+request.url);assert.ok(path.startsWith(resolve('public')+sep));response.setHeader('content-type',extname(path)==='.png'?'image/png':'image/webp');response.end(await readFile(path));return}
      response.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`)
    }catch(error){response.writeHead(500).end(error.message)}
  });await new Promise(done=>server.listen(0,'127.0.0.1',done))
  const{chromium}=await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser=await chromium.launch({executablePath:process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE,headless:true})
  const context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true}),page=await context.newPage(),errors=[],evidence=[]
  page.on('pageerror',error=>errors.push(error.message))
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.waitForFunction(()=>{const c=document.querySelector('.character-preview');if(!c)return false;const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return p.filter((_,i)=>i%4===3&&p[i]>128).length>1000})
    const cdp=await context.newCDPSession(page)
    for(const viewport of [{width:320,height:568},{width:320,height:844},{width:360,height:640},{width:360,height:800},{width:390,height:664},{width:390,height:844},{width:844,height:390},{width:640,height:360}]){
      await page.setViewportSize(viewport)
      const safeArea=viewport.width>viewport.height?{top:0,right:44,bottom:21,left:44}:{top:24,right:0,bottom:20,left:0}
      await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:safeArea})
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))))
      const face=await verifyCreatorViewport(page,{safeArea})
      if(viewport.width===320&&viewport.height===568){
        const preview=await page.locator('.character-preview').boundingBox(),panel=await page.locator('.appearance-setup__controls').boundingBox(),x=panel.x+panel.width/2,start=panel.y+panel.height-12
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]})
        for(let distance=20;distance<=100;distance+=20){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start-distance}]});await page.evaluate(()=>new Promise(done=>requestAnimationFrame(done)))}
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
        await page.waitForFunction(()=>document.querySelector('.appearance-setup__controls').scrollTop>0)
        assert.deepEqual(await page.locator('.character-preview').boundingBox(),preview,'a real touch swipe scrolls controls while the preview stays fixed')
        assert.equal(await page.evaluate(()=>scrollY),0)
        face.touchSwipe=true
      }
      await page.getByRole('button',{name:'Feminine',exact:true}).tap()
      await page.getByRole('button',{name:'Long braid',exact:true}).tap()
      await page.getByRole('button',{name:'Next: outfit',exact:true}).tap()
      await page.getByRole('button',{name:'Sage',exact:true}).tap()
      await page.getByRole('button',{name:'Field satchel',exact:true}).tap()
      const outfit=await verifyCreatorViewport(page,{safeArea})
      assert.equal(await page.getByRole('button',{name:'Begin your adventure',exact:true}).isVisible(),true)
      await page.screenshot({path:`${folder}/creator-mobile-${viewport.width}x${viewport.height}.png`})
      await page.getByRole('button',{name:'Back',exact:true}).tap()
      assert.equal(await page.getByRole('button',{name:'Feminine',exact:true}).getAttribute('aria-pressed'),'true')
      assert.equal(await page.getByRole('button',{name:'Long braid',exact:true}).getAttribute('aria-pressed'),'true')
      assert.equal(await page.evaluate(()=>window.creatorWrites.length),0)
      evidence.push({viewport,safeArea,face,outfit})
    }
    // Simulate a browser/keyboard visual-viewport contraction and pan without changing the layout viewport.
    await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,right:0,bottom:0,left:0}})
    await page.setViewportSize({width:390,height:844})
    await page.evaluate(()=>{
      const v=visualViewport;window.creatorViewportDescriptors={};window.creatorViewportResizeEvents=0;v.addEventListener('resize',()=>window.creatorViewportResizeEvents++)
      for(const[key,value]of Object.entries({width:370,height:480,offsetTop:28,offsetLeft:10})){window.creatorViewportDescriptors[key]=Object.getOwnPropertyDescriptor(v,key);Object.defineProperty(v,key,{configurable:true,get:()=>value})}v.dispatchEvent(new Event('resize'));v.dispatchEvent(new Event('scroll'))
    })
    const contracted=await verifyCreatorViewport(page)
    await page.screenshot({path:`${folder}/creator-mobile-visual-viewport.png`})
    assert.equal(await page.evaluate(()=>window.creatorViewportResizeEvents>0),true)
    await page.evaluate(()=>{for(const[key,descriptor]of Object.entries(window.creatorViewportDescriptors)){if(descriptor)Object.defineProperty(visualViewport,key,descriptor);else delete visualViewport[key]}visualViewport.dispatchEvent(new Event('resize'));visualViewport.dispatchEvent(new Event('scroll'))})
    await verifyCreatorViewport(page)
    await page.setViewportSize({width:1280,height:900})
    await page.waitForFunction(()=>!document.documentElement.classList.contains('appearance-setup-open'))
    const desktop=await page.locator('.appearance-setup').boundingBox();assert.equal(desktop.width,760);assert.ok(desktop.y>0)
    await page.screenshot({path:`${folder}/creator-desktop.png`})
    await page.getByRole('button',{name:'Next: outfit',exact:true}).click()
    await page.getByRole('button',{name:'Begin your adventure',exact:true}).click()
    await page.getByText('Creator saved',{exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>window.creatorWrites.length),1)
    await page.setViewportSize({width:390,height:844})
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))))
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('appearance-setup-open')),false)
    assert.deepEqual(errors,[])
    await writeFile(`${folder}/creator-viewport-acceptance.json`,JSON.stringify({pass:true,cases:evidence,simulatedVisualViewport:contracted,desktop,appearanceWrites:1,errors},null,2))
  }catch(error){await page.screenshot({path:`${folder}/creator-viewport-failure.png`});throw error}
  finally{await browser.close();await new Promise(done=>server.close(done))}
})
