import { requireAuthenticatedUser } from '../../utils/auth'
import { getProfileById } from '../../utils/auth-db'
import { UUID_PATTERN } from '../../utils/admin-users'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getAuthCookieOptions } from '../../utils/auth-cookie'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  if (user.role !== 'super_admin' && user.role !== 'admin' && user.role !== 'editor') {
    throw createError({ statusCode: 403, statusMessage: 'Acesso administrativo necessário.' })
  }
  if (user.role === 'editor' && !Object.values(user.editorPermissions).some(actions => actions?.view)) {
    throw createError({ statusCode: 403, statusMessage: 'Editor sem áreas liberadas.' })
  }
  await enforceRateLimit(event, `access-account-select:${user.actorId}`, 60, 60_000)
  const body = await readBody<Record<string, unknown>>(event)
  const id = String(body?.id || '').trim()
  if (id) {
    if (!UUID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: 'Conta inválida.' })
    const target = await getProfileById(id)
    if (!target || target.role !== 'user' || target.is_active === false) {
      throw createError({ statusCode: 404, statusMessage: 'Conta de cliente não encontrada.' })
    }
  }
  setCookie(event, 'active-account-id', id, {
    ...getAuthCookieOptions(event, id ? 60 * 60 * 24 * 7 : 0),
    httpOnly: true,
  })
  return { selectedId: id || null }
})
