import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgOneOrNull } from '../../utils/postgres'
import { musicGptStatusForClient } from '../../utils/musicgpt'
import { getElevenLabsConfig } from '../../utils/elevenlabs'
import { getRadioStorageConfig, radioTableMissing } from '../../utils/radio-indoor'
import { getRadioStationScope } from '../../utils/radio-access'
import { getS3Client } from '../../utils/s3'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-health:${user.id}`, 60, 60_000)
  try {
    const scope = await getRadioStationScope(user.id, String(getQuery(event).stationId || '').trim() || null)
    const ownerUserId = scope?.ownerUserId || user.id
    const stationId = scope?.station?.id || null
    const row = await pgOneOrNull<any>(
      `select (select count(*)::int from public.radio_stations where user_id = $1) as stations,
              (select count(*)::int from public.radio_catalog_tracks where user_id = $1 and status = 'ready') as tracks,
              (select count(*)::int from public.radio_playlists where user_id = $1 and (station_id = $2 or station_id is null)) as playlists,
              (select count(*)::int from public.radio_schedules where user_id = $1 and station_id = $2 and enabled = true) as active_schedules,
              (select count(*)::int from public.radio_players where station_id = $2 and status = 'active') as active_players`,
      [ownerUserId, stationId]
    )
    let worker = {
      queueTable: 'radio_schedule_jobs',
      heartbeatTable: 'radio_worker_heartbeats',
      command: './workers/start-radio-worker.sh',
      running: false,
      liveWorkers: 0,
      lastSeenAt: null as string | null,
      heartbeatConfigured: false
    }
    try {
      const heartbeat = await pgOneOrNull<any>(
        `select count(*) filter (
                  where status = 'running' and last_seen_at > now() - interval '90 seconds'
                )::int as live_workers,
                max(last_seen_at)::text as last_seen_at
           from public.radio_worker_heartbeats`,
        []
      )
      const liveWorkers = Number(heartbeat?.live_workers || 0)
      worker = {
        ...worker,
        running: liveWorkers > 0,
        liveWorkers,
        lastSeenAt: heartbeat?.last_seen_at || null,
        heartbeatConfigured: true
      }
    } catch (heartbeatError: any) {
      if (!radioTableMissing(heartbeatError)) throw heartbeatError
    }
    const config = getRadioStorageConfig()
    let storageConfigured = false
    try { getS3Client(); storageConfigured = true } catch { /* credenciais ausentes */ }
    return {
      success: true,
      database: { ok: true, ...row },
      station: scope?.station ? { id: stationId, name: scope.station.name, status: scope.station.status } : null,
      storage: { configured: storageConfigured && Boolean(config.bucket && config.endpoint), prefix: 'radio-indoor/', access: 'private-proxy' },
      musicGpt: musicGptStatusForClient(),
      elevenLabs: { configured: Boolean(getElevenLabsConfig().apiKey) },
      worker,
      providerKeyPresent: Boolean(getElevenLabsConfig().apiKey)
    }
  } catch (error: any) {
    if (radioTableMissing(error)) return { success: true, database: { ok: false, setupRequired: true }, musicGpt: musicGptStatusForClient(), elevenLabs: { configured: Boolean(getElevenLabsConfig().apiKey) } }
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Falha ao verificar Rádio Indoor' })
  }
})
