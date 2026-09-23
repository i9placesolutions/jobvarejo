import { clearResetTokenForUser, ensureAuthColumns, getProfileByWhatsApp } from '../../utils/auth-db'
import { ensureWhatsAppChallengeSchema, invalidateWhatsAppChallenge, issueWhatsAppChallenge } from '../../utils/auth-whatsapp'
import { sendWhatsAppText } from '../../utils/uazapi'
import { normalizeBrazilWhatsApp } from '~/utils/whatsapp-auth'

const GENERIC_RESPONSE = {
  success: true,
  expires_in: 600,
  message: 'Se este WhatsApp estiver vinculado à conta, enviaremos um código de recuperação.'
}

const waitForMinimumResponseTime = async (startedAt: number): Promise<void> => {
  const remainingMs = 750 - (Date.now() - startedAt)
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs))
  }
}

export default defineEventHandler(async (event) => {
  const startedAt = Date.now()
  const body = await readBody<Record<string, any>>(event)
  const whatsapp = normalizeBrazilWhatsApp(body?.whatsapp)
  if (!whatsapp) {
    throw createError({ statusCode: 400, statusMessage: 'Informe um WhatsApp brasileiro válido com DDD.' })
  }

  await ensureAuthColumns()
  await ensureWhatsAppChallengeSchema()

  const profile = await getProfileByWhatsApp(whatsapp)
  if (profile?.id) {
    try {
      const code = await issueWhatsAppChallenge({
        phone: whatsapp,
        purpose: 'password_reset',
        userId: profile.id
      })

      // A recuperação agora é exclusivamente por WhatsApp: qualquer token
      // legado de redefinição por e-mail deixa de ser válido.
      await clearResetTokenForUser(profile.id)

      try {
        await sendWhatsAppText({
          phone: whatsapp,
          text: `Seu código para redefinir a senha do JobVarejo é ${code}. Ele expira em 10 minutos. Não compartilhe este código.`
        })
      } catch {
        try {
          await invalidateWhatsAppChallenge({ phone: whatsapp, purpose: 'password_reset', code })
        } catch {
          // Keep the public response generic even if cleanup also fails.
        }
        console.warn('[auth] Não foi possível confirmar a entrega do código de recuperação pelo WhatsApp.')
      }
    } catch (error: any) {
      if (Number(error?.statusCode || 0) !== 429) throw error
    }
  }

  await waitForMinimumResponseTime(startedAt)
  return GENERIC_RESPONSE
})
