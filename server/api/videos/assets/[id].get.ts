import { videoUser,videoAssetUrl } from '../../../utils/video-studio/service'
import { videoBucket } from '../../../utils/video-studio/service'
import { getS3Client } from '../../../utils/s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
export default defineEventHandler(async event=>{
 const user=await videoUser(event,600),{row,url}=await videoAssetUrl(String(getRouterParam(event,'id')),user.id)
 setHeader(event,'Cache-Control','private, no-store')
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
