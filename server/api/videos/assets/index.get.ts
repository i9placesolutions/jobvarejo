import { videoUser } from '../../../utils/video-studio/service'
import { pgQuery } from '../../../utils/postgres'
export default defineEventHandler(async event=>{const u=await videoUser(event);return {items:(await pgQuery("SELECT id,name,kind,created_at FROM public.video_studio_assets WHERE user_id=$1 AND kind IN ('image','music') ORDER BY created_at DESC LIMIT 200",[u.id])).rows}})
