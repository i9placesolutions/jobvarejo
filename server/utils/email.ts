type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

let transporterCache: any | null = null

const parseBoolean = (value: unknown, fallback = false): boolean => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

const parsePort = (value: unknown, fallback = 587): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return fallback
  return parsed
}

export const getSmtpConfig = (): SmtpConfig => {
  const config = useRuntimeConfig()
  const host = String((config as any).smtpHost || process.env.SMTP_HOST || '').trim()
  const port = parsePort((config as any).smtpPort || process.env.SMTP_PORT, 587)
  const secure = parseBoolean((config as any).smtpSecure || process.env.SMTP_SECURE, false)
  const user = String((config as any).smtpUser || process.env.SMTP_USER || '').trim()
  const pass = String((config as any).smtpPass || process.env.SMTP_PASS || '').trim()
  const from = String((config as any).smtpFrom || process.env.SMTP_FROM || '').trim()

  return { host, port, secure, user, pass, from }
}

export const isSmtpConfigured = (): boolean => {
  const cfg = getSmtpConfig()
  return Boolean(cfg.host && cfg.port && cfg.from && cfg.user && cfg.pass)
}

const getTransporter = async () => {
  if (transporterCache) return transporterCache

  const cfg = getSmtpConfig()
  if (!isSmtpConfigured()) {
    throw new Error('SMTP not configured')
  }

  const nodemailerModule = await import('nodemailer')
  const nodemailer = (nodemailerModule as any)?.default || nodemailerModule
  transporterCache = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass
    }
  })

  return transporterCache
}

export const sendPasswordResetEmail = async (params: {
  to: string
  resetUrl: string
  ttlMinutes: number
}): Promise<void> => {
  const cfg = getSmtpConfig()
  const transporter = await getTransporter()

  const subject = 'Redefinicao de senha'
  const text =
    `Voce solicitou a redefinicao da sua senha.\n\n` +
    `Use o link abaixo para criar uma nova senha:\n${params.resetUrl}\n\n` +
    `Este link expira em ${params.ttlMinutes} minuto(s).\n\n` +
    `Se voce nao solicitou essa alteracao, ignore este e-mail.`

  const html =
    `<p>Voce solicitou a redefinicao da sua senha.</p>` +
    `<p><a href="${params.resetUrl}">Clique aqui para redefinir sua senha</a></p>` +
    `<p>Este link expira em <strong>${params.ttlMinutes} minuto(s)</strong>.</p>` +
    `<p>Se voce nao solicitou essa alteracao, ignore este e-mail.</p>`

  await transporter.sendMail({
    from: cfg.from,
    to: params.to,
    subject,
    text,
    html
  })
}
