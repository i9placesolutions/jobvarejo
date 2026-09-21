import type { H3Event } from 'h3'
import { requireAuthenticatedUser } from './auth'
import { enforceRateLimit } from './rate-limit'

export const cartazistaUser = async (event: H3Event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `cartazista:${user.id}`, 180, 60_000)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return user
}

export const cartazistaId = (event: H3Event) => {
  const id = getRouterParam(event, 'id') || ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identificador inválido.' })
  }
  return id
}

export const cartazistaDatabaseError = (error: any): never => {
  if (error?.code === '42P01') {
    throw createError({
      statusCode: 503,
      statusMessage: 'O banco do editor de cartazes ainda precisa ser configurado.'
    })
  }
  throw error
}
