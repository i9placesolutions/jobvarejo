import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { isStorageKeyAllowedForUser, isValidStoragePath, normalizeStoragePath } from '../../utils/storage-scope'

/**
 * API Route para deletar um único asset da Wasabi Storage
 *
 * Body: { key: string } - O key do arquivo a ser deletado
 * As pastas são: imagens/, logo/, ou projects/{userId}/{projectId}/
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthenticatedUser(event)
    enforceRateLimit(event, `assets-delete:${user.id}`, 60, 60_000)
    const body = await readBody(event)
    const key = normalizeStoragePath(body?.key)

    if (!key) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Key is required'
      })
    }
    if (!isValidStoragePath(key)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid key format'
      })
    }
    if (!isStorageKeyAllowedForUser(key, user.id)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden key scope'
      })
    }

    const config = useRuntimeConfig()
    const endpoint = config.wasabiEndpoint
    const region = config.wasabiRegion || 'us-east-1'
    const accessKeyId = config.wasabiAccessKey
    const secretAccessKey = config.wasabiSecretKey
    const bucketName = config.wasabiBucket

    if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Wasabi Storage not configured'
      })
    }

    const s3Client = new S3Client({
      region,
      endpoint: `https://${endpoint}`,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: true
    })

    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    })

    await s3Client.send(deleteCommand)

    console.log('✅ Asset deleted from Wasabi:', key)

    return {
      success: true,
      message: 'Asset deleted successfully'
    }

  } catch (error: any) {
    console.error('Error deleting asset from Wasabi:', error)
    const statusCode = Number(error?.statusCode || 500) || 500
    throw createError({
      statusCode,
      statusMessage: error?.statusMessage || error?.message || 'Failed to delete asset'
    })
  }
})
