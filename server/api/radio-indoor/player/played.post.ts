import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'
import { isUuid, positiveInt, parseRequestBody, radioTableErrorResponse } from '../../../utils/radio-indoor'
import { getAccessibleTrack, requireRadioStationAccess } from '../../../utils/radio-access'
import { getRadioPlayerIdentity } from '../../../utils/radio-player-auth'

export default defineEventHandler(async (event) => {
  const playerIdentity = await getRadioPlayerIdentity(event)
  const user = playerIdentity ? { id: playerIdentity.userId } : await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-played:${user.id}`, 600, 60_000)
  const body = await parseRequestBody(event)
  const trackId = String(body.trackId || '').trim()
  const requestedStationId = playerIdentity?.stationId || (isUuid(body.stationId) ? String(body.stationId) : null)
  const scope = await requireRadioStationAccess(user.id, requestedStationId, 'player')
  const station = scope.station
  const track = await getAccessibleTrack(user.id, trackId, station.id)
  if (!track) throw createError({ statusCode: 404, statusMessage: 'Faixa não encontrada' })
  const stationId = station.id
  const playlistId = isUuid(body.playlistId) ? String(body.playlistId) : null
  const programId = isUuid(body.programId) ? String(body.programId) : null
  try {
    await pgQuery(
      `insert into public.radio_playback_events
        (user_id, station_id, track_id, playlist_id, program_id, duration_ms, source, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        scope.ownerUserId,
        stationId,
        track.id,
        playlistId,
        programId,
        positiveInt(body.durationMs, 0, 24 * 60 * 60 * 1000) || null,
        String(body.source || 'internal-player').slice(0, 80),
        JSON.stringify({ completed: Boolean(body.completed), clientAt: body.clientAt || null })
      ]
    )
    return { success: true }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    throw createError({ statusCode: 500, statusMessage: 'Falha ao registrar reprodução' })
  }
})
