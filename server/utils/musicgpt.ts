import type { H3Event } from 'h3'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getS3Client } from './s3'
import { getRadioStorageConfig, isRadioStorageKey } from './radio-indoor'
import { pgTx } from './postgres'
import { withRetailMusicDirection } from '../../shared/musicgpt-retail.mjs'

export interface MusicGptSubmission {
  prompt: string
  musicStyle?: string | null
  lyrics?: string | null
  makeInstrumental?: boolean
  vocalOnly?: boolean
  voiceId?: string | null
}

export interface MusicGptResult {
  taskId: string | null
  conversionId: string | null
  raw: Record<string, any>
}

/**
 * O MusicGPT só recebe `webhook_url` no body — ele não envia header de
 * autenticação no callback. Por isso embutimos o segredo na query da URL
 * (`?secret=...`) e o endpoint valida esse valor ao receber o POST.
 */
export const buildMusicGptWebhookUrl = (baseUrl: string, secret: string): string | null => {
  const trimmed = String(baseUrl || '').trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (secret && !url.searchParams.get('secret') && !url.searchParams.get('webhook_secret')) {
      url.searchParams.set('secret', secret)
    }
    return url.toString()
  } catch {
    return null
  }
}

export const getMusicGptConfig = () => {
  const config = useRuntimeConfig() as any
  const apiKey = String(config.musicgptApiKey || process.env.MUSICGPT_API_KEY || process.env.NUXT_MUSICGPT_API_KEY || '').trim()
  const apiUrl = String(
    config.musicgptApiUrl ||
    process.env.MUSICGPT_API_URL ||
    process.env.NUXT_MUSICGPT_API_URL ||
    'https://api.musicgpt.com/api/public/v1/MusicAI'
  ).trim()
  const webhookSecret = String(config.musicgptWebhookSecret || process.env.MUSICGPT_WEBHOOK_SECRET || process.env.NUXT_MUSICGPT_WEBHOOK_SECRET || '').trim()
  const configuredWebhook = String(config.musicgptWebhookUrl || process.env.MUSICGPT_WEBHOOK_URL || process.env.NUXT_MUSICGPT_WEBHOOK_URL || '').trim()
  const appBase = String(config.appBaseUrl || process.env.APP_BASE_URL || '').trim().replace(/\/$/, '')
  const derivedWebhook = !configuredWebhook && appBase
    ? `${appBase}/api/radio-indoor/ai/musicgpt-webhook`
    : configuredWebhook
  const webhookUrl = buildMusicGptWebhookUrl(derivedWebhook, webhookSecret) || ''
  const ttsUrl = String(
    config.musicgptTtsUrl ||
    process.env.MUSICGPT_TTS_URL ||
    process.env.NUXT_MUSICGPT_TTS_URL ||
    'https://api.musicgpt.com/api/public/v1/TextToSpeech'
  ).trim()
  const defaultVoiceId = String(config.musicgptDefaultVoiceId || process.env.MUSICGPT_DEFAULT_VOICE_ID || process.env.NUXT_MUSICGPT_DEFAULT_VOICE_ID || '').trim()
  const defaultVoiceGender = String(config.musicgptDefaultVoiceGender || process.env.MUSICGPT_DEFAULT_VOICE_GENDER || process.env.NUXT_MUSICGPT_DEFAULT_VOICE_GENDER || 'female').trim().toLowerCase()
  return {
    configured: Boolean(apiKey),
    apiKey,
    apiUrl,
    webhookUrl,
    webhookSecret,
    webhookConfigured: Boolean(webhookUrl && webhookSecret),
    ttsUrl,
    defaultVoiceId,
    defaultVoiceGender
  }
}

const getFirstString = (value: any, keys: string[]): string | null => {
  for (const key of keys) {
    const current = value?.[key]
    if (current == null) continue
    const normalized = String(current).trim()
    if (normalized) return normalized
  }
  return null
}

/**
 * O MusicGPT usa nomes diferentes para o resultado dependendo do recurso.
 * MUSIC_AI normalmente retorna conversion_path_1/2; TTS pode retornar
 * audio_url ou result_url. Centralizamos a normalização para que polling e
 * webhook tenham exatamente o mesmo comportamento.
 */
