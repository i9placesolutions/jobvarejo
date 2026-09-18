import { GetObjectCommand } from '@aws-sdk/client-s3'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getS3Client } from '../../../utils/s3'
import { getRadioStorageConfig, isRadioStorageKey, isUuid } from '../../../utils/radio-indoor'
import { ensureMusicGptCloneSample, verifyMusicGptVoiceSampleToken } from '../../../utils/radio-voices'
import { pgOneOrNull } from '../../../utils/postgres'

/**
 * Endpoint público (sem cookie) para o MusicGPT baixar a amostra de voz.
 * Serve o clip `.clone.mp3` pré-processado (ffmpeg), não o arquivo longo original.
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
    `select id, user_id, sample_storage_key, sample_content_type, status, consent_status, metadata
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
    const clone = await ensureMusicGptCloneSample({
      voiceId: String(voice.id),
      ownerUserId: String(voice.user_id),
      sampleStorageKey: String(voice.sample_storage_key)
    })
    const { bucket } = getRadioStorageConfig()
    const result = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: clone.key }))
    if (!result.Body) throw createError({ statusCode: 404, statusMessage: 'Clip de clonagem não encontrado' })
    const chunks: Buffer[] = []
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)
    setResponseHeaders(event, {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline; filename="voice-clone.mp3"',
      'Content-Length': String(body.length),
      'Cache-Control': 'private, max-age=300',
      'X-Radio-Voice': String(voice.id),
      'X-Radio-Sample-Clip': `clone-${clone.durationSec}s`,
      'X-Radio-Clone-Bytes': String(clone.bytes)
    })
    return body
  } catch (error: any) {
    if (error?.statusCode) throw error
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada no Wasabi' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Falha ao buscar a amostra de voz' })
  }
})
