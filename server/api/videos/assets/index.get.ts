import { videoUser } from '../../../utils/video-studio/service'
import { pgQuery } from '../../../utils/postgres'
export default defineEventHandler(async event=>{
 const u=await videoUser(event),query=getQuery(event)
 const kind=query.kind==='music'?'music':query.kind==='image'?'image':null
 const cursor=typeof query.cursor==='string'?query.cursor:null
 if(cursor&&!/^[a-f0-9-]{36}$/i.test(cursor))throw createError({statusCode:422,statusMessage:'Página de arquivos inválida.'})
 const rows=(await pgQuery(`SELECT id,name,kind,created_at FROM public.video_studio_assets
  WHERE user_id=$1 AND kind IN ('image','music') AND ($2::text IS NULL OR kind=$2)
  AND ($3::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM public.video_studio_assets WHERE id=$3 AND user_id=$1 AND ($2::text IS NULL OR kind=$2)))
  ORDER BY created_at DESC,id DESC LIMIT 201`,[u.id,kind,cursor])).rows
 return {items:rows.slice(0,200),nextCursor:rows.length>200?rows[199]!.id:null}
})
