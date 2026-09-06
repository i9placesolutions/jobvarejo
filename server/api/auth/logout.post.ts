import { enforceRateLimit } from '../../utils/rate-limit'
import { getAuthCookieOptions } from '../../utils/auth-cookie'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `auth-logout:${ip}`, 120, 60_000)

  const cookieBase = getAuthCookieOptions(event, 0)
  setCookie(event, 'access-token', '', { ...cookieBase, httpOnly: true })
  setCookie(event, 'sb-access-token', '', { ...cookieBase, httpOnly: true })
  setCookie(event, 'authenticated', '', { ...cookieBase, httpOnly: false })

  return { success: true }
})
