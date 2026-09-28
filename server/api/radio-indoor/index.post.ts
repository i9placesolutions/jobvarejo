import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgQuery, pgTx } from '../../utils/postgres'
import {
  createRadioStation,
  cleanText,
  getOwnedPlaylist,
  getOwnedProgram,
  getOwnedTrack,
  isUuid,
  jsonParam,
  parseRequestBody,
  positiveInt,
  radioTableErrorResponse
} from '../../utils/radio-indoor'
import { getRadioStationScope, requireRadioStationAccess } from '../../utils/radio-access'

const validTime = (value: unknown): string | null => {
  const normalized = String(value || '').trim()
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : null
}

const daysOfWeek = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [1, 2, 3, 4, 5]
  return Array.from(new Set(value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 6))).sort((a, b) => a - b)
}

const validDate = (value: unknown): string | null => {
  const text = String(value || '').trim()
  if (!text) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw createError({ statusCode: 400, statusMessage: 'Data da agenda inválida' })
  const date = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw createError({ statusCode: 400, statusMessage: 'Data da agenda inválida' })
  }
  return text
}

const validTimezone = (value: unknown): string => {
  const timezone = cleanText(value, 80)
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format() }
  catch { throw createError({ statusCode: 400, statusMessage: 'Fuso horário inválido' }) }
  return timezone
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-config:${user.id}`, 180, 60_000)
  const body = await parseRequestBody(event)
  const action = cleanText(body.action, 60).toLowerCase()

  try {
    const requestedStationId = String(body.stationId || '').trim() || null
    if (action === 'create_station') {
      const accountScope = await getRadioStationScope(user.id, requestedStationId)
      if (accountScope && !['owner', 'manager'].includes(accountScope.accessLevel)) {
        throw createError({ statusCode: 403, statusMessage: 'Somente proprietário ou gerente pode cadastrar lojas' })
      }
      const created = await createRadioStation(accountScope?.ownerUserId || user.id, body.name, validTimezone(body.timezone || 'America/Sao_Paulo'), body.slug)
      return { success: true, station: created }
    }
    const minimumAccess = action === 'toggle_station' ? 'manager' : 'editor'
    const scope = await requireRadioStationAccess(user.id, requestedStationId, minimumAccess)
    const station = scope.station
    const ownerUserId = scope.ownerUserId

    if (action === 'toggle_station') {
      const status = ['draft', 'active', 'paused'].includes(String(body.status)) ? String(body.status) : 'active'
      if (status === 'active' && station.status !== 'active') {
        const readiness = await pgQuery<any>(
          `select
             exists(select 1 from public.radio_schedules s
               join public.radio_programs p on p.id = s.program_id
              where s.station_id = $1 and s.enabled and p.status <> 'paused'
                and (s.ends_on is null or s.ends_on >= current_date)) as has_schedule,
             exists(select 1 from public.radio_schedules s
               join public.radio_programs p on p.id = s.program_id
               join public.radio_program_blocks b on b.program_id = p.id
              where s.station_id = $1 and s.enabled and p.status <> 'paused'
                and (s.ends_on is null or s.ends_on >= current_date)
                and b.block_type in ('music','playlist','audio_pack','jingle','commercial')
                and (
                  (b.playlist_id is null and b.block_type in ('music','playlist') and exists (
                    select 1 from public.radio_catalog_tracks t
                     where t.user_id = $2 and (t.station_id = $1 or t.station_id is null)
                       and t.status = 'ready' and t.storage_key is not null))
                  or (b.playlist_id is not null and exists (
                    select 1 from public.radio_playlists l
                    join public.radio_playlist_items i on i.playlist_id = l.id
                    join public.radio_catalog_tracks t on t.id = i.track_id
                     where l.id = b.playlist_id and l.user_id = $2 and l.is_active
                       and (l.station_id = $1 or l.station_id is null)
                       and t.user_id = $2 and t.status = 'ready' and t.storage_key is not null))
                )) as has_playable_schedule,
             exists(select 1 from public.radio_players where station_id = $1 and status = 'active') as has_player`,
          [station.id, ownerUserId]
        )
        if (!readiness.rows[0]?.has_schedule || !readiness.rows[0]?.has_playable_schedule || !readiness.rows[0]?.has_player) {
          throw createError({ statusCode: 409, statusMessage: 'Para colocar a loja no ar, publique uma agenda com músicas e cadastre um player ativo.' })
        }
      }
      const result = await pgQuery<any>(
        `update public.radio_stations set status = $1, name = coalesce(nullif($2, ''), name), timezone = coalesce(nullif($3, ''), timezone)
          where id = $4 and user_id = $5 returning id, user_id, name, slug, timezone, status, settings, created_at, updated_at`,
        [status, cleanText(body.name, 120), body.timezone ? validTimezone(body.timezone) : '', station.id, ownerUserId]
      )
      return { success: true, station: result.rows[0] }
    }

    if (action === 'create_playlist') {
      const name = cleanText(body.name, 160)
      if (!name) throw createError({ statusCode: 400, statusMessage: 'Nome da playlist é obrigatório' })
      const result = await pgQuery<any>(
        `insert into public.radio_playlists (user_id, station_id, name, description, kind, cover_key, settings)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb)
         returning id, name, description, kind, cover_key, is_active, created_at, updated_at`,
        [
            ownerUserId, station.id, name, cleanText(body.description, 500) || null,
          ['custom', 'genre', 'year', 'artist', 'special', 'system'].includes(String(body.kind)) ? String(body.kind) : 'custom',
          null, jsonParam({})
        ]
      )
      return { success: true, playlist: result.rows[0] }
    }

    if (action === 'add_track') {
      const playlistId = String(body.playlistId || '').trim()
      const trackId = String(body.trackId || '').trim()
      const [playlist, track] = await Promise.all([getOwnedPlaylist(ownerUserId, playlistId, station.id), getOwnedTrack(ownerUserId, trackId)])
      if (!playlist || !track) throw createError({ statusCode: 404, statusMessage: 'Playlist ou faixa não encontrada' })
      const requestedPosition = positiveInt(body.position, 0, 100_000)
      const result = await pgQuery<any>(
        `insert into public.radio_playlist_items (playlist_id, track_id, position, weight)
         values ($1,$2,$3,$4)
         on conflict (playlist_id, track_id) do update set position = excluded.position, weight = excluded.weight
         returning playlist_id, track_id, position, weight`,
        [playlist.id, track.id, requestedPosition, Math.max(0.01, Math.min(100, Number(body.weight || 1)))]
      )
      return { success: true, item: result.rows[0] }
    }

    if (action === 'add_multiple_tracks') {
      const playlistId = String(body.playlistId || '').trim()
      const playlist = await getOwnedPlaylist(ownerUserId, playlistId, station.id)
      if (!playlist) throw createError({ statusCode: 404, statusMessage: 'Playlist não encontrada' })
      const rawTrackIds = Array.isArray(body.trackIds) ? body.trackIds : []
      const trackIds = Array.from(new Set(rawTrackIds.map((id: any) => String(id || '').trim()).filter(isUuid)))
      if (!trackIds.length) throw createError({ statusCode: 400, statusMessage: 'Nenhuma música válida selecionada' })
      let addedCount = 0
      await pgTx(async (client) => {
        for (const tId of trackIds) {
          const res = await client.query(
            `insert into public.radio_playlist_items (playlist_id, track_id, position)
             values ($1, $2, 99999)
             on conflict (playlist_id, track_id) do nothing`,
            [playlist.id, tId]
          )
          if ((res.rowCount || 0) > 0) addedCount++
        }
      })
      return { success: true, addedCount }
    }

    if (action === 'add_genre_to_playlist') {
      const playlistId = String(body.playlistId || '').trim()
      const genre = String(body.genre || '').trim()
      if (!genre) throw createError({ statusCode: 400, statusMessage: 'Gênero é obrigatório' })
      const playlist = await getOwnedPlaylist(ownerUserId, playlistId, station.id)
      if (!playlist) throw createError({ statusCode: 404, statusMessage: 'Playlist não encontrada' })
      const insertResult = await pgQuery(
        `insert into public.radio_playlist_items (playlist_id, track_id, position)
         select $1, t.id, 99999
           from public.radio_catalog_tracks t
          where t.user_id = $2 and t.status = 'ready' and lower(t.genre) = lower($3)
         on conflict (playlist_id, track_id) do nothing`,
        [playlist.id, ownerUserId, genre]
      )
      return { success: true, addedCount: insertResult.rowCount || 0 }
    }

    if (action === 'add_playlist_to_playlist') {
      const sourcePlaylistId = String(body.sourcePlaylistId || '').trim()
      const targetPlaylistId = String(body.targetPlaylistId || '').trim()
      if (sourcePlaylistId === targetPlaylistId) throw createError({ statusCode: 400, statusMessage: 'A playlist de origem e destino devem ser diferentes' })
      const [source, target] = await Promise.all([
        getOwnedPlaylist(ownerUserId, sourcePlaylistId, station.id),
        getOwnedPlaylist(ownerUserId, targetPlaylistId, station.id)
      ])
      if (!source || !target) throw createError({ statusCode: 404, statusMessage: 'Playlist de origem ou destino não encontrada' })
      const insertResult = await pgQuery(
        `insert into public.radio_playlist_items (playlist_id, track_id, position)
         select $1, pi.track_id, 99999
           from public.radio_playlist_items pi
          where pi.playlist_id = $2
         on conflict (playlist_id, track_id) do nothing`,
        [target.id, source.id]
      )
      return { success: true, addedCount: insertResult.rowCount || 0 }
    }

    if (action === 'remove_track') {
      const playlist = await getOwnedPlaylist(ownerUserId, String(body.playlistId || ''), station.id)
      if (!playlist) throw createError({ statusCode: 404, statusMessage: 'Playlist não encontrada' })
      await pgQuery(`delete from public.radio_playlist_items where playlist_id = $1 and track_id = $2`, [playlist.id, String(body.trackId || '')])
      return { success: true }
    }

    if (action === 'create_program') {
      const name = cleanText(body.name, 160)
      if (!name) throw createError({ statusCode: 400, statusMessage: 'Nome do programa é obrigatório' })
      const result = await pgQuery<any>(
        `insert into public.radio_programs (user_id, station_id, name, description, timezone, status, settings)
         values ($1,$2,$3,$4,$5,'draft',$6::jsonb)
         returning id, name, description, timezone, status, created_at, updated_at`,
        [ownerUserId, station.id, name, cleanText(body.description, 500) || null, validTimezone(body.timezone || station.timezone), jsonParam({})]
      )
      return { success: true, program: result.rows[0] }
    }

    if (action === 'update_program') {
      const programId = String(body.programId || '').trim()
      const program = await getOwnedProgram(ownerUserId, programId, station.id)
      if (!program) throw createError({ statusCode: 404, statusMessage: 'Programa não encontrado' })
      const name = cleanText(body.name, 160) || program.name
      const description = body.description !== undefined ? (cleanText(body.description, 500) || null) : program.description
      const timezone = body.timezone ? validTimezone(body.timezone) : program.timezone
      const status = ['draft', 'active', 'paused'].includes(String(body.status)) ? String(body.status) : program.status
      const result = await pgQuery<any>(
        `update public.radio_programs
         set name = $1, description = $2, timezone = $3, status = $4, updated_at = now()
         where id = $5 and user_id = $6 and station_id = $7
         returning id, name, description, timezone, status, created_at, updated_at`,
        [name, description, timezone, status, program.id, ownerUserId, station.id]
      )
      return { success: true, program: result.rows[0] }
    }

    if (action === 'delete_program') {
      const programId = String(body.programId || '').trim()
      const program = await getOwnedProgram(ownerUserId, programId, station.id)
      if (!program) throw createError({ statusCode: 404, statusMessage: 'Programa não encontrado' })
      await pgTx(async (client) => {
        await client.query(`delete from public.radio_schedules where program_id = $1 and station_id = $2`, [program.id, station.id])
        await client.query(`delete from public.radio_program_blocks where program_id = $1`, [program.id])
        await client.query(`delete from public.radio_programs where id = $1 and user_id = $2 and station_id = $3`, [program.id, ownerUserId, station.id])
      })
      return { success: true }
    }

    if (action === 'create_block') {
      const program = await getOwnedProgram(ownerUserId, String(body.programId || ''), station.id)
      if (!program) throw createError({ statusCode: 404, statusMessage: 'Programa não encontrado' })
      if (program.status === 'paused') throw createError({ statusCode: 409, statusMessage: 'Reative o programa antes de adicionar blocos.' })
      const blockType = String(body.blockType || 'playlist')
      if (!['music', 'playlist', 'audio_pack', 'jingle', 'commercial'].includes(blockType)) {
        throw createError({ statusCode: 400, statusMessage: 'Esse tipo de bloco ainda não pode ser reproduzido na programação.' })
      }
      let playlistId: string | null = null
      if (body.playlistId) {
        const playlist = await getOwnedPlaylist(ownerUserId, String(body.playlistId), station.id)
        if (!playlist) throw createError({ statusCode: 404, statusMessage: 'Playlist não encontrada' })
        playlistId = playlist.id
      }
      if (!playlistId && !['music', 'playlist'].includes(blockType)) {
        throw createError({ statusCode: 400, statusMessage: 'Escolha uma playlist para este bloco de áudio.' })
      }
      const settings = typeof body.settings === 'object' && body.settings !== null ? body.settings : {}
      const result = await pgQuery<any>(
        `insert into public.radio_program_blocks
          (program_id, block_type, label, playlist_id, duration_seconds, target_count, position, settings)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         returning id, block_type, label, playlist_id, duration_seconds, target_count, position, settings`,
        [
          program.id, blockType, cleanText(body.label, 160) || 'Bloco de música', playlistId,
          positiveInt(body.durationSeconds, 0, 24 * 60 * 60) || null,
          positiveInt(body.targetCount, 20, 500) || null,
          positiveInt(body.position, 0, 100_000), jsonParam(settings)
        ]
      )
      return { success: true, block: result.rows[0] }
    }

    if (action === 'update_block') {
      const blockId = String(body.blockId || '').trim()
      if (!isUuid(blockId)) throw createError({ statusCode: 400, statusMessage: 'Identificador do bloco inválido' })
      const blockRow = await pgQuery<any>(
        `select b.*, p.user_id, p.station_id from public.radio_program_blocks b
         join public.radio_programs p on p.id = b.program_id
         where b.id = $1 and p.user_id = $2 and p.station_id = $3`,
        [blockId, ownerUserId, station.id]
      )
      if (!blockRow.rows[0]) throw createError({ statusCode: 404, statusMessage: 'Bloco não encontrado' })
      const blockType = String(body.blockType || blockRow.rows[0].block_type)
      if (!['music', 'playlist', 'audio_pack', 'jingle', 'commercial'].includes(blockType)) {
        throw createError({ statusCode: 400, statusMessage: 'Esse tipo de bloco ainda não pode ser reproduzido na programação.' })
      }
      let playlistId: string | null = null
      if (body.playlistId) {
        const playlist = await getOwnedPlaylist(ownerUserId, String(body.playlistId), station.id)
        if (!playlist) throw createError({ statusCode: 404, statusMessage: 'Playlist não encontrada' })
        playlistId = playlist.id
      }
      if (!playlistId && !['music', 'playlist'].includes(blockType)) {
        throw createError({ statusCode: 400, statusMessage: 'Escolha uma playlist para este bloco de áudio.' })
      }
      const label = cleanText(body.label, 160) || blockRow.rows[0].label || 'Bloco de música'
      const targetCount = positiveInt(body.targetCount, blockRow.rows[0].target_count || 20, 500) || null
      const durationSeconds = positiveInt(body.durationSeconds, blockRow.rows[0].duration_seconds || 0, 24 * 60 * 60) || null
      const existingSettings = typeof blockRow.rows[0].settings === 'object' && blockRow.rows[0].settings !== null ? blockRow.rows[0].settings : {}
      const newSettings = typeof body.settings === 'object' && body.settings !== null ? { ...existingSettings, ...body.settings } : existingSettings

      const updated = await pgQuery<any>(
        `update public.radio_program_blocks
         set block_type = $1, label = $2, playlist_id = $3, duration_seconds = $4, target_count = $5, settings = $6::jsonb
         where id = $7
         returning id, program_id, block_type, label, playlist_id, duration_seconds, target_count, position, settings`,
        [blockType, label, playlistId, durationSeconds, targetCount, jsonParam(newSettings), blockId]
      )
      return { success: true, block: updated.rows[0] }
    }

    if (action === 'delete_block') {
      const blockId = String(body.blockId || '').trim()
      if (!isUuid(blockId)) throw createError({ statusCode: 400, statusMessage: 'Identificador do bloco inválido' })
      const blockRow = await pgQuery<any>(
        `select b.id from public.radio_program_blocks b
         join public.radio_programs p on p.id = b.program_id
         where b.id = $1 and p.user_id = $2 and p.station_id = $3`,
        [blockId, ownerUserId, station.id]
      )
      if (!blockRow.rows[0]) throw createError({ statusCode: 404, statusMessage: 'Bloco não encontrado' })
      await pgQuery(`delete from public.radio_program_blocks where id = $1`, [blockId])
      return { success: true }
    }

    if (action === 'create_schedule') {
      const program = await getOwnedProgram(ownerUserId, String(body.programId || ''), station.id)
      if (!program) throw createError({ statusCode: 404, statusMessage: 'Programa não encontrado' })
      if (program.status === 'paused') throw createError({ statusCode: 409, statusMessage: 'Reative o programa antes de publicar um horário.' })
      const startTime = validTime(body.startTime)
      const endTime = validTime(body.endTime)
      if (!startTime || !endTime) throw createError({ statusCode: 400, statusMessage: 'Informe horários válidos (HH:MM)' })
      const days = daysOfWeek(body.daysOfWeek)
      if (!days.length) throw createError({ statusCode: 400, statusMessage: 'Escolha ao menos um dia da semana.' })
      const startsOn = validDate(body.startsOn)
      const endsOn = validDate(body.endsOn)
      if (startsOn && endsOn && endsOn < startsOn) throw createError({ statusCode: 400, statusMessage: 'A data final deve ser posterior à inicial.' })
      const timezone = validTimezone(body.timezone || program.timezone)
      const playable = await pgQuery<any>(
        `select exists (
           select 1 from public.radio_program_blocks b
            where b.program_id = $1 and b.block_type in ('music','playlist','audio_pack','jingle','commercial')
              and (
                (b.playlist_id is null and b.block_type in ('music','playlist') and exists (
                   select 1 from public.radio_catalog_tracks t
                    where t.user_id = $2 and (t.station_id = $3 or t.station_id is null)
                      and t.status = 'ready' and t.storage_key is not null))
                or (b.playlist_id is not null and exists (
                   select 1 from public.radio_playlists p
                   join public.radio_playlist_items i on i.playlist_id = p.id
                   join public.radio_catalog_tracks t on t.id = i.track_id
                    where p.id = b.playlist_id and p.user_id = $2 and p.is_active
                      and (p.station_id = $3 or p.station_id is null)
                      and t.user_id = $2 and t.status = 'ready' and t.storage_key is not null))
              )
         ) as ready`,
        [program.id, ownerUserId, station.id]
      )
      if (!playable.rows[0]?.ready) throw createError({ statusCode: 409, statusMessage: 'Adicione ao programa um bloco com músicas prontas antes de publicar.' })
      const createdSchedule = await pgTx(async (client) => {
        const result = await client.query<any>(
        `insert into public.radio_schedules
          (user_id, station_id, program_id, days_of_week, start_time, end_time, timezone, priority, enabled, starts_on, ends_on, settings)
         values ($1,$2,$3,$4::smallint[],$5::time,$6::time,$7,$8,true,$9::date,$10::date,$11::jsonb)
         returning id, program_id, days_of_week, to_char(start_time, 'HH24:MI') as start_time,
                   to_char(end_time, 'HH24:MI') as end_time, timezone, priority, enabled, starts_on, ends_on,
                   created_at, updated_at`,
        [
          ownerUserId, station.id, program.id, days, startTime, endTime,
          timezone, positiveInt(body.priority, 100, 10_000),
          startsOn, endsOn, jsonParam({})
        ]
        )
        const createdSchedule = result.rows[0]
        await client.query(`update public.radio_programs set status = 'active' where id = $1 and user_id = $2`, [program.id, ownerUserId])
        await client.query(
          `insert into public.radio_schedule_jobs
            (user_id, station_id, schedule_id, due_at, kind, idempotency_key, payload)
           values ($1,$2,$3,now(),'schedule_tick',$4,$5::jsonb)
           on conflict (idempotency_key) do nothing`,
          [ownerUserId, station.id, createdSchedule.id, `${createdSchedule.id}:initial`, jsonParam({ source: 'schedule-created' })]
        )
        return createdSchedule
      })
      return { success: true, schedule: createdSchedule }
    }

    if (action === 'toggle_schedule') {
      if (!isUuid(body.scheduleId)) throw createError({ statusCode: 400, statusMessage: 'Agenda inválida' })
      const result = await pgQuery<any>(
        `update public.radio_schedules set enabled = $1 where id = $2 and user_id = $3 and station_id = $4 returning id, enabled`,
        [Boolean(body.enabled), body.scheduleId, ownerUserId, station.id]
      )
      if (!result.rows[0]) throw createError({ statusCode: 404, statusMessage: 'Agenda não encontrada' })
      return { success: true, schedule: result.rows[0] }
    }

    throw createError({ statusCode: 400, statusMessage: 'Ação de Rádio Indoor desconhecida' })
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Falha ao salvar configuração da Rádio Indoor' })
  }
})
