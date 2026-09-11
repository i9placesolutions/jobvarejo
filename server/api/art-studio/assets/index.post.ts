import { randomUUID } from 'node:crypto'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { artUser, artDatabaseError } from '~/server/utils/art-studio'
import { pgQuery } from '~/server/utils/postgres'
import { getS3Client } from '~/server/utils/s3'
import { enforceRateLimit } from '~/server/utils/rate-limit'
export default defineEventHandler(async (event) => {
  const user = await artUser(event)
  await enforceRateLimit(event, `art-upload:${user.id}`, 30, 60_000)
  const parts = await readMultipartFormData(event),
    file = parts?.find((p) => p.name === 'file')
  if (!file?.data?.length || file.data.length > 10 * 1024 * 1024)
    throw createError({
      statusCode: 400,
      statusMessage: 'Envie uma imagem de até 10 MB.'
    })
  const sharp = (await import('sharp')).default
  let buffer: Buffer
  try {
    const img = sharp(file.data, {
      limitInputPixels: 24_000_000,
      animated: false
    })
    const meta = await img.metadata()
    if (!['png', 'jpeg', 'webp', 'avif'].includes(meta.format || ''))
      throw new Error('Formato inválido')
    buffer = await img
      .rotate()
      .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Imagem inválida. Use PNG, JPEG, WebP ou AVIF.'
    })
  }
  const id = randomUUID(),
    key = `art-studio/${user.id}/${id}.png`,
    bucket = useRuntimeConfig().wasabiBucket
  try {
    // Detecta migração ausente antes de enviar bytes ao storage.
    await pgQuery('SELECT id FROM public.art_studio_assets LIMIT 0')
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'image/png'
      })
    )
    try {
      await pgQuery(
        'INSERT INTO public.art_studio_assets(id,owner_id,storage_key) VALUES($1,$2,$3)',
        [id, user.id, key]
      )
    } catch (error) {
      await getS3Client()
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        .catch(() => {})
      throw error
    }
    return { id, src: `/api/art-studio/assets/${id}` }
  } catch (error) {
    return artDatabaseError(error)
  }
})
