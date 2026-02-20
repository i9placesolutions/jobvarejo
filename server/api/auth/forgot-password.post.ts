import { ensureAuthColumns, normalizeEmail, setResetTokenForEmail } from '../../utils/auth-db'
import { isSmtpConfigured, sendPasswordResetEmail } from '../../utils/email'
import { enforceRateLimit } from '../../utils/rate-limit'
import { createPasswordResetToken, hashOpaqueToken } from '../../utils/session-token'

const getResetTokenTtlMinutes = (): number => {
  const config = useRuntimeConfig()
  const raw = Number.parseInt(
    String((config as any).authResetTokenTtlMinutes || process.env.AUTH_RESET_TOKEN_TTL_MINUTES || '60'),
    10
  )
  if (!Number.isFinite(raw) || raw <= 0) return 60
  return Math.min(raw, 24 * 60)
}

const resolveAppOrigin = (event: any): string => {
  const config = useRuntimeConfig()
  const configured = String((config as any).appBaseUrl || process.env.APP_BASE_URL || '').trim()
  if (configured) {
    try {
      const parsed = new URL(configured)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      // fallback to request origin
    }
  }
  return getRequestURL(event).origin
}

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  enforceRateLimit(event, `auth-forgot-password:${ip}`, 15, 60_000)
  const ttlMinutes = getResetTokenTtlMinutes()
  const smtpConfigured = isSmtpConfigured()
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction && !smtpConfigured) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Recuperacao de senha indisponivel. Contate o suporte.'
    })
  }

  const body = await readBody<Record<string, any>>(event)
  const email = normalizeEmail(body?.email)
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'E-mail invalido' })
  }

  await ensureAuthColumns()
  const token = createPasswordResetToken()
  const tokenHash = hashOpaqueToken(token)
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString()

  const updated = await setResetTokenForEmail(email, tokenHash, expiresAt)

  let debugResetUrl: string | null = null
  if (updated?.id) {
    const resetUrl = `${resolveAppOrigin(event)}/auth/reset-password?token=${encodeURIComponent(token)}`
    if (smtpConfigured) {
      try {
        await sendPasswordResetEmail({
          to: email,
          resetUrl,
          ttlMinutes
        })
      } catch (error: any) {
        console.error('[auth] Falha ao enviar e-mail de reset:', error?.message || String(error))
        throw createError({
          statusCode: 502,
          statusMessage: 'Falha ao enviar e-mail de recuperacao. Tente novamente.'
        })
      }
    } else {
      debugResetUrl = resetUrl
      console.warn(`[auth] Reset link gerado para ${email}: ${debugResetUrl}`)
    }
  }

  return {
    success: true,
    message: 'Se o e-mail existir, enviaremos instrucoes para redefinir a senha.',
    debugResetUrl
  }
})
