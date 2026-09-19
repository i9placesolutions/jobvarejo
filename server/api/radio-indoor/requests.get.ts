import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgQuery } from '../../utils/postgres'
import { positiveInt, radioKeyUrl, radioTableErrorResponse } from '../../utils/radio-indoor'
import { requireRadioStationAccess } from '../../utils/radio-access'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-requests:${user.id}`, 180, 60_000)
  const query = getQuery(event)
  const limit = positiveInt(query.limit, 30, 100)
  try {
    const stationId = String(query.stationId || '').trim() || null
    const scope = await requireRadioStationAccess(user.id, stationId, 'player')
    const station = scope.station
    const result = await pgQuery<any>(
      `select r.id, r.station_id, r.kind, r.title, r.brief, r.lyrics, r.style, r.voice_id, r.voice_profile_id, r.status, r.provider,
              provider_task_id, provider_conversion_id, result_storage_key, result_source_url,
              result_format, result_duration_ms, r.error, r.metadata, r.created_at, r.updated_at,
              t.id as catalog_track_id
         from public.radio_requests r
         left join public.radio_catalog_tracks t
           on t.user_id = r.user_id and t.source_provider = 'musicgpt'
          and t.source_id = r.id::text and t.status = 'ready'
        where r.user_id = $1 and (r.station_id = $2 or r.station_id is null)
        order by r.created_at desc limit $3`,
      [scope.ownerUserId, station.id, limit]
    )
    return {
      success: true,
      items: result.rows.map((row) => ({
        id: row.id,
        stationId: row.station_id,
        kind: row.kind,
        title: row.title,
        brief: row.brief,
        lyrics: row.lyrics,
        style: row.style,
        voiceId: row.voice_id,
        voiceProfileId: row.voice_profile_id,
        status: row.status,
        provider: row.provider,
        providerTaskId: row.provider_task_id,
        providerConversionId: row.provider_conversion_id,
        resultStorageKey: row.result_storage_key,
        resultSourceUrl: row.result_source_url,
        resultFormat: row.result_format,
        resultDurationMs: row.result_duration_ms,
        catalogTrackId: row.catalog_track_id ? String(row.catalog_track_id) : null,
        audioUrl: row.catalog_track_id ? radioKeyUrl('audio', String(row.catalog_track_id)) : null,
        downloadUrl: row.catalog_track_id ? `${radioKeyUrl('audio', String(row.catalog_track_id))}&download=1` : null,
        error: row.error,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return { ...setup, items: [] }
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Falha ao carregar solicitações' })
  }
})
