import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgQuery } from '../../utils/postgres'
import {
  radioTableErrorResponse,
  serializePlaylist,
  serializeProgram,
  serializeStation,
  getRadioRequestIp
} from '../../utils/radio-indoor'
import { getRadioStationScope, listAccessibleStations } from '../../utils/radio-access'
import { musicGptStatusForClient } from '../../utils/musicgpt'
import { getElevenLabsConfig } from '../../utils/elevenlabs'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-bootstrap:${user.id}:${getRadioRequestIp(event)}`, 120, 60_000)

  try {
    const requestedStationId = String(getQuery(event).stationId || '').trim() || null
    const scope = await getRadioStationScope(user.id, requestedStationId)
    if (!scope) throw createError({ statusCode: 404, statusMessage: 'Loja da Rádio Indoor não encontrada' })
    const station = scope.station
    const ownerUserId = scope.ownerUserId

    const [stationResult, playlistResult, programResult, scheduleResult, trackSummary] = await Promise.all([
      listAccessibleStations(user.id),
      pgQuery<any>(
        `select p.id, p.name, p.description, p.kind, p.cover_key, p.is_active, p.created_at, p.updated_at,
                count(i.track_id)::int as track_count
           from public.radio_playlists p
           left join public.radio_playlist_items i on i.playlist_id = p.id
          where p.user_id = $1 and (p.station_id = $2 or p.station_id is null)
          group by p.id order by p.updated_at desc`,
        [ownerUserId, station.id]
      ),
      pgQuery<any>(
        `select p.id, p.name, p.description, p.timezone, p.status, p.created_at, p.updated_at,
                coalesce(json_agg(json_build_object(
                  'id', b.id, 'blockType', b.block_type, 'label', b.label,
                  'playlistId', b.playlist_id, 'durationSeconds', b.duration_seconds,
                  'targetCount', b.target_count, 'position', b.position, 'settings', b.settings
                ) order by b.position) filter (where b.id is not null), '[]'::json) as blocks
           from public.radio_programs p
           left join public.radio_program_blocks b on b.program_id = p.id
          where p.user_id = $1 and p.station_id = $2
          group by p.id order by p.updated_at desc`,
        [ownerUserId, station.id]
      ),
      pgQuery<any>(
        `select id, program_id, days_of_week, to_char(start_time, 'HH24:MI') as start_time,
                to_char(end_time, 'HH24:MI') as end_time, timezone, priority, enabled,
                starts_on, ends_on, created_at, updated_at
           from public.radio_schedules where user_id = $1 and station_id = $2
          order by priority, start_time`,
        [ownerUserId, station.id]
      ),
      pgQuery<any>(
        `select count(*)::int as total,
                count(*) filter (where status = 'ready')::int as ready,
                count(distinct nullif(genre, ''))::int as genres,
                count(distinct nullif(artist, ''))::int as artists
           from public.radio_catalog_tracks where user_id = $1`,
        [ownerUserId]
      )
    ])

    return {
      success: true,
      station: serializeStation(station),
      stationId: station.id,
      stations: stationResult.map(serializeStation),
      access: {
        level: scope.accessLevel,
        isOwner: scope.isOwner,
        canManageUsers: scope.accessLevel === 'owner' || scope.accessLevel === 'manager',
        canEditProgramming: ['owner', 'manager', 'editor'].includes(scope.accessLevel)
      },
      playlists: playlistResult.rows.map(serializePlaylist),
      programs: programResult.rows.map(serializeProgram),
      schedules: scheduleResult.rows,
      summary: trackSummary.rows[0] || { total: 0, ready: 0, genres: 0, artists: 0 },
      musicGpt: musicGptStatusForClient(),
      elevenLabs: { configured: Boolean(getElevenLabsConfig().apiKey) }
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    throw createError({ statusCode: Number(error?.statusCode || 500), statusMessage: error?.statusMessage || error?.message || 'Falha ao carregar Rádio Indoor' })
  }
})