export const getMusicGptAudioUrl = (payload: any): string | null => {
  const conversion = payload?.conversion && typeof payload.conversion === 'object' ? payload.conversion : payload
  const candidates = [
    conversion?.audio_url,
    conversion?.audioUrl,
    conversion?.result_url,
    conversion?.resultUrl,
    conversion?.output?.url,
    conversion?.conversion_path_1,
    conversion?.conversion_path_2,
    conversion?.conversion_path,
    conversion?.conversion_path_wav_1,
    conversion?.conversion_path_wav_2,
    conversion?.conversion_path_wav,
    payload?.audio_url,
    payload?.conversion_path_1,
    payload?.conversion_path
  ]
  return candidates.find((value) => typeof value === 'string' && /^https:\/\//i.test(value))?.slice(0, 2048) || null
}

export const submitMusicGptMusicAi = async (
  event: H3Event,
  input: MusicGptSubmission
): Promise<MusicGptResult> => {
  const config = getMusicGptConfig()
  if (!config.configured) {
    throw createError({ statusCode: 503, statusMessage: 'MusicGPT não está configurado no servidor' })
  }

  let response: any
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      response = await $fetch<any>(config.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: config.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: {
          prompt: withRetailMusicDirection(input.prompt),
          ...(input.musicStyle ? { music_style: input.musicStyle } : {}),
          ...(input.lyrics ? { lyrics: input.lyrics } : {}),
          make_instrumental: input.makeInstrumental === true,
          vocal_only: input.vocalOnly === true,
          ...(input.voiceId ? { voice_id: input.voiceId } : {}),
          ...(config.webhookUrl ? { webhook_url: config.webhookUrl } : {})
        },
        signal: controller.signal
      } as any)
    } finally {
      clearTimeout(timeout)
    }
  } catch (error: any) {
    const status = Number(error?.statusCode || error?.response?.status || 502)
    const statusMessage = String(error?.data?.message || error?.statusMessage || error?.message || 'Falha ao solicitar áudio ao MusicGPT')
    throw createError({ statusCode: status >= 400 && status < 600 ? status : 502, statusMessage: statusMessage.slice(0, 300) })
  }

  const payload = response && typeof response === 'object' ? response : {}
  const taskId = getFirstString(payload, ['task_id', 'taskId', 'id', 'conversion_id_1'])
  const conversionId = getFirstString(payload, ['conversion_id_1', 'conversionId', 'conversion_id'])
  return { taskId, conversionId, raw: payload }
}

export const submitMusicGptTextToSpeech = async (
  input: { text: string; voiceId?: string | null; sampleAudioUrl?: string | null; gender: string }
): Promise<MusicGptResult> => {
  const config = getMusicGptConfig()
  if (!config.configured) throw createError({ statusCode: 503, statusMessage: 'MusicGPT não está configurado no servidor' })
  if (!input.voiceId && !input.sampleAudioUrl) {
    throw createError({ statusCode: 422, statusMessage: 'Informe uma voz do MusicGPT ou uma amostra de voz' })
  }
  let response: any
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      response = await $fetch<any>(config.ttsUrl, {
        method: 'POST',
        headers: { Authorization: config.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: {
          text: input.text,
          ...(input.voiceId ? { voice_id: input.voiceId } : {}),
          ...(input.sampleAudioUrl ? { sample_audio_url: input.sampleAudioUrl } : {}),
          gender: input.gender,
          ...(config.webhookUrl ? { webhook_url: config.webhookUrl } : {})
        },
        signal: controller.signal
      } as any)
    } finally {
      clearTimeout(timeout)
    }
  } catch (error: any) {
    const status = Number(error?.statusCode || error?.response?.status || 502)
    const statusMessage = String(error?.data?.message || error?.statusMessage || error?.message || 'Falha ao solicitar locução ao MusicGPT')
    throw createError({ statusCode: status >= 400 && status < 600 ? status : 502, statusMessage: statusMessage.slice(0, 300) })
  }
  const payload = response && typeof response === 'object' ? response : {}
  const taskId = getFirstString(payload, ['task_id', 'taskId', 'id'])
  const conversionId = getFirstString(payload, ['conversion_id', 'conversion_id_1', 'conversionId'])
  return { taskId, conversionId, raw: payload }
}

export const getMusicGptConversion = async (input: { taskId: string; conversionType: string }) => {
  const config = getMusicGptConfig()
  if (!config.configured) throw createError({ statusCode: 503, statusMessage: 'MusicGPT não está configurado no servidor' })
  const base = new URL(config.apiUrl)
  base.pathname = base.pathname.replace(/\/[^/]+$/, '/byId')
  base.search = ''
  base.searchParams.set('conversionType', input.conversionType)
  base.searchParams.set('task_id', input.taskId)
  try {
    return await $fetch<any>(base.toString(), {
      method: 'GET',
      headers: { Authorization: config.apiKey, Accept: 'application/json' },
      timeout: 20_000
    } as any)
  } catch (error: any) {
    const status = Number(error?.statusCode || error?.response?.status || 502)
    throw createError({ statusCode: status >= 400 && status < 600 ? status : 502, statusMessage: String(error?.data?.message || error?.message || 'Falha ao consultar MusicGPT').slice(0, 300) })
  }
}

export const musicGptStatusForClient = () => {
  const config = getMusicGptConfig()
  return {
    configured: config.configured,
    apiUrl: config.apiUrl,
    webhookConfigured: config.webhookConfigured,
    ttsConfigured: config.configured && Boolean(config.ttsUrl)
  }
}

