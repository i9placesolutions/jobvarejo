import {register} from 'tsx/esm/api';register()
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {renderVideo,root} from './engine.mjs'
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const dir=join(root,'output/video-studio-impact'),doc=JSON.parse(await readFile(join(dir,'showcase-project.json'),'utf8')).document
const media=Object.fromEntries([doc.brand.logo,...doc.offers.map(o=>o.image)].filter(Boolean).map(id=>[id,id+'.png']))
doc.voice.enabled=false;doc.brand.logoStyle='clean'
await renderVideo({document:doc,media,scenes:buildVideoTimeline(doc),format:'vertical'},dir,join(dir,'showcase-clean-logo.png'),()=>{},{frame:30,scale:.4})
