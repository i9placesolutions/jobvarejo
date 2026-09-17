import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getMusicGptAudioUrl, getMusicGptConversion, ingestMusicGptAudio } from '../../../utils/musicgpt'
import { pgOneOrNull } from '../../../utils/postgres'
import { cleanText, isUuid, jsonParam, parseRequestBody, radioTableErrorResponse } from '../../../utils/radio-indoor'
import { radioAccessAllows } from '../../../utils/radio-access'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-ai-refresh:${user.id}`, 120, 60_000)
  const body = await parseRequestBody(event)
  const requestId = String(body.requestId || '').trim()
  if (!isUuid(requestId)) throw createError({ statusCode: 400, statusMessage: 'Solicitação inválida' })
  try {
    const request = await pgOneOrNull<any>(
      `select r.id, r.user_id, r.station_id, r.kind, r.status, r.provider, r.provider_task_id,
              case when s.user_id = $2 then 'owner' else m.access_level end as access_level
         from public.radio_requests r
         left join public.radio_stations s on s.id = r.station_id
         left join public.radio_station_members m on m.station_id = r.station_id and m.user_id = $2 and m.status = 'active'
        where r.id = $1 and (r.user_id = $2 or m.id is not null) limit 1`,
      [requestId, user.id]
    )
    if (!request || request.provider !== 'musicgpt' || !request.provider_task_id) throw createError({ statusCode: 404, statusMessage: 'Solicitação sem tarefa MusicGPT' })
    if (!radioAccessAllows(request.access_level, 'operator')) throw createError({ statusCode: 403, statusMessage: 'Seu nível não permite atualizar esta solicitação' })
    const ownerUserId = String(request.user_id)
    const conversionType = request.kind === 'off' || request.kind === 'voice' ? 'TEXT_TO_SPEECH' : 'MUSIC_AI'
    const response = await getMusicGptConversion({ taskId: String(request.provider_task_id), conversionType })
    const conversion = response?.conversion && typeof response.conversion === 'object' ? response.conversion : response
    const providerStatus = cleanText(conversion?.status || conversion?.state, 40).toLowerCase()
    const audioUrl = getMusicGptAudioUrl(response)
    const status = audioUrl || ['completed', 'complete', 'success', 'succeeded', 'ready'].includes(providerStatus)
      ? 'ready' : ['failed', 'error'].includes(providerStatus) ? 'failed' : 'processing'
    let stored: { storageKey: string; format: string; bytes: number } | null = null
    let ingestError: string | null = null
    if (audioUrl) {
      try {
        const detail = await pgOneOrNull<any>(
          `select title, station_id, result_storage_key from public.radio_requests where id = $1 and user_id = $2 limit 1`,
          [requestId, ownerUserId]
        )
        if (detail && !detail.result_storage_key) {
          stored = await ingestMusicGptAudio({ userId: ownerUserId, requestId, title: String(detail.title || 'Áudio MusicGPT'), sourceUrl: audioUrl, stationId: detail.station_id, kind: request.kind })
        }
      } catch (error: any) {
        ingestError = String(error?.statusMessage || error?.message || 'Falha ao guardar áudio gerado').slice(0, 500)
      }
    }
    const updated = await pgOneOrNull<any>(
      `update public.radio_requests set status = $1, result_source_url = coalesce($2, result_source_url),
          result_storage_key = coalesce($3, result_storage_key), result_format = coalesce($4, result_format),
          error = case when $1 = 'failed' then $5::text when $1 = 'processing' and $6::text is not null then $6::text else null end,
          metadata = metadata || $7::jsonb, updated_at = now()
       where id = $8 and user_id = $9
       returning id, status, result_source_url, result_storage_key, result_format, error, metadata, updated_at`,
      [stored ? 'ready' : ingestError ? 'processing' : status, audioUrl, stored?.storageKey || null, stored?.format || cleanText(conversion?.format || conversion?.mime_type || '', 40) || null, cleanText(conversion?.status_msg || conversion?.message || '', 500) || null, ingestError, jsonParam({ lastPoll: response, ingest: stored ? { bytes: stored.bytes } : { error: ingestError } }), requestId, ownerUserId]
    )
    return { success: true, request: updated }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    if (error?.statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: error?.message || 'Falha ao atualizar solicitação' })
  }
})
