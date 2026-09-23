import { enforceRateLimit } from '../../utils/rate-limit'
import { ensureAuthColumns, getProfileByEmail, getProfileByWhatsApp, normalizeEmail, setLoginWhatsAppForUser } from '../../utils/auth-db'
import { consumeWhatsAppChallenge, ensureWhatsAppChallengeSchema } from '../../utils/auth-whatsapp'
import { verifyPassword } from '../../utils/password'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `auth-link-whatsapp:${ip}`, 10, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const email = normalizeEmail(body?.email)
  const password = String(body?.password || '')
  const whatsapp = normalizeBrazilWhatsApp(body?.whatsapp)
  const code = String(body?.whatsapp_code || '').trim()

  if (!EMAIL_PATTERN.test(email) || !password || !whatsapp || !/^\d{6}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'Confira o e-mail, a senha, o WhatsApp e o código.' })
  }

  await ensureAuthColumns()
  await ensureWhatsAppChallengeSchema()

  const profile = await getProfileByEmail(email)
  const validPassword = await verifyPassword(password, profile?.password_hash || null)
  if (!profile?.id || !validPassword) {
    throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha inválidos.' })
  }
  if (profile.login_whatsapp) {
    throw createError({ statusCode: 409, statusMessage: 'Esta conta já tem um WhatsApp vinculado. Entre com ele.' })
  }
  if (await getProfileByWhatsApp(whatsapp)) {
    throw createError({ statusCode: 409, statusMessage: 'Este WhatsApp já está vinculado a uma conta.' })
  }

  const codeIsValid = await consumeWhatsAppChallenge({
    phone: whatsapp,
    purpose: 'link',
    code,
    userId: profile.id
  })
  if (!codeIsValid) {
    throw createError({ statusCode: 400, statusMessage: 'Código inválido ou expirado. Solicite outro.' })
  }

  try {
    const linked = await setLoginWhatsAppForUser(profile.id, whatsapp)
    if (!linked) {
      throw createError({ statusCode: 409, statusMessage: 'Esta conta já tem um WhatsApp vinculado.' })
    }
  } catch (error: any) {
    if (String(error?.code || '') === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Este WhatsApp já está vinculado a outra conta.' })
    }
    throw error
  }

  return { success: true }
})
