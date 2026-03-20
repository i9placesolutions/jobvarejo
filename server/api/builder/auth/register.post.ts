import { enforceRateLimit } from '../../../utils/rate-limit'
import { hashPassword } from '../../../utils/password'
import { createBuilderSessionToken } from '../../../utils/builder-session-token'
import { createTenant, getTenantByEmail, normalizeBuilderEmail } from '../../../utils/builder-auth-db'

const normalizeName = (value: unknown): string => String(value || '').trim().replace(/\s+/g, ' ')

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  await enforceRateLimit(event, `builder-register:${ip}`, 20, 60_000)

  const body = await readBody<Record<string, any>>(event)
  const name = normalizeName(body?.name)
  const email = normalizeBuilderEmail(body?.email)
  const password = String(body?.password || '')

  if (!name || name.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Nome obrigatorio' })
  }
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'E-mail invalido' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Senha deve ter no minimo 6 caracteres' })
  }

  const existing = await getTenantByEmail(email)
  if (existing?.id) {
    throw createError({ statusCode: 409, statusMessage: 'Ja existe uma conta com este e-mail' })
  }

  const passwordHash = await hashPassword(password)

  const tenant = await createTenant({ name, email, passwordHash })

  const { token, expiresIn } = createBuilderSessionToken({
    tenantId: tenant.id,
    email: tenant.email,
    name: tenant.name
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

  return {
    tenant: {
      id: tenant.id,
      email: tenant.email,
      name: tenant.name
    }
  }
})
