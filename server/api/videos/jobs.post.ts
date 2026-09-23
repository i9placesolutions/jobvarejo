import {stageVideoPayload} from '../../utils/video-studio/payload-parts'
import {resolveVideoLabel} from '../../../shared/video-studio/labels'
import {flyerRecipe} from '../../../shared/video-studio/flyer-recipes'
import { listVideoLabels } from '../../utils/video-studio/labels'
import { z } from 'zod'
import { videoUser,ownedVideo,videoWorkerReady,videoHash,videoJson,validateVideoAssets } from '../../utils/video-studio/service'
import { pgTx } from '../../utils/postgres'
import { resolveVideoVoice } from '../../utils/video-studio/voices'
import { videoDocumentSchema } from '../../utils/video-studio/schema'
import { validateVideoForGeneration,videoAudioIdentity,videoSpeechSource } from '../../../shared/video-studio/model'
export default defineEventHandler(async event=>{
 const traceStarted=Date.now();const trace=(stage:string)=>console.info('[video-enqueue]',stage,Date.now()-traceStarted);trace('start')
 const u=await videoUser(event,12);trace('authenticated');const parsed=z.object({projectId:z.string().uuid(),revision:z.number().int(),kind:z.enum(['voice','render','music']),musicPrompt:z.string().max(500).optional()}).safeParse(await readBody(event));if(!parsed.success)throw createError({statusCode:422,statusMessage:'Solicitação inválida.'})
 if(!await videoWorkerReady())throw createError({statusCode:503,statusMessage:'A geração está temporariamente indisponível. Seu projeto pode ser salvo normalmente.'})
 const input=parsed.data,p=await ownedVideo(input.projectId,u.id);if(p.revision!==input.revision)throw createError({statusCode:409,statusMessage:'Salve a versão atual antes de gerar.'})
 trace('project');const doc=videoDocumentSchema.parse(p.document);await validateVideoAssets(doc,u.id)
 const errors=validateVideoForGeneration(doc);if(input.kind!=='music'&&errors.length)throw createError({statusCode:422,statusMessage:errors[0]})
 if(doc.voice.enabled&&input.kind!=='music'&&p.script_source!==videoSpeechSource(doc))throw createError({statusCode:422,statusMessage:'Os produtos mudaram. Revise e confirme o roteiro antes de gerar.'})
 const voice=input.kind==='voice'?await resolveVideoVoice(doc.voice.id,u.id):null
 if(input.kind==='voice'&&!doc.voice.enabled)throw createError({statusCode:422,statusMessage:'Ative a locução primeiro.'})
 if(input.kind==='voice'&&!process.env.ELEVENLABS_API_KEY)throw createError({statusCode:503,statusMessage:'Configure ELEVENLABS_API_KEY no servidor para gerar a locução.'})
 const label=resolveVideoLabel((doc.priceLabel||flyerRecipe(doc.theme)?await listVideoLabels(u.id,doc.priceLabel||undefined):[]).filter((l):l is NonNullable<typeof l>=>!!l),doc.theme,doc.priceLabel)
 if((doc.priceLabel||flyerRecipe(doc.theme))&&!label)throw createError({statusCode:422,statusMessage:'Esta etiqueta não está disponível para este vídeo.'})
 trace('label');const audioHash=videoHash(videoAudioIdentity(doc));const fingerprint=videoHash(input.kind==='voice'?{audioHash,voice,voiceMode:'full-v1',provider:'elevenlabs',model:'eleven_v3',speechVersion:3,pacingVersion:'retail-pauses-v1'}:input.kind==='render'?{doc,label,revision:p.revision,renderVersion:5}: {prompt:input.musicPrompt||'Trilha instrumental animada para ofertas de supermercado',project:p.id})
 return pgTx(async client=>{
  await client.query("SET LOCAL idle_in_transaction_session_timeout='30s'")
  await client.query("SET LOCAL statement_timeout='30s'")
  // Stage the large body before taking the account lock; assets can finish saving.
  const stagedPayload={voiceMode:'full-v1',speechProvider:'elevenlabs',speechModel:'eleven_v3',speechVersion:3,document:doc,label,audioHash,voice,voiceResult:null,musicPrompt:input.musicPrompt||'Trilha instrumental animada para ofertas de supermercado, sem voz'}
  await stageVideoPayload(client,videoJson(stagedPayload));trace('payload-staged')
  await client.query('SELECT id FROM public.profiles WHERE id=$1 FOR UPDATE',[u.id])
  trace('account-lock');const prior=await client.query("SELECT id,kind,status,result,progress,error,revision FROM public.video_studio_jobs WHERE user_id=$1 AND project_id=$2 AND kind=$3 AND fingerprint=$4 AND status IN ('queued','running','ready') LIMIT 1",[u.id,p.id,input.kind,fingerprint]);if(prior.rows[0])return prior.rows[0]
  const active=await client.query("SELECT count(*)::int n FROM public.video_studio_jobs WHERE user_id=$1 AND status IN ('queued','running')",[u.id]);if(active.rows[0].n>=3)throw createError({statusCode:429,statusMessage:'Aguarde suas gerações em andamento.'})
  const failed=await client.query("SELECT id,provider_state FROM public.video_studio_jobs WHERE user_id=$1 AND project_id=$2 AND kind=$3 AND fingerprint=$4 AND status='failed' ORDER BY created_at DESC LIMIT 1",[u.id,p.id,input.kind,fingerprint])
  if(failed.rows[0]&&input.kind!=='render'){
   const state=failed.rows[0].provider_state||{}
   const full=state['full-voice']
   // A new paid attempt requires this explicit user action, never a worker retry.
   if(input.kind==='voice'&&full?.taskId&&!full.asset&&['TIMEOUT','TIMED_OUT','FAILED','ERROR','CANCELLED','CANCELED','EXPIRED'].includes(full.status)){
    state['full-voice']={previousTasks:[...(full.previousTasks||[]),{taskId:full.taskId,status:full.status}],sending:false}
    return (await client.query("UPDATE public.video_studio_jobs SET status='queued',provider_state=$3::jsonb,attempts=0,error=NULL,progress=0,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id,kind,status,result,progress,error,revision",[failed.rows[0].id,u.id,JSON.stringify(state)])).rows[0]
   }
   if(Object.values(state).some((v:any)=>v?.sending&&!v?.taskId))throw createError({statusCode:409,statusMessage:'Sua solicitação de áudio precisa ser verificada. Os trechos prontos estão salvos. Entre em contato com o suporte.'})
   if(Object.values(state).some((v:any)=>v?.taskId))return (await client.query("UPDATE public.video_studio_jobs SET status='queued',attempts=0,error=NULL,progress=0,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id,kind,status,result,progress,error,revision",[failed.rows[0].id,u.id])).rows[0]
  }
  let voiceResult=null
  if(input.kind==='render'&&doc.voice.enabled){const r=await client.query("SELECT result FROM public.video_studio_jobs WHERE user_id=$1 AND project_id=$2 AND kind='voice' AND status='ready' AND payload->>'audioHash'=$3 AND payload->>'speechProvider'='elevenlabs' ORDER BY created_at DESC LIMIT 1",[u.id,p.id,audioHash]);voiceResult=r.rows[0]?.result;if(!voiceResult)throw createError({statusCode:422,statusMessage:'Gere e ouça a nova locução ElevenLabs desta versão antes de exportar.'})}
  trace('inserting');return (await client.query(`INSERT INTO public.video_studio_jobs(user_id,project_id,revision,kind,fingerprint,payload) SELECT $1,$2,$3,$4,$5,jsonb_set(string_agg(part,'' ORDER BY ordinal)::jsonb,'{voiceResult}',$6::jsonb) FROM pg_temp.video_job_payload_parts RETURNING id,kind,status,result,progress,error,revision`,[u.id,p.id,p.revision,input.kind,fingerprint,JSON.stringify(voiceResult)])).rows[0]
 })
})
