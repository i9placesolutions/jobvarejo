import {register} from 'tsx/esm/api';register()
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {renderVideo,root} from './engine.mjs'
const dir=join(root,'output/video-studio-impact'),state=JSON.parse(await readFile(join(dir,'audio-logo-source.json'),'utf8'))
const document=state.project.document,scenes=state.voice.result.scenes,media=Object.fromEntries([document.brand.logo,...document.offers.map(o=>o.image)].map(id=>[id,id+'.png']))
for(const [format,name,frame] of [['vertical','opening',45],['horizontal','badge',25],['horizontal','logo',80],['vertical','product',135],['horizontal','product',135],['horizontal','ending',725]]){
 await renderVideo({document,scenes,media,format},dir,join(dir,`identity-${format}-${name}.png`),()=>{},{frame,scale:.65});console.log(format,name)
}
