import { ensureAuthColumns, getProfileById, getProfileByWhatsApp, updateLastLoginAt } from '../../utils/auth-db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { verifyPassword } from '../../utils/password'
import { createSessionToken } from '../../utils/session-token'
import { getAuthCookieOptions } from '../../utils/auth-cookie'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'
import { normalizeEditorPermissions } from '../../../shared/access-control'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `auth-login:${ip}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const whatsapp = normalizeBrazilWhatsApp(body?.whatsapp)
  const password = String(body?.password || '')

  if (!whatsapp) {
    throw createError({ statusCode: 400, statusMessage: 'Informe um WhatsApp válido com DDD.' })
  }
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'Senha obrigatoria' })
  }

  await ensureAuthColumns()
  const profile = await getProfileByWhatsApp(whatsapp)
  const validPassword = await verifyPassword(password, profile?.password_hash || null)
  if (!profile?.id || !validPassword) {
    throw createError({ statusCode: 401, statusMessage: 'WhatsApp ou senha inválidos.' })
  }
  const current = await getProfileById(profile.id)
  if (!current?.id || current.is_active === false) {
    throw createError({ statusCode: 401, statusMessage: 'WhatsApp ou senha inválidos.' })
  }

  const { token, expiresIn } = createSessionToken({
    userId: profile.id,
    email: String(profile.email),
    role: current.role || 'user'
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
  setCookie(event, 'active-account-id', '', {
    ...getAuthCookieOptions(event, 0),
    httpOnly: true
  })

  await updateLastLoginAt(profile.id)

  return {
    success: true,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? null,
      avatar_url: profile.avatar_url ?? null,
      role: current.role || 'user',
      editorPermissions: normalizeEditorPermissions(current.editor_permissions)
    },
    session: {
      access_token: token,
      expires_in: expiresIn
    }
  }
})
