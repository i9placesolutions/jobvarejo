import { videoUser,videoAssetUrl } from '../../../utils/video-studio/service'
import { videoBucket } from '../../../utils/video-studio/service'
import { getS3Client } from '../../../utils/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
export default defineEventHandler(async event=>{
 const user=await videoUser(event,600),{row,url}=await videoAssetUrl(String(getRouterParam(event,'id')),user.id)
 if(getQuery(event).download==='1'){
  if(row.kind!=='render')throw createError({statusCode:422,statusMessage:'Download de vídeo indisponível para este arquivo.'})
  const title=Array.from(String(row.name||'Meu vídeo').replace(/[\x00-\x1f\x7f/\\:"<>|?*]/g,'-').trim()).slice(0,140).join('')||'video'
  const filename=title.replace(/\.mp4$/i,'')+'.mp4'
  const fallback=filename.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ._-]/g,'-')
  const encoded=encodeURIComponent(filename).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())
  const downloadUrl=await getSignedUrl(getS3Client(),new GetObjectCommand({Bucket:videoBucket(),Key:row.storage_key,ResponseContentType:'video/mp4',ResponseContentDisposition:`attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`}),{expiresIn:300})
  setHeader(event,'Cache-Control','private, no-store')
  return sendRedirect(event,downloadUrl,302)
 }
 const isRenderCover=row.kind==='image'&&row.metadata?.role==='render-cover'
 // A URL assinada expira em 15 min; manter a capa privada por 10 min evita refazer o redirect ao voltar à biblioteca.
 setHeader(event,'Cache-Control',isRenderCover?'private, max-age=600':'private, no-store')
 // Somente imagens pertencentes ao usuário; evita CORS e download progressivo no Player.
 if(getQuery(event).preview==='1'){
  if(row.kind!=='image')throw createError({statusCode:422,statusMessage:'Prévia disponível somente para imagens.'})
  const object=await getS3Client().send(new GetObjectCommand({Bucket:videoBucket(),Key:row.storage_key}))
  if(!object.Body)throw createError({statusCode:404,statusMessage:'Imagem não encontrada.'})
  setHeader(event,'Content-Type',row.content_type)
  return sendStream(event,object.Body.transformToWebStream())
 }
 return sendRedirect(event,url,302)
})
