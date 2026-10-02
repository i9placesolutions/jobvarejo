import { requireSuperAdminUser } from '../../../utils/auth'
import { UUID_PATTERN } from '../../../utils/admin-users'
import { manageAccountAccess } from '../../../utils/account-access'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { invalidateBuilderTenantCache } from '../../../utils/builder-auth'

export default defineEventHandler(async event => {
  const actor = await requireSuperAdminUser(event)
  await enforceRateLimit(event, `admin-users-remove:${actor.actorId}`, 20, 60_000)
  const id = String(getRouterParam(event, 'id') || '')
  if (!UUID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: 'Usuário inválido.' })
  const body = await readBody(event)
  if (body?.confirmId !== id) throw createError({ statusCode: 400, statusMessage: 'Confirme o usuário que será removido.' })
  const user = await manageAccountAccess(actor.actorId, id, 'remove')
  invalidateBuilderTenantCache(id)
  return { user }
})
