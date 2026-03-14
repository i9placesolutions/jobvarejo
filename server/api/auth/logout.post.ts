import { enforceRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `auth-logout:${ip}`, 120, 60_000)

  const isProduction = process.env.NODE_ENV === 'production'
  setCookie(event, 'access-token', '', { path: '/', maxAge: 0, sameSite: 'lax', secure: isProduction, httpOnly: true })
  setCookie(event, 'sb-access-token', '', { path: '/', maxAge: 0, sameSite: 'lax', secure: isProduction, httpOnly: true })
  setCookie(event, 'authenticated', '', { path: '/', maxAge: 0, sameSite: 'lax', secure: isProduction, httpOnly: false })

  return { success: true }
})
