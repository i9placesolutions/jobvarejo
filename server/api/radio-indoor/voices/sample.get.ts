import { GetObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getS3Client } from '../../../utils/s3'
import { getRadioStorageConfig, isRadioStorageKey } from '../../../utils/radio-indoor'
import { getRadioVoiceByIdForActor } from '../../../utils/radio-voices'

const parseRange = (header: string | undefined) => {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header || '').trim())
  if (!match || (!match[1] && !match[2])) return null
  const start = match[1] ? Number.parseInt(match[1], 10) : null
  const end = match[2] ? Number.parseInt(match[2], 10) : null
  if ((start != null && (!Number.isFinite(start) || start < 0)) || (end != null && (!Number.isFinite(end) || end < 0))) return null
  return { start, end }
}

export default defineEventHandler(async (event) => {
  const actor = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-voice-sample:${actor.id}`, 240, 60_000)
  const voiceId = String(getQuery(event).voiceId || '').trim()
  const voice = await getRadioVoiceByIdForActor(actor.id, voiceId)
  if (!voice || !isRadioStorageKey(voice.sample_storage_key) || !voice.sample_storage_key.startsWith('radio-indoor/voices/')) {
    throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada' })
  }

  try {
    const { bucket } = getRadioStorageConfig()
    const range = parseRange(getHeader(event, 'range'))
    const result = await getS3Client().send(new GetObjectCommand({
      Bucket: bucket,
      Key: voice.sample_storage_key,
      ...(range ? { Range: `bytes=${range.start ?? ''}-${range.end ?? ''}` } : {})
    }))
    if (!result.Body) throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada' })
    setResponseHeaders(event, {
      'Content-Type': voice.sample_content_type || 'audio/mpeg',
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      'X-Radio-Voice': String(voice.id)
    })
    if (result.ContentLength != null) setResponseHeader(event, 'Content-Length', Number(result.ContentLength))
    if (result.ContentRange) {
      setResponseStatus(event, 206)
      setResponseHeader(event, 'Content-Range', String(result.ContentRange))
    }
    return sendStream(event, result.Body as any)
  } catch (error: any) {
    if (error?.statusCode) throw error
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada no Wasabi' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Falha ao buscar a amostra de voz' })
  }
})
