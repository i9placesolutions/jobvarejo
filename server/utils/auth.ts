import type { H3Event } from 'h3'
import type { UserRole } from '~/types/auth'
import { getProfileById } from './auth-db'
import { verifySessionToken } from './session-token'

const _profileCache = new Map<string, { id: string; email: string; role: string; name: string | null; avatar_url: string | null; expiresAt: number }>()
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000

const getCachedProfile = async (id: string) => {
  const now = Date.now()
  const cached = _profileCache.get(id)
  if (cached && cached.expiresAt > now) return cached
  _profileCache.delete(id)
  const profile = await getProfileById(id)
  if (profile?.id) {
    _profileCache.set(profile.id, {
      id: profile.id,
      email: String(profile.email),
      role: String(profile.role || 'user'),
      name: profile.name ?? null,
      avatar_url: profile.avatar_url ?? null,
      expiresAt: now + PROFILE_CACHE_TTL_MS
    })
    return _profileCache.get(profile.id)!
  }
  return null
}

export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  user_metadata: {
    name: string | null
    avatar_url: string | null
  }
}

const getBearerToken = (event: H3Event): string | null => {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader) {
    const prefix = 'Bearer '
    if (authHeader.startsWith(prefix)) {
      const token = authHeader.slice(prefix.length).trim()
      if (token) return token
    }
  }

  const cookieTokenRaw =
    getCookie(event, 'access-token') ||
    getCookie(event, 'sb-access-token') ||
    getCookie(event, 'sb_access_token') ||
    null
  if (!cookieTokenRaw) return null

  try {
    const decoded = decodeURIComponent(String(cookieTokenRaw))
    return decoded.trim() || null
  } catch {
    return String(cookieTokenRaw).trim() || null
  }
}

export const requireAuthenticatedUser = async (event: H3Event): Promise<AuthenticatedUser> => {
  const token = getBearerToken(event)
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Missing Authorization bearer token'
    })
  }

  const payload = verifySessionToken(token)
  if (!payload?.sub) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired auth token'
    })
  }

  const profile = await getCachedProfile(payload.sub)
  if (!profile?.id || !profile?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired auth token'
    })
  }

  return {
    id: profile.id,
    email: String(profile.email),
    role: (String(profile.role || 'user') as UserRole),
    user_metadata: {
      name: profile.name ?? null,
      avatar_url: profile.avatar_url ?? null
    }
  }
}

export const requireAdminUser = async (
  event: H3Event
): Promise<{ user: AuthenticatedUser; role: UserRole }> => {
  const user = await requireAuthenticatedUser(event)

  const role = String(user.role || '').trim() as UserRole
  const isAdmin = role === 'admin' || role === 'super_admin'

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Admin access required'
    })
  }

  return { user, role }
}
