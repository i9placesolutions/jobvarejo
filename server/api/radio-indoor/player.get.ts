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

    const history = await pgQuery<{ track_id: string }>(
      `select track_id from public.radio_playback_events
        where station_id = $1 and track_id is not null
        order by played_at desc limit 300`,
      [station.id]
    )
    const recentlyPlayedIds = Array.from(new Set(history.rows.map((row) => String(row.track_id))))

    const queue: any[] = []
    const seen = new Set<string>()
    for (const block of blocks) {
      if (!['music', 'playlist', 'jingle', 'commercial', 'audio_pack'].includes(String(block.block_type))) continue
      const settings = typeof block.settings === 'object' && block.settings !== null ? block.settings : {}
      const mode = settings.transitionMode || (block.duration_seconds ? 'time' : 'count')

      // Define quantas faixas buscar do banco dependendo do critério de troca automática
      let limit = 20
      if (mode === 'time' && block.duration_seconds) {
        // Média de ~3 min por faixa (180s) para cobrir o tempo configurado do bloco
        limit = Math.max(1, Math.min(100, Math.ceil(Number(block.duration_seconds) / 180)))
      } else if (mode === 'full_playlist') {
        limit = 100 // Toca toda a playlist cadastrada
      } else if (mode === 'continuous') {
        limit = 80 // Roda em fluxo contínuo até a agenda virar
      } else {
        limit = Math.max(1, Math.min(50, Number(block.target_count || 20)))
      }

      const items = block.playlist_id ? await pgQuery<any>(
        `select t.* from public.radio_playlist_items i
           join public.radio_catalog_tracks t on t.id = i.track_id
           join public.radio_playlists p on p.id = i.playlist_id
          where i.playlist_id = $1 and t.user_id = $2 and t.status = 'ready'
            and t.storage_key is not null and p.is_active = true
            and p.user_id = $2 and (p.station_id = $4 or p.station_id is null)
          order by (t.id = any($5::uuid[])), array_position($5::uuid[], t.id) desc nulls last,
                   i.position, t.artist, t.title limit $3`,
        [block.playlist_id, ownerUserId, limit, station.id, recentlyPlayedIds]
      ) : await pgQuery<any>(
        `select * from public.radio_catalog_tracks
          where user_id = $1 and status = 'ready' and storage_key is not null
            and (station_id = $2 or station_id is null)
          order by (id = any($4::uuid[])), array_position($4::uuid[], id) desc nulls last,
                   artist, title limit $3`,
        [ownerUserId, station.id, limit, recentlyPlayedIds]
      )
      for (const track of items.rows) {
        if (seen.has(String(track.id))) continue
        seen.add(String(track.id))
        queue.push({ ...serializeTrack(track), blockId: block.id, blockLabel: block.label, playlistId: block.playlist_id })
      }
    }

    // A loja ativa fica silenciosa fora dos horários publicados. A prévia
    // autenticada ainda pode tocar o catálogo enquanto a grade é preparada.
    if (!schedule && !playerIdentity && station.status !== 'active') {
      const fallback = await pgQuery<any>(
        `select * from public.radio_catalog_tracks
          where user_id = $1 and status = 'ready' and storage_key is not null
            and (station_id = $2 or station_id is null)
          order by (id = any($3::uuid[])), array_position($3::uuid[], id) desc nulls last,
                   artist, title limit 80`,
        [ownerUserId, station.id, recentlyPlayedIds]
      )
      for (const track of fallback.rows) {
        queue.push({ ...serializeTrack(track), blockId: null, blockLabel: 'Catálogo geral', playlistId: null })
      }
    }

    // Continuidade da transmissão: calcula o ponto exato da programação no horário
    // para que reabrir o player não volte sempre ao início da primeira música.
    let initialOffsetSec = 0
    let currentTrackIndex = 0
    if (schedule && queue.length > 0) {
      try {
        const timezone = String(schedule.timezone || station.timezone || 'America/Sao_Paulo')
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        }).formatToParts(new Date())
        const vals = Object.fromEntries(parts.map((p) => [p.type, p.value]))
        const currentSecOfDay = (Number(vals.hour || 0) * 3600) + (Number(vals.minute || 0) * 60) + Number(vals.second || 0)

        const startParts = String(schedule.start_time || '00:00').slice(0, 5).split(':').map(Number)
        const startSecOfDay = (startParts[0] || 0) * 3600 + (startParts[1] || 0) * 60

        let elapsedSeconds = currentSecOfDay >= startSecOfDay
          ? currentSecOfDay - startSecOfDay
          : (86400 - startSecOfDay) + currentSecOfDay

        // Duração total do ciclo da fila (fallback para 180s por faixa se duração não informada)
        const trackDurationsMs = queue.map((t) => {
          const ms = Number(t.durationMs || t.duration_ms)
          return Number.isFinite(ms) && ms > 10000 ? ms : 180_000
        })
        const totalCycleMs = trackDurationsMs.reduce((acc, d) => acc + d, 0)

        if (totalCycleMs > 0) {
          const elapsedMs = (elapsedSeconds * 1000) % totalCycleMs
          let accumulatedMs = 0
          for (let i = 0; i < queue.length; i++) {
            const trackDur = trackDurationsMs[i] || 180_000
            if (accumulatedMs + trackDur > elapsedMs) {
              currentTrackIndex = i
              initialOffsetSec = Math.max(0, Math.floor((elapsedMs - accumulatedMs) / 1000))
              break
            }
            accumulatedMs += trackDur
          }

          // Rotaciona a fila para que a faixa em andamento fique no topo (índice 0)
          if (currentTrackIndex > 0) {
            const rotated = [...queue.slice(currentTrackIndex), ...queue.slice(0, currentTrackIndex)]
            queue.length = 0
            queue.push(...rotated)
          }
        }
      } catch (err) {
        console.warn('[radio-player] erro ao calcular continuidade da grade:', err)
      }
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
      initialOffsetSec,
      currentTrackIndex,
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
