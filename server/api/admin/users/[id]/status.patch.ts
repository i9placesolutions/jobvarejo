import { requireSuperAdminUser } from '../../../../utils/auth'
import { UUID_PATTERN } from '../../../../utils/admin-users'
import { manageAccountAccess } from '../../../../utils/account-access'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { invalidateBuilderTenantCache } from '../../../../utils/builder-auth'

export default defineEventHandler(async event => {
  const actor = await requireSuperAdminUser(event)
  await enforceRateLimit(event, `admin-users-status:${actor.actorId}`, 30, 60_000)
  const id = String(getRouterParam(event, 'id') || '')
  if (!UUID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: 'Usuário inválido.' })
  const body = await readBody(event)
  if (typeof body?.is_active !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Status inválido.' })
  const user = await manageAccountAccess(actor.actorId, id, body.is_active ? 'unblock' : 'block')
  invalidateBuilderTenantCache(id)
  return { user }
})
