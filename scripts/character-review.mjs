/** Local-only combination review. No route or production module imports this tool.
 * node scripts/character-review.mjs [--baseline] [--exhaustive]
 * --exhaustive streams every palette/geometry atlas without retaining look caches.
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { build } from 'esbuild'
import { chromium } from '../.wrangler/ui-check/node_modules/playwright/index.mjs'

const baseline=process.argv.includes('--baseline'), exhaustive=process.argv.includes('--exhaustive')
const repository=resolve('.'), publicRoot=resolve('public'), folder=resolve('.wrangler/character-v21-work',baseline?'review-before':'review-final')
await mkdir(folder,{recursive:true})
const entry=baseline?'.wrangler/character-v21-work/source-baseline/src/characters/characterArt.ts':'src/characters/characterArt.ts'
const bundled=await build({entryPoints:[entry],bundle:true,write:false,format:'iife',globalName:'CharacterReview'})
const server=createServer(async(req,res)=>{
  if(req.url==='/'){res.end('<!doctype html><title>Local character combination review</title><body></body>');return}
  const asset=resolve(publicRoot,req.url.slice(1))
  if(!asset.startsWith(publicRoot+sep)||!req.url.startsWith('/assets/characters/')){res.writeHead(404).end();return}
  try{res.end(await readFile(asset))}catch{res.writeHead(404).end()}
})
await new Promise(done=>server.listen(0,'127.0.0.1',done))
const browser=await chromium.launch({executablePath:process.env.CACTIGROW_TEST_BROWSER_EXECUTABLE??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
const errors=[], started=Date.now()
try{
  const page=await browser.newPage({viewport:{width:2700,height:1640}})
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto('http://127.0.0.1:'+server.address().port)
  await page.addScriptTag({content:bundled.outputFiles[0].text})
  await page.evaluate(baseline=>{window.reviewBaseline=baseline},baseline)
  await page.evaluate(async()=>{window.reviewSources=await window.CharacterReview.loadCharacterArt();document.body.style.cssText='margin:0;padding:16px;background:#3b2b20;color:#edd8b2;font:15px Georgia'})
  const geometry=[]
  for(let body=0;body<2;body++)for(let hair=0;hair<4;hair++){
    const rows=await page.evaluate(({body,hair})=>{
      const api=window.CharacterReview,sources=window.reviewSources;document.body.replaceChildren();document.body.style.display='block';const records=[]
      for(let hat=0;hat<3;hat++)for(let accessory=0;accessory<2;accessory++){
        const appearance={body,hair,hat,accessory,skin:0,hairColor:0,shirt:0,pants:0},atlas=document.createElement('canvas')
        api.paintCharacterAtlas(atlas,sources,appearance)
        const atlasPixels=atlas.getContext('2d').getImageData(0,0,640,896).data;let atlasAlphaHash=2166136261
        for(let p=3;p<atlasPixels.length;p+=4)atlasAlphaHash=Math.imul(atlasAlphaHash^atlasPixels[p],16777619)
        window.reviewAlpha??={};window.reviewAlpha[[body,hair,hat,accessory].join(':')]=atlasAlphaHash>>>0
        const label=document.createElement('div');label.textContent=`body ${body} / hair ${hair} / hat ${hat} / accessory ${accessory}`;label.style.cssText='padding:8px;background:#513a29';document.body.append(label)
        const strip=document.createElement('div');strip.style.cssText='display:flex;gap:2px;background:#70543e';document.body.append(strip)
        const frames=[]
        for(let row=0;row<4;row++)for(let frame=0;frame<5;frame++){
          const canvas=document.createElement('canvas');canvas.width=128;canvas.height=224;canvas.getContext('2d').drawImage(atlas,frame*128,row*224,128,224,0,0,128,224)
          const card=document.createElement('div'),name=document.createElement('div');name.textContent=api.CHARACTER_DIRECTIONS[row]+' '+(frame?'walk'+frame:'idle');card.append(name,canvas);strip.append(card)
          const data=canvas.getContext('2d').getImageData(0,0,128,224).data;let opacity=0,edge=0,edgeMax=0,hash=2166136261
          for(let p=3;p<data.length;p+=4){opacity+=data[p];hash=Math.imul(hash^data[p],16777619);const x=(p>>>2)%128,y=Math.floor((p>>>2)/128);if(x===0||x===127||y===0||y===223){edge+=data[p];edgeMax=Math.max(edgeMax,data[p])}}
          if(!opacity)throw Error('Empty geometry pose')
          if(!window.reviewBaseline&&edgeMax>=32)throw Error(`Opaque frame edge body${body} hair${hair} hat${hat} accessory${accessory} row${row} frame${frame}`)
          frames.push({row,frame,opacity,edge,edgeMax,alphaHash:hash>>>0,plan:api.resolveCharacterComposition?.(appearance,{facing:api.CHARACTER_DIRECTIONS[row],frame})})
        }
        records.push({appearance,frames})
      }
      return records
    },{body,hair})
    geometry.push(...rows)
    await page.screenshot({path:resolve(folder,`geometry-body-${body}-hair-${hair}.png`),fullPage:true})
  }
  await page.evaluate(()=>{
    const api=window.CharacterReview;document.body.replaceChildren();document.body.style.display='block'
    for(const size of [128,64]){
      const strip=document.createElement('div');strip.style.cssText='display:flex;gap:2px;background:repeating-conic-gradient(#70543e 0% 25%,#98785a 0% 50%) 0/16px 16px';document.body.append(strip)
      for(const facing of api.CHARACTER_DIRECTIONS)for(let frame=0;frame<5;frame++){
        const source=document.createElement('canvas');api.paintCharacterArt(source,window.reviewSources,{skin:0,shirt:0},{npcId:'mara',facing,frame})
        const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size*224/128;canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height)
        const card=document.createElement('div'),label=document.createElement('div');label.textContent=facing+' '+frame;card.append(label,canvas);strip.append(card)
        const pixels=source.getContext('2d').getImageData(0,0,128,224).data
        for(let p=3;p<pixels.length;p+=4){const x=(p>>>2)%128,y=Math.floor((p>>>2)/128);if((x===0||x===127||y===0||y===223)&&pixels[p]>=32)throw Error('Mara opaque frame edge')}
      }
    }
  })
  await page.screenshot({path:resolve(folder,'mara-exclusive-poses.png'),fullPage:true})
  let paletteRenders=0, structuralComposites=0, exhaustiveAtlases=0
  for(let body=0;body<2;body++)for(let shirt=0;shirt<4;shirt++){
    const stats=await page.evaluate(({body,shirt})=>{
      const api=window.CharacterReview,sources=window.reviewSources;document.body.replaceChildren();document.body.style.display='grid';document.body.style.gridTemplateColumns='repeat(9,144px)';document.body.style.gap='8px';let renders=0
      for(let skin=0;skin<3;skin++)for(let hairColor=0;hairColor<4;hairColor++)for(let pants=0;pants<3;pants++){
        const appearance={body,shirt,skin,hairColor,pants,hair:hairColor,hat:0,accessory:1},canvas=document.createElement('canvas');api.paintCharacterArt(canvas,sources,appearance)
        const card=document.createElement('div'),label=document.createElement('div');label.textContent=`skin${skin} hair${hairColor} pants${pants}`;card.append(label,canvas);document.body.append(card);renders++
      }
      return renders
    },{body,shirt})
    paletteRenders+=stats
    await page.screenshot({path:resolve(folder,`palettes-body-${body}-shirt-${shirt}.png`),fullPage:true})
  }
  const structural=await page.evaluate(()=>{
    const api=window.CharacterReview;if(!api.resolveCharacterComposition)return{available:false,count:0}
    let count=0
    for(let body=0;body<2;body++)for(let hair=0;hair<4;hair++)for(let hat=0;hat<3;hat++)for(let accessory=0;accessory<2;accessory++)for(const facing of api.CHARACTER_DIRECTIONS)for(let frame=0;frame<5;frame++){
      const expected=JSON.stringify(api.resolveCharacterComposition({body,hair,hat,accessory,skin:0,shirt:0,pants:0,hairColor:0},{facing,frame}))
      for(let skin=0;skin<3;skin++)for(let hairColor=0;hairColor<4;hairColor++)for(let shirt=0;shirt<4;shirt++)for(let pants=0;pants<3;pants++){
        if(JSON.stringify(api.resolveCharacterComposition({body,hair,hat,accessory,skin,hairColor,shirt,pants},{facing,frame}))!==expected)throw Error('Palette changed geometry')
        count++
      }
    }
    return{available:true,count}
  })
  structuralComposites=structural.count
  if(exhaustive){
    for(let start=0;start<6912;start+=48){
      const count=await page.evaluate(({start})=>{
        const api=window.CharacterReview,sources=window.reviewSources,canvas=document.createElement('canvas');let count=0
        for(let index=start;index<Math.min(start+48,6912);index++){
          let choice=index;const pants=choice%3;choice=Math.floor(choice/3);const shirt=choice%4;choice=Math.floor(choice/4);const hairColor=choice%4;choice=Math.floor(choice/4);const skin=choice%3;choice=Math.floor(choice/3);const accessory=choice%2;choice=Math.floor(choice/2);const hat=choice%3;choice=Math.floor(choice/3);const hair=choice%4;choice=Math.floor(choice/4);const body=choice%2
          api.paintCharacterAtlas(canvas,sources,{body,hair,hat,accessory,skin,hairColor,shirt,pants})
          const pixels=canvas.getContext('2d').getImageData(0,0,640,896).data
          let alphaHash=2166136261
          for(let p=3;p<pixels.length;p+=4)alphaHash=Math.imul(alphaHash^pixels[p],16777619)
          if((alphaHash>>>0)!==window.reviewAlpha[[body,hair,hat,accessory].join(':')])throw Error('Palette changed composite alpha, bounds or frame margins')
          for(let row=0;row<4;row++)for(let frame=0;frame<5;frame++){let visible=false;for(let y=row*224;y<(row+1)*224&&!visible;y++)for(let x=frame*128;x<(frame+1)*128;x++)if(pixels[(y*640+x)*4+3]>128){visible=true;break}if(!visible)throw Error('Empty composite')}
          count++
        }
        return count
      },{start})
      exhaustiveAtlases+=count
      if(exhaustiveAtlases%576===0)console.log(JSON.stringify({phase:'exhaustive',atlases:exhaustiveAtlases,composites:exhaustiveAtlases*20}))
    }
  }
  assert.equal(geometry.length,48);assert.equal(paletteRenders,288);assert.deepEqual(errors,[])
  const report={passed:true,baseline,geometryLooks:48,geometryPoseRenders:960,paletteTuples:144,paletteExampleRenders:paletteRenders,structuralPaletteComposites:structuralComposites,exhaustiveAtlases,exhaustivePoseComposites:exhaustiveAtlases*20,checks:['all geometry frames nonempty','frame-edge alpha below32','palette attachment plan identical','exhaustive palette full-atlas alpha identical to geometry reference','Mara20 source and world poses with transparent edges'],durationMs:Date.now()-started,errors,geometry}
  await writeFile(resolve(folder,'review-result.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({...report,geometry:undefined,folder}))
}finally{await browser.close();await new Promise(done=>server.close(done))}
