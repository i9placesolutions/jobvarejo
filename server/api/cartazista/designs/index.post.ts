import { randomUUID } from 'node:crypto'
import { cartazistaUser, cartazistaDatabaseError } from '~/server/utils/cartazista'
import { cartazistaDesignSchema, parseCartazistaInput } from '~/server/utils/cartazista-schema'
import { pgOneOrNull } from '~/server/utils/postgres'
import { parseAndStringifyJsonbParam } from '~/server/utils/jsonb'

export default defineEventHandler(async (event) => {
  const user = await cartazistaUser(event)
  const data = parseCartazistaInput(cartazistaDesignSchema, await readBody(event))
  try {
    const id = data.id || randomUUID()
    const row = await pgOneOrNull(
      `insert into public.cartazista_designs(id, owner_id, name, state)
       values ($1, $2, $3, $4::jsonb)
       on conflict (id) do nothing
       returning *`,
      [id, user.id, data.name, parseAndStringifyJsonbParam(data.state, 'state')]
    )
    if (row) return row
    const existing = await pgOneOrNull(
      'select * from public.cartazista_designs where id = $1 and owner_id = $2',
      [id, user.id]
    )
    if (!existing) throw createError({ statusCode: 409, statusMessage: 'Não foi possível criar o cartaz.' })
    return existing
  } catch (error: any) {
    if (error?.statusCode) throw error
    return cartazistaDatabaseError(error)
  }
})
