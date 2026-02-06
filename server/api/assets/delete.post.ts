import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

/**
 * API Route para deletar um único asset da Wasabi Storage
 *
 * Body: { key: string } - O key do arquivo a ser deletado
 * As pastas são: imagens/, logo/, ou projects/{userId}/{projectId}/
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { key } = body

    if (!key) {
      throw createError({
        status: 400,
        message: 'Key is required'
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
        status: 500,
        message: 'Wasabi Storage not configured'
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
    throw createError({
      status: 500,
      message: error.message || 'Failed to delete asset'
    })
  }
})
