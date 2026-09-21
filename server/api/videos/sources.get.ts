import { videoUser } from '../../utils/video-studio/service'
import { pgQuery } from '../../utils/postgres'
export default defineEventHandler(async event=>{const u=await videoUser(event);return {items:(await pgQuery('SELECT id,name FROM public.projects WHERE user_id=$1 AND coalesce(is_template,false)=false ORDER BY updated_at DESC LIMIT 100',[u.id])).rows}})
