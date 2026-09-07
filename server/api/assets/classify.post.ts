import { CopyObjectCommand } from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import { requireAdminUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { isValidStoragePath, normalizeStoragePath } from '../../utils/storage-scope'
import { getAssetLibraryCategory } from '~/utils/assetLibraryCategories'

export default defineEventHandler(async event => {
  const { user } = await requireAdminUser(event)
  await enforceRateLimit(event, `asset-library-classify:${user.id}`, 60, 60_000)
  const body = await readBody(event)
  const source = normalizeStoragePath(body?.key)
  const category = getAssetLibraryCategory(body?.category)
  if (!category || !isValidStoragePath(source) || !/^(imagens|uploads)\/.+\.(png|jpe?g|webp|gif|svg|avif)$/i.test(source)) {
    throw createError({ statusCode: 400, statusMessage: 'Arquivo ou categoria inválida' })
  }
  const bucket = String(useRuntimeConfig().wasabiBucket || '')
  if (!bucket) throw createError({ statusCode: 503, statusMessage: 'Armazenamento indisponível' })
  // Preserve the original key: existing designs continue resolving exactly the same URL.
  const key = source.startsWith(category.prefix) ? source : `${category.prefix}${createHash('sha256').update(source).digest('hex').slice(0, 12)}-${source.split('/').pop()}`
  if (key !== source) await getS3Client().send(new CopyObjectCommand({ Bucket: bucket, Key: key, CopySource: `${bucket}/${source.split('/').map(encodeURIComponent).join('/')}`, ACL: 'public-read' }))
  return { success: true, key, category: category.id }
})
