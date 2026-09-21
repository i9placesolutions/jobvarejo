// Verificação offline: arquivos sintéticos, sem MusicGPT ou dados de clientes.
import {register} from 'tsx/esm/api';register()
import {mkdir,writeFile,cp} from 'node:fs/promises'
import {join} from 'node:path'
import {renderVideo,root} from './engine.mjs'
const {newVideoDocument,buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const sharp=(await import('../../node_modules/sharp/lib/index.js')).default
const dir=join(root,'output/video-studio-validation');await mkdir(dir,{recursive:true})
const doc=newVideoDocument();doc.brand.name='Mercado Demonstração';doc.brand.address='Rua das Ofertas, 100';doc.validity='Demonstração · preços ilustrativos';doc.voice.enabled=false;doc.duration=15;doc.effects=['smoke','embers','shake','zoom','glow'];doc.offers=[{id:'00000000-0000-4000-8000-000000000001',name:'Café especial 500 g',price:'19,90',unit:'un',condition:'Imagem e preço ilustrativos',image:'coffee'}]
await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="800"><defs><linearGradient id="p"><stop stop-color="#263e2c"/><stop offset="1" stop-color="#0c1d12"/></linearGradient></defs><path fill="url(#p)" stroke="#768959" stroke-width="8" d="M160 80H540L570 720Q350 775 130 720Z"/><path fill="#b69555" d="M165 82H535V125H165Z"/><ellipse cx="350" cy="375" rx="145" ry="155" fill="#eee3c5"/><text x="350" y="350" text-anchor="middle" font-size="62" fill="#253e2c" font-family="sans-serif" font-weight="bold">CAFÉ</text><text x="350" y="406" text-anchor="middle" font-size="26" fill="#253e2c" font-family="sans-serif">ESPECIAL</text><text x="350" y="480" text-anchor="middle" font-size="32" fill="#253e2c" font-family="sans-serif">500 g</text></svg>')).png().toFile(join(dir,'coffee.png'))
for(const name of ['upbeat','whoosh','impact'])await cp(join(root,'public/video-studio/audio',name+'.mp3'),join(dir,name+'.mp3'))
const report=[]
for(const format of ['vertical','horizontal']){const props={document:doc,scenes:buildVideoTimeline(doc),media:{coffee:'coffee.png'},format,music:'upbeat.mp3',impact:'impact.mp3',whoosh:'whoosh.mp3'};const out=join(dir,format+'.mp4');let mark=-1;const info=await renderVideo(props,dir,out,p=>{const n=Math.floor(p*4);if(n>mark){mark=n;console.log(format,Math.round(p*100)+'%')}});report.push({format,path:out,info})}
await writeFile(join(dir,'report.json'),JSON.stringify(report,null,2));console.log('Render verification complete')
