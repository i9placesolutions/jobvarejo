import { GetObjectCommand } from '@aws-sdk/client-s3'
import { pgOneOrNull } from './postgres'
import { getS3Client } from './s3'
import { normalizeBusinessProfile } from '~/utils/businessProfile'
import { extractStorageKeyFromRef } from '~/utils/storageRef'
import { isValidStoragePath, isStorageKeyAllowedForUser } from './storage-scope'
export const readArtImage = async (source: string, userId: string) => {
  const config = useRuntimeConfig()
  let key: string | null = null
  if (source === 'brand') {
    const profile = await pgOneOrNull<{ business_profile: unknown }>(
      'SELECT business_profile FROM public.profiles WHERE id=$1',
      [userId]
    )
    key = extractStorageKeyFromRef(
      normalizeBusinessProfile(profile?.business_profile).logo,
      { bucket: config.wasabiBucket, endpoint: config.wasabiEndpoint }
    )
    if (
      !key ||
      !isValidStoragePath(key) ||
      !isStorageKeyAllowedForUser(key, userId)
    )
      throw createError({
        statusCode: 404,
        statusMessage: 'Cadastre a logo da loja no perfil comercial.'
      })
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(source))
      throw createError({ statusCode: 400, statusMessage: 'Imagem inválida.' })
    const row = await pgOneOrNull<{ storage_key: string }>(
      'SELECT storage_key FROM public.art_studio_assets WHERE id=$1 AND (owner_id=$2 OR shared=true)',
      [source, userId]
    )
    key = row?.storage_key || null
  }
  if (!key)
    throw createError({
      statusCode: 404,
      statusMessage: 'Imagem não disponível para esta conta.'
    })
  const response = await getS3Client().send(
    new GetObjectCommand({ Bucket: config.wasabiBucket, Key: key })
  )
  if ((response.ContentLength || 0) > 10 * 1024 * 1024)
    throw createError({
      statusCode: 413,
      statusMessage: 'Imagem excede 10 MB.'
    })
  const buffer = Buffer.from(await response.Body!.transformToByteArray())
  if (buffer.length > 10 * 1024 * 1024)
    throw createError({
      statusCode: 413,
      statusMessage: 'Imagem excede 10 MB.'
    })
  return buffer
}
