import { enforceRateLimit } from '../../../utils/rate-limit'
import { verifyPassword } from '../../../utils/password'
import { createBuilderSessionToken } from '../../../utils/builder-session-token'
import { getTenantByEmail, normalizeBuilderEmail, updateTenantLastLogin } from '../../../utils/builder-auth-db'
import { getProfileByEmail } from '../../../utils/auth-db'

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

  // 1) Try builder_tenants table first
  const tenant = await getTenantByEmail(email)
  if (tenant?.id) {
    const validPassword = await verifyPassword(password, tenant.password_hash || null)
    if (!validPassword) {
      throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha invalidos' })
    }

    const { token, expiresIn } = createBuilderSessionToken({
      tenantId: tenant.id,
      email: String(tenant.email),
      name: String(tenant.name)
    })

    setBuilderCookies(event, token, expiresIn)
    await updateTenantLastLogin(tenant.id)

    return {
      tenant: {
        id: tenant.id,
        email: tenant.email,
        name: tenant.name
      }
    }
  }

  // 2) Fallback: allow super_admin / admin from profiles table
  const profile = await getProfileByEmail(email)
  if (profile?.id) {
    const role = String(profile.role || '').trim()
    const isAdmin = role === 'super_admin' || role === 'admin'
    if (!isAdmin) {
      throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha invalidos' })
    }

    const validPassword = await verifyPassword(password, (profile as any).password_hash || null)
    if (!validPassword) {
      throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha invalidos' })
    }

    const { token, expiresIn } = createBuilderSessionToken({
      tenantId: profile.id,
      email: String(profile.email),
      name: String(profile.name || 'Admin'),
      isAdmin: true
    })

    setBuilderCookies(event, token, expiresIn)

    return {
      tenant: {
        id: profile.id,
        email: profile.email,
        name: profile.name || 'Admin',
        _isAdmin: true
      }
    }
  }

  throw createError({ statusCode: 401, statusMessage: 'E-mail ou senha invalidos' })
})

function setBuilderCookies(event: any, token: string, expiresIn: number) {
  const secure = !import.meta.dev
  setCookie(event, 'builder-access-token', token, {
    path: '/',
    maxAge: expiresIn,
    sameSite: 'lax',
    secure,
    httpOnly: true
  })
  setCookie(event, 'builder-authenticated', 'true', {
    path: '/',
    maxAge: expiresIn,
    sameSite: 'lax',
    secure,
    httpOnly: false
  })
}
