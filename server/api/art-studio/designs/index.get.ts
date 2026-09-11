import { artUser, artDatabaseError } from '~/server/utils/art-studio'
import { pgQuery } from '~/server/utils/postgres'
export default defineEventHandler(async (event) => {
  const user = await artUser(event)
  try {
    return (
      await pgQuery(
        'SELECT id,name,composition,revision,template_id,updated_at FROM public.art_studio_designs WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 200',
        [user.id]
      )
    ).rows
  } catch (error) {
    return artDatabaseError(error)
  }
})
