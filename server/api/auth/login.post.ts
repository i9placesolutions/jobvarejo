import { ensureAuthColumns, getProfileByEmail, normalizeEmail, updateLastLoginAt } from '../../utils/auth-db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { verifyPassword } from '../../utils/password'
import { createSessionToken } from '../../utils/session-token'
import { getAuthCookieOptions } from '../../utils/auth-cookie'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `auth-login:${ip}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const email = normalizeEmail(body?.email)
  const password = String(body?.password || '')

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'E-mail invalido' })
  }
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'Senha obrigatoria' })
  }

  await ensureAuthColumns()
  const profile = await getProfileByEmail(email)
  const validPassword = await verifyPassword(password, profile?.password_hash || null)
  if (!profile?.id || !validPassword) {
    throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha invalidos' })
  }

  const { token, expiresIn } = createSessionToken({
    userId: profile.id,
    email: String(profile.email),
    role: profile.role || 'user'
  })

  const cookieBase = getAuthCookieOptions(event, expiresIn)
  setCookie(event, 'access-token', token, {
    ...cookieBase,
    httpOnly: true
  })
  // Keep legacy cookie for backward compatibility during cutover.
  setCookie(event, 'sb-access-token', token, {
    ...cookieBase,
    httpOnly: true
  })
  // Non-httpOnly flag so client JS can detect authenticated state without reading the token
  setCookie(event, 'authenticated', 'true', {
    ...cookieBase,
    httpOnly: false
  })

  await updateLastLoginAt(profile.id)

  return {
    success: true,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? null,
      avatar_url: profile.avatar_url ?? null,
      role: profile.role || 'user'
    },
    session: {
      access_token: token,
      expires_in: expiresIn
    }
  }
})
