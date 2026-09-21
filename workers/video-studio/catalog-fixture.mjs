import {register} from 'tsx/esm/api';register()
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {renderVideo,root} from './engine.mjs'
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const {MOTION_PRESETS}=await import('../../shared/video-studio/effect-catalog.ts')
const dir=join(root,'output/video-studio-impact'),base=JSON.parse(await readFile(join(dir,'showcase-project.json'),'utf8')).document
const media=Object.fromEntries([base.brand.logo,...base.offers.map(o=>o.image)].filter(Boolean).map(id=>[id,id+'.png']))
const result=[]
for(const preset of MOTION_PRESETS){
 const doc={...base,motion:preset.motion,transition:preset.transition,voice:{...base.voice,enabled:false}},scenes=buildVideoTimeline(doc)
 for(const format of (preset.id==='pressure'?['vertical','horizontal']:['vertical'])){
  const props={document:doc,media,scenes,format}
  const file=join(dir,'catalog-'+preset.id+'-'+format+'.png')
  await renderVideo(props,dir,file,()=>{},{frame:scenes[2].from+16,scale:.5});result.push({preset:preset.id,format,file});console.log(preset.id,format)
 }
}
await writeFile(join(dir,'catalog-stills.json'),JSON.stringify(result,null,2))
