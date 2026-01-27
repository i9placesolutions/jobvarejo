import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'

/**
 * API Route para deletar arquivos da Contabo Storage
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

    // Configurações da Contabo
    const config = {
      endpoint: process.env.CONTABO_ENDPOINT || 'eu2.contabostorage.com',
      bucket: process.env.CONTABO_BUCKET,
      accessKey: process.env.CONTABO_ACCESS_KEY,
      secretKey: process.env.CONTABO_SECRET_KEY,
      region: process.env.CONTABO_REGION || 'eu-2'
    }

    if (!config.bucket || !config.accessKey || !config.secretKey) {
      throw createError({
        status: 500,
        message: 'Contabo Storage not configured'
      })
    }

    // Criar cliente S3
    const s3Client = new S3Client({
      endpoint: `https://${config.endpoint}`,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      forcePathStyle: true
    })

    // Primeiro, listar objetos com o prefixo
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3')

    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix
    })

    const listResult = await s3Client.send(listCommand)

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return { deleted: 0, message: 'No files to delete' }
    }

    // Deletar todos os objetos encontrados
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: config.bucket,
      Delete: {
        Objects: listResult.Contents.map(obj => ({ Key: obj.Key })),
        Quiet: false
      }
    })

    const deleteResult = await s3Client.send(deleteCommand)

    return {
      deleted: deleteResult.Deleted?.length || 0,
      message: `Deleted ${deleteResult.Deleted?.length || 0} files`
    }

  } catch (error: any) {
    console.error('Error deleting files:', error)
    throw createError({
      status: 500,
      message: error.message || 'Failed to delete files'
    })
  }
})
