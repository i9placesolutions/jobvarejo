import {
  artUser,
  checkArtAssets,
  artDatabaseError
} from '~/server/utils/art-studio'
import {
  artDesignSchema,
  parseArtInput
} from '~/server/utils/art-studio-schema'
import { pgOneOrNull } from '~/server/utils/postgres'
import { parseAndStringifyJsonbParam } from '~/server/utils/jsonb'
import { randomUUID } from 'node:crypto'
export default defineEventHandler(async (event) => {
  const user = await artUser(event),
    data = parseArtInput(artDesignSchema, await readBody(event))
  try {
    await checkArtAssets(data.composition, user.id)
    const id = data.id || randomUUID()
    // ID gerado pelo cliente torna o primeiro save idempotente após timeout de rede.
    const row = await pgOneOrNull(
      'INSERT INTO public.art_studio_designs(id,owner_id,name,composition,template_id) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(id) DO NOTHING RETURNING *',
      [
        id,
        user.id,
        data.name,
        parseAndStringifyJsonbParam(data.composition, 'composition'),
        data.template_id || null
      ]
    )
    if (row) return row
    const existing = await pgOneOrNull(
      'SELECT * FROM public.art_studio_designs WHERE id=$1 AND owner_id=$2',
      [id, user.id]
    )
    if (!existing)
      throw createError({
        statusCode: 409,
        statusMessage: 'Não foi possível criar esta arte.'
      })
    return existing
  } catch (error) {
    return artDatabaseError(error)
  }
})
