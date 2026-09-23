import { ensureAuthColumns, getProfileByEmail, getProfileByWhatsApp, normalizeEmail } from '../../utils/auth-db'
import { ensureWhatsAppChallengeSchema, issueWhatsAppChallenge, invalidateWhatsAppChallenge, type WhatsAppChallengePurpose } from '../../utils/auth-whatsapp'
import { verifyPassword } from '../../utils/password'
import { sendWhatsAppText } from '../../utils/uazapi'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, any>>(event)
  const purpose = String(body?.purpose || '') as WhatsAppChallengePurpose
  const whatsapp = normalizeBrazilWhatsApp(body?.whatsapp)
  if (!['register', 'link'].includes(purpose)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de confirmação inválido.' })
  }
  if (!whatsapp) {
    throw createError({ statusCode: 400, statusMessage: 'Informe um WhatsApp válido com DDD.' })
  }

  await ensureAuthColumns()
  await ensureWhatsAppChallengeSchema()

  let userId: string | null = null
  if (purpose === 'register') {
    const email = normalizeEmail(body?.email)
    if (!EMAIL_PATTERN.test(email)) {
      throw createError({ statusCode: 400, statusMessage: 'Informe um e-mail válido para recuperação da conta.' })
    }

    const [existingEmail, existingWhatsApp] = await Promise.all([
      getProfileByEmail(email),
      getProfileByWhatsApp(whatsapp)
    ])
    if (existingEmail?.id || existingWhatsApp?.id) {
      throw createError({ statusCode: 409, statusMessage: 'Este e-mail ou WhatsApp já está vinculado a uma conta.' })
    }
  } else {
    const email = normalizeEmail(body?.email)
    const password = String(body?.password || '')
    if (!EMAIL_PATTERN.test(email) || !password) {
      throw createError({ statusCode: 400, statusMessage: 'Informe o e-mail e a senha atuais da conta.' })
    }

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
    userId = profile.id
  }

  const code = await issueWhatsAppChallenge({ phone: whatsapp, purpose, userId })
  try {
    await sendWhatsAppText({
      phone: whatsapp,
      text: `Seu código de confirmação do JobVarejo é ${code}. Ele expira em 10 minutos. Não compartilhe este código.`
    })
  } catch (error) {
    await invalidateWhatsAppChallenge({ phone: whatsapp, purpose, code })
    throw error
  }

  return { success: true, expires_in: 600 }
})
