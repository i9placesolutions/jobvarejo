import { videoUser } from '../../../utils/video-studio/service'
import { pgQuery } from '../../../utils/postgres'
export default defineEventHandler(async event=>{const user=await videoUser(event);try{return {items:(await pgQuery('SELECT id,title,revision,updated_at,document FROM public.video_studio_projects WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 500',[user.id])).rows}}catch(e:any){if(e.code==='42P01')throw createError({statusCode:503,statusMessage:'A área de vídeos está aguardando a preparação do servidor.'});throw e}})
