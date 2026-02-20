import { requireAdminUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  enforceRateLimit(event, `test-remove-bg:${user.id}`, 20, 60_000)

  if (process.env.NODE_ENV !== 'development') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return {
    message: 'TESTE API funcionando!',
    timestamp: new Date().toISOString()
  }
})
