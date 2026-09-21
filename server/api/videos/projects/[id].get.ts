import { videoUser,ownedVideo } from '../../../utils/video-studio/service'
export default defineEventHandler(async event=>{const user=await videoUser(event);return ownedVideo(String(getRouterParam(event,'id')),user.id)})
