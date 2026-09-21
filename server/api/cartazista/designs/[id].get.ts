import { cartazistaId, cartazistaUser, cartazistaDatabaseError } from '~/server/utils/cartazista'
import { pgOneOrNull } from '~/server/utils/postgres'

export default defineEventHandler(async (event) => {
  const user = await cartazistaUser(event)
  const id = cartazistaId(event)
  try {
    const row = await pgOneOrNull(
      'select id, name, state, revision, created_at, updated_at from public.cartazista_designs where id = $1 and owner_id = $2',
      [id, user.id]
    )
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Cartaz não encontrado.' })
    return row
  } catch (error: any) {
    if (error?.statusCode) throw error
    return cartazistaDatabaseError(error)
  }
})
