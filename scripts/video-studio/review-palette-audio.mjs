// Prévia curta da correção; não altera os MP4s já publicados.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {register} from '../../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
import {renderVideo} from '../../workers/video-studio/engine.mjs'
register()
const {newVideoFromTemplate}=await import('../../shared/video-studio/templates.ts')
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const {resolveVideoLabel}=await import('../../shared/video-studio/labels.ts')
const dir=resolve('output/video-all-models/palette-audio-v19');await mkdir(dir,{recursive:true})
const source=JSON.parse(await readFile('output/video-studio-impact/template-demo-source.json')).project.document
const labels=JSON.parse(await readFile('output/video-flyer-models/labels.json')).items
const document=newVideoFromTemplate('flyer-ea0d0789-3081-409c-b830-10739806b065')
document.brand=source.brand;document.offers=source.offers;document.validity=source.validity||''
// Música deliberadamente separada nesta revisão dos efeitos; aguarda referência do usuário.
document.audio.music='none'
const ids=[document.brand.logo,...document.offers.map(o=>o.image)]
for(const id of ids)await copyFile('output/video-studio-impact/'+id+'.png',dir+'/'+id+'.png')
const scenes=buildVideoTimeline(document),media=Object.fromEntries(ids.map(id=>[id,id+'.png']))
for(const format of ['vertical','horizontal']){
 const props={document,label:resolveVideoLabel(labels,document.theme),format,media,scenes}
 const output=dir+'/semana-cliente-'+format+'.mp4'
 await renderVideo(props,dir,output,()=>{},{frameRange:[0,scenes[1].from+65],scale:.5})
 console.log(output)
}
await writeFile(dir+'/document.json',JSON.stringify(document,null,2))
