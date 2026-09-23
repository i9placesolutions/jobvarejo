import { GetObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgOneOrNull } from '../../utils/postgres'
import { getS3Client } from '../../utils/s3'
import { getRadioStorageConfig, isRadioStorageKey } from '../../utils/radio-indoor'
import { getRadioPlayerIdentity } from '../../utils/radio-player-auth'

const mediaType = (key: string) => {
  const ext = key.split('.').pop()?.toLowerCase()
  return ({
    webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml'
  } as Record<string, string>)[String(ext || '')] || 'application/octet-stream'
}

export default defineEventHandler(async (event) => {
  const playerIdentity = await getRadioPlayerIdentity(event)
  const user = playerIdentity ? { id: playerIdentity.userId } : await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-media:${user.id}`, 1200, 60_000)
  const rawKey = String(getQuery(event).key || '').trim()
  let key = rawKey
  try { key = decodeURIComponent(rawKey) } catch { /* query já pode estar decodificada */ }
  if (!isRadioStorageKey(key)) throw createError({ statusCode: 400, statusMessage: 'Chave de mídia inválida' })

  const playerStationCondition = playerIdentity ? ' and (radio_catalog_tracks.station_id is null or radio_catalog_tracks.station_id = $3)' : ''
  const playlistStationCondition = playerIdentity ? ' and (p.station_id is null or p.station_id = $3)' : ''
  const owned = await pgOneOrNull<any>(
    `select 1 as ok from public.radio_catalog_tracks
      where (storage_key = $2 or thumbnail_key = $2)
        and (user_id = $1 or exists (
          select 1 from public.radio_station_members m
          join public.radio_stations s on s.id = m.station_id
          where m.user_id = $1 and m.status = 'active' and s.user_id = radio_catalog_tracks.user_id
            and (radio_catalog_tracks.station_id is null or radio_catalog_tracks.station_id = s.id)
        ))${playerStationCondition}
     union all
    select 1 as ok from public.radio_playlists p
     where p.cover_key = $2
       and (p.user_id = $1 or exists (
         select 1 from public.radio_station_members m
         join public.radio_stations s on s.id = m.station_id
         where m.user_id = $1 and m.status = 'active' and s.user_id = p.user_id
           and (p.station_id is null or p.station_id = s.id)
       ))${playlistStationCondition}
     limit 1`,
    playerIdentity ? [user.id, key, playerIdentity.stationId] : [user.id, key]
  )
  if (!owned) throw createError({ statusCode: 403, statusMessage: 'Mídia fora da estação do usuário' })

  try {
    const { bucket } = getRadioStorageConfig()
    const result = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!result.Body) throw createError({ statusCode: 404, statusMessage: 'Mídia não encontrada' })
    setResponseHeaders(event, {
      'Content-Type': result.ContentType || mediaType(key),
      'Cache-Control': playerIdentity ? 'private, no-store' : 'private, max-age=86400, stale-while-revalidate=604800',
      'X-Radio-Storage': 'private'
    })
    if (result.ContentLength != null) setResponseHeader(event, 'Content-Length', Number(result.ContentLength))
    return sendStream(event, result.Body as any)
  } catch (error: any) {
    if (error?.statusCode) throw error
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Mídia não encontrada' })
    }
    throw createError({ statusCode: 502, statusMessage: 'Falha ao buscar mídia da Rádio Indoor' })
  }
})
