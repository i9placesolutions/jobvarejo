import type { H3Event } from 'h3'
import type { UserRole } from '~/types/auth'
import { assertSuperAdminRole } from './role-guard'
import { getProfileById } from './auth-db'
import { verifySessionToken } from './session-token'
import { verifyBuilderSessionToken } from './builder-session-token'
import { assertRoleApiAccess } from './access-policy'
import { normalizeEditorPermissions, type EditorPermissions } from '../../shared/access-control'
import { getRequestURL } from 'h3'

const ACTIVE_ACCOUNT_COOKIE = 'active-account-id'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface AuthenticatedUser {
  id: string
  actorId: string
  accountId: string
  email: string
  role: UserRole
  editorPermissions: EditorPermissions
  user_metadata: {
    name: string | null
    avatar_url: string | null
  }
}

export const getBearerToken = (event: H3Event): string | null => {
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
  const existing = event.context.authenticatedUser as AuthenticatedUser | undefined
  if (existing) return existing
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

  // Role, active status and editor permissions are read on every request so
  // disabling or demoting a user takes effect even with an unexpired JWT.
  const profile = await getProfileById(payload.sub)
  if (!profile?.id || !profile?.email || profile.is_active === false) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired auth token'
    })
  }

  const path = getRequestURL(event).pathname
  const permissions = normalizeEditorPermissions(profile.editor_permissions)
  await assertRoleApiAccess(event, profile.role, permissions)

  let accountId = profile.id
  const ownIdentityRoute = path.startsWith('/api/auth/') || path.startsWith('/api/admin/') ||
    path.startsWith('/api/access/') || path === '/api/notifications' || path === '/api/profiles' ||
    (path === '/api/profile' && String(getQuery(event).self || '') === '1')
  if (!ownIdentityRoute && (profile.role === 'super_admin' || profile.role === 'admin' || profile.role === 'editor')) {
    const selected = String(getCookie(event, ACTIVE_ACCOUNT_COOKIE) || '').trim()
    if (selected) {
      if (!UUID_PATTERN.test(selected)) throw createError({ statusCode: 403, statusMessage: 'Conta selecionada inválida.' })
      const target = await getProfileById(selected)
      if (!target?.id || target.role !== 'user' || target.is_active === false) {
        throw createError({ statusCode: 403, statusMessage: 'Conta selecionada indisponível.' })
      }
      accountId = target.id
    }
  }

  const user: AuthenticatedUser = {
    id: accountId,
    actorId: profile.id,
    accountId,
    email: String(profile.email),
    role: profile.role,
    editorPermissions: permissions,
    user_metadata: {
      name: profile.name ?? null,
      avatar_url: profile.avatar_url ?? null
    }
  }
  event.context.authenticatedUser = user
  return user
}

export const requireAdminUser = async (
  event: H3Event
): Promise<{ user: AuthenticatedUser; role: UserRole }> => {
  // Try main auth token first
  const mainToken = getBearerToken(event)
  if (mainToken) {
    const user = await requireAuthenticatedUser(event)
    const role = String(user.role || '').trim() as UserRole
    const isAdmin = role === 'admin' || role === 'super_admin'
    if (!isAdmin) {
      throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
    }
    return { user, role }
  }

  // Fallback: try builder admin token
  const builderTokenRaw = getCookie(event, 'builder-access-token') || null
  if (builderTokenRaw) {
    let decoded: string
    try { decoded = decodeURIComponent(String(builderTokenRaw)).trim() } catch { decoded = String(builderTokenRaw).trim() }
    const payload = verifyBuilderSessionToken(decoded)
    if (payload?.isAdmin && payload?.sub) {
      const profile = await getProfileById(payload.sub)
      if (profile?.id && profile.is_active !== false) {
        const role = String(profile.role || 'user') as UserRole
        if (role === 'admin' || role === 'super_admin') {
          return {
            user: {
              id: profile.id,
              actorId: profile.id,
              accountId: profile.id,
              email: String(profile.email),
              role,
              editorPermissions: normalizeEditorPermissions(profile.editor_permissions),
              user_metadata: { name: profile.name ?? null, avatar_url: profile.avatar_url ?? null }
            },
            role
          }
        }
      }
    }
  }

  throw createError({ statusCode: 401, statusMessage: 'Admin access required' })
}

export const requireSuperAdminUser = async (event: H3Event): Promise<AuthenticatedUser> => {
  const user = await requireAuthenticatedUser(event)
  assertSuperAdminRole(user.role)
  return user
}
