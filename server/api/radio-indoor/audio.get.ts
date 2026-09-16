import { GetObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { getRadioStorageConfig, isRadioStorageKey } from '../../utils/radio-indoor'
import { getAccessibleTrack } from '../../utils/radio-access'
import { getRadioPlayerIdentity } from '../../utils/radio-player-auth'

const parseRange = (header: string | undefined) => {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header || '').trim())
  if (!match || (!match[1] && !match[2])) return null
  const start = match[1] ? Number.parseInt(match[1], 10) : null
  const end = match[2] ? Number.parseInt(match[2], 10) : null
  if ((start != null && (!Number.isFinite(start) || start < 0)) || (end != null && (!Number.isFinite(end) || end < 0))) return null
  return { start, end }
}

export default defineEventHandler(async (event) => {
  const playerIdentity = await getRadioPlayerIdentity(event)
  const user = playerIdentity ? { id: playerIdentity.userId } : await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-audio:${user.id}`, 600, 60_000)
  const trackId = String(getQuery(event).trackId || '').trim()
  const track = await getAccessibleTrack(user.id, trackId, playerIdentity?.stationId)
  if (!track || !track.storage_key || !isRadioStorageKey(track.storage_key)) {
    throw createError({ statusCode: 404, statusMessage: 'Áudio não encontrado' })
  }
  const range = parseRange(getHeader(event, 'range'))
  const { bucket } = getRadioStorageConfig()
  try {
    const result = await getS3Client().send(new GetObjectCommand({
      Bucket: bucket,
      Key: track.storage_key,
      ...(range ? { Range: `bytes=${range.start ?? ''}-${range.end ?? ''}` } : {})
    }))
    if (!result.Body) throw createError({ statusCode: 404, statusMessage: 'Áudio não encontrado' })
    const contentType = result.ContentType || (String(track.audio_format || '').toLowerCase() === 'webm' ? 'audio/webm' : 'audio/mpeg')
    const contentLength = Number(result.ContentLength || 0)
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
      'X-Radio-Track': String(track.id)
    })
    if (contentLength > 0) setResponseHeader(event, 'Content-Length', contentLength)
    if (result.ContentRange) {
      setResponseStatus(event, 206)
      setResponseHeader(event, 'Content-Range', String(result.ContentRange))
    }
    return sendStream(event, result.Body as any)
  } catch (error: any) {
    if (error?.statusCode) throw error
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Arquivo de áudio não encontrado no Wasabi' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Falha ao transmitir áudio da Rádio Indoor' })
  }
})
