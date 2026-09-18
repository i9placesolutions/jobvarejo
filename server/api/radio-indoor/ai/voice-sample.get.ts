import { GetObjectCommand } from '@aws-sdk/client-s3'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getS3Client } from '../../../utils/s3'
import { getRadioStorageConfig, isRadioStorageKey, isUuid } from '../../../utils/radio-indoor'
import { verifyMusicGptVoiceSampleToken } from '../../../utils/radio-voices'
import { buildMusicGptVoiceClip } from '../../../utils/musicgpt-voice-clip'
import { pgOneOrNull } from '../../../utils/postgres'

/**
 * Baixa no máximo ~1.2 MB do início (suficiente p/ ~30s em 320kbps)
 * antes de recodificar o clip de clonagem.
 */
const MUSICGPT_SAMPLE_FETCH_MAX_BYTES = 1_200_000

/**
 * Endpoint público (sem cookie) para o MusicGPT baixar a amostra de voz.
 * Protegido por token HMAC de curta duração gerado em /ai/request.
 *
 * O MusicGPT recomenda amostra só de voz (sem música). Entregamos um clip
 * mono de ~12s via ffmpeg — corte cru em bytes estraga o clone.
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
    const result = await getS3Client().send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=0-${MUSICGPT_SAMPLE_FETCH_MAX_BYTES - 1}`
    }))
    if (!result.Body) throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada' })
    const chunks: Buffer[] = []
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const source = Buffer.concat(chunks)
    const clip = await buildMusicGptVoiceClip(source)
    if (!clip) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Não foi possível preparar o clip de voz para o MusicGPT (ffmpeg)'
      })
    }

    setResponseHeaders(event, {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline; filename="voice-sample.mp3"',
      'Content-Length': String(clip.length),
      'Cache-Control': 'private, max-age=300',
      'X-Radio-Voice': String(voice.id),
      'X-Radio-Sample-Clip': 'ffmpeg-12s'
    })
    return clip
  } catch (error: any) {
    if (error?.statusCode) throw error
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada no Wasabi' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Falha ao buscar a amostra de voz' })
  }
})
