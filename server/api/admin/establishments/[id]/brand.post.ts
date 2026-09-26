import { requireSuperAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { loadVideoBrandFromProfile } from '../../../../utils/video-studio/brand'
import { videoId } from '../../../../utils/video-studio/service'

export default defineEventHandler(async (event) => {
  const user = await requireSuperAdminUser(event)
  await enforceRateLimit(event, `admin-establishment-brand:${user.id}`, 60, 60_000)

  const establishmentId = videoId(getRouterParam(event, 'id'))
  return {
    establishmentId,
    ...(await loadVideoBrandFromProfile(establishmentId, user.id))
  }
})
