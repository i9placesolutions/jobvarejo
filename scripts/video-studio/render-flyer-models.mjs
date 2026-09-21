import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {register} from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
import {renderVideo} from '../../workers/video-studio/engine.mjs'
register()
const {newVideoFromTemplate}=await import('../../shared/video-studio/templates.ts')
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const {resolveVideoLabel}=await import('../../shared/video-studio/labels.ts')
const labels=JSON.parse(await readFile('output/video-flyer-models/labels.json','utf8')).items
const dir=resolve('output/video-flyer-models');await mkdir(dir,{recursive:true})
const source=JSON.parse(await readFile('output/video-studio-impact/template-demo-source.json','utf8')).project.document
for(const id of [source.brand.logo,...source.offers.map(o=>o.image)])await copyFile('output/video-studio-impact/'+id+'.png',dir+'/'+id+'.png')
for(const music of ['retail-drive','retail-bounce'])await copyFile('public/video-studio/audio/'+music+'.mp3',dir+'/'+music+'.mp3')
for(const id of ['alerta','relampago','saldao']){
 const document=newVideoFromTemplate(id);document.title=document.campaign+' — Demonstração';document.brand=source.brand;document.offers=source.offers;document.validity='20 A 27/09/2026';document.audio.musicVolume=.5;document.audio.effectsVolume=.7
 const media=Object.fromEntries([document.brand.logo,...document.offers.map(o=>o.image)].map(id=>[id,id+'.png']))
 for(const format of ['vertical','horizontal']){
  const props={document,label:resolveVideoLabel(labels,id),format,media,scenes:buildVideoTimeline(document),music:document.audio.music+'.mp3'}
  await writeFile(dir+'/'+id+'-'+format+'.json',JSON.stringify(props,null,2))
  const frames=process.argv.includes('--all-stills')?[20,44,65,73,115,265,415,550]:[115]
  for(const frame of frames){await renderVideo(props,dir,dir+'/'+id+'-'+format+'-'+frame+'.png',()=>{},{frame,scale:.5});console.log(id,format,'frame',frame)}
  if(process.argv.includes('--render')){await renderVideo(props,dir,dir+'/'+id+'-'+format+'.mp4',p=>{if(Math.floor(p*100)%20===0)console.log(id,format,Math.round(p*100))});console.log(id,format,'ready')}
 }
}
