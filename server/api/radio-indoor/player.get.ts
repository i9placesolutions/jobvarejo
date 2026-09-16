import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgQuery } from '../../utils/postgres'
import {
  activeLocalSchedule,
  radioTableErrorResponse,
  serializeTrack
} from '../../utils/radio-indoor'
import { requireRadioStationAccess } from '../../utils/radio-access'
import { getRadioPlayerIdentity } from '../../utils/radio-player-auth'

export default defineEventHandler(async (event) => {
  const playerIdentity = await getRadioPlayerIdentity(event)
  const user = playerIdentity ? { id: playerIdentity.userId } : await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-player:${user.id}`, 240, 60_000)
  const requestedStationId = String(getQuery(event).stationId || '').trim() || null
  const stationId = playerIdentity?.stationId || requestedStationId

  try {
    const scope = await requireRadioStationAccess(user.id, stationId, 'player', { createIfMissing: false })
    const station = scope.station
    const ownerUserId = scope.ownerUserId
    const scheduleResult = await pgQuery<any>(
      `select s.*, p.id as joined_program_id, p.name as program_name, p.description as program_description,
              p.timezone as program_timezone, p.status as program_status
         from public.radio_schedules s
         join public.radio_programs p on p.id = s.program_id and p.user_id = s.user_id
        where s.user_id = $1 and s.station_id = $2 and s.enabled = true and p.status <> 'paused'
        order by s.priority, s.start_time`,
      [ownerUserId, stationId || station.id]
    )
    const schedule = activeLocalSchedule(scheduleResult.rows)
    const programId = schedule?.program_id || null
    let blocks: any[] = []
    if (programId) {
      const blockResult = await pgQuery<any>(
        `select id, block_type, label, playlist_id, duration_seconds, target_count, position, settings
           from public.radio_program_blocks where program_id = $1 order by position, created_at`,
        [programId]
      )
      blocks = blockResult.rows
    }

    const queue: any[] = []
    const seen = new Set<string>()
    for (const block of blocks) {
      if (!block.playlist_id) continue
      const limit = Math.max(1, Math.min(50, Number(block.target_count || 20)))
      const items = await pgQuery<any>(
        `select t.* from public.radio_playlist_items i
           join public.radio_catalog_tracks t on t.id = i.track_id
           join public.radio_playlists p on p.id = i.playlist_id
          where i.playlist_id = $1 and t.user_id = $2 and t.status = 'ready'
            and p.user_id = $2 and (p.station_id = $4 or p.station_id is null)
          order by i.position, t.artist, t.title limit $3`,
        [block.playlist_id, ownerUserId, limit, station.id]
      )
      for (const track of items.rows) {
        if (seen.has(String(track.id))) continue
        seen.add(String(track.id))
        queue.push({ ...serializeTrack(track), blockId: block.id, blockLabel: block.label, playlistId: block.playlist_id })
      }
    }

    const fallback = await pgQuery<any>(
      `select * from public.radio_catalog_tracks
        where user_id = $1 and status = 'ready'
        order by artist, title limit 80`,
      [ownerUserId]
    )
    for (const track of fallback.rows) {
      if (seen.has(String(track.id))) continue
      seen.add(String(track.id))
      queue.push({ ...serializeTrack(track), blockId: null, blockLabel: 'Catálogo geral', playlistId: null })
      if (queue.length >= 80) break
    }

    return {
      success: true,
      station,
      schedule: schedule ? {
        id: schedule.id,
        programId: schedule.program_id,
        programName: schedule.program_name,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        timezone: schedule.timezone
      } : null,
      program: programId ? {
        id: programId,
        name: schedule.program_name,
        blocks: blocks.map((block) => ({
          id: block.id,
          blockType: block.block_type,
          label: block.label,
          playlistId: block.playlist_id,
          durationSeconds: block.duration_seconds,
          targetCount: block.target_count
        }))
      } : null,
      queue,
      cache: { enabled: true, maxTracks: 20, offlineMinutes: 45, strategy: 'cache-first-next-tracks' },
      player: playerIdentity ? { id: playerIdentity.playerId, name: playerIdentity.name } : null,
      serverTime: new Date().toISOString()
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return { ...setup, queue: [], schedule: null, program: null }
    throw createError({ statusCode: Number(error?.statusCode || 500), statusMessage: error?.statusMessage || error?.message || 'Falha ao preparar player' })
  }
})
