import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

/**
 * API Route para deletar arquivos da Wasabi Storage
 *
 * Deleta múltiplos arquivos baseado em um prefixo
 */

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { prefix } = body

    if (!prefix) {
      throw createError({
        status: 400,
        message: 'Prefix is required'
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
        status: 500,
        message: 'Wasabi Storage not configured'
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

    // Primeiro, listar objetos com o prefixo
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix
    })

    const listResult = await s3Client.send(listCommand)

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return { deleted: 0, message: 'No files to delete' }
    }

    // Deletar todos os objetos encontrados
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: listResult.Contents.map(obj => ({ Key: obj.Key })),
        Quiet: false
      }
    })

    const deleteResult = await s3Client.send(deleteCommand)

    console.log(`✅ Deleted ${deleteResult.Deleted?.length || 0} files from Wasabi with prefix: ${prefix}`)

    return {
      deleted: deleteResult.Deleted?.length || 0,
      message: `Deleted ${deleteResult.Deleted?.length || 0} files`
    }

  } catch (error: any) {
    console.error('Error deleting files from Wasabi:', error)
    throw createError({
      status: 500,
      message: error.message || 'Failed to delete files'
    })
  }
})
