import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { getS3Client } from './s3'
import { pgOneOrNull, pgQuery } from './postgres'

export const RADIO_STORAGE_PREFIX = 'radio-indoor/'
export const DEFAULT_RADIO_TIMEZONE = 'America/Sao_Paulo'

export const isUuid = (value: unknown): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim())

export const isRadioStorageKey = (value: unknown): boolean => {
  const key = String(value || '').trim()
  return key.startsWith(RADIO_STORAGE_PREFIX) &&
    key.length <= 1024 &&
    !key.includes('..') &&
    !/[\u0000-\u001f\u007f]/.test(key)
}

export const radioKeyUrl = (kind: 'audio' | 'media', id: string): string =>
  `/api/radio-indoor/${kind}?${kind === 'audio' ? 'trackId' : 'key=' + encodeURIComponent(id)}`

export const radioTableMissing = (error: any): boolean =>
  String(error?.code || '') === '42P01' ||
  /radio_(stations|catalog_tracks|playlists|playlist_items|programs|program_blocks|schedules|requests|playback_events|schedule_jobs|worker_heartbeats|station_members|players)/i.test(String(error?.message || ''))

export const jsonObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}

export const jsonParam = (value: unknown): string => JSON.stringify(value && typeof value === 'object' ? value : {})

export const cleanText = (value: unknown, max = 240): string =>
  String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max)

export const positiveInt = (value: unknown, fallback: number, max: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(max, parsed))
}

export const getRadioStorageConfig = () => {
  const config = useRuntimeConfig() as any
  const endpoint = String(config.wasabiEndpoint || process.env.WASABI_ENDPOINT || process.env.NUXT_WASABI_ENDPOINT || 's3.wasabisys.com')
    .replace(/^https?:\/\//i, '').replace(/\/$/, '')
  const bucket = String(config.wasabiBucket || process.env.WASABI_BUCKET || process.env.NUXT_WASABI_BUCKET || 'jobvarejo')
  return { endpoint, bucket }
}

export const getRadioPresignedGetUrl = async (key: string, expiresIn = 900): Promise<string> => {
  if (!isRadioStorageKey(key)) throw createError({ statusCode: 400, statusMessage: 'Chave de rádio inválida' })
  const { bucket } = getRadioStorageConfig()
  return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn })
}

const stationSlug = (value: unknown): string => {
  const normalized = cleanText(value, 80)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized.slice(0, 56) || 'loja'
}

export const serializeStation = (station: any) => ({
  id: String(station.id),
  user_id: station.user_id,
  name: String(station.name || 'Loja'),
  slug: String(station.slug || 'radio-indoor'),
  timezone: String(station.timezone || DEFAULT_RADIO_TIMEZONE),
  status: station.status || 'draft',
  settings: jsonObject(station.settings),
  accessLevel: station.access_level || station.accessLevel || null,
  isOwner: Boolean(station.is_owner ?? station.isOwner),
  created_at: station.created_at || null,
  updated_at: station.updated_at || null
})

export const ensureRadioStation = async (userId: string, name = 'Rádio Indoor', timezone = DEFAULT_RADIO_TIMEZONE) => {
  const existing = await pgOneOrNull<any>(
    `select id, user_id, name, slug, timezone, status, settings, created_at, updated_at
       from public.radio_stations where user_id = $1 and slug = 'radio-indoor' limit 1`,
    [userId]
  )
  if (existing) {
    await pgQuery(
      `insert into public.radio_station_members (station_id, user_id, access_level, status, created_by)
       values ($1, $2, 'owner', 'active', $2)
       on conflict (station_id, user_id) do update
         set access_level = 'owner', status = 'active', updated_at = now()`,
      [existing.id, userId]
    )
    return existing
  }
  const created = await pgOneOrNull<any>(
    `insert into public.radio_stations (user_id, name, slug, timezone, status)
     values ($1, $2, 'radio-indoor', $3, 'draft')
     on conflict (user_id, slug) do update set name = excluded.name
     returning id, user_id, name, slug, timezone, status, settings, created_at, updated_at`,
    [userId, cleanText(name, 120) || 'Rádio Indoor', cleanText(timezone, 80) || DEFAULT_RADIO_TIMEZONE]
  )
  if (created?.id) {
    await pgQuery(
      `insert into public.radio_station_members (station_id, user_id, access_level, status, created_by)
       values ($1, $2, 'owner', 'active', $2)
       on conflict (station_id, user_id) do update
         set access_level = 'owner', status = 'active', updated_at = now()`,
      [created.id, userId]
    )
  }
  return created
}

