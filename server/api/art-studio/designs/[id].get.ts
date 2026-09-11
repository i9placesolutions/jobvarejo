import { artUser, artId, artDatabaseError } from '~/server/utils/art-studio'
import { pgOneOrNull } from '~/server/utils/postgres'
export default defineEventHandler(async (event) => {
  const user = await artUser(event),
    id = artId(event)
  try {
    const row = await pgOneOrNull(
      'SELECT id,name,composition,revision,template_id,updated_at FROM public.art_studio_designs WHERE id=$1 AND owner_id=$2',
      [id, user.id]
    )
    if (!row)
      throw createError({
        statusCode: 404,
        statusMessage: 'Arte não encontrada.'
      })
    return row
  } catch (error) {
    return artDatabaseError(error)
  }
})
