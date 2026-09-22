import { videoUser, ownedVideo } from '../../utils/video-studio/service'
import { videoJobStatus } from '../../utils/video-studio/job-status'
export default defineEventHandler(async event => {
  const user = await videoUser(event)
  const project = await ownedVideo(String(getQuery(event).projectId || ''), user.id)
  return videoJobStatus(user.id, project.id)
})
