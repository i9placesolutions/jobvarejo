// Revisão curta: não publica nem enfileira exportações finais.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {register} from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
import {renderVideo} from '../../workers/video-studio/engine.mjs'
register()
const {newVideoFromTemplate}=await import('../../shared/video-studio/templates.ts')
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const {resolveVideoLabel}=await import('../../shared/video-studio/labels.ts')
const {FLYER_RECIPES}=await import('../../shared/video-studio/flyer-recipes.ts')
const dir=resolve('output/video-all-models/'+(process.env.VIDEO_MOTION_DIR||'boom-review-v14'));await mkdir(dir,{recursive:true})
const source=JSON.parse(await readFile('output/video-studio-impact/template-demo-source.json')).project.document
const labels=JSON.parse(await readFile('output/video-flyer-models/labels.json')).items
const ids=[source.brand.logo,...source.offers.map(o=>o.image)]
for(const id of ids)await copyFile('output/video-studio-impact/'+id+'.png',dir+'/'+id+'.png')
const recipes=Object.values(FLYER_RECIPES),results=[],requested=(process.env.VIDEO_MOTION_MODELS||'flyer-ab690e7b-f393-4416-b81c-e6ad3da654a4,flyer-c11924b4-3438-4e49-bd0e-56f702d4843d').split(','),selected=requested?recipes.filter(r=>requested.includes(r.id)):recipes.slice(0,8)
const families=requested?[]:[...new Set(recipes.map(r=>r.backgroundKind))].map(kind=>recipes.find(r=>r.backgroundKind===kind))
for(const r of (requested?[]:recipes.filter(r=>r.nativeTitle)))if(!families.includes(r))families.push(r)
for(const r of [...selected,...families.filter(r=>!selected.includes(r))]){
 const document=newVideoFromTemplate(r.id);document.brand=source.brand;document.offers=source.offers;document.validity='20 A 27/09/2026'
 await copyFile('public/video-studio/audio/'+r.music+'.mp3',dir+'/music.mp3')
 const scenes=buildVideoTimeline(document),media=Object.fromEntries(ids.map(id=>[id,id+'.png']))
 for(const format of ['vertical','horizontal']){
  const props={document,label:resolveVideoLabel(labels,r.id),format,media,scenes,music:'music.mp3'}
  if(selected.includes(r)){
   const file=r.id+'-'+format+'-entry.mp4';await renderVideo(props,dir,dir+'/'+file,()=>{},{frameRange:[scenes[1].from-6,scenes[1].from+36]});results.push({id:r.id,name:r.name,format,kind:'motion',file,transition:r.transition,product:r.motion.product,price:r.motion.price});console.log('CLIP',r.name,format);await renderVideo(props,dir,dir+'/'+r.id+'-'+format+'-intro.mp4',()=>{},{frameRange:[0,55]})
  }
  if(true)for(const [kind,frame] of [['intro',16],...(format==='horizontal'?[['intro-logo',Math.floor(scenes[1].from*.48)+15]]:[]),['outro',scenes.at(-1).from+40]]){
   const file=r.id+'-'+format+'-'+kind+'.png';await renderVideo(props,dir,dir+'/'+file,()=>{},{frame,scale:.35});results.push({id:r.id,name:r.name,format,kind,file});console.log('FRAME',kind,r.name,format)
  }
  await writeFile(dir+'/results.json',JSON.stringify(results,null,2))
 }
}
console.log('COMPLETE',results.length)
