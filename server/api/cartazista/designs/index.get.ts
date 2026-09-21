import { cartazistaUser, cartazistaDatabaseError } from '~/server/utils/cartazista'
import { pgQuery } from '~/server/utils/postgres'

export default defineEventHandler(async (event) => {
  const user = await cartazistaUser(event)
  try {
    const result = await pgQuery(
      `select id, name, state, revision, created_at, updated_at
         from public.cartazista_designs
        where owner_id = $1
        order by updated_at desc
        limit 200`,
      [user.id]
    )
    return result.rows
  } catch (error: any) {
    if (error?.code === '42P01') return []
    return cartazistaDatabaseError(error)
  }
})
