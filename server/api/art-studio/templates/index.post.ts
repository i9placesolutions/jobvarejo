import {
  normalizeArtTemplateBindings,
  artUser,
  artAssetIds,
  checkArtAssets,
  artDatabaseError
} from '~/server/utils/art-studio'
import {
  artTemplateSchema,
  parseArtInput
} from '~/server/utils/art-studio-schema'
import { pgTx } from '~/server/utils/postgres'
import { parseAndStringifyJsonbParam } from '~/server/utils/jsonb'
export default defineEventHandler(async (event) => {
  const user = await artUser(event, true)
  const data = parseArtInput(artTemplateSchema, await readBody(event))
  normalizeArtTemplateBindings(data.composition)
  try {
    await checkArtAssets(data.composition, user.id)
    return await pgTx(async (client) => {
      const result = await client.query(
        `INSERT INTO public.art_studio_templates(owner_id,name,category,collection,tags,composition,published) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`,
        [
          user.id,
          data.name,
          data.category,
          data.collection,
          data.tags,
          parseAndStringifyJsonbParam(data.composition, 'composition'),
          data.published
        ]
      )
      const row = result.rows[0]
      if (data.published)
        await client.query(
          'UPDATE public.art_studio_assets SET shared = true WHERE id = ANY($1::uuid[]) AND owner_id = $2',
          [artAssetIds(data.composition), user.id]
        )
      await client.query(
        'INSERT INTO public.art_studio_audit(actor_id,template_id,action,revision) VALUES($1,$2,$3,$4)',
        [user.id, row.id, data.published ? 'publish' : 'create', row.revision]
      )
      return row
    })
  } catch (error) {
    return artDatabaseError(error)
  }
})
