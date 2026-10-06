import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'

// Isolated full-app browser fixture: real API/services/PostgreSQL, fixed test identity.
// No instrumentation or authentication shortcuts are compiled into the shipped app.
export async function verifyStartingUi({ database, playerId, handleApiRequest, createApiRouter }) {
  await mkdir('.wrangler/starting-browser',{recursive:true})
  const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import Phaser from 'phaser';import {AppRouter} from './src/app/AppRouter';
    const OriginalGame=Phaser.Game;Phaser.Game=class extends OriginalGame{constructor(options){super(options);window.fixtureGame=this;}};
    createRoot(document.getElementById('root')).render(<AppRouter/>);
  `},bundle:true,jsx:'automatic',platform:'browser',format:'iife',write:false,define:{'import.meta.env':JSON.stringify({MODE:'staging',DEV:false})},loader:{'.css':'empty'},logLevel:'silent'})
  const css=(await Promise.all(['src/index.css','src/styles/tokens.css','src/styles/game.css','src/features/starting/starting.css','src/features/devtools/devTools.css','src/features/admin/adminTools.css'].map(f=>readFile(f,'utf8')))).join('\n')
  const router=createApiRouter({authenticationConfigurationFactory:()=>({identityProvider:{verify:async()=>({provider:'test',subject:playerId,expiresAt:new Date(Date.now()+3600000).toISOString()})},createPlayerIdentityResolver:async()=>({resolve:async()=>({playerId})})})})
  const errors=[],server=createServer(async(req,res)=>{
    try {
      if(req.url.startsWith('/api/')) {
        const chunks=[];for await(const c of req)chunks.push(c)
        const response=await handleApiRequest(new Request(`http://127.0.0.1${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),{CACTIGROW_ENVIRONMENT:'staging',CACTIGROW_VERSION:'starting-ui-fixture',CACTIGROW_REALTIME_ENABLED:'false'},undefined,{router,createRequestDatabaseContext:()=>({getDatabase:async()=>database,dispose:async()=>{}}),reportUnexpectedError:e=>errors.push(e.message+': '+(e.cause?.message??''))})
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return
      }
      if(req.url.startsWith('/assets/')) {const path=resolve('public','.'+req.url);if(!path.startsWith(resolve('public')+'\\'))throw new Error('Invalid asset path');res.setHeader('content-type',extname(path)==='.png'?'image/png':extname(path)==='.webp'?'image/webp':'image/svg+xml');res.end(await readFile(path));return}
      res.setHeader('content-type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`)
    }catch(e){errors.push(e.message);res.statusCode=500;res.end('Fixture unavailable')}
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const {chromium}=await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser=await chromium.launch({executablePath:process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']})
  let page
  try {
    page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/world`)
    await page.getByLabel('Character name',{exact:true}).fill('Fresh Browser Grower');await page.getByRole('button',{name:'Continue',exact:true}).click()
    await page.getByRole('button',{name:'Tone 3',exact:true}).click();await page.getByRole('button',{name:'Sage',exact:true}).click()
    for(const width of [320,360,390]) {await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'appearance fits mobile');}
    await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Begin your adventure',exact:true}).click()
    const ready=areaId=>page.waitForFunction(id=>{const s=window.fixtureGame?.scene.getScenes(true)[0];return s?.player?.body&&(s.options?.area??s.foundation?.area)?.areaId===id},areaId,{timeout:20000})
    await ready('starting-spawn-tutorial')
    const walk=async point=>{await page.locator('canvas').focus();await page.evaluate(p=>{const s=window.fixtureGame.scene.getScenes(true)[0];s.navigation.move(s.player,p)},point);await page.waitForFunction(p=>{const s=window.fixtureGame?.scene.getScenes(true)[0];return s&&Math.hypot(s.player.x-p.x,s.player.y-p.y)<35},point,{timeout:20000})}
    const interact=async entityId=>{
      const e=await page.evaluate(id=>window.fixtureGame.scene.getScenes(true)[0].options.area.interactables.find(e=>e.entityId===id),entityId)
      await walk({x:e.x,y:e.y+65});const target=await page.evaluate(e=>{const s=window.fixtureGame.scene.getScenes(true)[0],c=s.cameras.main,b=s.game.canvas.getBoundingClientRect();return {x:b.x+(e.x-c.worldView.x)*c.zoom,y:b.y+(e.y-c.worldView.y)*c.zoom}},e);await page.mouse.click(target.x,target.y);await page.getByRole('dialog').waitFor({state:'visible'})
    }
    const exit=async(id,area)=>{const target=await page.evaluate(id=>window.fixtureGame.scene.getScenes(true)[0].options.area.exits.find(e=>e.exitId===id),id);await page.locator('canvas').focus();await page.evaluate(p=>{const s=window.fixtureGame.scene.getScenes(true)[0];s.navigation.move(s.player,{x:p.x,y:p.y})},target);await ready(area)}
    await interact('mara-guide');await page.getByRole('button',{name:'Accept Field Knife',exact:true}).click()
    await page.getByRole('button',{name:'Open Inventory',exact:true}).click();await page.getByRole('button',{name:'Equip Field Knife',exact:true}).click();await page.getByRole('button',{name:'Close feature panel',exact:true}).click()
    await interact('first-san-pedro');await page.getByRole('button',{name:'Harvest seeds · +10 Harvesting XP',exact:true}).click()
    await page.reload();await ready('starting-spawn-tutorial');await page.getByText('Follow the eastern road to Path 1. Plant the tutorial pot.',{exact:true}).waitFor()
    for(const width of [320,360,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'world fits mobile');const h=await page.locator('.game-header').boundingBox(),objective=await page.getByLabel('Current tutorial objective').boundingBox();assert.ok(h.height<90,'HUD stays one row');assert.ok(objective.y>=h.y+h.height,'objective stays below HUD controls');}
    await page.setViewportSize({width:1280,height:900});await exit('to-path-1','path-1');await interact('path-1-pot');await page.getByRole('button',{name:'Plant reserved tutorial seed',exact:true}).click()
    await page.waitForFunction(()=>window.fixtureGame.scene.getScenes(true)[0].potPlant?.visible)
    await page.screenshot({path:'.wrangler/starting-browser/pot-growing.png'});await page.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await ready('path-1');await interact('path-1-pot')
    await page.getByRole('button',{name:'Collect tutorial San Pedro',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('.tutorial-dialog button')?.disabled,null,{timeout:60000})
    assert.equal(await page.evaluate(()=>window.fixtureGame.scene.getScenes(true)[0].potPlant.texture.key),'pot-mature')
    await page.getByRole('button',{name:'Collect tutorial San Pedro',exact:true}).click();await exit('to-cross-path-1','cross-path-1');await exit('to-player-farm','player-farm')
    await page.getByRole('button',{name:'Visit Nursery',exact:true}).click();await page.getByRole('button',{name:/Plant Seed/i}).first().click();await page.getByRole('button',{name:/San Pedro/}).first().click();await page.getByRole('button',{name:'I planted a normal seed',exact:true}).click()
    await page.getByRole('button',{name:'Open Garden / Collection',exact:true}).click();await page.getByRole('button',{name:/^Favorite specimen/}).first().click();await page.getByRole('button',{name:'I favorited my tutorial plant',exact:true}).click()
    await page.getByRole('button',{name:'Visit Genetics Lab',exact:true}).click();await page.getByRole('button',{name:'Observe tutorial specimen',exact:true}).click()
    await page.getByRole('button',{name:'Visit Breeding',exact:true}).click();await page.getByLabel('Parent A',{exact:true}).selectOption({index:1});await page.getByLabel('Parent B',{exact:true}).selectOption({index:1});await page.getByRole('button',{name:'Breed practice offspring',exact:true}).click()
    await page.getByLabel('Current tutorial objective').waitFor({state:'hidden'});await page.reload();await page.getByLabel('Current tutorial objective').waitFor({state:'hidden'})
    await page.screenshot({path:'.wrangler/starting-browser/farm-complete.png'})
    assert.deepEqual(errors,[])
    await writeFile('.wrangler/starting-browser/acceptance.json',JSON.stringify({fullApp:true,freshPlayer:true,appearance:true,tool:true,harvest:true,pot45s:true,refreshResume:true,farmNurseryGardenResearchBreeding:true,mobileWidths:[320,360,390],errors},null,2))
  }catch(e){await page?.screenshot({path:'.wrangler/starting-browser/failure.png'});await writeFile('.wrangler/starting-browser/failure.json',JSON.stringify({text:await page?.locator('body').innerText(),errors,error:e.message},null,2));throw e}
  finally{await browser.close();await new Promise(r=>server.close(r))}
}
