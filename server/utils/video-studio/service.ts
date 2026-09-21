import {readVideoJsonParts} from '../../../shared/video-studio/read-json-parts'
import {isBuiltinMusic} from '../../../shared/video-studio/effect-catalog'
import { createHash, randomUUID } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireAuthenticatedUser } from '../auth'
import { enforceRateLimit } from '../rate-limit'
import { pgOneOrNull, pgQuery, pgTx } from '../postgres'
import { getS3Client } from '../s3'
import { parseAndStringifyJsonbParam } from '../jsonb'
import { getRequestURL, type H3Event } from 'h3'
import type { VideoDocument } from '../../../shared/video-studio/model'
export const videoJson=(v:unknown)=>parseAndStringifyJsonbParam(v,'vídeo')
export const videoHash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
export async function videoUser(event:H3Event, limit=120) {const user=await requireAuthenticatedUser(event);await enforceRateLimit(event,`videos:${event.method}:${getRequestURL(event).pathname.replace(/[a-f0-9]{8}-[a-f0-9-]{27}/gi, ':id')}:${user.id}`,limit,60_000);return user}
export function videoId(value:unknown):string {const s=String(value||'');if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s))throw createError({statusCode:400,statusMessage:'Identificador inválido.'});return s}
export function videoBucket(){return String(useRuntimeConfig().wasabiBucket||process.env.WASABI_BUCKET||'jobvarejo')}
export async function ownedVideo(id:string,userId:string){const row=await pgTx(async client=>{await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL idle_in_transaction_session_timeout='30s'");await client.query("SET LOCAL statement_timeout='30s'");return readVideoJsonParts(client.query.bind(client),'SELECT row_to_json(p) data FROM public.video_studio_projects p WHERE id=$1 AND user_id=$2',[videoId(id),userId])});if(!row)throw createError({statusCode:404,statusMessage:'Vídeo não encontrado.'});return row}
export async function validateVideoAssets(doc:VideoDocument,userId:string){
 const ids=[doc.brand.logo,...doc.offers.map(o=>o.image),...(doc.audio.music!=='none'&&!isBuiltinMusic(doc.audio.music)?[doc.audio.music]:[])].filter(Boolean)
 if(!ids.length)return
 const {rows}=await pgQuery<any>('SELECT id,kind FROM public.video_studio_assets WHERE user_id=$1 AND id=ANY($2::uuid[])',[userId,ids.map(videoId)])
 for(const id of ids){const expected=id===doc.audio.music?'music':'image';if(!rows.some(r=>r.id===id&&r.kind===expected))throw createError({statusCode:422,statusMessage:'Uma imagem ou música não pertence a esta conta. Selecione o arquivo novamente.'})}
}
export async function putVideoAsset(userId:string,kind:string,name:string,bytes:Buffer,contentType:string,extension:string,metadata:unknown={}){
 const id=randomUUID(),key=`video-studio/${userId}/assets/${id}.${extension}`
 await getS3Client().send(new PutObjectCommand({Bucket:videoBucket(),Key:key,Body:bytes,ContentType:contentType}))
 await pgQuery('INSERT INTO public.video_studio_assets(id,user_id,kind,name,storage_key,content_type,bytes,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',[id,userId,kind,name.slice(0,160),key,contentType,bytes.length,videoJson(metadata)])
 return {id,name,kind,url:`/api/videos/assets/${id}`}
}
export async function videoAssetUrl(assetId:string,userId:string){const row=await pgOneOrNull<any>('SELECT * FROM public.video_studio_assets WHERE id=$1 AND user_id=$2',[videoId(assetId),userId]);if(!row||!row.storage_key.startsWith(`video-studio/${userId}/`))throw createError({statusCode:404,statusMessage:'Arquivo não encontrado.'});return {row,url:await getSignedUrl(getS3Client(),new GetObjectCommand({Bucket:videoBucket(),Key:row.storage_key}),{expiresIn:900})}}
export async function videoWorkerReady(){return !!await pgOneOrNull('SELECT id FROM public.video_studio_workers WHERE heartbeat_at > now() - interval \'90 seconds\' LIMIT 1')}
