import nodemailer from 'nodemailer'
const [host, portRaw, secureRaw, from, brandRaw, logoRaw, supportRaw, signatureRaw] = process.argv.slice(2)
const port = Number(portRaw || 465)
const secure = String(secureRaw || 'true').toLowerCase() === 'true'
const brand = (brandRaw || 'Job Varejo').trim() || 'Job Varejo'
const logo = (logoRaw || '').trim()
const support = (supportRaw || 'atendimento@jobvarejo.com.br').trim()
const signature = (signatureRaw || `Equipe ${brand}`).trim()
const resetUrl = 'https://jobvarejo.com.br/auth/reset-password?token=preview-theme-token'
const logoSection = logo
  ? `<img src="${logo}" alt="${brand}" style="max-width:180px;max-height:38px;display:block;margin:0 auto;" />`
  : `<span style="font-size:13px;font-weight:700;letter-spacing:.3px;">${brand}</span>`
const supportSection = support
  ? `<p style="margin:12px 0 0 0;font-size:12px;line-height:1.6;color:#71717a;">Suporte: <a href="mailto:${support}" style="color:#a1a1aa;text-decoration:none;">${support}</a></p>`
  : ''
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Preview tema email</title></head><body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,Helvetica,sans-serif;color:#e4e4e7;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0f;padding:28px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;"><tr><td style="padding:0 0 14px 0;color:#a1a1aa;font-size:13px;text-align:center;">${logoSection}</td></tr><tr><td style="background:#14141d;border:1px solid #2a2a38;border-radius:16px;padding:28px;"><div style="display:inline-block;padding:6px 10px;border:1px solid #473067;background:#261a39;color:#d8b4fe;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.2px;">SEGURANCA DA CONTA</div><h1 style="margin:16px 0 10px 0;font-size:26px;line-height:1.2;color:#ffffff;">Redefinir senha</h1><p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#c4c4d0;">Preview do novo tema de e-mail de recuperação.</p><table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;"><tr><td align="center" style="border-radius:10px;background:#7c3aed;"><a href="${resetUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Redefinir minha senha</a></td></tr></table><p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#a1a1aa;">Este link expira em <strong style="color:#ffffff;">60 minuto(s)</strong>.</p><p style="margin:0 0 20px 0;word-break:break-all;font-size:13px;line-height:1.6;"><a href="${resetUrl}" style="color:#c4b5fd;text-decoration:underline;">${resetUrl}</a></p><hr style="border:none;border-top:1px solid #2a2a38;margin:0 0 16px 0;" /><p style="margin:0;font-size:13px;line-height:1.6;color:#8f8f9b;">Se voce nao solicitou essa alteracao, ignore este e-mail.</p><p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:#b4b4bf;">${signature}</p>${supportSection}</td></tr><tr><td style="padding:14px 6px 0 6px;color:#71717a;font-size:12px;text-align:center;">© ${new Date().getFullYear()} ${brand}</td></tr></table></td></tr></table></body></html>`
const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user: 'atendimento@jobvarejo.com.br',
    pass: 'RMN@ssw0rd@'
  },
  tls: { rejectUnauthorized: false }
})
const info = await transporter.sendMail({
  from,
  to: 'atendimento@jobvarejo.com.br',
  subject: 'Preview visual - Recuperacao de senha',
  text: `Preview visual do novo tema de recuperação.\n\nLink exemplo: ${resetUrl}`,
  html
})
console.log('PREVIEW_MAIL_SENT', info.messageId || 'no-message-id')
