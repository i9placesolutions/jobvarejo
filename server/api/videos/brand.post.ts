import { videoUser } from '../../utils/video-studio/service'
import { loadVideoBrand } from '../../utils/video-studio/brand'
export default defineEventHandler(async event=>{const user=await videoUser(event,30);return loadVideoBrand(user.id)})
