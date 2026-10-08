// Demonstração dos efeitos desenhados: modelo pronto + combinação escolhida, MP4 e quadros-chave.
// Uso: node workers/video-studio/drawn-fx-fixture.mjs <pasta> <modelo> <combinação> <formato> <imagens...>
import {register} from 'tsx/esm/api';register()
import {mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import sharp from 'sharp'
import {renderVideo} from './engine.mjs'
const [dir,theme='alerta',presetId='cartoon-boom',format='vertical',...images]=process.argv.slice(2)
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const {newVideoFromTemplate}=await import('../../shared/video-studio/templates.ts')
const {MOTION_PRESETS}=await import('../../shared/video-studio/effect-catalog.ts')
await mkdir(dir,{recursive:true})
const doc=newVideoFromTemplate(theme),preset=MOTION_PRESETS.find(p=>p.id===presetId)
if(preset)Object.assign(doc,{motion:structuredClone(preset.motion),transition:preset.transition})
const names=['Picanha Bovina kg','Cerveja Lata 350 ml','Café Torrado 500 g'],prices=['59,90','3,49','17,99'],media={}
doc.offers=images.slice(0,3).map((file,i)=>{const id=randomUUID();media[id]=id+'.png';return {id,name:names[i],price:prices[i],unit:i?'un':'kg',condition:'',image:id}})
for(const [id,file] of Object.entries(media))await sharp(resolve(images[Object.keys(media).indexOf(id)])).png().toFile(join(dir,file))
doc.voice={...doc.voice,enabled:false};doc.variationSeed=11
const scenes=buildVideoTimeline(doc),props={document:doc,media,scenes,format}
await writeFile(join(dir,'document.json'),JSON.stringify({motion:doc.motion,transition:doc.transition,scenes},null,1))
await renderVideo(props,dir,join(dir,`${theme}-${presetId}-${format}.mp4`),p=>process.stdout.write(`\r${Math.round(p*100)}%`))
console.log('\nok',join(dir,`${theme}-${presetId}-${format}.mp4`))