const allowedResultHost = (host: string): boolean => {
  const normalized = host.toLowerCase().replace(/\.$/, '')
  return normalized === 'musicgpt.s3.amazonaws.com' ||
    normalized.endsWith('.musicgpt.s3.amazonaws.com') ||
    /^cdn\d+\.musicgpt\.com$/.test(normalized) ||
    normalized === 'lalals.s3.amazonaws.com' ||
    normalized.endsWith('.lalals.s3.amazonaws.com') ||
    normalized.endsWith('.s3.amazonaws.com')
}

const resultContentType = (value: string | null, url: string): { mime: string; extension: string } => {
  const mime = (String(value || '').split(';')[0] || '').trim().toLowerCase()
  if (mime === 'audio/webm') return { mime, extension: 'webm' }
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return { mime: 'audio/wav', extension: 'wav' }
  if (mime === 'audio/ogg' || mime === 'audio/opus') return { mime: 'audio/ogg', extension: 'ogg' }
  if (mime === 'audio/aac') return { mime, extension: 'aac' }
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return { mime: 'audio/mpeg', extension: 'mp3' }
  const urlExt = new URL(url).pathname.split('.').pop()?.toLowerCase()
  if (urlExt === 'webm' || urlExt === 'wav' || urlExt === 'ogg' || urlExt === 'aac' || urlExt === 'mp3') {
    const fallbackMime = urlExt === 'mp3' ? 'audio/mpeg' : `audio/${urlExt}`
    return { mime: fallbackMime, extension: urlExt }
  }
  return { mime: 'audio/mpeg', extension: 'mp3' }
}

/** Baixa o resultado assinado do MusicGPT e o guarda no prefixo privado da rádio. */
export const ingestMusicGptAudio = async (input: {
  userId: string
  requestId: string
  title: string
  sourceUrl: string
  stationId?: string | null
  kind?: string | null
}) => {
  let parsed: URL
  try { parsed = new URL(input.sourceUrl) } catch { throw createError({ statusCode: 422, statusMessage: 'URL de áudio do MusicGPT inválida' }) }
  if (parsed.protocol !== 'https:' || !allowedResultHost(parsed.hostname)) {
    throw createError({ statusCode: 422, statusMessage: 'URL de resultado do MusicGPT não autorizada' })
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)
  let response: Response
  try { response = await fetch(parsed, { signal: controller.signal }) } finally { clearTimeout(timeout) }
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: `MusicGPT não entregou o áudio (${response.status})` })
  const declaredLength = Number(response.headers.get('content-length') || 0)
  if (declaredLength > 100 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Áudio gerado maior que o limite de 100 MB' })
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length || bytes.length > 100 * 1024 * 1024) throw createError({ statusCode: 422, statusMessage: 'Áudio gerado vazio ou maior que o limite de 100 MB' })
  const format = resultContentType(response.headers.get('content-type'), parsed.toString())
  const key = `radio-indoor/generated/${input.userId}/${input.requestId}.${format.extension}`
  if (!isRadioStorageKey(key)) throw createError({ statusCode: 500, statusMessage: 'Chave de áudio gerado inválida' })
  const { bucket } = getRadioStorageConfig()
  await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: format.mime, Metadata: { source: 'musicgpt', requestId: input.requestId } }))

  await pgTx(async (client) => {
    await client.query(
      `update public.radio_requests set result_storage_key = $1, result_format = $2, result_source_url = $3,
          status = 'ready', updated_at = now() where id = $4 and user_id = $5`,
      [key, format.extension, input.sourceUrl.slice(0, 2048), input.requestId, input.userId]
    )
    await client.query(
      `insert into public.radio_catalog_tracks
        (user_id, station_id, title, artist, album, genre, language, duration_ms, source_url,
         source_provider, source_id, storage_key, audio_format, audio_codec, rights_status, status, metadata)
       values ($1,$2,$3,'MusicGPT','Solicitações da Rádio Indoor','AI','pt-BR',null,$4,
               'musicgpt',$5,$6,$7,null,'provider-generated','ready',$8::jsonb)
       on conflict (user_id, source_provider, source_id) do update set
         station_id=excluded.station_id, title=excluded.title, storage_key=excluded.storage_key,
         audio_format=excluded.audio_format, rights_status=excluded.rights_status, status='ready', metadata=excluded.metadata, updated_at=now()`,
      [input.userId, input.stationId || null, input.title.slice(0, 240), input.sourceUrl.slice(0, 2048), input.requestId, key, format.extension, JSON.stringify({ kind: input.kind || 'audio', generatedBy: 'musicgpt' })]
    )
  })
  return { storageKey: key, format: format.extension, bytes: bytes.length }
}
