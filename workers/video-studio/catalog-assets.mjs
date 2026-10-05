import {createHash, randomUUID} from 'node:crypto'
import {createReadStream, createWriteStream} from 'node:fs'
import {mkdir, readFile, rename, rm, stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join, resolve, sep} from 'node:path'
import {Transform} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {GetObjectCommand,S3Client} from '@aws-sdk/client-s3'

const SHA256=/^[a-f0-9]{64}$/
const safeRelativePath=(value)=>typeof value==='string'&&value.length>0&&!value.includes('\\')&&!value.split('/').some(part=>!part||part==='.'||part==='..')
let environmentStorage
const manifestCache=new Map(),verifiedCache=new Map()
const cfg=(name)=>process.env[name]||process.env[`NUXT_${name}`]||''

export function getCatalogStorage(){
 if(environmentStorage)return environmentStorage
 const endpoint=cfg('WASABI_ENDPOINT').replace(/^https?:\/\//,'')
 const accessKeyId=cfg('WASABI_ACCESS_KEY'),secretAccessKey=cfg('WASABI_SECRET_KEY')
 if(!endpoint||!accessKeyId||!secretAccessKey)throw Error('Storage de assets do vídeo não está configurado.')
 environmentStorage={
  s3:new S3Client({endpoint:`https://${endpoint}`,region:cfg('WASABI_REGION')||'us-east-1',credentials:{accessKeyId,secretAccessKey},forcePathStyle:true}),
  bucket:cfg('WASABI_BUCKET')||'jobvarejo',
 }
 return environmentStorage
}

export async function readCatalogManifest(path){
 if(!manifestCache.has(path))manifestCache.set(path,(async()=>{
  const manifest=JSON.parse(await readFile(path,'utf8'))
  if(manifest?.version!==1||!manifest.assets||typeof manifest.assets!=='object')throw Error('Catálogo de assets do vídeo inválido.')
  return manifest
 })().catch(error=>{manifestCache.delete(path);throw error}))
 return manifestCache.get(path)
}

export async function resolveCatalogAsset(relativePath,options={}){
 if(!safeRelativePath(relativePath))throw Error('Caminho de asset do catálogo inválido.')
 const {root=process.cwd(),cacheDir=join(tmpdir(),'jobvarejo-video-studio-catalog'),manifest,manifestPath=join(root,'shared/video-studio/catalog-assets.json')}=options
 const storage=options.s3&&options.bucket?options:getCatalogStorage(),{s3,bucket}=storage
 const catalog=manifest||await readCatalogManifest(manifestPath),entry=catalog.assets?.[relativePath]
 if(!entry||!SHA256.test(entry.sha256)||entry.key!==`video-studio/catalog/${entry.sha256}/${relativePath}`||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||typeof entry.contentType!=='string')throw Error(`Asset ausente ou inválido no catálogo: ${relativePath}`)
 const file=join(cacheDir,entry.sha256)
 const isValid=async()=>{
  try{
   const info=await stat(file)
   if(!info.isFile()||info.size!==entry.bytes)return false
   const previous=verifiedCache.get(file)
   if(previous?.size===info.size&&previous.mtimeMs===info.mtimeMs)return true
   const hash=createHash('sha256')
   await pipeline(createReadStream(file),new Transform({transform(chunk,_encoding,callback){hash.update(chunk);callback()}}))
   if(hash.digest('hex')!==entry.sha256)return false
   verifiedCache.set(file,{size:info.size,mtimeMs:info.mtimeMs})
   return true
  }catch{return false}
 }
 if(await isValid())return file
 await mkdir(cacheDir,{recursive:true})
 const temporary=`${file}.${process.pid}.${randomUUID()}.part`
 try{
  const response=await s3.send(new GetObjectCommand({Bucket:bucket,Key:entry.key}))
  if(!response.Body)throw Error(`Download vazio do catálogo: ${relativePath}`)
  const hash=createHash('sha256');let bytes=0
  const verifier=new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;hash.update(chunk);callback(null,chunk)}})
  await pipeline(response.Body,verifier,createWriteStream(temporary,{flags:'wx'}))
  if(bytes!==entry.bytes||hash.digest('hex')!==entry.sha256)throw Error(`Integridade inválida no asset do catálogo: ${relativePath}`)
  await rename(temporary,file)
  const info=await stat(file);verifiedCache.set(file,{size:info.size,mtimeMs:info.mtimeMs})
  return file
 }catch(error){await rm(temporary,{force:true});throw error}
}

