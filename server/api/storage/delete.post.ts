import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getUserProjectsPrefix, isValidStoragePath, normalizeStoragePath } from '../../utils/storage-scope'

/**
 * API Route para deletar arquivos da Wasabi Storage
 *
 * Deleta múltiplos arquivos baseado em um prefixo
 */

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthenticatedUser(event)
    enforceRateLimit(event, `storage-delete:${user.id}`, 20, 60_000)
    const body = await readBody(event)
    const prefix = normalizeStoragePath(body?.prefix)

    if (!prefix) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Prefix is required'
      })
    }
    if (!isValidStoragePath(prefix, { allowTrailingSlash: true })) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid prefix format'
      })
    }
    const allowedPrefix = getUserProjectsPrefix(user.id)
    if (!prefix.startsWith(allowedPrefix)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden prefix scope'
      })
    }

    // Configurações da Wasabi
    const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
    const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
    const accessKey = process.env.WASABI_ACCESS_KEY
    const secretKey = process.env.WASABI_SECRET_KEY
    const region = process.env.WASABI_REGION || 'us-east-1'

    if (!bucket || !accessKey || !secretKey) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Wasabi Storage not configured'
      })
    }

    // Criar cliente S3 para Wasabi
    const s3Client = new S3Client({
      endpoint: `https://${endpoint}`,
      region: region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey
      },
      forcePathStyle: true
    })

    let continuationToken: string | undefined
    let totalDeleted = 0

    while (true) {
      const listResult = await s3Client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {})
      }))

      const objectKeys = (listResult.Contents || [])
        .map(obj => String(obj?.Key || '').trim())
        .filter(Boolean)

      if (objectKeys.length > 0) {
        const deleteResult = await s3Client.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objectKeys.map((key) => ({ Key: key })),
            Quiet: false
          }
        }))
        totalDeleted += Number(deleteResult.Deleted?.length || 0)
      }

      if (!listResult.IsTruncated || !listResult.NextContinuationToken) break
      continuationToken = listResult.NextContinuationToken
    }

    if (totalDeleted === 0) {
      return { deleted: 0, message: 'No files to delete' }
    }

    console.log(`✅ Deleted ${totalDeleted} files from Wasabi with prefix: ${prefix}`)

    return {
      deleted: totalDeleted,
      message: `Deleted ${totalDeleted} files`
    }

  } catch (error: any) {
    console.error('Error deleting files from Wasabi:', error)
    const statusCode = Number(error?.statusCode || 500) || 500
    throw createError({
      statusCode,
      statusMessage: error?.statusMessage || error?.message || 'Failed to delete files'
    })
  }
})
