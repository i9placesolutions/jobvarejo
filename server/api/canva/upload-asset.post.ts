// Upload de imagem do Wasabi para o Canva
// Gera URL publica do Wasabi e envia para o Canva como asset

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { canvaUploadAssetFromUrl, canvaGetAssetUploadJob } from '../../utils/canva-client'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { wasabi_key, name } = body

  if (!wasabi_key) {
    throw createError({ statusCode: 400, message: 'wasabi_key e obrigatorio' })
  }

  // Gerar URL temporaria do Wasabi para o Canva baixar
  const s3 = getS3Client()
  const config = useRuntimeConfig()
  const bucket = config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || 'jobvarejo'

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: wasabi_key,
  })

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 })

  // Upload para o Canva
  const uploadResponse = await canvaUploadAssetFromUrl(url, name || 'produto')
  const jobId = uploadResponse.job.id

  // Polling ate o upload terminar (max 30s)
  const maxAttempts = 15
  const delayMs = 2000
  let attempt = 0

  while (attempt < maxAttempts) {
    const jobStatus = await canvaGetAssetUploadJob(jobId)

    if (jobStatus.job.status === 'completed' || jobStatus.job.status === 'success') {
      return {
        asset_id: jobStatus.job.asset?.id || null,
        name: jobStatus.job.asset?.name || name,
      }
    }

    if (jobStatus.job.status === 'failed') {
      throw createError({
        statusCode: 500,
        message: 'Upload de imagem falhou no Canva',
      })
    }

    await new Promise(resolve => setTimeout(resolve, delayMs))
    attempt++
  }

  throw createError({
    statusCode: 504,
    message: 'Timeout aguardando upload de imagem no Canva',
  })
})
