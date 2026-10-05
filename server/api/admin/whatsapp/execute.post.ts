import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { assertWhatsAppSameOrigin, callWhatsApp } from '../../../utils/whatsapp-admin'
export default defineEventHandler(async event => {
  const { user, role } = await requireAdminUser(event)
  assertWhatsAppSameOrigin(event)
  await enforceRateLimit(event, `whatsapp-admin:${user.id}`, 180, 60_000)
  const input = await readBody(event)
  if (!input || typeof input.operationId !== 'string') throw createError({ statusCode: 400, statusMessage: 'Informe a operação.' })
  return callWhatsApp(input.operationId, input, role)
})
