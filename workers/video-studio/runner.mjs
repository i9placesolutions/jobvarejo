import { register } from 'tsx/esm/api'
register()
const {readVideoJsonParts}=await import('../../shared/video-studio/read-json-parts.ts')
const {isBuiltinMusic}=await import('../../shared/video-studio/effect-catalog.ts')
const {buildVideoTimeline,videoAudioIdentity}=await import('../../shared/video-studio/model.ts')
import pg from 'pg'
import { S3Client,GetObjectCommand,PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID,createHash } from 'node:crypto'
import { readFile,writeFile,mkdtemp,rm,cp } from 'node:fs/promises'
import { tmpdir,hostname } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { renderVideo,probe,root } from './engine.mjs'
import { createVideoCover } from './cover.mjs'
import { renewVideoLease } from './lease.mjs'
import { requestVideoAudio } from './provider.mjs'
import {PACING_VERSION,tightenVoicePauses} from './voice-pacing.mjs'
import {fullVoiceText,analyzeVoiceBoundaries,voiceUsage} from './full-voice.mjs'
import {withRetailMusicDirection} from '../../shared/musicgpt-retail.mjs'
import {createElevenClone,createRetailSpeech,elevenCloneName,ELEVEN_RETAIL_MODEL} from '../../shared/elevenlabs-retail.mjs'
const {fullVoiceTimeline}=await import('../../shared/video-studio/full-voice.ts')
import {speechReadinessIssue} from '../../shared/video-studio/speech-readiness.mjs'
const pool=new pg.Pool({connectionString:process.env.POSTGRES_DATABASE_URL,max:3})
const cfg=(name)=>process.env[name]||process.env['NUXT_'+name]||''
const endpoint=cfg('WASABI_ENDPOINT').replace(/^https?:\/\//,'')
const s3=new S3Client({endpoint:`https://${endpoint}`,region:cfg('WASABI_REGION')||'us-east-1',credentials:{accessKeyId:cfg('WASABI_ACCESS_KEY'),secretAccessKey:cfg('WASABI_SECRET_KEY')},forcePathStyle:true})
const bucket=cfg('WASABI_BUCKET')||'jobvarejo',workerId=`${hostname()}:${process.pid}`
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const SPEECH_VERSION=3
let stopping=false
process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true})
async function touch(){await pool.query('INSERT INTO public.video_studio_workers(id,heartbeat_at) VALUES($1,now()) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()',[workerId])}
async function normalize(doc){return new Promise((resolve,reject)=>{const p=spawn(process.env.VIDEO_STUDIO_PYTHON||'python3',[join(root,'workers/video-studio/normalize.py')]);let out='',err='';const timer=setTimeout(()=>p.kill(),10000);p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>{clearTimeout(timer);if(code)return reject(Error('Não foi possível preparar o texto da locução.'));try{resolve(JSON.parse(out).scripts)}catch{reject(Error('Resposta de normalização inválida.'))}});p.stdin.end(JSON.stringify({scripts:doc.scripts,pronunciations:doc.voice.pronunciations}))})}
async function claim(){await pool.query("UPDATE public.video_studio_jobs SET status='failed',error='A geração foi interrompida repetidamente. Contate o suporte.',updated_at=now() WHERE status='running' AND lease_until < now() AND attempts>=3");const claimed=(await pool.query(`WITH candidate AS (SELECT id FROM public.video_studio_jobs WHERE status='queued' OR (status='running' AND lease_until<now() AND attempts<3) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE public.video_studio_jobs j SET status='running',lease_token=$1,lease_until=now()+interval '90 seconds',attempts=attempts+1,updated_at=now() FROM candidate c WHERE j.id=c.id RETURNING j.id,j.lease_token`,[randomUUID()])).rows[0];if(!claimed)return;const timer=setInterval(()=>renewVideoLease(pool,claimed),20000);try{return await readVideoJsonParts(pool.query.bind(pool),'SELECT row_to_json(j) data FROM video_studio_jobs j WHERE id=$1 AND lease_token=$2',[claimed.id,claimed.lease_token])}finally{clearInterval(timer)}}
async function checkpoint(job,state,progress){const r=await pool.query("UPDATE public.video_studio_jobs SET provider_state=$1::jsonb,progress=GREATEST(progress,$2),updated_at=now() WHERE id=$3 AND lease_token=$4 AND status='running'",[JSON.stringify(state),progress,job.id,job.lease_token]);if(!r.rowCount)throw Error('A geração foi retomada por outro processo.');job.provider_state=state}
async function store(job,kind,name,bytes,type,ext,duration,metadata={}){const id=randomUUID(),key=`video-studio/${job.user_id}/assets/${id}.${ext}`;await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:type}));await pool.query('INSERT INTO public.video_studio_assets(id,user_id,kind,name,storage_key,content_type,bytes,duration,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',[id,job.user_id,kind,name,key,type,bytes.length,duration,JSON.stringify(metadata)]);return {id,duration}}
async function assetFile(id,userId,dir){const r=(await pool.query('SELECT * FROM public.video_studio_assets WHERE id=$1 AND user_id=$2',[id,userId])).rows[0];if(!r||!r.storage_key.startsWith(`video-studio/${userId}/`))throw Error('Arquivo não disponível nesta conta.');const name=`${id}.${r.kind==='image'?'png':'mp3'}`,file=join(dir,name);const response=await s3.send(new GetObjectCommand({Bucket:bucket,Key:r.storage_key}));if(Number(response.ContentLength)>150*1024*1024)throw Error('Arquivo muito grande.');await writeFile(file,Buffer.from(await response.Body.transformToByteArray()));return {name,file,row:r}}
async function ensureElevenVoice(job,voice){
 const key=cfg('ELEVENLABS_API_KEY')
 if(!key)throw Error('Configure ELEVENLABS_API_KEY no servidor para gerar a locução.')
 if(!voice?.profileId)throw Error('Selecione uma voz autorizada para a locução.')
 const client=await pool.connect()
 try{
  await client.query('SELECT pg_advisory_lock(hashtext($1))',[`elevenlabs:${voice.profileId}`])
  const row=(await client.query("SELECT name,sample_storage_key,sample_content_type,metadata FROM public.radio_voice_profiles WHERE id=$1 AND user_id=$2 AND status='active' AND consent_status='confirmed'",[voice.profileId,job.user_id])).rows[0]
  if(!row||!row.sample_storage_key?.startsWith(`radio-indoor/voices/${job.user_id}/`))throw Error('A amostra de voz não está mais disponível nesta conta.')
  const response=await s3.send(new GetObjectCommand({Bucket:bucket,Key:row.sample_storage_key}))
  if(Number(response.ContentLength)>25*1024*1024)throw Error('A amostra de voz ultrapassa 25 MB.')
  const sample=Buffer.from(await response.Body.transformToByteArray())
  if(!sample.length||sample.length>25*1024*1024)throw Error('A amostra de voz é inválida.')
  const sha256=createHash('sha256').update(sample).digest('hex')
  if(row.metadata?.sourceSha256&&row.metadata.sourceSha256!==sha256)throw Error('A amostra de voz não coincide com o arquivo original.')
  if(row.metadata?.elevenLabsVoiceId&&row.metadata?.elevenLabsSampleSha256===sha256)return {voiceId:row.metadata.elevenLabsVoiceId,sampleSha256:sha256}
  if(job.provider_state?.['eleven-clone']?.sending)throw Error('A criação da voz teve resposta incerta. Verifique a conta ElevenLabs antes de repetir.')
  const name=elevenCloneName(voice.profileId,row.name,sha256)
  const result=await createElevenClone({apiKey:key,name,sample,filename:row.sample_storage_key.split('/').at(-1)||'voice.mp3',mimeType:row.sample_content_type||'audio/mpeg',beforeCreate:async()=>{
   const state=job.provider_state||{}
   state['eleven-clone']={sending:true,name,sampleSha256:sha256}
   await checkpoint(job,state,5)
  }})
  const metadata={...row.metadata,elevenLabsVoiceId:result.voiceId,elevenLabsSampleSha256:sha256,elevenLabsCloneCreatedAt:new Date().toISOString()}
  await client.query('UPDATE public.radio_voice_profiles SET metadata=$1::jsonb,updated_at=now() WHERE id=$2 AND user_id=$3',[JSON.stringify(metadata),voice.profileId,job.user_id])
  const state=job.provider_state||{}
  state['eleven-clone']={sending:false,voiceId:result.voiceId,sampleSha256:sha256,created:result.created}
  await checkpoint(job,state,8)
  if(result.requiresVerification)throw Error('A ElevenLabs exige verificação desta voz antes de gerar locução.')
  return {voiceId:result.voiceId,sampleSha256:sha256}
 }finally{
  await client.query('SELECT pg_advisory_unlock(hashtext($1))',[`elevenlabs:${voice.profileId}`]).catch(()=>{})
  client.release()
 }
}
async function provider(job,label,payload,type){
 const endpoint=type==='TEXT_TO_SPEECH'?(cfg('MUSICGPT_TTS_URL')||'https://api.musicgpt.com/api/public/v1/TextToSpeech'):(cfg('MUSICGPT_API_URL')||'https://api.musicgpt.com/api/public/v1/MusicAI')
 return requestVideoAudio({job,label,payload,type,endpoint,key:cfg('MUSICGPT_API_KEY'),checkpoint,isStopping:()=>stopping||job.lost})
}
async function providerBytes(url){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!(u.hostname.endsWith('.s3.amazonaws.com')||/^cdn\d+\.musicgpt\.com$/.test(u.hostname)))throw Error('O provedor retornou um endereço de áudio não autorizado.');const response=await fetch(u,{redirect:'error',signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Não foi possível baixar a locução.');if(Number(response.headers.get('content-length'))>100*1024*1024)throw Error('Áudio muito grande.');const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>100*1024*1024)throw Error('Áudio muito grande.');chunks.push(chunk)}return Buffer.concat(chunks)}
async function generate(job,dir){
 const doc=job.payload.document
 if(job.kind==='voice'){
  const scripts=await normalize(doc),voice=job.payload.voice,results={}
  const speechIssue=speechReadinessIssue(scripts)
  if(speechIssue)throw Error(speechIssue)
  if(voice?.profileId){const r=await pool.query("SELECT id FROM public.radio_voice_profiles WHERE id=$1 AND user_id=$2 AND status='active' AND consent_status='confirmed'",[voice.profileId,job.user_id]);if(!r.rowCount)throw Error('Esta voz não está mais disponível.')}
  const identity=hash({mode:'full-v1',provider:'elevenlabs',model:ELEVEN_RETAIL_MODEL,speechVersion:SPEECH_VERSION,texts:scripts.map(s=>s.text),voice})
  let asset=(await pool.query("SELECT id,duration,metadata FROM public.video_studio_assets WHERE user_id=$1 AND kind='voice' AND metadata->>'fingerprint'=$2 ORDER BY created_at DESC LIMIT 1",[job.user_id,identity])).rows[0]
  if(!asset){
   const clone=await ensureElevenVoice(job,voice)
   const state=job.provider_state||{}
   if(state['full-voice']?.sending&&!state['full-voice']?.asset)throw Error('A locução ElevenLabs teve resposta incerta. Consulte o histórico do provedor antes de repetir.')
   state['full-voice']={provider:'elevenlabs',sending:true,voiceId:clone.voiceId,model:ELEVEN_RETAIL_MODEL}
   await checkpoint(job,state,10)
   const speech=await createRetailSpeech({apiKey:cfg('ELEVENLABS_API_KEY'),voiceId:clone.voiceId,text:fullVoiceText(scripts)})
   const file=join(dir,'full-voice.audio');await writeFile(file,speech.bytes)
   const info=await probe(file),duration=Number(info.format?.duration)
   if(!info.streams?.some(s=>s.codec_type==='audio')||!Number.isFinite(duration)||duration<=0||duration>180)throw Error('A ElevenLabs retornou um áudio inválido.')
   const metadata={fingerprint:identity,provider:'elevenlabs',model:ELEVEN_RETAIL_MODEL,mode:'full-v1',speechVersion:SPEECH_VERSION,voiceProfileId:voice.profileId,sampleSha256:clone.sampleSha256,sampleVersion:voice.sampleVersion||null,requestId:speech.requestId,usage:voiceUsage(fullVoiceText(scripts))}
   asset={...await store(job,'voice','Locução completa — '+doc.title,speech.bytes,'audio/mpeg','mp3',duration,metadata),metadata}
   state['full-voice']={provider:'elevenlabs',sending:false,voiceId:clone.voiceId,model:ELEVEN_RETAIL_MODEL,requestId:speech.requestId,asset:{id:asset.id,duration}}
   await checkpoint(job,state,95)
  }
  if(!asset)throw Error('Não foi possível recuperar a locução completa.')
  if(asset.metadata?.pacing?.version!==PACING_VERSION){
   const local=await assetFile(asset.id,job.user_id,dir)
   const paced=await tightenVoicePauses(local.file,join(dir,'retail-voice.mp3'),Number(asset.duration))
   const pacing={version:paced.version,cuts:paced.cuts,removedSeconds:paced.removedSeconds,sourceAssetId:asset.id}
   if(paced.removedSeconds>0){
    const duration=Number((await probe(paced.file)).format.duration)
    const {alignment:previousAlignment,boundaries:previousBoundaries,...original}=asset.metadata||{}
    const metadata={...original,pacing}
    asset={...await store(job,'voice','Locução completa — '+doc.title,await readFile(paced.file),'audio/mpeg','mp3',duration,metadata),metadata}
   }else{
    asset.metadata={...asset.metadata,pacing}
    await pool.query('UPDATE video_studio_assets SET metadata=$1::jsonb WHERE id=$2 AND user_id=$3',[JSON.stringify(asset.metadata),asset.id,job.user_id])
   }
  }
  if(!['words-v1','reference-v1'].includes(asset.metadata?.alignment?.version)){
   await checkpoint(job,job.provider_state,96)
   const local=await assetFile(asset.id,job.user_id,dir)
   const alignment=await analyzeVoiceBoundaries(local.file,scripts,Number(asset.duration))
   asset.metadata={...asset.metadata,boundaries:alignment.boundaries,alignment}
   await pool.query('UPDATE video_studio_assets SET metadata=$1::jsonb WHERE id=$2 AND user_id=$3',[JSON.stringify(asset.metadata),asset.id,job.user_id])
  }
  const fullVoice={assetId:asset.id,duration:Number(asset.duration),boundaries:asset.metadata.boundaries}
  return {provider:'elevenlabs',audioIdentity:videoAudioIdentity(doc),fullVoice,clips:{},scenes:fullVoiceTimeline(doc,fullVoice)}
 }
 if(job.kind==='music'){const out=await provider(job,'music',{prompt:withRetailMusicDirection(job.payload.musicPrompt),make_instrumental:true,vocal_only:false},'MUSIC_AI');if(out.id)return {assetId:out.id};const bytes=await providerBytes(out.url),file=join(dir,'music.audio');await writeFile(file,bytes);const info=await probe(file);const duration=Number(info.format?.duration);if(!info.streams?.some(s=>s.codec_type==='audio')||!Number.isFinite(duration)||duration>600)throw Error('A trilha recebida é inválida.');const asset=await store(job,'music','Trilha gerada',bytes,'audio/mpeg','mp3',duration);out.state.music.asset=asset;await checkpoint(job,out.state,95);return {assetId:asset.id}}
 const media={},voice=job.payload.voiceResult
 const ids=[doc.brand.logo,...doc.offers.map(o=>o.image)].filter(Boolean)
 for(const id of new Set(ids))media[id]=(await assetFile(id,job.user_id,dir)).name
 const scenes=doc.voice.enabled&&voice.fullVoice?fullVoiceTimeline(doc,voice.fullVoice):buildVideoTimeline(doc,doc.voice.enabled?Object.fromEntries(Object.entries(voice.clips).map(([id,c])=>[id,c.duration])):undefined)
 for(const s of scenes)if(doc.voice.enabled&&!voice.fullVoice)s.audio=(await assetFile(voice.clips[s.id].assetId,job.user_id,dir)).name
 const voiceAudio=doc.voice.enabled&&voice.fullVoice?(await assetFile(voice.fullVoice.assetId,job.user_id,dir)).name:undefined
 let music
 if(doc.audio.music!=='none'){if(isBuiltinMusic(doc.audio.music)){music='music.mp3';await cp(join(root,'public/video-studio/audio',doc.audio.music+'.mp3'),join(dir,music))}else{const asset=await assetFile(doc.audio.music,job.user_id,dir);const info=await probe(asset.file);if(!info.streams?.some(s=>s.codec_type==='audio'))throw Error('A música enviada não é um áudio válido.');music=asset.name}}
 for(const name of ['impact','whoosh'])await cp(join(root,'public/video-studio/audio',name+'.mp3'),join(dir,name+'.mp3'))
 const outputs=[]
 for(let i=0;i<doc.formats.length;i++){
  const format=doc.formats[i],output=join(dir,format+'.mp4')
  const recovered=(await pool.query("SELECT id,duration FROM video_studio_assets WHERE user_id=$1 AND kind='render' AND metadata->>'jobId'=$2 AND metadata->>'format'=$3 ORDER BY created_at DESC LIMIT 1",[job.user_id,job.id,format])).rows[0]
  if(recovered){outputs.push({format,assetId:recovered.id,duration:recovered.duration});continue}
  let previous=-1
  const info=await renderVideo({document:doc,label:job.payload.label,media,scenes,format,music,voiceAudio,impact:'impact.mp3',whoosh:'whoosh.mp3'},dir,output,p=>{const n=Math.floor((i+p)/doc.formats.length*95);if(n>previous+4){previous=n;pool.query('UPDATE public.video_studio_jobs SET progress=$1 WHERE id=$2 AND lease_token=$3 AND status=\'running\'',[n,job.id,job.lease_token]).catch(()=>{})}})
  const asset=await store(job,'render',doc.title+' — '+format,await readFile(output),'video/mp4','mp4',Number(info.format.duration),{jobId:job.id,revision:job.revision,format})
  let coverAssetId
  try{
   const cover=await createVideoCover(output,join(dir,`cover-${format}.jpg`))
   const coverAsset=await store(job,'image',`${doc.title} — capa ${format}`,cover,'image/jpeg','jpg',null,{role:'render-cover',jobId:job.id,revision:job.revision,format,renderAssetId:asset.id})
   coverAssetId=coverAsset.id
  }catch(error){
   // A renderização principal continua disponível mesmo se uma capa derivada falhar.
   console.error('[video-cover] Não foi possível gerar a capa',job.id,format,error?.message||error)
  }
  outputs.push({format,assetId:asset.id,duration:asset.duration,...(coverAssetId?{coverAssetId}:{})})
 }
 return {outputs}
}
async function main(){await touch();const heartbeat=setInterval(()=>touch().catch(()=>{}),20000);try{while(!stopping){const job=await claim();if(!job){await sleep(2500);continue}const dir=await mkdtemp(join(tmpdir(),'jobvarejo-video-'));let lost=false;const lease=setInterval(()=>renewVideoLease(pool,job).then(state=>{if(state==='lost'){lost=true;job.lost=true}}),20000);try{const result=await generate(job,dir);if(lost)throw Error('A geração foi assumida por outro processo.');const published=await pool.query("UPDATE public.video_studio_jobs SET status='ready',result=$1::jsonb,progress=100,error=NULL,updated_at=now(),lease_until=NULL WHERE id=$2 AND lease_token=$3 AND status='running'",[JSON.stringify(result),job.id,job.lease_token]);if(!published.rowCount)throw Error('A geração foi assumida por outro processo.');console.log('video job ready',job.id)}catch(e){if(stopping){await pool.query("UPDATE public.video_studio_jobs SET lease_until=now() WHERE id=$1 AND lease_token=$2",[job.id,job.lease_token])}else{const message=String(e.message||'Não foi possível gerar o vídeo.').slice(0,400);await pool.query("UPDATE public.video_studio_jobs SET status='failed',error=$1,updated_at=now(),lease_until=NULL WHERE id=$2 AND lease_token=$3 AND status='running'",[message,job.id,job.lease_token]);console.error('video job failed',job.id,message)}}finally{clearInterval(lease);await rm(dir,{recursive:true,force:true})}}}finally{clearInterval(heartbeat);await pool.query('DELETE FROM public.video_studio_workers WHERE id=$1',[workerId]);await pool.end()}}
main().catch(e=>{console.error('Video worker unavailable:',e.code||e.name);process.exitCode=1})
