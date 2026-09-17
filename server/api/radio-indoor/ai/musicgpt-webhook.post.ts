import { getMusicGptAudioUrl, getMusicGptConfig, ingestMusicGptAudio } from '../../../utils/musicgpt'
import { pgOneOrNull } from '../../../utils/postgres'
import { cleanText, jsonParam } from '../../../utils/radio-indoor'

/**
 * Callback do MusicGPT. O provedor não envia header de autenticação — o
 * segredo vai na query da webhook_url (`?secret=...`) configurada no envio.
 */
export default defineEventHandler(async (event) => {
  const config = getMusicGptConfig()
  if (!config.webhookSecret) throw createError({ statusCode: 503, statusMessage: 'Webhook do MusicGPT não configurado' })

  const query = getQuery(event)
  const provided = String(
    query.secret ||
    query.webhook_secret ||
    getHeader(event, 'x-musicgpt-webhook-secret') ||
    getHeader(event, 'x-webhook-secret') ||
    getHeader(event, 'authorization') ||
    ''
  ).replace(/^Bearer\s+/i, '').trim()
  if (!provided || provided !== config.webhookSecret) {
    throw createError({ statusCode: 401, statusMessage: 'Webhook não autorizado' })
  }

  const body = await readBody<Record<string, any>>(event)
  const payload = body?.data && typeof body.data === 'object' ? { ...body, ...body.data } : body || {}
  const taskId = cleanText(payload.task_id || payload.taskId || payload.conversion_id_1 || payload.id, 240)
  if (!taskId) throw createError({ statusCode: 400, statusMessage: 'Webhook sem task_id' })

  const audioUrl = getMusicGptAudioUrl(payload)
  const eventStatus = cleanText(payload.status || payload.state || payload.status_msg, 80).toLowerCase()
  const failedHint = ['failed', 'error'].includes(eventStatus) || /fail|error/.test(eventStatus)
  const completedHint = ['completed', 'complete', 'success', 'succeeded', 'ready'].includes(eventStatus)
  const status = audioUrl || completedHint ? 'ready' : failedHint ? 'failed' : 'processing'

  const request = await pgOneOrNull<any>(
    `select id, user_id, station_id, kind, title, provider_task_id, result_storage_key
       from public.radio_requests where provider = 'musicgpt' and provider_task_id = $1 limit 1`,
    [taskId]
  )
  if (!request) return { success: true, matched: false, request: null }

  let stored: { storageKey: string; format: string; bytes: number } | null = null
  let ingestError: string | null = null
  if (audioUrl && !request.result_storage_key) {
    try {
      stored = await ingestMusicGptAudio({
        userId: request.user_id,
        requestId: request.id,
        title: request.title,
        sourceUrl: audioUrl,
        stationId: request.station_id,
        kind: request.kind
      })
    } catch (error: any) {
      ingestError = String(error?.statusMessage || error?.message || 'Falha ao guardar áudio gerado').slice(0, 500)
    }
  }

  const failureMessage = cleanText(
    payload.error || payload.status_msg || payload.message || 'MusicGPT informou falha',
    500
  ) || null

  const row = await pgOneOrNull<any>(
    `update public.radio_requests
        set status = $1, result_source_url = coalesce($2, result_source_url),
            result_storage_key = coalesce($3, result_storage_key), result_format = coalesce($4, result_format),
            error = case when $1 = 'failed' then $5::text when $1 = 'processing' and $6::text is not null then $6::text else null end,
            metadata = metadata || $7::jsonb, updated_at = now()
      where id = $8
      returning id, status, provider_task_id, result_source_url, result_storage_key, result_format, error, updated_at`,
    [
      stored ? 'ready' : ingestError ? 'processing' : status,
      audioUrl,
      stored?.storageKey || null,
      stored?.format || cleanText(payload.format || payload.mime_type || '', 40) || null,
      failureMessage,
      ingestError,
      jsonParam({ lastWebhook: payload, ingest: stored ? { bytes: stored.bytes } : { error: ingestError } }),
      request.id
    ]
  )
  return { success: true, matched: true, stored: Boolean(stored), request: row || null }
})
