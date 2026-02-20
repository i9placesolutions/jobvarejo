import { ensureAuthColumns, getProfileByResetTokenHash, updatePasswordForUser } from '../../utils/auth-db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { hashPassword } from '../../utils/password'
import { createSessionToken, hashOpaqueToken } from '../../utils/session-token'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  enforceRateLimit(event, `auth-reset-password:${ip}`, 20, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const token = String(body?.token || '').trim()
  const password = String(body?.password || '')

  if (!token) throw createError({ statusCode: 400, statusMessage: 'Token de recuperacao invalido' })
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Senha deve ter no minimo 8 caracteres' })
  }

  await ensureAuthColumns()

  const tokenHash = hashOpaqueToken(token)
  const profile = await getProfileByResetTokenHash(tokenHash)
  if (!profile?.id) {
    throw createError({ statusCode: 400, statusMessage: 'Token invalido ou expirado' })
  }

  const passwordHash = await hashPassword(password)
  await updatePasswordForUser(profile.id, passwordHash)

  const role = profile.role || 'user'
  const { token: sessionToken, expiresIn } = createSessionToken({
    userId: profile.id,
    email: profile.email,
    role
  })

  setCookie(event, 'access-token', sessionToken, {
    path: '/',
    maxAge: expiresIn,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false
  })
  // Keep legacy cookie for backward compatibility during cutover.
  setCookie(event, 'sb-access-token', sessionToken, {
    path: '/',
    maxAge: expiresIn,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false
  })
  setCookie(event, 'authenticated', 'true', {
    path: '/',
    maxAge: expiresIn,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false
  })

  return {
    success: true,
    message: 'Senha redefinida com sucesso.',
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? null,
      avatar_url: profile.avatar_url ?? null,
      role
    },
    session: {
      access_token: sessionToken,
      expires_in: expiresIn
    }
  }
})
