import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {Readable} from 'node:stream'
import {mkdtemp,readFile,rm,writeFile,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {copyCatalogAsset,resolveCatalogAsset,selectCatalogSoundAssets,selectCatalogTemplateAssets} from './catalog-assets.mjs'

const entry=(path,bytes)=>{
 const sha256=createHash('sha256').update(bytes).digest('hex')
 return [path,{key:`video-studio/catalog/${sha256}/${path}`,sha256,bytes:bytes.length,contentType:'application/octet-stream'}]
}

test('catalog downloads once, reuses a validated cache file, and repairs a corrupt cache',async()=>{
 const cacheDir=await mkdtemp(join(tmpdir(),'video-catalog-test-')),bytes=Buffer.from('catalog asset bytes'),[path,item]=entry('audio/sfx/air-swipe.wav',bytes),manifest={version:1,assets:{[path]:item}
 },calls=[]
 const s3={async send(command){calls.push(command.input.Key);return {Body:Readable.from([bytes])}}}
 try{
  const options={s3,bucket:'bucket',cacheDir,manifest}
  const first=await resolveCatalogAsset(path,options)
  assert.equal(await readFile(first,'utf8'),bytes.toString())
  assert.equal(await resolveCatalogAsset(path,options),first)
  assert.equal(calls.length,1)
  await writeFile(first,'corrupt')
  const repaired=await resolveCatalogAsset(path,options)
  assert.equal(await readFile(repaired,'utf8'),bytes.toString())
  assert.equal(calls.length,2)
  assert.deepEqual(await readdir(cacheDir),[item.sha256])
 }finally{await rm(cacheDir,{recursive:true,force:true})}
})

test('catalog rejects bytes that do not match the manifest and leaves no partial files',async()=>{
 const cacheDir=await mkdtemp(join(tmpdir(),'video-catalog-test-')),expected=Buffer.from('expected'),actual=Buffer.from('tampered'),[path,item]=entry('templates/seal.png',expected)
 const s3={async send(){return {Body:Readable.from([actual])}}}
 try{
  await assert.rejects(resolveCatalogAsset(path,{s3,bucket:'bucket',cacheDir,manifest:{version:1,assets:{[path]:item}}}),/Integridade inválida/)
  assert.deepEqual(await readdir(cacheDir),[])
 }finally{await rm(cacheDir,{recursive:true,force:true})}
})

test('copy keeps catalog assets under the job directory',async()=>{
 const cacheDir=await mkdtemp(join(tmpdir(),'video-catalog-test-')),jobDir=join(cacheDir,'job'),bytes=Buffer.from('music'),[path,item]=entry('audio/upbeat.mp3',bytes)
 const s3={async send(){return {Body:Readable.from([bytes])}}}
 try{
  const target=await copyCatalogAsset(path,join(jobDir,'music.mp3'),{s3,bucket:'bucket',cacheDir,jobDir,manifest:{version:1,assets:{[path]:item}}})
  assert.equal(await readFile(target,'utf8'),'music')
  await assert.rejects(copyCatalogAsset(path,join(cacheDir,'outside.mp3'),{s3,bucket:'bucket',cacheDir,jobDir,manifest:{version:1,assets:{[path]:item}}}),/fora da pasta do job/)
 }finally{await rm(cacheDir,{recursive:true,force:true})}
})

test('direct renderer calls share one lazy Wasabi client from environment aliases',async()=>{
 const original=Object.fromEntries(['WASABI_ENDPOINT','WASABI_REGION','WASABI_BUCKET','WASABI_ACCESS_KEY','WASABI_SECRET_KEY','NUXT_WASABI_ENDPOINT','NUXT_WASABI_REGION','NUXT_WASABI_BUCKET','NUXT_WASABI_ACCESS_KEY','NUXT_WASABI_SECRET_KEY'].map(name=>[name,process.env[name]]))
 try{
  process.env.NUXT_WASABI_ENDPOINT='s3.us-east-2.wasabisys.com';process.env.NUXT_WASABI_REGION='us-east-2';process.env.NUXT_WASABI_BUCKET='catalog-test';process.env.NUXT_WASABI_ACCESS_KEY='test-key';process.env.NUXT_WASABI_SECRET_KEY='test-secret'
  const {getCatalogStorage}=await import('./catalog-assets.mjs')
  assert.equal(getCatalogStorage(),getCatalogStorage())
  assert.equal(getCatalogStorage().bucket,'catalog-test')
 }finally{
  for(const [name,value] of Object.entries(original)){if(value===undefined)delete process.env[name];else process.env[name]=value}
 }
})

test('SFX selection follows selected motions and adds only composition cues in use',()=>{
 const doc={templateRevision:20,motion:{transitionSound:'whip',accentSound:'coin'},audio:{sounds:true,effectsVolume:.3}}
 assert.deepEqual(selectCatalogSoundAssets(doc,'vertical',{flyerCues:[{sound:'suction'},{sound:'explosion-retail'}]}),['audio/sfx/whip.wav','audio/sfx/coin.wav','audio/sfx/suction.wav','audio/sfx/explosion-retail.wav'])
 assert.deepEqual(selectCatalogSoundAssets(doc,'horizontal',{showcase:true}),[
  'audio/sfx/whip.wav','audio/sfx/coin.wav','audio/sfx/air-swipe.wav','audio/sfx/snap.wav','audio/sfx/boom.wav','audio/sfx/metal-hit.wav','audio/sfx/sparkle.wav','audio/sfx/bass-hit.wav',
 ])
 assert.deepEqual(selectCatalogSoundAssets({...doc,audio:{sounds:false,effectsVolume:.3}},'vertical'),['audio/sfx/whip.wav','audio/sfx/coin.wav'])
})

test('template selection downloads only the active format/background and effects',()=>{
 const backgroundAsset=(id,format)=>`backgrounds/${id}${format==='vertical'?'-vertical':''}-v1.png`
 const recipe={background:'base.png',backgroundHorizontal:'wide.png',energyBackground:'energy.png',energyBackgroundVertical:'energy-v.png',seal:'seal.png',mascot:'mascot.png',backgroundVideo:'loop.mp4'}
 assert.deepEqual(selectCatalogTemplateAssets({background:'lava',effects:['fire']},'horizontal',{recipe,backgroundAsset}),[
  'templates/backgrounds/lava-v1.png','templates/seal.png','templates/mascot.png','templates/impact-fire-v2.png','templates/retail-fire-curtain-v1.png',
 ])
 assert.deepEqual(selectCatalogTemplateAssets({background:undefined,effects:['fire']},'vertical',{recipe,backgroundAsset}),[
  'templates/base.png','templates/loop.mp4','templates/energy-v.png','templates/seal.png','templates/mascot.png','templates/impact-fire-v2.png','templates/retail-fire-curtain-v1.png',
 ])
 assert.deepEqual(selectCatalogTemplateAssets({background:undefined,effects:[]},'vertical',{recipe:{...recipe,energyBackgroundVertical:undefined},backgroundAsset}),[
  'templates/base.png','templates/loop.mp4','templates/energy.png','templates/seal.png','templates/mascot.png',
 ])
})
