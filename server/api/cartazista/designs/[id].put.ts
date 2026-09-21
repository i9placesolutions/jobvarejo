import { cartazistaId, cartazistaUser, cartazistaDatabaseError } from '~/server/utils/cartazista'
import { cartazistaDesignSchema, parseCartazistaInput } from '~/server/utils/cartazista-schema'
import { pgOneOrNull } from '~/server/utils/postgres'
import { parseAndStringifyJsonbParam } from '~/server/utils/jsonb'

export default defineEventHandler(async (event) => {
  const user = await cartazistaUser(event)
  const id = cartazistaId(event)
  const data = parseCartazistaInput(cartazistaDesignSchema, await readBody(event))
  if (!data.revision) throw createError({ statusCode: 400, statusMessage: 'Revisão obrigatória.' })
  try {
    const row = await pgOneOrNull(
      `update public.cartazista_designs
          set name = $1,
              state = $2::jsonb,
              revision = revision + 1,
              updated_at = now()
        where id = $3 and owner_id = $4 and revision = $5
      returning *`,
      [data.name, parseAndStringifyJsonbParam(data.state, 'state'), id, user.id, data.revision]
    )
    if (row) return row
    const exists = await pgOneOrNull(
      'select id from public.cartazista_designs where id = $1 and owner_id = $2',
      [id, user.id]
    )
    if (!exists) throw createError({ statusCode: 404, statusMessage: 'Cartaz não encontrado.' })
    throw createError({ statusCode: 409, statusMessage: 'Este cartaz mudou em outra aba. Salve uma cópia para preservar seu trabalho.' })
  } catch (error: any) {
    if (error?.statusCode) throw error
    return cartazistaDatabaseError(error)
  }
})
