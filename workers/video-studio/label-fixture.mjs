import {register} from 'tsx/esm/api';register()
import {readFile,copyFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {renderVideo,root} from './engine.mjs'
import {resolveCatalogAsset} from './catalog-assets.mjs'
const {buildVideoTimeline}=await import('../../shared/video-studio/model.ts')
const dir=join(root,'output/video-studio-impact'),doc=JSON.parse(await readFile(join(dir,'document.json'),'utf8'))
const media=Object.fromEntries([doc.brand.logo,...doc.offers.map(o=>o.image)].filter(Boolean).map(id=>[id,id+'.png']))
for(const name of ['energy','impact','whoosh'])await copyFile(await resolveCatalogAsset(`audio/${name}.mp3`,{root}),join(dir,name+'.mp3'))
const scenes=buildVideoTimeline(doc)
const {adaptVideoLabel}=await import('../../shared/video-studio/labels.ts')
const rows=JSON.parse(await readFile(join(root,'output/video-studio-professional/labels.json'),'utf8'))
const row=(Array.isArray(rows)?rows:rows.templates).find(r=>r.id==='nz2bk9f8m');const label=adaptVideoLabel(row);if(!label)throw Error('Etiqueta indisponível')
await renderVideo({document:doc,media,scenes,format:'vertical',label},dir,join(dir,'registered-label.png'),()=>{},{frame:100,scale:.5})
console.log('registered label rendered')
