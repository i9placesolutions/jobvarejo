import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * API Route para gerar presigned URLs para Contabo Storage
 *
 * Contabo Object Storage é compatível com AWS S3.
 * Usa presigned URLs para evitar expor credenciais no frontend.
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

    // Configurações da Contabo (variáveis de ambiente)
    const endpoint = process.env.CONTABO_ENDPOINT || 'eu2.contabostorage.com'
    // Detectar região automaticamente baseado no endpoint se não especificado
    let defaultRegion = 'eu-2'
    if (endpoint.includes('usc1')) defaultRegion = 'us-east-1'
    else if (endpoint.includes('sin1')) defaultRegion = 'ap-southeast-1'
    else if (endpoint.includes('eu2')) defaultRegion = 'eu-2'
    
    const config = {
      endpoint,
      bucket: process.env.CONTABO_BUCKET,
      accessKey: process.env.CONTABO_ACCESS_KEY,
      secretKey: process.env.CONTABO_SECRET_KEY,
      region: process.env.CONTABO_REGION || defaultRegion
    }

    // Verificar configuração e dar mensagens específicas
    if (!config.bucket) {
      console.error('❌ CONTABO_BUCKET não está definido')
      throw createError({
        status: 500,
        message: 'CONTABO_BUCKET environment variable is missing. Check your .env file.'
      })
    }
    if (!config.accessKey) {
      console.error('❌ CONTABO_ACCESS_KEY não está definido')
      throw createError({
        status: 500,
        message: 'CONTABO_ACCESS_KEY environment variable is missing. Check your .env file.'
      })
    }
    if (!config.secretKey) {
      console.error('❌ CONTABO_SECRET_KEY não está definido')
      throw createError({
        status: 500,
        message: 'CONTABO_SECRET_KEY environment variable is missing. Check your .env file.'
      })
    }

    // Criar cliente S3 para Contabo
    // IMPORTANTE: Contabo usa formato tenant:bucket (ex: 475a29e42e55430abff00915da2fa4bc:jobupload)
    // O bucket name no comando S3 deve ser o nome completo com tenant
    const s3Client = new S3Client({
      endpoint: `https://${config.endpoint}`,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey
      },
      // Importante: Contabo usa path style, não virtual host
      // URL gerada: https://endpoint/bucket/key
      // Com tenant:bucket, a URL fica: https://endpoint/tenant:bucket/key
      forcePathStyle: true
    })
    
    // Log para debug (sem expor credenciais)
    console.log('🔍 Contabo S3 Client config:', {
      endpoint: `https://${config.endpoint}`,
      bucket: config.bucket ? (config.bucket.includes(':') ? config.bucket.split(':')[1] : config.bucket.substring(0, 20)) + '...' : 'N/A',
      fullBucket: config.bucket ? '***' : 'N/A',
      region: config.region,
      hasCredentials: !!(config.accessKey && config.secretKey),
      operation: operation,
      key: key.substring(0, 50) + (key.length > 50 ? '...' : '')
    })

    let command

    if (operation === 'put') {
      command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType || 'application/octet-stream'
      })
    } else {
      // CRITICAL: Disable checksum mode for S3-compatible storage (e.g. Contabo)
      // that may return 500 when x-amz-checksum-mode=ENABLED is present in the presigned URL
      command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ChecksumMode: 'DISABLED'
      })
    }

    // Gerar presigned URL válida por 1 hora
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: 3600
    })

    return {
      url,
      bucket: config.bucket,
      region: config.region
    }

  } catch (error: any) {
    console.error('❌ Erro ao gerar presigned URL da Contabo:', error)
    console.error('   Detalhes:', {
      message: error.message,
      code: error.code,
      endpoint: process.env.CONTABO_ENDPOINT,
      bucket: process.env.CONTABO_BUCKET ? '***' : 'NÃO DEFINIDO',
      hasAccessKey: !!process.env.CONTABO_ACCESS_KEY,
      hasSecretKey: !!process.env.CONTABO_SECRET_KEY
    })
    
    // Mensagem mais amigável para o frontend
    let userMessage = 'Failed to generate presigned URL'
    if (error.message?.includes('not configured') || error.message?.includes('missing')) {
      userMessage = 'Contabo Storage não está configurado. Verifique as variáveis de ambiente no servidor.'
    } else if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      userMessage = 'Credenciais da Contabo inválidas. Verifique CONTABO_ACCESS_KEY e CONTABO_SECRET_KEY.'
    } else if (error.code === 'NoSuchBucket') {
      userMessage = `Bucket "${process.env.CONTABO_BUCKET}" não existe na Contabo.`
    } else {
      userMessage = error.message || 'Erro desconhecido ao conectar com Contabo Storage'
    }
    
    throw createError({
      status: 500,
      message: userMessage
    })
  }
})
