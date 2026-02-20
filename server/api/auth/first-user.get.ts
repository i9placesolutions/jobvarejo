import { countProfiles, ensureAuthColumns } from '../../utils/auth-db'
import { enforceRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  enforceRateLimit(event, `auth-first-user:${ip}`, 120, 60_000)

  await ensureAuthColumns()
  const total = await countProfiles()
  return {
    success: true,
    isFirstUser: total === 0,
    totalUsers: total
  }
})
