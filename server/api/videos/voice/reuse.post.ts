import {z} from 'zod'
import {videoHash,videoJson,videoUser} from '../../../utils/video-studio/service'
import {pgTx} from '../../../utils/postgres'
import {videoDocumentSchema} from '../../../utils/video-studio/schema'
import {isVideoModel} from '../../../../shared/video-studio/project-kind'
import {readVideoJsonParts} from '../../../../shared/video-studio/read-json-parts'
import {prepareVoiceReuse} from '../../../../shared/video-studio/voice-reuse'
import {videoAudioIdentity,videoSpeechSource} from '../../../../shared/video-studio/model'
import {stageVideoPayload} from '../../../utils/video-studio/payload-parts'

export default defineEventHandler(async event=>{
 const user=await videoUser(event,30)
 const parsed=z.object({projectId:z.string().uuid(),revision:z.number().int().nonnegative(),jobId:z.string().uuid()}).safeParse(await readBody(event))
 if(!parsed.success)throw createError({statusCode:422,statusMessage:'Solicitação inválida.'})
 const input=parsed.data

 return pgTx(async client=>{
  await client.query("SET LOCAL idle_in_transaction_session_timeout='30s'")
  await client.query("SET LOCAL statement_timeout='30s'")
  const locked=await client.query('SELECT id,revision FROM public.video_studio_projects WHERE id=$1 AND user_id=$2 FOR UPDATE',[input.projectId,user.id])
  const lockedProject=locked.rows[0]
  if(!lockedProject)throw createError({statusCode:404,statusMessage:'Vídeo não encontrado.'})
  if(Number(lockedProject.revision)!==input.revision)throw createError({statusCode:409,statusMessage:'Este vídeo mudou em outra janela. Reabra antes de aplicar a locução.'})

  const project=await readVideoJsonParts(client.query.bind(client),'SELECT row_to_json(p) data FROM public.video_studio_projects p WHERE p.id=$1 AND p.user_id=$2',[input.projectId,user.id])
  if(!project)throw createError({statusCode:404,statusMessage:'Vídeo não encontrado.'})
  if(isVideoModel(project))throw createError({statusCode:409,statusMessage:'Este é um modelo. Crie sua cópia antes de editar.'})
  const current=videoDocumentSchema.safeParse(project.document)
  if(!current.success)throw createError({statusCode:422,statusMessage:'O vídeo atual não pode receber esta locução.'})

  const source=await client.query(`SELECT id,result FROM public.video_studio_jobs
   WHERE id=$1 AND project_id=$2 AND user_id=$3 AND kind='voice' AND status='ready' FOR SHARE`,[input.jobId,input.projectId,user.id])
  const sourceJob=source.rows[0]
  if(!sourceJob)throw createError({statusCode:404,statusMessage:'Locução pronta não encontrada neste vídeo.'})

  let plan:ReturnType<typeof prepareVoiceReuse>
  try{plan=prepareVoiceReuse(current.data,sourceJob.result?.audioIdentity,sourceJob.result)}
  catch(error:any){throw createError({statusCode:422,statusMessage:error?.message||'Esta locução não pode ser aplicada ao vídeo.'})}
  const validated=videoDocumentSchema.safeParse(plan.document)
  if(!validated.success)throw createError({statusCode:422,statusMessage:'O roteiro gravado não pode ser aplicado a este vídeo.'})
  const restoredAudioIdentity=videoAudioIdentity(validated.data)
  const restoredScriptSource=videoSpeechSource(validated.data)

  const assetResult=await client.query(`SELECT id,kind,storage_key,content_type,bytes,duration FROM public.video_studio_assets
   WHERE id=$1 AND user_id=$2 AND kind='voice' FOR SHARE`,[plan.fullVoice.assetId,user.id])
  const asset=assetResult.rows[0]
  const expectedKey=new RegExp(`^video-studio/${user.id}/assets/${plan.fullVoice.assetId}\\.[a-z0-9]{1,8}$`,'i')
  if(!asset||!expectedKey.test(String(asset.storage_key||'')))throw createError({statusCode:404,statusMessage:'Arquivo da locução não encontrado.'})
  if(!String(asset.content_type||'').startsWith('audio/')||Number(asset.bytes)<=0||!Number.isFinite(Number(asset.duration))||Number(asset.duration)<=0)throw createError({statusCode:422,statusMessage:'O arquivo desta locução está inválido.'})
  if(Math.abs(Number(asset.duration)-plan.fullVoice.duration)>.1)throw createError({statusCode:422,statusMessage:'A duração do arquivo não corresponde à locução gravada.'})

  const audioHash=videoHash(restoredAudioIdentity)
  const fingerprint=videoHash({mode:'reuse-v1',projectId:input.projectId,sourceJobId:sourceJob.id,audioHash})
  const prior=await client.query(`SELECT id,kind,status,result,progress,error,revision FROM public.video_studio_jobs
   WHERE user_id=$1 AND project_id=$2 AND kind='voice' AND fingerprint=$3 AND status='ready' LIMIT 1 FOR SHARE`,[user.id,input.projectId,fingerprint])
  if(prior.rows[0]&&JSON.stringify(current.data)===JSON.stringify(validated.data)&&project.script_source===restoredScriptSource)return {project:{...project,document:current.data},job:prior.rows[0]}

  const nextRevision=input.revision+1
  const updated=await client.query(`UPDATE public.video_studio_projects
   SET document=$1::jsonb,script_source=$2,revision=revision+1,updated_at=now()
   WHERE id=$3 AND user_id=$4 AND revision=$5
   RETURNING id,title,revision,updated_at`,[videoJson(validated.data),restoredScriptSource,input.projectId,user.id,input.revision])
  const updatedRow=updated.rows[0]
  if(!updatedRow)throw createError({statusCode:409,statusMessage:'Este vídeo mudou em outra janela. Reabra antes de aplicar a locução.'})
  const projectRow={...updatedRow,document:validated.data,script_source:restoredScriptSource}
  if(prior.rows[0])return {project:projectRow,job:prior.rows[0]}

  const payload={document:validated.data,audioHash,voiceMode:'full-v1',speechProvider:'elevenlabs',reuseMode:'reuse-v1',reusedFromJobId:sourceJob.id}
  const result={...sourceJob.result,provider:'elevenlabs',audioIdentity:restoredAudioIdentity,fullVoice:plan.fullVoice,clips:{},scenes:plan.scenes}
  await stageVideoPayload(client,videoJson(payload))
  const inserted=await client.query(`INSERT INTO public.video_studio_jobs
   (user_id,project_id,revision,kind,fingerprint,status,payload,result,progress)
   SELECT $1,$2,$3,'voice',$4,'ready',string_agg(part,'' ORDER BY ordinal)::jsonb,$5::jsonb,100
   FROM pg_temp.video_job_payload_parts
   RETURNING id,kind,status,result,progress,error,revision`,[user.id,input.projectId,nextRevision,fingerprint,JSON.stringify(result)])
  return {project:projectRow,job:inserted.rows[0]}
 })
})
