import { GetObjectCommand } from '@aws-sdk/client-s3'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getS3Client } from '../../../utils/s3'
import { getRadioStorageConfig, isRadioStorageKey, isUuid } from '../../../utils/radio-indoor'
import { verifyMusicGptVoiceSampleToken } from '../../../utils/radio-voices'
import { pgOneOrNull } from '../../../utils/postgres'

/**
 * Endpoint público (sem cookie) para o MusicGPT baixar a amostra de voz.
 * Protegido por token HMAC de curta duração gerado em /ai/request.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, `radio-mgpt-voice-sample:${getRequestIP(event, { xForwardedFor: true }) || 'anon'}`, 60, 60_000)
  const token = String(getQuery(event).token || '').trim()
  const verified = verifyMusicGptVoiceSampleToken(token)
  if (!verified) throw createError({ statusCode: 401, statusMessage: 'Token de amostra inválido ou expirado' })
  if (!isUuid(verified.voiceId) || !isUuid(verified.ownerUserId)) {
    throw createError({ statusCode: 401, statusMessage: 'Token de amostra inválido' })
  }

  const voice = await pgOneOrNull<any>(
    `select id, user_id, sample_storage_key, sample_content_type, status, consent_status
       from public.radio_voice_profiles
      where id = $1 and user_id = $2
        and status = 'active' and consent_status = 'confirmed'
      limit 1`,
    [verified.voiceId, verified.ownerUserId]
  )
  if (!voice || !isRadioStorageKey(voice.sample_storage_key) || !String(voice.sample_storage_key).startsWith('radio-indoor/voices/')) {
    throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada' })
  }

  try {
    const { bucket } = getRadioStorageConfig()
    const key = String(voice.sample_storage_key)
    const extension = key.split('.').pop()?.toLowerCase() || 'mp3'
    const safeExt = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'].includes(extension) ? extension : 'mp3'
    const result = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!result.Body) throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada' })
    setResponseHeaders(event, {
      'Content-Type': voice.sample_content_type || 'audio/mpeg',
      'Content-Disposition': `inline; filename="voice-sample.${safeExt}"`,
      'Cache-Control': 'private, max-age=300',
      'X-Radio-Voice': String(voice.id)
    })
    if (result.ContentLength != null) setResponseHeader(event, 'Content-Length', Number(result.ContentLength))
    return sendStream(event, result.Body as any)
  } catch (error: any) {
    if (error?.statusCode) throw error
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada no Wasabi' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Falha ao buscar a amostra de voz' })
  }
})
