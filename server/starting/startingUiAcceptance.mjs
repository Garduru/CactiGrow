import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sql } from 'drizzle-orm'
import { verifyCreatorViewport } from './creatorViewportAcceptance.mjs'

// Isolated full-app browser fixture: real API/services/PostgreSQL, fixed test identity.
// No instrumentation or authentication shortcuts are compiled into the shipped app.
export async function verifyStartingUi({ database, playerId, handleApiRequest, createApiRouter }) {
  await mkdir('.wrangler/starting-browser',{recursive:true})
  await mkdir('.wrangler/character-v21-work',{recursive:true})
  const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import Phaser from 'phaser';import {AppRouter} from './src/app/AppRouter';
    import {CHARACTER_MODULES} from './src/characters/characterArt';window.fixtureCharacterModules=CHARACTER_MODULES;
    const OriginalGame=Phaser.Game;Phaser.Game=class extends OriginalGame{constructor(options){super(options);window.fixtureGame=this;}};
    createRoot(document.getElementById('root')).render(<AppRouter/>);
  `},bundle:true,jsx:'automatic',platform:'browser',format:'iife',write:false,define:{'import.meta.env':JSON.stringify({MODE:'staging',DEV:false})},loader:{'.css':'empty'},logLevel:'silent'})
  const css=(await Promise.all(['src/index.css','src/styles/tokens.css','src/styles/game.css','src/features/starting/starting.css','src/game-world/localMinimap.css','src/features/devtools/devTools.css','src/features/admin/adminTools.css'].map(f=>readFile(f,'utf8')))).join('\n')
  const router=createApiRouter({authenticationConfigurationFactory:()=>({identityProvider:{verify:async()=>({provider:'test',subject:playerId,expiresAt:new Date(Date.now()+3600000).toISOString()})},createPlayerIdentityResolver:async()=>({resolve:async()=>({playerId})})})})
  const errors=[];let appearanceWrites=0
  const server=createServer(async(req,res)=>{
    try {
      if(req.url.startsWith('/api/')) {
        const chunks=[];for await(const c of req)chunks.push(c)
        if(req.method==='POST'&&req.url==='/api/v1/me/starting-experience'&&JSON.parse(Buffer.concat(chunks).toString()).type==='save-appearance')appearanceWrites++
        const response=await handleApiRequest(new Request(`http://127.0.0.1${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),{CACTIGROW_ENVIRONMENT:'staging',CACTIGROW_VERSION:'starting-ui-fixture',CACTIGROW_REALTIME_ENABLED:'false',CACTIGROW_ACCESS_TEAM_DOMAIN:'https://fixture.invalid',CACTIGROW_ACCESS_AUDIENCE:'fixture-audience'},undefined,{router,createRequestDatabaseContext:()=>({getDatabase:async()=>database,dispose:async()=>{}}),reportUnexpectedError:e=>errors.push(e.message+': '+(e.cause?.message??''))})
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return
      }
      if(req.url.startsWith('/assets/')) {const path=resolve('public','.'+req.url);if(!path.startsWith(resolve('public')+'\\'))throw new Error('Invalid asset path');res.setHeader('content-type',extname(path)==='.png'?'image/png':extname(path)==='.webp'?'image/webp':'image/svg+xml');res.end(await readFile(path));return}
      res.setHeader('content-type','text/html');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style><div id="root"></div><script>${bundle.outputFiles[0].text}</script>`)
    }catch(e){errors.push(e.message);res.statusCode=500;res.end('Fixture unavailable')}
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const {chromium}=await import(pathToFileURL(resolve('.wrangler/ui-check/node_modules/playwright/index.mjs')).href)
  const browser=await chromium.launch({executablePath:process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox']})
  let page
  try {
    page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message))
    await page.addInitScript(() => { const OriginalDate=Date;class DeviceDate extends OriginalDate { constructor(...args){ super(...(args.length?args:[OriginalDate.now()-16000])) } static now(){return OriginalDate.now()-16000} };window.Date=DeviceDate })
    await page.goto(`http://127.0.0.1:${server.address().port}/world`)
    await page.getByLabel('Character name',{exact:true}).fill('Fresh Browser Grower');await page.getByRole('button',{name:'Continue',exact:true}).click()
    const previewPainted=async()=>{await page.waitForFunction(()=>{const canvas=document.querySelector('canvas.character-preview');if(!canvas)return false;const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>128)opaque++;return opaque>1000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
    await previewPainted()
    const previewSignature=()=>page.evaluate(()=>{const c=document.querySelector('canvas.character-preview'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(const pixel of pixels)hash=Math.imul(hash^pixel,16777619)>>>0;return hash})
    const masculinePreview=await previewSignature(),masculine=page.getByRole('button',{name:'Masculine',exact:true}),feminine=page.getByRole('button',{name:'Feminine',exact:true})
    assert.equal(await masculine.getAttribute('aria-pressed'),'true')
    const masculineBounds=await masculine.boundingBox(),feminineBounds=await feminine.boundingBox()
    assert.ok(Math.abs(masculineBounds.width-feminineBounds.width)<=1,'both body choices have equal visual weight')
    await page.screenshot({path:'.wrangler/character-v21-work/creator-masculine-desktop.png'})
    await feminine.click()
    await page.waitForFunction(previous=>{const c=document.querySelector('canvas.character-preview'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(const pixel of pixels)hash=Math.imul(hash^pixel,16777619)>>>0;return hash!==previous},masculinePreview)
    const femininePreview=await previewSignature();assert.notEqual(femininePreview,masculinePreview,'feminine preview changes actual rendered pixels')
    await page.screenshot({path:'.wrangler/character-v21-work/creator-feminine-desktop.png'})
    for(const width of [320,360,390]) {
      await page.setViewportSize({width,height:844})
      for(const [button,label,signature] of [[masculine,'masculine',masculinePreview],[feminine,'feminine',femininePreview]]) {
        await button.click();await previewPainted();assert.equal(await previewSignature(),signature,'body preview restores the selected artwork')
        await verifyCreatorViewport(page)
        const preview=await page.getByRole('img',{name:'Character preview',exact:true}).boundingBox()
        assert.ok(preview&&preview.x>=0&&preview.x+preview.width<=width&&preview.y>=0&&preview.y+preview.height<=844,'body preview stays visible')
        await page.screenshot({path:`.wrangler/character-v21-work/creator-${label}-${width}.png`})
      }
    }
    await page.setViewportSize({width:1280,height:900})
    const hairPreviews=new Set()
    for(const label of ['Cropped','Tied back','Wavy crop','Long braid']) {
      await page.getByRole('button',{name:label,exact:true}).click();await previewPainted()
      hairPreviews.add(await previewSignature())
      await page.screenshot({path:`.wrangler/character-v21-work/creator-hair-${label.toLowerCase().replaceAll(' ','-')}-desktop.png`})
    }
    assert.equal(hairPreviews.size,4,'all four hairstyles update actual preview artwork')
    await page.getByRole('button',{name:'Tone 3',exact:true}).click();await page.getByRole('button',{name:'Tied back',exact:true}).click();await page.getByRole('button',{name:'Silver',exact:true}).click()
    await previewPainted();await page.screenshot({path:'.wrangler/character-v21-work/creator-face-desktop.png'})
    await page.getByRole('button',{name:'Next: outfit',exact:true}).click()
    await page.getByRole('button',{name:'Sage',exact:true}).click();await page.getByRole('button',{name:'Walnut',exact:true}).click();await page.getByRole('button',{name:'Straw brim',exact:true}).click();await page.getByRole('button',{name:'Field satchel',exact:true}).click()
    await page.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await feminine.getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('button',{name:'Tone 3',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('button',{name:'Tied back',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Next: outfit',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Sage',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(appearanceWrites,0,'creator navigation stays a local preview until final save')
    for(const width of [320,360,390]) {await page.setViewportSize({width,height:844});await previewPainted();await verifyCreatorViewport(page);const preview=await page.getByRole('img',{name:'Character preview',exact:true}).boundingBox();assert.ok(preview&&preview.width>0&&preview.height>0&&preview.x>=0&&preview.x+preview.width<=width,'live character preview remains visible');await page.screenshot({path:`.wrangler/character-v21-work/creator-outfit-${width}.png`});}
    await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'.wrangler/character-v21-work/creator-outfit-desktop.png'})
    await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Begin your adventure',exact:true}).click()
    const ready=areaId=>page.waitForFunction(id=>{const s=window.fixtureGame?.scene.getScenes(true)[0];if(!s?.player?.body||(s.options?.area??s.foundation?.area)?.areaId!==id)return false;const modules=Object.keys(window.fixtureCharacterModules);if(!modules.length||!modules.every(m=>{if(!s.textures.exists('character-module:'+m))return false;const t=s.textures.get('character-module:'+m).getSourceImage();return t.width>0&&t.height>0}))return false;const art=s.player.list.find(o=>o.name==='character-art-v1'),canvas=art?.texture.getSourceImage();if(!canvas?.getContext)return false;const pixels=canvas.getContext('2d').getImageData(art.frame.cutX,art.frame.cutY,art.frame.cutWidth,art.frame.cutHeight).data;let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>128)opaque++;return opaque>1000},areaId,{timeout:20000})
    await ready('starting-spawn-tutorial')
    const selectedAppearance={body:1,skin:2,shirt:1,hair:1,hairColor:3,pants:1,hat:1,accessory:1}
    const characterAppearance=()=>page.evaluate(()=>window.fixtureGame.scene.getScenes(true)[0].player.getData('characterAppearance'))
    assert.equal(appearanceWrites,1,'appearance saves through one authoritative command');assert.deepEqual(await characterAppearance(),selectedAppearance)
    const mara=await page.evaluate(()=>{const s=window.fixtureGame.scene.getScenes(true)[0],npc=s.children.list.find(o=>o.data?.get('characterPreset')==='mara'),entity=s.options.area.interactables.find(e=>e.entityId==='mara-guide');const signature=object=>{const art=object.list.find(o=>o.name==='character-art-v1'),canvas=art.texture.getSourceImage(),frame=art.frame,pixels=canvas.getContext('2d').getImageData(frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight).data;let hash=2166136261;for(const pixel of pixels)hash=Math.imul(hash^pixel,16777619)>>>0;return hash};return {appearance:npc?.getData('characterAppearance'),art:npc?.list.some(o=>o.name==='character-art-v1'),distinctArtwork:signature(npc)!==signature(s.player),position:npc&&{x:npc.x,y:npc.y},authored:{x:entity.x,y:entity.y}}})
    assert.equal(mara.art,true,'Mara uses the shared character renderer');assert.deepEqual(mara.appearance,selectedAppearance);assert.equal(mara.distinctArtwork,true,'authored Mara art differs from a player with the same public appearance');assert.deepEqual(mara.position,mara.authored,'NPC art preserves the accepted interaction registration')
    await page.screenshot({path:'.wrangler/character-v21-work/starting-spawn-desktop.png'})
    await page.reload();await ready('starting-spawn-tutorial');assert.deepEqual(await characterAppearance(),selectedAppearance,'modular appearance restores from the server after refresh')
    const walk=async point=>{await page.locator('canvas').focus();await page.evaluate(p=>{const s=window.fixtureGame.scene.getScenes(true)[0];s.navigation.move(s.player,p)},point);await page.waitForFunction(p=>{const s=window.fixtureGame?.scene.getScenes(true)[0];return s&&Math.hypot(s.player.x-p.x,s.player.y-p.y)<35},point,{timeout:20000})}
    const interact=async entityId=>{
      const e=await page.evaluate(id=>window.fixtureGame.scene.getScenes(true)[0].options.area.interactables.find(e=>e.entityId===id),entityId)
      await walk({x:e.x,y:e.y+65});const target=await page.evaluate(e=>{const s=window.fixtureGame.scene.getScenes(true)[0],c=s.cameras.main,b=s.game.canvas.getBoundingClientRect();return {x:b.x+(e.x-c.worldView.x)*c.zoom,y:b.y+(e.y-c.worldView.y)*c.zoom}},e);await page.mouse.click(target.x,target.y);await page.getByRole('dialog').waitFor({state:'visible'})
    }
    const exit=async(id,area)=>{const target=await page.evaluate(id=>{const s=window.fixtureGame.scene.getScenes(true)[0];return (s.options?.area??s.foundation.area).exits.find(e=>e.exitId===id)},id);await page.locator('canvas').focus();await page.evaluate(p=>{const s=window.fixtureGame.scene.getScenes(true)[0];s.navigation.move(s.player,{x:p.x,y:p.y})},target);await ready(area)}
    const enterBuilding=async(id,path)=>{
      const point=await page.evaluate(id=>{const s=window.fixtureGame.scene.getScenes(true)[0],t=s.interactionTargets.find(t=>t.location.id===id);return {x:t.layout.approachX,y:t.layout.approachY}},id)
      await walk(point)
      const target=await page.evaluate(id=>{const s=window.fixtureGame.scene.getScenes(true)[0],t=s.interactionTargets.find(t=>t.location.id===id),p=s.getTapCenter(t.layout),c=s.cameras.main,b=s.game.canvas.getBoundingClientRect();return {x:b.x+(p.x-c.worldView.x)*c.zoom,y:b.y+(p.y-c.worldView.y)*c.zoom}},id)
      await page.mouse.click(target.x,target.y);await page.waitForURL('**/'+path)
    }
    const backFarm=async()=>{await page.locator('[data-tutorial-target="farm-return"]').click();await ready('player-farm')}
    await interact('mara-guide');await page.screenshot({path:'.wrangler/character-v21-work/mara-dialogue-desktop.png'});for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mara dialogue fits mobile');const dialog=await page.getByRole('dialog').boundingBox();assert.ok(dialog.x>=0&&dialog.x+dialog.width<=width);await page.screenshot({path:`.wrangler/character-v21-work/mara-dialogue-${width}.png`});}await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Accept Field Knife',exact:true}).click()
    await page.locator('[data-tutorial-target=inventory][data-tutorial-highlight]').waitFor();await page.locator('[data-tutorial-target=inventory]').click();await page.locator('[data-tutorial-target=equip-tool][data-tutorial-highlight]').waitFor();assert.equal(await page.locator('[data-tutorial-target=inventory][data-tutorial-highlight]').count(),0);await page.getByRole('button',{name:'Equip Field Knife',exact:true}).click();await page.getByRole('button',{name:'Close feature panel',exact:true}).click()
    await interact('first-san-pedro');await page.getByRole('button',{name:'Harvest seeds · +10 Harvesting XP',exact:true}).click()
    // Disposable fixture simulates an exhausted repeat tester, without minting economic seeds.
    await database.execute(sql`update player_seed_stacks set quantity=0 where player_id=${playerId}`)
    await page.reload();await ready('starting-spawn-tutorial');await page.getByText('Follow the eastern road to the Path 1 tutorial pot.',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Inventory',exact:true}).click();const seedCard=page.getByRole('article',{name:'San Pedro tutorial seed',exact:true});await seedCard.waitFor();assert.ok((await seedCard.innerText()).includes('Owned'));assert.ok((await seedCard.innerText()).includes('Reserved for the Path 1 tutorial pot'));assert.equal(await page.getByLabel('Equipment',{exact:true}).getByText('San Pedro tutorial seed',{exact:true}).count(),0);await page.screenshot({path:'.wrangler/starting-browser/tutorial-seed-inventory.png'});await page.getByRole('button',{name:'Close feature panel',exact:true}).click()
    for(const width of [320,360,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'world fits mobile');const h=await page.locator('.game-header').boundingBox(),objective=await page.getByLabel('Current tutorial objective').boundingBox();assert.ok(h.height<90,'HUD stays one row');assert.ok(objective.y>=h.y+h.height,'objective stays below HUD controls');}
    await page.setViewportSize({width:1280,height:900});await exit('to-path-1','path-1');assert.deepEqual(await characterAppearance(),selectedAppearance);await page.screenshot({path:'.wrangler/character-v21-work/path-1-desktop.png'});await interact('path-1-pot');const potStart=performance.now();await page.getByRole('button',{name:'Plant reserved tutorial seed',exact:true}).click()
    await page.waitForFunction(()=>window.fixtureGame.scene.getScenes(true)[0].potPlant?.visible)
    await page.screenshot({path:'.wrangler/starting-browser/pot-growing.png'});await page.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await ready('path-1');await interact('path-1-pot')
    await page.getByRole('button',{name:'Collect tutorial San Pedro',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('.tutorial-dialog button')?.disabled,null,{timeout:60000})
    assert.ok(performance.now()-potStart<22000,'effective collectible threshold stays near 15s despite a 16s slow device clock');assert.equal(await page.evaluate(()=>window.fixtureGame.scene.getScenes(true)[0].potPlant.texture.key),'pot-mature')
    await page.getByRole('button',{name:'Collect tutorial San Pedro',exact:true}).click();await exit('to-cross-path-1','cross-path-1');assert.deepEqual(await characterAppearance(),selectedAppearance);await page.screenshot({path:'.wrangler/character-v21-work/cross-path-desktop.png'});await exit('to-player-farm','player-farm');assert.deepEqual(await characterAppearance(),selectedAppearance);await page.screenshot({path:'.wrangler/character-v21-work/player-farm-appearance.png'})
    await enterBuilding('nursery','nursery');await page.locator('.nursery-slot--empty').nth(5).waitFor();assert.equal(await page.locator('.nursery-slot--empty').count(),6,'fresh Nursery is empty before intentional planting')
    for(const width of [320,360,390]) {
      await page.setViewportSize({width,height:844})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'facility fits mobile')
      const card=await page.getByLabel('Current tutorial objective').boundingBox(), planting=await page.getByRole('button',{name:/Plant Seed/i}).first().boundingBox()
      assert.ok(card.y+card.height<=planting.y,'objective does not cover Nursery planting controls')
    }
    await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:/Plant Seed/i}).first().click();await page.getByRole('button',{name:/San Pedro Farm practice seed/}).click()
    await backFarm();await enterBuilding('garden','garden')
    const firstDetails=page.getByRole('button',{name:/^Full details for/}).first(), firstId=(await firstDetails.getAttribute('aria-label')).split(' ').at(-1)
    await page.getByRole('button',{name:/^Favorite specimen/}).first().click()
    await page.locator('[data-tutorial-target=farm-return][data-tutorial-highlight]').waitFor();await backFarm();await enterBuilding('lab','lab')
    assert.equal(await page.getByRole('button',{name:'Observe tutorial specimen',exact:true}).count(),0)
    await page.getByText('Return to your Farm, then enter the garden to continue with your first san pedro.',{exact:true}).waitFor();await backFarm();await enterBuilding('garden','garden')
    await page.getByRole('button',{name:new RegExp('^Full details for .*'+firstId+'$')}).click()
    await page.getByRole('button',{name:'Study Genetics',exact:true}).click()
    assert.equal(await page.getByLabel('Current tutorial objective').isVisible(),false,'objective hides while the actual research dialog is open')
    await page.getByRole('button',{name:'Observe specimen',exact:true}).click()
    await page.getByRole('button',{name:'Close Genetics research',exact:true}).last().click()
    await page.locator('[data-tutorial-target^="details:"][data-tutorial-highlight]').waitFor()
    await page.locator('.garden-specimen').filter({hasText:'Practice partner'}).getByRole('button',{name:/^Full details for/}).click()
    await page.getByRole('button',{name:'Breed',exact:true}).click(); await page.locator('.breeding-candidate').waitFor();assert.equal(await page.locator('.breeding-candidate').count(),1); assert.ok((await page.locator('.breeding-section').first().innerText()).includes('Your first San Pedro'))
    await page.locator('.breeding-candidate[data-tutorial-highlight]').waitFor();await page.locator('.breeding-candidate').first().click();await page.getByRole('button',{name:'Confirm breeding',exact:true}).click();await page.getByRole('button',{name:'Finish',exact:true}).click()
    await page.getByLabel('Current tutorial objective').waitFor({state:'hidden'});await page.reload();await page.getByLabel('Current tutorial objective').waitFor({state:'hidden'})
    await page.screenshot({path:'.wrangler/starting-browser/farm-complete.png'})
    await page.goto(`http://127.0.0.1:${server.address().port}/world`);await ready('player-farm');await exit('to-cross-path-1','cross-path-1');await exit('to-path-1','path-1');await interact('path-1-pot')
    await page.getByRole('button',{name:'Travel',exact:true}).click();await page.getByRole('button',{name:'Farm',exact:true}).click();await ready('player-farm')
    assert.equal(await page.getByRole('dialog').count(),0,'Travel closes the previous Area interaction')
    await walk({x:1500,y:1570})
    // Disposable fixture only: full reset shows the same empty name form before appearance.
    const resetResponse=await page.request.post(`http://127.0.0.1:${server.address().port}/api/v1/dev/starting-experience/reset`,{data:{commandId:crypto.randomUUID(),targetPlayerId:playerId,confirmPlayerId:playerId,mode:'full-onboarding'}})
    assert.equal(resetResponse.status(),200)
    await page.reload();await page.getByLabel('Character name',{exact:true}).waitFor();assert.equal(await page.getByLabel('Character name',{exact:true}).inputValue(),'')
    assert.equal(await page.getByRole('button',{name:'Begin your adventure',exact:true}).count(),0)
    await page.reload();await page.getByLabel('Character name',{exact:true}).fill('Browser Reset Grower');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Next: outfit',exact:true}).waitFor()
    assert.equal(await page.getByRole('button',{name:'Masculine',exact:true}).getAttribute('aria-pressed'),'true','full-reset appearances use the compatibility body until an explicit selection')
    assert.equal(await page.getByRole('button',{name:'Feminine',exact:true}).isVisible(),true,'full-reset players receive both body choices')
    await page.screenshot({path:'.wrangler/starting-browser/full-reset-name-then-appearance.png'})
    await page.getByText('Staging Developer Tools - onboarding reset',{exact:true}).click()
    await page.getByLabel('Reset mode',{exact:true}).selectOption('full-onboarding')
    assert.equal(await page.getByRole('button',{name:'Reset Full Character Onboarding',exact:true}).isEnabled(),false,'reset requires explicit target confirmation')
    assert.equal(await page.getByLabel('Target internal UUID',{exact:true}).inputValue(),playerId)
    await page.getByLabel('Confirm target UUID',{exact:true}).fill(playerId)
    await page.getByRole('button',{name:'Reset Full Character Onboarding',exact:true}).click()
    await page.getByLabel('Character name',{exact:true}).waitFor();assert.equal(await page.getByLabel('Character name',{exact:true}).inputValue(),'')
    await page.screenshot({path:'.wrangler/starting-browser/full-reset-waiting-name.png'})
    assert.deepEqual(errors,[])
    const acceptance=JSON.stringify({fullApp:true,freshPlayer:true,appearance:true,bodyPreviews:['masculine','feminine'],authoredMara:true,modularAppearance:selectedAppearance,appearanceWrites,creatorNavigation:true,visualViewportCreator:true,persistentPreviewAndActions:true,controlsOnlyScroll:true,tool:true,harvest:true,pot15s:true,refreshResume:true,farmNurseryGardenResearchBreeding:true,travelClosesInteraction:true,mobileWidths:[320,360,390],errors},null,2)
    await Promise.all([writeFile('.wrangler/starting-browser/acceptance.json',acceptance),writeFile('.wrangler/character-v21-work/starting-acceptance.json',acceptance)])
  }catch(e){await page?.screenshot({path:'.wrangler/starting-browser/failure.png'});await writeFile('.wrangler/starting-browser/failure.json',JSON.stringify({text:await page?.locator('body').innerText(),errors,error:e.message},null,2));throw e}
  finally{await browser.close();await new Promise(r=>server.close(r))}
}