export async function copyCatalogAsset(relativePath,target,options){
 const source=await resolveCatalogAsset(relativePath,options),destination=resolve(target),base=resolve(options?.jobDir||dirname(destination))
 if(destination!==base&&!destination.startsWith(base+sep))throw Error('Destino de asset do catálogo fora da pasta do job.')
 await mkdir(dirname(destination),{recursive:true})
 const {copyFile}=await import('node:fs/promises')
 await copyFile(source,destination)
 return destination
}

export function selectCatalogSoundAssets(document,format='vertical',{showcase=false,flyerCues=[]}={}){
 const assets=new Set()
 if(document?.motion){
  for(const id of [document.motion.transitionSound,document.motion.accentSound])if(id)assets.add(`audio/sfx/${id}.wav`)
 }
 if(document?.audio?.sounds&&(showcase||document.audio.effectsVolume>0)){
  if(showcase){
   for(const id of ['air-swipe','snap','boom','metal-hit','sparkle'])assets.add(`audio/sfx/${id}.wav`)
   if(format==='horizontal')for(const id of ['air-swipe','bass-hit'])assets.add(`audio/sfx/${id}.wav`)
  }
 }
 for(const cue of flyerCues)if(cue?.sound)assets.add(`audio/sfx/${cue.sound}.wav`)
 return [...assets]
}

export function selectCatalogTemplateAssets(document,format,{recipe,backgroundAsset}={}){
 const assets=new Set()
 const spriteAssets={
  'sprite-sparks':'spark','sprite-smoke':'smoke','sprite-flare':'flare',
  'sprite-stars':'star','sprite-rings':'ring','sprite-lightning':'lightning',
  'sprite-fire':'fire','sprite-dust':'dust','sprite-vortex':'vortex',
 }
 for(const effect of document?.motion?.atmosphere||[]){
  const sprite=spriteAssets[effect]
  if(sprite)assets.add(`templates/effects/kenney-${sprite}.png`)
 }
 if(recipe){
  const chosen=document?.background
  const energy=chosen&&backgroundAsset?backgroundAsset(chosen,format):format==='vertical'?(recipe.energyBackgroundVertical||recipe.energyBackground):recipe.energyBackground
  const background=chosen?undefined:format==='horizontal'?(recipe.backgroundHorizontal||recipe.background):recipe.background
  for(const asset of [background,chosen?undefined:recipe.backgroundVideo,energy,recipe.seal,recipe.mascot])if(asset)assets.add(`templates/${asset}`)
  const referenceSource=recipe.referenceArtwork?.src
  if(typeof referenceSource==='string'&&referenceSource.startsWith('/video-studio/templates/'))assets.add(referenceSource.slice('/video-studio/'.length))
  if(document?.effects?.includes('fire')||document?.effects?.includes('smoke'))assets.add('templates/impact-fire-v2.png')
  if(document?.effects?.includes('fire')||document?.effects?.includes('fire-jets'))assets.add('templates/retail-fire-curtain-v1.png')
 }else{
  if(document?.background&&backgroundAsset)assets.add(`templates/${backgroundAsset(document.background,format)}`)
  if(document?.theme==='impact')assets.add('templates/fecha-mes-stage-v1.png')
  if(document?.campaign?.trim().toLocaleUpperCase('pt-BR')==='FECHA MÊS'){
   assets.add('templates/fecha-mes-badge-v1.png')
   if(document?.layoutVersion===2)assets.add('templates/fecha-mes-emerald-v2.png')
  }
  if(document?.effects?.includes('fire')||document?.effects?.includes('smoke'))assets.add('templates/impact-fire-v2.png')
  if(document?.effects?.includes('fire')||document?.effects?.includes('fire-jets'))assets.add('templates/retail-fire-curtain-v1.png')
 }
 return [...assets]
}
