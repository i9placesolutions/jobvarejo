type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

type EmailBrandConfig = {
  brandName: string
  logoUrl: string
  supportEmail: string
  signatureName: string
}

let transporterCache: any | null = null

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const extractEmailAddress = (value: unknown): string => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const angled = raw.match(/<([^>]+)>/)
  const email = String(angled?.[1] || raw).trim()
  if (!email.includes('@')) return ''
  return email
}

const normalizeHttpUrl = (value: unknown): string => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

const resolveAppOriginFromConfig = (): string => {
  const config = useRuntimeConfig()
  const configured = String((config as any).appBaseUrl || process.env.APP_BASE_URL || '').trim()
  if (!configured) return ''
  try {
    const parsed = new URL(configured)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return ''
  }
}

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

const getEmailBrandConfig = (): EmailBrandConfig => {
  const config = useRuntimeConfig()
  const smtp = getSmtpConfig()

  const brandName = String((config as any).emailBrandName || process.env.EMAIL_BRAND_NAME || 'Job Varejo').trim() || 'Job Varejo'
  const explicitLogoUrl = normalizeHttpUrl((config as any).emailLogoUrl || process.env.EMAIL_LOGO_URL || '')
  const appOrigin = resolveAppOriginFromConfig()
  const fallbackLogoUrl = appOrigin ? `${appOrigin}/logo.png` : ''
  const logoUrl = explicitLogoUrl || fallbackLogoUrl
  const supportEmail =
    extractEmailAddress((config as any).emailSupportEmail || process.env.EMAIL_SUPPORT_EMAIL || '') ||
    extractEmailAddress(smtp.from) ||
    extractEmailAddress(smtp.user)
  const signatureName = String((config as any).emailSignatureName || process.env.EMAIL_SIGNATURE_NAME || '').trim() || `Equipe ${brandName}`

  return {
    brandName,
    logoUrl,
    supportEmail,
    signatureName
  }
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
  const brand = getEmailBrandConfig()
  const transporter = await getTransporter()

  const subject = 'Redefinição de senha'
  const resetUrl = String(params.resetUrl || '').trim()
  const safeUrl = escapeHtml(resetUrl)
  const safeBrand = escapeHtml(brand.brandName)
  const safeLogoUrl = escapeHtml(brand.logoUrl)
  const safeSignatureName = escapeHtml(brand.signatureName)
  const safeSupportEmail = escapeHtml(brand.supportEmail)
  const ttl = Number.parseInt(String(params.ttlMinutes || 60), 10) || 60
  const logoSection = brand.logoUrl
    ? `<img src="${safeLogoUrl}" alt="${safeBrand}" style="max-width:210px;max-height:56px;display:block;margin:0 auto;" />`
    : `<span style="font-size:16px;font-weight:800;letter-spacing:.2px;color:#2a2117;">${safeBrand}</span>`
  const supportSection = brand.supportEmail
    ? `<p style="margin:12px 0 0 0;font-size:12px;line-height:1.6;color:#7f6b58;">Suporte: <a href="mailto:${safeSupportEmail}" style="color:#8f2e22;text-decoration:none;font-weight:600;">${safeSupportEmail}</a></p>`
    : ''
  const text =
    `${brand.brandName}\n\n` +
    `Você solicitou a redefinição da sua senha.\n\n` +
    `Use o link abaixo para criar uma nova senha:\n${resetUrl}\n\n` +
    `Este link expira em ${ttl} minuto(s).\n\n` +
    `Se você não solicitou essa alteração, ignore este e-mail.`

  const html = `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#f8f7f3;font-family:Arial,Helvetica,sans-serif;color:#3f2f24;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      Recuperação de senha ${safeBrand}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f7f3;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;">
            <tr>
              <td style="padding:0 0 14px 0;color:#8f7d69;font-size:13px;text-align:center;">
                ${logoSection}
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e8d8bc;border-radius:16px;padding:28px;">
                <div style="height:4px;border-radius:999px;background:linear-gradient(90deg,#d1831f,#b3261e 55%,#d1831f);margin:0 0 18px 0;"></div>
                <div style="display:inline-block;padding:6px 10px;border:1px solid #e3cda8;background:#fff5df;color:#8f3a1f;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.2px;">
                  SEGURANÇA DA CONTA
                </div>
                <h1 style="margin:16px 0 10px 0;font-size:26px;line-height:1.2;color:#2a2117;">
                  Redefinir senha
                </h1>
                <p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:#5f4c3d;">
                  Recebemos uma solicitação para trocar a senha da sua conta.
                  Clique no botão abaixo para criar uma nova senha.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;">
                  <tr>
                    <td align="center" style="border-radius:10px;background:#b3261e;">
                      <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
                        Redefinir minha senha
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#6f5c4b;">
                  Este link expira em <strong style="color:#2a2117;">${ttl} minuto(s)</strong>.
                </p>
                <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#6f5c4b;">
                  Se o botão não abrir, copie e cole este link no navegador:
                </p>
                <p style="margin:0 0 20px 0;word-break:break-all;font-size:13px;line-height:1.6;">
                  <a href="${safeUrl}" style="color:#9c2f24;text-decoration:underline;">${safeUrl}</a>
                </p>
                <hr style="border:none;border-top:1px solid #eadfcd;margin:0 0 16px 0;" />
                <p style="margin:0;font-size:13px;line-height:1.6;color:#7f6b58;">
                  Se você não solicitou essa alteração, ignore este e-mail. Nenhuma mudança será feita sem a ação no link.
                </p>
                <p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:#5f4c3d;font-weight:600;">
                  ${safeSignatureName}
                </p>
                ${supportSection}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 6px 0 6px;color:#8f7d69;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} ${safeBrand}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim()

  await transporter.sendMail({
    from: cfg.from,
    to: params.to,
    subject,
    text,
    html
  })
}
