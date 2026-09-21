import {register} from 'tsx/esm/api';register()
import {readFile,cp,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {renderVideo,root} from './engine.mjs'
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const dir=join(root,'output/video-studio-impact'),doc=JSON.parse(await readFile(join(dir,'showcase-project.json'),'utf8')).document
const media=Object.fromEntries([doc.brand.logo,...doc.offers.map(o=>o.image)].filter(Boolean).map(id=>[id,id+'.png']))
for(const name of ['energy','impact','whoosh'])await cp(join(root,'public/video-studio/audio',name+'.mp3'),join(dir,name+'.mp3'))
doc.voice.enabled=false;doc.layoutVersion=2;doc.duplicateProducts=true;doc.brand.logoStyle='sticker';doc.effects=['zoom','smoke','embers','glow','rays','pulse'];const scenes=buildVideoTimeline(doc)
for(const format of ['vertical','horizontal']){const props={document:doc,media,scenes,format,music:'music.mp3',impact:'impact.mp3',whoosh:'whoosh.mp3'}
 if(process.argv.includes('--stills')){for(const [name,frame] of [['opening',30],['offer',100],['ending',scenes.at(-1).from+40]]){await renderVideo(props,dir,join(dir,'showcase-'+format+'-'+name+'.png'),()=>{},{frame,scale:.7});console.log(format,name)}}
 else{await renderVideo(props,dir,join(dir,'showcase-'+format+'.mp4'),p=>{});console.log(format,'render complete')}
}
await writeFile(join(dir,'timeline.json'),JSON.stringify(scenes,null,2))