export const listOwnedStations = async (userId: string) => {
  const result = await pgQuery<any>(
    `select id, user_id, name, slug, timezone, status, settings, created_at, updated_at
       from public.radio_stations where user_id = $1 order by lower(name), created_at, id`,
    [userId]
  )
  return result.rows
}

export const createRadioStation = async (
  userId: string,
  name: unknown,
  timezone: unknown = DEFAULT_RADIO_TIMEZONE,
  requestedSlug?: unknown
) => {
  const cleanName = cleanText(name, 120)
  if (!cleanName) throw createError({ statusCode: 400, statusMessage: 'Nome da loja é obrigatório' })
  const cleanTimezone = cleanText(timezone, 80) || DEFAULT_RADIO_TIMEZONE
  const baseSlug = stationSlug(requestedSlug || cleanName)
  const candidates = [baseSlug, `${baseSlug}-${randomUUID().slice(0, 8)}`, `${baseSlug}-${randomUUID().slice(0, 8)}`]
  for (const slug of candidates) {
    const created = await pgOneOrNull<any>(
      `insert into public.radio_stations (user_id, name, slug, timezone, status)
       values ($1, $2, $3, $4, 'draft')
       on conflict (user_id, slug) do nothing
       returning id, user_id, name, slug, timezone, status, settings, created_at, updated_at`,
      [userId, cleanName, slug, cleanTimezone]
    )
    if (created) {
      await pgQuery(
        `insert into public.radio_station_members (station_id, user_id, access_level, status, created_by)
         values ($1, $2, 'owner', 'active', $2)
         on conflict (station_id, user_id) do update
           set access_level = 'owner', status = 'active', updated_at = now()`,
        [created.id, userId]
      )
      return created
    }
  }
  throw createError({ statusCode: 409, statusMessage: 'Não foi possível criar outra loja com um identificador único' })
}

export const getOwnedStation = async (userId: string, stationId?: string | null) => {
  if (stationId && isUuid(stationId)) {
    return pgOneOrNull<any>(
      `select id, user_id, name, slug, timezone, status, settings, created_at, updated_at
         from public.radio_stations where id = $1 and user_id = $2 limit 1`,
      [stationId, userId]
    )
  }
  return ensureRadioStation(userId)
}

export const serializeTrack = (track: any) => ({
  id: String(track.id),
  title: String(track.title || 'Sem título'),
  artist: String(track.artist || 'Artista desconhecido'),
  album: track.album || null,
  releaseYear: track.release_year == null ? null : Number(track.release_year),
  releaseDate: track.release_date || null,
  genre: String(track.genre || 'Outros'),
  subgenres: Array.isArray(track.subgenres) ? track.subgenres : [],
  language: track.language || 'pt-BR',
  durationMs: track.duration_ms == null ? null : Number(track.duration_ms),
  sourceUrl: track.source_url || null,
  sourceProvider: track.source_provider || null,
  sourceId: track.source_id || null,
  storageKey: track.storage_key || null,
  thumbnailKey: track.thumbnail_key || null,
  audioFormat: track.audio_format || null,
  audioCodec: track.audio_codec || null,
  rightsStatus: track.rights_status || 'pending',
  status: track.status || 'ready',
  metadata: jsonObject(track.metadata),
  audioUrl: track.storage_key ? `/api/radio-indoor/audio?trackId=${encodeURIComponent(String(track.id))}` : null,
  thumbnailUrl: track.thumbnail_key ? `/api/radio-indoor/media?key=${encodeURIComponent(String(track.thumbnail_key))}` : null,
  createdAt: track.created_at || null,
  updatedAt: track.updated_at || null
})

