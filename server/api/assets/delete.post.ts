import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

/**
 * API Route para deletar um único asset da Contabo Storage
 *
 * Body: { key: string } - O key do arquivo a ser deletado
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
    const endpoint = config.contaboEndpoint
    const region = config.contaboRegion || 'default'
    const accessKeyId = config.contaboAccessKey
    const secretAccessKey = config.contaboSecretKey
    const bucketName = config.contaboBucket

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      throw createError({
        status: 500,
        message: 'Contabo Storage not configured'
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

    return {
      success: true,
      message: 'Asset deleted successfully'
    }

  } catch (error: any) {
    console.error('Error deleting asset:', error)
    throw createError({
      status: 500,
      message: error.message || 'Failed to delete asset'
    })
  }
})
