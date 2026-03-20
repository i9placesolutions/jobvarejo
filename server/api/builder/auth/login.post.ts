import { enforceRateLimit } from '../../../utils/rate-limit'
import { verifyPassword } from '../../../utils/password'
import { createBuilderSessionToken } from '../../../utils/builder-session-token'
import { getTenantByEmail, normalizeBuilderEmail, updateTenantLastLogin } from '../../../utils/builder-auth-db'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `builder-login:${ip}`, 30, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const email = normalizeBuilderEmail(body?.email)
  const password = String(body?.password || '')

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'E-mail invalido' })
  }
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'Senha obrigatoria' })
  }

  const tenant = await getTenantByEmail(email)
  const validPassword = await verifyPassword(password, tenant?.password_hash || null)
  if (!tenant?.id || !validPassword) {
    throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha invalidos' })
  }

  const { token, expiresIn } = createBuilderSessionToken({
    tenantId: tenant.id,
    email: String(tenant.email),
    name: String(tenant.name)
  })

  const secure = !import.meta.dev
  setCookie(event, 'builder-access-token', token, {
    path: '/builder',
    maxAge: expiresIn,
    sameSite: 'lax',
    secure,
    httpOnly: true
  })
  setCookie(event, 'builder-authenticated', 'true', {
    path: '/builder',
    maxAge: expiresIn,
    sameSite: 'lax',
    secure,
    httpOnly: false
  })

  await updateTenantLastLogin(tenant.id)

  return {
    tenant: {
      id: tenant.id,
      email: tenant.email,
      name: tenant.name
    }
  }
})
