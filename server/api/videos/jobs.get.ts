import { videoUser,ownedVideo } from '../../utils/video-studio/service'
import { pgQuery } from '../../utils/postgres'
export default defineEventHandler(async event=>{const u=await videoUser(event);const p=await ownedVideo(String(getQuery(event).projectId||''),u.id);return {items:(await pgQuery('SELECT id,revision,kind,status,fingerprint,result,progress,error,created_at FROM public.video_studio_jobs WHERE user_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 40',[u.id,p.id])).rows}})
