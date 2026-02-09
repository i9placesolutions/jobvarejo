import { requireAuthenticatedUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuthenticatedUser(event)

  if (process.env.NODE_ENV !== 'development') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return {
    message: 'TESTE API funcionando!',
    timestamp: new Date().toISOString()
  }
})