export const serializePlaylist = (playlist: any) => ({
  id: String(playlist.id),
  name: String(playlist.name || 'Playlist'),
  description: playlist.description || null,
  kind: playlist.kind || 'custom',
  coverKey: playlist.cover_key || null,
  coverUrl: playlist.cover_key ? `/api/radio-indoor/media?key=${encodeURIComponent(String(playlist.cover_key))}` : null,
  isActive: playlist.is_active !== false,
  trackCount: Number(playlist.track_count || 0),
  createdAt: playlist.created_at || null,
  updatedAt: playlist.updated_at || null
})

export const serializeProgram = (program: any) => ({
  id: String(program.id),
  name: String(program.name || 'Programa'),
  description: program.description || null,
  timezone: program.timezone || DEFAULT_RADIO_TIMEZONE,
  status: program.status || 'draft',
  blocks: Array.isArray(program.blocks) ? program.blocks : [],
  createdAt: program.created_at || null,
  updatedAt: program.updated_at || null
})

export const parseRequestBody = async (event: H3Event): Promise<Record<string, any>> => {
  const body = await readBody(event)
  return jsonObject(body)
}

export const getRadioRequestIp = (event: H3Event): string =>
  getRequestIP(event, { xForwardedFor: true }) || event.node.req.socket?.remoteAddress || 'unknown'

export const getOwnedTrack = async (userId: string, trackId: string) => {
  if (!isUuid(trackId)) return null
  return pgOneOrNull<any>(
    `select * from public.radio_catalog_tracks where id = $1 and user_id = $2 limit 1`,
    [trackId, userId]
  )
}

export const getOwnedPlaylist = async (userId: string, playlistId: string, stationId?: string | null) => {
  if (!isUuid(playlistId)) return null
  const params: any[] = [playlistId, userId]
  const stationCondition = stationId && isUuid(stationId)
    ? ' and (station_id = $3 or station_id is null)'
    : ''
  if (stationCondition) params.push(stationId)
  return pgOneOrNull<any>(
    `select * from public.radio_playlists where id = $1 and user_id = $2${stationCondition} limit 1`,
    params
  )
}

export const getOwnedProgram = async (userId: string, programId: string, stationId?: string | null) => {
  if (!isUuid(programId)) return null
  const params: any[] = [programId, userId]
  const stationCondition = stationId && isUuid(stationId)
    ? ' and station_id = $3'
    : ''
  if (stationCondition) params.push(stationId)
  return pgOneOrNull<any>(
    `select * from public.radio_programs where id = $1 and user_id = $2${stationCondition} limit 1`,
    params
  )
}

export const activeLocalSchedule = (schedules: any[], now = new Date()) => {
  const candidates = schedules.filter((schedule) => {
    const timezone = String(schedule.timezone || DEFAULT_RADIO_TIMEZONE)
    let parts: Intl.DateTimeFormatPart[]
    try {
      parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(now)
    } catch {
      return false
    }
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const day = weekdayMap[String(values.weekday)]
    const currentMinutes = Number(values.hour) * 60 + Number(values.minute)
    const start = String(schedule.start_time || '00:00').slice(0, 5).split(':').map(Number)
    const end = String(schedule.end_time || '23:59').slice(0, 5).split(':').map(Number)
    const startMinutes = (start[0] || 0) * 60 + (start[1] || 0)
    const endMinutes = (end[0] || 0) * 60 + (end[1] || 0)
    const days = Array.isArray(schedule.days_of_week) ? schedule.days_of_week.map(Number) : []
    const inWindow = startMinutes <= endMinutes
      ? currentMinutes >= startMinutes && currentMinutes < endMinutes
      : currentMinutes >= startMinutes || currentMinutes < endMinutes
    return days.includes(day) && inWindow
  })
  return candidates.sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100))[0] || null
}

export const radioTableErrorResponse = (error: any) => {
  if (!radioTableMissing(error)) return null
  return {
    success: false,
    setupRequired: true,
    message: 'A migração da Rádio Indoor ainda não foi aplicada em public.radio_*.'
  }
}
