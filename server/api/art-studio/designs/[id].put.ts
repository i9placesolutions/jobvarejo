import {
  artUser,
  artId,
  checkArtAssets,
  artDatabaseError
} from '~/server/utils/art-studio'
import {
  artDesignSchema,
  parseArtInput
} from '~/server/utils/art-studio-schema'
import { pgOneOrNull } from '~/server/utils/postgres'
import { parseAndStringifyJsonbParam } from '~/server/utils/jsonb'
export default defineEventHandler(async (event) => {
  const user = await artUser(event),
    id = artId(event)
  const data = parseArtInput(
    artDesignSchema.required({ revision: true }),
    await readBody(event)
  )
  try {
    await checkArtAssets(data.composition, user.id)
    const row = await pgOneOrNull(
      'UPDATE public.art_studio_designs SET name=$1,composition=$2::jsonb,revision=revision+1,updated_at=now() WHERE id=$3 AND owner_id=$4 AND revision=$5 RETURNING *',
      [
        data.name,
        parseAndStringifyJsonbParam(data.composition, 'composition'),
        id,
        user.id,
        data.revision
      ]
    )
    if (!row)
      throw createError({
        statusCode: 409,
        statusMessage:
          'A arte mudou em outra sessão. Seu rascunho foi preservado; reabra a versão salva.'
      })
    return row
  } catch (error) {
    return artDatabaseError(error)
  }
})
