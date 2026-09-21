import { videoUser } from '../../utils/video-studio/service'
import { videoVoices } from '../../utils/video-studio/voices'
export default defineEventHandler(async event=>{const u=await videoUser(event);return {items:await videoVoices(u.id)}})
