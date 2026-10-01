import {assertFlyerGallerySourceKey} from './lib/flyer-gallery-source-policy.mjs'
// Miniaturas neutras da biblioteca: render offline, sem alterar modelos ou banco.
import {register} from '../workers/video-studio/node_modules/tsx/dist/esm/api/index.mjs'
register({tsconfig:".nuxt/tsconfig.app.json"})
import pg from 'pg'
import sharp from 'sharp'
import {StaticCanvas,getEnv} from 'fabric/node'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {S3Client,GetObjectCommand,PutObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3'
const {prepareNeutralFlyerCanvas}=await import('../utils/flyerGalleryPreview.ts')
const {generateThumbnailFromCanvasJson}=await import('../utils/editorThumbnail.ts')
const {buildFlyerTemplateConfigFromPages,inferFormatIdFromPage,orderFlyerTemplatePages}=await import('../utils/flyerTemplateApi.ts')
const apply=process.argv.includes('--upload'),limit=Number(process.argv.find(x=>x.startsWith('--limit='))?.split('=')[1]||0)
const manifestPath='server/data/flyer-gallery-previews.json',output='output/flyer-gallery-previews'
await mkdir('server/data',{recursive:true});await mkdir(output,{recursive:true})
globalThis.document=getEnv().document
const require=createRequire(import.meta.url)
const {registerFont}=require('canvas')
for(const file of await readdir('public/art-studio/fonts'))if(/\.ttf$/i.test(file)){
 const stem=file.replace(/\.ttf$/i,''),parts=stem.split('-');const variant=parts.pop();
 registerFont('public/art-studio/fonts/'+file,{family:parts.join('-'),weight:/ExtraBold/i.test(variant)?'800':/SemiBold/i.test(variant)?'600':/Bold/i.test(variant)?'700':'400',style:/Italic/i.test(variant)?'italic':'normal'})
}
const bucket=process.env.WASABI_BUCKET
const s3=new S3Client({endpoint:'https://'+process.env.WASABI_ENDPOINT.replace(/^https?:\/\//,''),region:process.env.WASABI_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.WASABI_ACCESS_KEY,secretAccessKey:process.env.WASABI_SECRET_KEY}})
const assetCache=new Map()
const readAsset=key=>{if(!assetCache.has(key))assetCache.set(key,s3.send(new GetObjectCommand({Bucket:bucket,Key:key})).then(async r=>Buffer.from(await r.Body.transformToByteArray())));return assetCache.get(key)}
const keyOf=value=>{const str=String(value||'');if(str.startsWith('/api/storage/'))return new URL(str,'http://local').searchParams.get('key');if(/^https?:/.test(str)){const u=new URL(str);if(u.searchParams.has('key'))return u.searchParams.get('key');const host=new URL('https://'+process.env.WASABI_ENDPOINT.replace(/^https?:\/\//,'')).hostname;if(u.hostname!==host&&!u.hostname.endsWith('.'+host))throw Error('Fonte externa não permitida: '+u.hostname);return decodeURIComponent(u.pathname).replace(/^\//,'').replace(bucket+'/','')}return str}
async function prepareImages(node,ownerId){
 if(!node||typeof node!=='object')return
 delete node.clipPath
 if(String(node.type||'').toLowerCase()==='image'&&node.src){
  let bytes
  if(!node.src.startsWith('data:'))bytes=await readAsset(assertFlyerGallerySourceKey(keyOf(node.src),ownerId))
  else if(/^data:image\/(?:webp|avif);base64,/.test(node.src))bytes=Buffer.from(node.src.split(',')[1],'base64')
  if(bytes){
   const meta=await sharp(bytes).metadata()
   // node-canvas decodes PNG/JPEG; WebP is converted without changing pixels/geometry.
   const supported=['png','jpeg','gif','svg'].includes(meta.format)
   const encoded=supported?bytes:await sharp(bytes).png({compressionLevel:1}).toBuffer()
   const format=supported?(meta.format==='svg'?'svg+xml':meta.format):'png'
   node.src='data:image/'+format+';base64,'+encoded.toString('base64')
   delete node.__originalSrc
  }
 }
 await Promise.all(Object.values(node).filter(v=>v&&typeof v==='object').map(async v=>{
  if(Array.isArray(v))await Promise.all(v.map(item=>prepareImages(item,ownerId)))
  else await prepareImages(v,ownerId)
 }))
}

const c=new pg.Client({connectionString:process.env.POSTGRES_DATABASE_URL});await c.connect();const{rows}=await c.query(`select p.id,p.user_id,p.name,p.updated_at,p.canvas_data,p.template_config from public.projects p join public.profiles owner on owner.id=p.user_id where p.is_template=true and owner.role in ('admin','super_admin') order by p.id`);await c.end(); const selectedIds=new Set(["4ac789c8-71f4-4a8b-96ae-8d9e703f0282","f6dcbbe6-f9b1-4d09-8e21-31fe305cbbe5","1a014da8-d0f0-483b-b56c-cf8f3a49a40b","1c9b7763-fa63-436b-9f2d-dfe1875ed04d","78be56e6-beee-4095-adcb-871ef579c199","15edbe91-acc8-4d49-9f0e-e61992c07421","4a578d49-087d-4922-a9f6-9f2376c099cc","d840b59b-6b17-4897-a7c3-9c312c756e4d","e6b1d002-8bc2-4d6c-9678-6840f7f169a3","76386259-0a88-439e-b20e-b658acdff2a8","d90ab0ad-ac4b-40db-8fea-f4bc77801480","df643073-16d3-4c30-9417-883bb287ff7c"]);rows.splice(0,rows.length,...rows.filter(p=>selectedIds.has(p.id)))
let previous={version:1,assets:{}};try{previous=JSON.parse(await readFile(manifestPath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const manifest={version:1,assets:{...previous.assets}},metrics=[]
let completed=0
let checkpoint=Promise.resolve()
async function processProject(project){
 const revision=project.updated_at.toISOString(),old=previous.assets[project.id]
 const start=performance.now();const pages=Array.isArray(project.canvas_data)?project.canvas_data:project.canvas_data?.pages||[]
 const config=buildFlyerTemplateConfigFromPages(project.template_config,pages,project.id),ordered=orderFlyerTemplatePages(pages,config)
 const page=ordered.find(p=>p.templateModelId===config.defaultModelId&&inferFormatIdFromPage(p)===config.defaultFormatId)||ordered[0]
 if(!page)throw Error('Modelo sem página '+project.id)
 let canvas=page.canvasData;if(!canvas){const b=await readAsset(assertFlyerGallerySourceKey(keyOf(page.canvasDataPath),project.user_id));canvas=JSON.parse(b[0]===31&&b[1]===139?gunzipSync(b):b)}
 const neutral=prepareNeutralFlyerCanvas(canvas)
 // Validate every source even when reusing a previously prepared thumbnail.
 const validate=node=>{if(!node||typeof node!=='object')return;if(String(node.type||'').toLowerCase()==='image'&&node.src&&!node.src.startsWith('data:'))assertFlyerGallerySourceKey(keyOf(node.src),project.user_id);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(validate);else if(value&&typeof value==='object')validate(value)}}
 validate(neutral)
 if(apply&&old?.revision===revision&&old.sourcePolicyVersion===1){const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:old.key}));if(head.ContentLength!==old.bytes||head.Metadata?.sha256!==old.sha256)throw Error('Catálogo remoto adulterado');manifest.assets[project.id]=old;completed++;return}
 canvas=neutral;await prepareImages(canvas,project.user_id)
 const image=await generateThumbnailFromCanvasJson({sourceJson:canvas,staticCanvasCtor:StaticCanvas,pageWidth:page.width,pageHeight:page.height})
 if(!image)throw Error('Falha de render '+project.id)
 const bytes=await sharp(Buffer.from(image.split(',')[1],'base64')).webp({quality:76}).toBuffer(),sha256=createHash('sha256').update(bytes).digest('hex'),key='imagens/catalogo-encartes/'+sha256+'.webp'
 await writeFile(output+'/'+project.id+'.webp',bytes)
 if(apply){await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:'image/webp',ContentMD5:createHash('md5').update(bytes).digest('base64'),Metadata:{sha256},CacheControl:'public,max-age=31536000,immutable'}));const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:key}));if(head.ContentLength!==bytes.length||head.Metadata?.sha256!==sha256)throw Error('Upload não confirmado '+project.id)}
 manifest.assets[project.id]={revision,key,sha256,bytes:bytes.length,sourcePolicyVersion:1};const metric={id:project.id,bytes:bytes.length,prepareMs:Math.round(performance.now()-start)};metrics.push(metric)
 completed++
 if(apply&&!limit){const snapshot=JSON.stringify(manifest,null,2)+'\n';checkpoint=checkpoint.then(async()=>{await writeFile(manifestPath+'.tmp',snapshot);await rename(manifestPath+'.tmp',manifestPath)});await checkpoint}
 console.log(JSON.stringify({completed,total:limit||rows.length,...metric}))
}
const selected=limit?rows.slice(0,limit):rows
for(let i=0;i<selected.length;i+=4){await Promise.all(selected.slice(i,i+4).map(processProject));globalThis.gc?.()}
if(!limit){const ids=new Set(rows.map(p=>p.id));for(const id of Object.keys(manifest.assets))if(!ids.has(id))delete manifest.assets[id]}
if(apply&&!limit)await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n')
await writeFile(output+'/metrics.json',JSON.stringify(metrics,null,2))
console.log(JSON.stringify({mode:apply?'uploaded':'local-review',count:Object.keys(manifest.assets).length,totalBytes:Object.values(manifest.assets).reduce((n,a)=>n+a.bytes,0)}))
