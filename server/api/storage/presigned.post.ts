import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * API Route para gerar presigned URLs para Wasabi Storage
 *
 * Wasabi Cloud Storage é compatível com AWS S3.
 * Usa presigned URLs para evitar expor credenciais no frontend.
 *
 * Estrutura de pastas:
 * - projects/{userId}/{projectId}/page_{pageId}.json → Canvas JSON
 * - projects/{userId}/{projectId}/thumb_{pageId}.png → Thumbnail
 * - imagens/{filename} → Uploads de imagens
 * - logo/{filename} → Logos de marcas
 */

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { key, contentType, operation = 'put' } = body

    if (!key) {
      throw createError({
        status: 400,
        message: 'Key is required'
      })
    }

    // Configurações da Wasabi (variáveis de ambiente)
    const endpoint = process.env.WASABI_ENDPOINT || 's3.wasabisys.com'
    const region = process.env.WASABI_REGION || 'us-east-1'
    const bucket = process.env.WASABI_BUCKET || 'jobvarejo'
    const accessKey = process.env.WASABI_ACCESS_KEY
    const secretKey = process.env.WASABI_SECRET_KEY

    // Verificar configuração e dar mensagens específicas
    if (!bucket) {
      console.error('❌ WASABI_BUCKET não está definido')
      throw createError({
        status: 500,
        message: 'WASABI_BUCKET environment variable is missing. Check your .env file.'
      })
    }
    if (!accessKey) {
      console.error('❌ WASABI_ACCESS_KEY não está definido')
      throw createError({
        status: 500,
        message: 'WASABI_ACCESS_KEY environment variable is missing. Check your .env file.'
      })
    }
    if (!secretKey) {
      console.error('❌ WASABI_SECRET_KEY não está definido')
      throw createError({
        status: 500,
        message: 'WASABI_SECRET_KEY environment variable is missing. Check your .env file.'
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
      // Wasabi usa path style (igual a Contabo)
      // URL gerada: https://s3.wasabisys.com/bucket/key
      forcePathStyle: true
    })

    // Log para debug (sem expor credenciais)
    console.log('🔍 Wasabi S3 Client config:', {
      endpoint: `https://${endpoint}`,
      bucket: bucket,
      region: region,
      hasCredentials: !!(accessKey && secretKey),
      operation: operation,
      key: key.substring(0, 50) + (key.length > 50 ? '...' : '')
    })

    let command

    if (operation === 'put') {
      command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
        ACL: 'public-read'
      })
    } else {
      command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })
    }

    // Gerar presigned URL válida por 1 hora
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 3600
    })

    console.log('✅ Presigned URL gerada com sucesso')

    return {
      url,
      bucket: bucket,
      region: region,
      endpoint: endpoint
    }

  } catch (error: any) {
    console.error('❌ Erro ao gerar presigned URL da Wasabi:', error)
    console.error('   Detalhes:', {
      message: error.message,
      code: error.code,
      endpoint: process.env.WASABI_ENDPOINT,
      bucket: process.env.WASABI_BUCKET || 'NÃO DEFINIDO',
      hasAccessKey: !!process.env.WASABI_ACCESS_KEY,
      hasSecretKey: !!process.env.WASABI_SECRET_KEY
    })

    // Mensagem mais amigável para o frontend
    let userMessage = 'Failed to generate presigned URL'
    if (error.message?.includes('not configured') || error.message?.includes('missing')) {
      userMessage = 'Wasabi Storage não está configurado. Verifique as variáveis de ambiente no servidor.'
    } else if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      userMessage = 'Credenciais da Wasabi inválidas. Verifique WASABI_ACCESS_KEY e WASABI_SECRET_KEY.'
    } else if (error.code === 'NoSuchBucket') {
      userMessage = `Bucket "${process.env.WASABI_BUCKET}" não existe na Wasabi.`
    } else {
      userMessage = error.message || 'Erro desconhecido ao conectar com Wasabi Storage'
    }

    throw createError({
      status: 500,
      message: userMessage
    })
  }
})
