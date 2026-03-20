import type { H3Event } from 'h3'
import type { BuilderTenant } from '~/types/builder'
import { getTenantById } from './builder-auth-db'
import { verifyBuilderSessionToken } from './builder-session-token'

const _tenantCache = new Map<string, { tenant: BuilderTenant; expiresAt: number }>()
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000

const getCachedTenant = async (id: string): Promise<BuilderTenant | null> => {
  const now = Date.now()
  const cached = _tenantCache.get(id)
  if (cached && cached.expiresAt > now) return cached.tenant
  _tenantCache.delete(id)
  const row = await getTenantById(id)
  if (row?.id) {
    const tenant: BuilderTenant = {
      id: row.id,
      email: String(row.email),
      name: String(row.name),
      slug: row.slug ?? null,
      logo: row.logo ?? null,
      logo_position: row.logo_position ?? {},
      slogan: row.slogan ?? null,
      phone: row.phone ?? null,
      phone2: row.phone2 ?? null,
      whatsapp: row.whatsapp ?? null,
      instagram: row.instagram ?? null,
      facebook: row.facebook ?? null,
      website: row.website ?? null,
      address: row.address ?? null,
      payment_notes: row.payment_notes ?? null,
      cep: row.cep ?? null,
      segment1: row.segment1 ?? null,
      segment2: row.segment2 ?? null,
      segment3: row.segment3 ?? null,
      show_on_portal: row.show_on_portal ?? false,
      plan: row.plan ?? 'free',
      is_active: row.is_active ?? true,
      last_login_at: row.last_login_at ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at)
    }
    _tenantCache.set(id, { tenant, expiresAt: now + TENANT_CACHE_TTL_MS })
    return tenant
  }
  return null
}

const getBuilderToken = (event: H3Event): string | null => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader) {
    const prefix = 'Bearer '
    if (authHeader.startsWith(prefix)) {
      const token = authHeader.slice(prefix.length).trim()
      if (token) return token
    }
  }

  const cookieTokenRaw = getCookie(event, 'builder-access-token') || null
  if (!cookieTokenRaw) return null

  try {
    const decoded = decodeURIComponent(String(cookieTokenRaw))
    return decoded.trim() || null
  } catch {
    return String(cookieTokenRaw).trim() || null
  }
}

export const requireBuilderTenant = async (event: H3Event): Promise<BuilderTenant> => {
  const token = getBuilderToken(event)
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing builder authorization token'
    })
  }

  const payload = verifyBuilderSessionToken(token)
  if (!payload?.sub) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired builder token'
    })
  }

  const tenant = await getCachedTenant(payload.sub)
  if (!tenant?.id || !tenant?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired builder token'
    })
  }

  if (!tenant.is_active) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Builder tenant account is disabled'
    })
  }

  return tenant
}
