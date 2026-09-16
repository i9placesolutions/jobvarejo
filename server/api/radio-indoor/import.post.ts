import { GetObjectCommand } from '@aws-sdk/client-s3'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { getS3Client } from '../../utils/s3'
import { pgTx } from '../../utils/postgres'
import {
  cleanText,
  getRadioRequestIp,
  getRadioStorageConfig,
  isRadioStorageKey,
  jsonParam,
  positiveInt,
  radioTableErrorResponse
} from '../../utils/radio-indoor'
import { requireRadioStationAccess } from '../../utils/radio-access'

const DEFAULT_MANIFEST_KEY = 'radio-indoor/catalog/metadata/playlists/henrique-e-juliano/menos-e-mais-ao-vivo-2018.json'

const first = (source: any, keys: string[]) => {
  for (const key of keys) {
    if (source?.[key] != null && String(source[key]).trim()) return source[key]
  }
  return null
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-import:${user.id}:${getRadioRequestIp(event)}`, 12, 60_000)
  const body = await readBody<Record<string, any>>(event)
  const requestedKey = cleanText(body?.manifestKey || DEFAULT_MANIFEST_KEY, 1024)
  if (!isRadioStorageKey(requestedKey) || !requestedKey.includes('/metadata/playlists/') || !requestedKey.endsWith('.json')) {
    throw createError({ statusCode: 400, statusMessage: 'Manifesto de rádio inválido' })
  }

  try {
    const { bucket } = getRadioStorageConfig()
    const object = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: requestedKey }))
    const raw = await object.Body?.transformToString()
    if (!raw) throw createError({ statusCode: 422, statusMessage: 'Manifesto vazio no Wasabi' })
    const manifest = JSON.parse(raw)
    const tracks = Array.isArray(manifest?.tracks) ? manifest.tracks : []
    if (!tracks.length) throw createError({ statusCode: 422, statusMessage: 'O manifesto não possui músicas' })
    const requestedStationId = String(body?.stationId || '').trim() || null
    const scope = await requireRadioStationAccess(user.id, requestedStationId, 'editor')
    const station = scope.station
    const ownerUserId = scope.ownerUserId

    const result = await pgTx(async (client) => {
      const playlistName = cleanText(first(manifest?.playlist || manifest, ['title', 'name']) || 'Menos É Mais — Ao Vivo', 160)
      const existingPlaylist = await client.query<any>(
        `select id from public.radio_playlists where user_id = $1 and station_id = $2 and name = $3 limit 1`,
        [ownerUserId, station.id, playlistName]
      )
      let playlistId = existingPlaylist.rows[0]?.id as string | undefined
      if (!playlistId) {
        const insertedPlaylist = await client.query<any>(
          `insert into public.radio_playlists (user_id, station_id, name, description, kind, cover_key, settings)
           values ($1, $2, $3, $4, 'year', $5, $6::jsonb) returning id`,
          [
            ownerUserId,
            station.id,
            playlistName,
            cleanText(first(manifest?.playlist || manifest, ['description', 'album']) || 'Catálogo importado para a Rádio Indoor', 500),
            first(manifest?.playlist || manifest, ['coverKey', 'cover_key']) || manifest?.playlist?.cover?.storageKey || manifest?.cover?.storageKey || null,
            jsonParam({ source: 'wasabi-manifest', manifestKey: requestedKey, importedAt: new Date().toISOString() })
          ]
        )
        playlistId = insertedPlaylist.rows[0]?.id
      }
      if (!playlistId) throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar a playlist' })

      let imported = 0
      for (let index = 0; index < tracks.length; index += 1) {
        const track = tracks[index] || {}
        const audio = track.audio && typeof track.audio === 'object' ? track.audio : {}
        const thumbnail = track.thumbnail && typeof track.thumbnail === 'object' ? track.thumbnail : {}
        const storageKey = first(audio, ['storageKey', 'storage_key']) || first(track, ['storageKey', 'storage_key'])
        const thumbnailKey = first(thumbnail, ['storageKey', 'storage_key']) || first(track, ['thumbnailKey', 'thumbnail_key'])
        if (storageKey && !isRadioStorageKey(storageKey)) continue
        if (thumbnailKey && !isRadioStorageKey(thumbnailKey)) continue
        const source = track.source && typeof track.source === 'object' ? track.source : {}
        const sourceId = cleanText(first(track, ['sourceId', 'source_id', 'videoId', 'trackId', 'id']) || first(source, ['videoId', 'id']) || `manifest-${index + 1}`, 180)
        const releaseYearRaw = first(track, ['releaseYear', 'release_year', 'year'])
        const releaseYear = Number.isFinite(Number(releaseYearRaw)) ? positiveInt(releaseYearRaw, 0, 2200) || null : null
        const durationMsRaw = first(track, ['durationMs', 'duration_ms']) || audio.durationMs || (Number.isFinite(Number(track.durationSeconds)) ? Number(track.durationSeconds) * 1000 : null)
        const durationMs = Number.isFinite(Number(durationMsRaw)) ? positiveInt(durationMsRaw, 0, 24 * 60 * 60 * 1000) || null : null
        const metadata = {
          ...(track.metadata && typeof track.metadata === 'object' ? track.metadata : {}),
          importedFrom: requestedKey,
          playlistPosition: index + 1
        }
        const upserted = await client.query<any>(
          `insert into public.radio_catalog_tracks
            (user_id, station_id, title, artist, album, release_year, release_date, genre, subgenres,
             language, duration_ms, source_url, source_provider, source_id, storage_key, thumbnail_key,
             thumbnail_source_url, audio_format, audio_codec, rights_status, status, metadata)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'ready',$21::jsonb)
           on conflict (user_id, source_provider, source_id) do update set
             station_id = coalesce(radio_catalog_tracks.station_id, excluded.station_id), title = excluded.title, artist = excluded.artist,
             album = excluded.album, release_year = excluded.release_year, release_date = excluded.release_date,
             genre = excluded.genre, duration_ms = excluded.duration_ms, storage_key = excluded.storage_key,
             thumbnail_key = excluded.thumbnail_key, audio_format = excluded.audio_format,
             audio_codec = excluded.audio_codec, rights_status = excluded.rights_status,
             status = excluded.status, metadata = excluded.metadata, updated_at = now()
           returning id`,
          [
            ownerUserId,
            station.id,
            cleanText(first(track, ['title', 'name']) || `Faixa ${index + 1}`, 240),
            cleanText(first(track, ['artist', 'author']) || 'Artista desconhecido', 180),
            cleanText(first(track, ['album']) || first(manifest?.playlist || manifest, ['album', 'title']) || '', 180) || null,
            releaseYear,
            first(track, ['releaseDate', 'release_date']) || null,
            cleanText(first(track, ['genre', 'category']) || first(manifest?.playlist || manifest, ['genre']) || 'Outros', 80),
            Array.isArray(track.subgenres) ? track.subgenres.map((item: any) => cleanText(item, 60)).filter(Boolean) : [],
            cleanText(first(track, ['language']) || 'pt-BR', 20),
            durationMs,
            cleanText(first(track, ['sourceUrl', 'source_url', 'url']) || first(source, ['url']) || '', 2048) || null,
            'youtube',
            sourceId,
            storageKey || null,
            thumbnailKey || null,
            cleanText(first(thumbnail, ['sourceUrl', 'source_url', 'url']) || '', 2048) || null,
            cleanText(first(audio, ['format', 'audioFormat']) || 'webm', 24),
            cleanText(first(audio, ['codec', 'audioCodec']) || 'opus', 40),
            cleanText(first(track, ['rightsStatus', 'rights_status']) || 'authorized_by_user', 80),
            jsonParam(metadata)
          ]
        )
        const trackId = upserted.rows[0]?.id
        if (!trackId) continue
        await client.query(
          `insert into public.radio_playlist_items (playlist_id, track_id, position)
           values ($1, $2, $3)
           on conflict (playlist_id, track_id) do update set position = excluded.position`,
          [playlistId, trackId, index]
        )
        imported += 1
      }
      return { playlistId, imported, total: tracks.length }
    })

    return { success: true, stationId: station.id, ...result, manifestKey: requestedKey }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    if (error?.statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: error?.message || 'Falha ao importar catálogo da Rádio Indoor' })
  }
})
