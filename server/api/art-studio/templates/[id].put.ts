import {
  normalizeArtTemplateBindings,
  artUser,
  artId,
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
  const user = await artUser(event, true),
    id = artId(event)
  const data = parseArtInput(
    artTemplateSchema.required({ revision: true }),
    await readBody(event)
  )
  normalizeArtTemplateBindings(data.composition)
  try {
    await checkArtAssets(data.composition, user.id)
    return await pgTx(async (client) => {
      const result = await client.query(
        `UPDATE public.art_studio_templates SET name=$1,category=$2,collection=$3,tags=$4,composition=$5::jsonb,published=$6,revision=revision+1,updated_at=now() WHERE id=$7 AND revision=$8 RETURNING *`,
        [
          data.name,
          data.category,
          data.collection,
          data.tags,
          parseAndStringifyJsonbParam(data.composition, 'composition'),
          data.published,
          id,
          data.revision
        ]
      )
      if (!result.rows[0])
        throw createError({
          statusCode: 409,
          statusMessage:
            'O modelo mudou em outra sessão. Reabra antes de salvar.'
        })
      if (data.published)
        await client.query(
          'UPDATE public.art_studio_assets SET shared = true WHERE id = ANY($1::uuid[]) AND owner_id=$2',
          [artAssetIds(data.composition), user.id]
        )
      await client.query(
        'INSERT INTO public.art_studio_audit(actor_id,template_id,action,revision) VALUES($1,$2,$3,$4)',
        [
          user.id,
          id,
          data.published ? 'publish' : 'unpublish',
          result.rows[0].revision
        ]
      )
      return result.rows[0]
    })
  } catch (error) {
    return artDatabaseError(error)
  }
})
