import { countProfiles, createProfileWithPassword, ensureAuthColumns, getProfileByEmail, normalizeEmail } from '../../utils/auth-db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { hashPassword } from '../../utils/password'
import { createSessionToken } from '../../utils/session-token'
import type { UserRole } from '~/types/auth'

const normalizeName = (value: unknown): string => String(value || '').trim().replace(/\s+/g, ' ')

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  enforceRateLimit(event, `auth-register:${ip}`, 20, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const name = normalizeName(body?.name)
  const email = normalizeEmail(body?.email)
  const password = String(body?.password || '')
  const autoLogin = Boolean(body?.auto_login)

  if (!name || name.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Nome invalido' })
  }
  if (name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Nome muito longo (max 120)' })
  }
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'E-mail invalido' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Senha deve ter no minimo 8 caracteres' })
  }

  await ensureAuthColumns()

  const existing = await getProfileByEmail(email)
  if (existing?.id) {
    throw createError({ statusCode: 409, statusMessage: 'Ja existe uma conta com este e-mail' })
  }

  const currentUsers = await countProfiles()
  const role: UserRole = currentUsers === 0 ? 'super_admin' : 'user'
  const passwordHash = await hashPassword(password)

  const created = await createProfileWithPassword({
    name,
    email,
    passwordHash,
    role
  })

  const response: Record<string, any> = {
    success: true,
    user: {
      id: created.id,
      email: created.email,
      name: created.name ?? null,
      avatar_url: created.avatar_url ?? null,
      role
    }
  }

  if (autoLogin) {
    const { token, expiresIn } = createSessionToken({
      userId: created.id,
      email: created.email,
      role
    })

    setCookie(event, 'access-token', token, {
      path: '/',
      maxAge: expiresIn,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false
    })
    // Keep legacy cookie for backward compatibility during cutover.
    setCookie(event, 'sb-access-token', token, {
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

    response.session = {
      access_token: token,
      expires_in: expiresIn
    }
  }

  return response
})
