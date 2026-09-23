import { enforceRateLimit } from '../../utils/rate-limit'
import { ensureAuthColumns, getProfileByWhatsApp, updatePasswordForUser } from '../../utils/auth-db'
import { consumeWhatsAppChallenge, ensureWhatsAppChallengeSchema } from '../../utils/auth-whatsapp'
import { hashPassword } from '../../utils/password'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `auth-reset-whatsapp:${ip}`, 10, 15 * 60_000)

  const body = await readBody<Record<string, any>>(event)
  const whatsapp = normalizeBrazilWhatsApp(body?.whatsapp)
  const code = String(body?.code || '').trim()
  const password = String(body?.password || '')

  if (!whatsapp || !/^\d{6}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: 'Código inválido ou expirado. Solicite outro pelo WhatsApp.' })
  }
  if (password.length < 8 || password.length > 256) {
    throw createError({ statusCode: 400, statusMessage: 'A senha deve ter entre 8 e 256 caracteres.' })
  }

  await ensureAuthColumns()
  await ensureWhatsAppChallengeSchema()

  const profile = await getProfileByWhatsApp(whatsapp)
  const codeIsValid = await consumeWhatsAppChallenge({
    phone: whatsapp,
    purpose: 'password_reset',
    code,
    userId: profile?.id || null
  })

  if (!profile?.id || !codeIsValid) {
    throw createError({ statusCode: 400, statusMessage: 'Código inválido ou expirado. Solicite outro pelo WhatsApp.' })
  }

  const passwordHash = await hashPassword(password)
  await updatePasswordForUser(profile.id, passwordHash)

  return {
    success: true,
    message: 'Senha redefinida. Entre com WhatsApp e sua nova senha.'
  }
})
