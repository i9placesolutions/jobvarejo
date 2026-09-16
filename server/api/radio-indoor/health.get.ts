import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgOneOrNull } from '../../utils/postgres'
import { getMusicGptConfig, musicGptStatusForClient } from '../../utils/musicgpt'
import { getRadioStorageConfig, radioTableMissing } from '../../utils/radio-indoor'
import { getRadioStationScope } from '../../utils/radio-access'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-health:${user.id}`, 60, 60_000)
  try {
    const scope = await getRadioStationScope(user.id, String(getQuery(event).stationId || '').trim() || null)
    const ownerUserId = scope?.ownerUserId || user.id
    const row = await pgOneOrNull<any>(
      `select (select count(*)::int from public.radio_stations where user_id = $1) as stations,
              (select count(*)::int from public.radio_catalog_tracks where user_id = $1 and status = 'ready') as tracks,
              (select count(*)::int from public.radio_playlists where user_id = $1) as playlists,
              (select count(*)::int from public.radio_schedules where user_id = $1 and enabled = true) as active_schedules`,
      [ownerUserId]
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
    const provider = getMusicGptConfig()
    return {
      success: true,
      database: { ok: true, ...row },
      storage: { configured: Boolean(config.bucket && config.endpoint), prefix: 'radio-indoor/', access: 'private-proxy' },
      musicGpt: musicGptStatusForClient(),
      worker,
      providerKeyPresent: provider.configured
    }
  } catch (error: any) {
    if (radioTableMissing(error)) return { success: true, database: { ok: false, setupRequired: true }, musicGpt: musicGptStatusForClient() }
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Falha ao verificar Rádio Indoor' })
  }
})
