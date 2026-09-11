import { ART_STARTER_TEMPLATES } from '~/utils/art-studio/catalog'
import { artUser, artDatabaseError } from '~/server/utils/art-studio'
import { pgQuery } from '~/server/utils/postgres'
export default defineEventHandler(async (event) => {
  const admin = getQuery(event).admin === '1'
  await artUser(event, admin)
  try {
    const result = await pgQuery(
      `SELECT id, name, category, collection, tags, composition, published, revision FROM public.art_studio_templates WHERE ($1::boolean OR published = true) ORDER BY updated_at DESC LIMIT 500`,
      [admin]
    )
    return {
      templates: [...ART_STARTER_TEMPLATES, ...result.rows],
      databaseReady: true
    }
  } catch (error: any) {
    if (error?.code === '42P01')
      return { templates: ART_STARTER_TEMPLATES, databaseReady: false }
    return artDatabaseError(error)
  }
})
