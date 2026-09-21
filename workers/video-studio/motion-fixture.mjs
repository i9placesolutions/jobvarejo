import {register} from 'tsx/esm/api';register()
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {renderVideo,root} from './engine.mjs'
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const dir=join(root,'output/video-studio-impact'),doc=JSON.parse(await readFile(join(dir,'showcase-project.json'),'utf8')).document
const media=Object.fromEntries([doc.brand.logo,...doc.offers.map(o=>o.image)].filter(Boolean).map(id=>[id,id+'.png']))
doc.voice.enabled=false;doc.effects=['zoom','shake','smoke','embers','glow','rays','pulse'];doc.intensity=.85
const scenes=buildVideoTimeline(doc)
for(const format of ['vertical','horizontal']){
 const props={document:doc,media,scenes,format}
 for(const [name,frame] of [['entry-2',scenes[2].from+2],['entry-5',scenes[2].from+5],['offer',scenes[2].from+20]]){
  await renderVideo(props,dir,join(dir,'motion-'+format+'-'+name+'.png'),()=>{},{frame,scale:.6});console.log(format,name)
 }
}
