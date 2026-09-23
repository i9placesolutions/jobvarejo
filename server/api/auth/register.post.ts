import { countProfiles, createProfileWithPassword, ensureAuthColumns, getProfileByEmail, getProfileByWhatsApp, normalizeEmail } from '../../utils/auth-db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { hashPassword } from '../../utils/password'
import { createSessionToken } from '../../utils/session-token'
import { getAuthCookieOptions } from '../../utils/auth-cookie'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'
import { consumeWhatsAppChallenge, ensureWhatsAppChallengeSchema } from '../../utils/auth-whatsapp'
import type { UserRole } from '~/types/auth'

const normalizeName = (value: unknown): string => String(value || '').trim().replace(/\s+/g, ' ')
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `auth-register:${ip}`, 20, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const name = normalizeName(body?.name)
  const email = normalizeEmail(body?.email)
  const whatsapp = normalizeBrazilWhatsApp(body?.whatsapp)
  const password = String(body?.password || '')
  const whatsappCode = String(body?.whatsapp_code || '').trim()
  const autoLogin = Boolean(body?.auto_login)

  if (!name || name.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Nome invalido' })
  }
  if (name.length > 120) {
    throw createError({ statusCode: 400, statusMessage: 'Nome muito longo (max 120)' })
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe um e-mail válido para recuperação.' })
  }
  if (!whatsapp) {
    throw createError({ statusCode: 400, statusMessage: 'Informe um WhatsApp válido com DDD.' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Senha deve ter no minimo 8 caracteres' })
  }
  if (!/^\d{6}$/.test(whatsappCode)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o código de confirmação recebido no WhatsApp.' })
  }

  await ensureAuthColumns()
  await ensureWhatsAppChallengeSchema()

  const [existingEmail, existingWhatsApp] = await Promise.all([
    getProfileByEmail(email),
    getProfileByWhatsApp(whatsapp)
  ])
  if (existingEmail?.id || existingWhatsApp?.id) {
    throw createError({ statusCode: 409, statusMessage: 'Este e-mail ou WhatsApp já está vinculado a uma conta.' })
  }

  const validWhatsAppCode = await consumeWhatsAppChallenge({
    phone: whatsapp,
    purpose: 'register',
    code: whatsappCode
  })
  if (!validWhatsAppCode) {
    throw createError({ statusCode: 400, statusMessage: 'Código de confirmação inválido ou expirado. Solicite outro.' })
  }

  const currentUsers = await countProfiles()
  const role: UserRole = currentUsers === 0 ? 'super_admin' : 'user'
  const passwordHash = await hashPassword(password)

  let created
  try {
    created = await createProfileWithPassword({
      name,
      email,
      whatsapp,
      passwordHash,
      role
    })
  } catch (error: any) {
    if (String(error?.code || '') === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Este e-mail ou WhatsApp já está vinculado a uma conta.' })
    }
    throw error
  }

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

    const cookieBase = getAuthCookieOptions(event, expiresIn)
    setCookie(event, 'access-token', token, { ...cookieBase, httpOnly: true })
    setCookie(event, 'sb-access-token', token, { ...cookieBase, httpOnly: true })
    setCookie(event, 'authenticated', 'true', { ...cookieBase, httpOnly: false })

    response.session = {
      access_token: token,
      expires_in: expiresIn
    }
  }

  return response
})
