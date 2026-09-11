import { GetObjectCommand } from '@aws-sdk/client-s3'
import { artUser, artId, artDatabaseError } from '~/server/utils/art-studio'
import { pgOneOrNull } from '~/server/utils/postgres'
import { getS3Client } from '~/server/utils/s3'
export default defineEventHandler(async (event) => {
  const user = await artUser(event),
    id = artId(event)
  try {
    const asset = await pgOneOrNull<{ storage_key: string }>(
      'SELECT storage_key FROM public.art_studio_assets WHERE id=$1 AND (owner_id=$2 OR shared=true)',
      [id, user.id]
    )
    if (!asset)
      throw createError({
        statusCode: 404,
        statusMessage: 'Imagem não encontrada.'
      })
    const result = await getS3Client().send(
      new GetObjectCommand({
        Bucket: useRuntimeConfig().wasabiBucket,
        Key: asset.storage_key
      })
    )
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return Buffer.from(await result.Body!.transformToByteArray())
  } catch (error) {
    return artDatabaseError(error)
  }
})
