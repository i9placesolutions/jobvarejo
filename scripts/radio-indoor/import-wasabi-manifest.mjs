#!/usr/bin/env node
/* Importa o manifesto privado já enviado para o Wasabi na conta informada. */
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Client } from 'pg'

const DEFAULT_KEY = 'radio-indoor/catalog/metadata/playlists/henrique-e-juliano/menos-e-mais-ao-vivo-2018.json'
const args = process.argv.slice(2)
const arg = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 ? String(args[index + 1] || fallback) : fallback
}
const userId = arg('--user-id')
const stationId = arg('--station-id')
const manifestKey = arg('--manifest-key', DEFAULT_KEY)
if (!userId) throw new Error('Uso: node scripts/radio-indoor/import-wasabi-manifest.mjs --user-id UUID [--station-id UUID]')
if (!manifestKey.startsWith('radio-indoor/') || !manifestKey.endsWith('.json')) throw new Error('Manifest key inválida')

const endpoint = String(process.env.WASABI_ENDPOINT || 's3.wasabisys.com').replace(/^https?:\/\//i, '').replace(/\/$/, '')
const s3 = new S3Client({
  region: process.env.WASABI_REGION || 'us-east-1',
  endpoint: `https://${endpoint}`,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.WASABI_ACCESS_KEY, secretAccessKey: process.env.WASABI_SECRET_KEY }
})
const object = await s3.send(new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET || 'jobvarejo', Key: manifestKey }))
const manifest = JSON.parse(await object.Body.transformToString())
const tracks = Array.isArray(manifest?.tracks) ? manifest.tracks : []
if (!tracks.length) throw new Error('Manifesto sem faixas')

const db = new Client({ connectionString: process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL })
await db.connect()
try {
  await db.query('BEGIN')
  const playlist = manifest.playlist || manifest
  let station
  if (stationId) {
    station = (await db.query(
      `select id from public.radio_stations where id = $1 and user_id = $2 limit 1`,
      [stationId, userId]
    )).rows[0]
    if (!station) throw new Error('A loja informada não pertence ao usuário ou não existe')
  } else {
    station = (await db.query(
      `insert into public.radio_stations (user_id, name, slug, timezone, status)
       values ($1,$2,'radio-indoor','America/Sao_Paulo','draft')
       on conflict (user_id, slug) do update set name = excluded.name
       returning id`,
      [userId, String(playlist.title || playlist.name || 'Rádio Indoor').slice(0, 120)]
    )).rows[0]
  }
  const playlistName = String(playlist.title || playlist.name || 'Catálogo importado').slice(0, 160)
  const existingPlaylist = (await db.query(
    `select id from public.radio_playlists where user_id = $1 and station_id = $2 and name = $3 limit 1`,
    [userId, station.id, playlistName]
  )).rows[0]
  const playlistRow = existingPlaylist || (await db.query(
    `insert into public.radio_playlists (user_id, station_id, name, description, kind, cover_key, settings)
     values ($1,$2,$3,$4,'year',$5,$6::jsonb)
     returning id`,
    [userId, station.id, playlistName, String(playlist.album || 'Catálogo importado').slice(0, 500), playlist.cover?.storageKey || null, JSON.stringify({ source: 'wasabi-manifest', manifestKey })]
  )).rows[0]
  let imported = 0
  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index] || {}
    const source = track.source || {}
    const audio = track.audio || {}
    const thumbnail = track.thumbnail || {}
    const sourceId = String(track.trackId || source.videoId || `manifest-${index + 1}`).slice(0, 180)
    const row = (await db.query(
      `insert into public.radio_catalog_tracks
        (user_id, station_id, title, artist, album, release_year, release_date, genre, subgenres, language,
         duration_ms, source_url, source_provider, source_id, storage_key, thumbnail_key, thumbnail_source_url,
         audio_format, audio_codec, rights_status, status, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'youtube',$13,$14,$15,$16,$17,$18,$19,'ready',$20::jsonb)
       on conflict (user_id, source_provider, source_id) do update set
         station_id=coalesce(radio_catalog_tracks.station_id, excluded.station_id), title=excluded.title, artist=excluded.artist, album=excluded.album,
         release_year=excluded.release_year, release_date=excluded.release_date, genre=excluded.genre,
         duration_ms=excluded.duration_ms, source_url=excluded.source_url, storage_key=excluded.storage_key,
         thumbnail_key=excluded.thumbnail_key, thumbnail_source_url=excluded.thumbnail_source_url,
         audio_format=excluded.audio_format, audio_codec=excluded.audio_codec,
         rights_status=excluded.rights_status, status='ready', metadata=excluded.metadata, updated_at=now()
       returning id`,
      [
        userId, station.id, String(track.title || `Faixa ${index + 1}`).slice(0, 240), String(track.artist || playlist.artist || 'Artista desconhecido').slice(0, 180),
        String(track.album || playlist.album || '').slice(0, 180) || null, Number(track.year || playlist.year) || null, track.releaseDate || null,
        String(track.genre || playlist.genre || 'Outros').slice(0, 80), Array.isArray(track.tags) ? track.tags.map(String).slice(0, 20) : [], String(track.language || playlist.language || 'pt-BR').slice(0, 20),
        Math.round(Number(track.durationSeconds || audio.durationSeconds || 0) * 1000) || null, source.url || null, sourceId,
        audio.storageKey || null, thumbnail.storageKey || null, thumbnail.sourceUrl || null, audio.format || 'webm', audio.codec || 'opus', audio.rightsStatus || 'authorized_by_user',
        JSON.stringify({ importedFrom: manifestKey, playlistPosition: Number(track.position || index + 1) })
      ]
    )).rows[0]
    await db.query(
      `insert into public.radio_playlist_items (playlist_id, track_id, position) values ($1,$2,$3)
       on conflict (playlist_id, track_id) do update set position=excluded.position`,
      [playlistRow.id, row.id, index]
    )
    imported += 1
  }
  await db.query('COMMIT')
  console.log(JSON.stringify({ success: true, userId, stationId: station.id, playlistId: playlistRow.id, imported, total: tracks.length }))
} catch (error) {
  await db.query('ROLLBACK')
  throw error
} finally {
  await db.end()
  s3.destroy()
}
