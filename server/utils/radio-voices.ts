import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getS3Client } from './s3'
import { cleanText, getRadioStorageConfig, isRadioStorageKey, isUuid, jsonObject, jsonParam } from './radio-indoor'
import { pgOneOrNull, pgQuery } from './postgres'
import { buildMusicGptVoiceClip } from './musicgpt-voice-clip'

export const RADIO_VOICE_CONSENT_VERSION = 'voice-cloning-consent-v1'
export const RADIO_VOICE_CONSENT_TEXT =
  'Confirmo que tenho autorização da pessoa representada na amostra para criar e usar uma voz clonada no JobVarejo.'
export const RADIO_VOICE_MAX_BYTES = 25 * 1024 * 1024

const allowedMimeTypes = new Map([
  ['audio/mpeg', 'mp3'],
  ['audio/mp3', 'mp3'],
  ['audio/wav', 'wav'],
  ['audio/x-wav', 'wav'],
  ['audio/wave', 'wav'],
  ['audio/webm', 'webm'],
  ['audio/ogg', 'ogg'],
  ['audio/opus', 'ogg'],
  ['audio/mp4', 'm4a'],
  ['audio/x-m4a', 'm4a'],
  ['audio/aac', 'aac'],
  ['audio/flac', 'flac']
])

export const normalizeVoiceGender = (value: unknown): 'female' | 'male' =>
  String(value || '').trim().toLowerCase() === 'male' ? 'male' : 'female'

export const voiceExtensionForMime = (mime: unknown, filename?: unknown): string => {
  const normalized = String(mime || '').split(';')[0]!.trim().toLowerCase()
  const known = allowedMimeTypes.get(normalized)
  if (known) return known
  const ext = String(filename || '').toLowerCase().split('.').pop()?.replace(/[^a-z0-9]/g, '')
  return ext && ['mp3', 'wav', 'webm', 'ogg', 'm4a', 'aac', 'flac'].includes(ext) ? ext : 'mp3'
}

export const isAllowedVoiceMime = (mime: unknown): boolean => {
  const normalized = String(mime || '').split(';')[0]!.trim().toLowerCase()
  return allowedMimeTypes.has(normalized)
}

export const radioVoiceStorageKey = (ownerUserId: string, voiceId: string, extension: string): string =>
  `radio-indoor/voices/${ownerUserId}/${voiceId}.${extension}`

/** Clip curto otimizado só para o MusicGPT (não substitui a amostra completa). */
export const radioVoiceCloneStorageKey = (ownerUserId: string, voiceId: string): string =>
  `radio-indoor/voices/${ownerUserId}/${voiceId}.clone.mp3`

export const radioVoiceSampleUrl = (voiceId: string): string =>
  `/api/radio-indoor/voices/sample?voiceId=${encodeURIComponent(voiceId)}`

export const serializeRadioVoice = (row: any) => {
  const metadata = jsonObject(row.metadata)
  return {
    id: String(row.id),
    stationId: row.station_id ? String(row.station_id) : null,
    name: String(row.name || 'Voz sem nome'),
    description: row.description || null,
    gender: normalizeVoiceGender(row.gender),
    sampleContentType: row.sample_content_type || 'audio/mpeg',
    sampleSizeBytes: Number(row.sample_size_bytes || 0),
    consentStatus: row.consent_status || 'confirmed',
    consentVersion: row.consent_version || RADIO_VOICE_CONSENT_VERSION,
    consentConfirmedAt: row.consent_confirmed_at || null,
    status: row.status || 'active',
    metadata,
    cloneReady: Boolean(metadata.elevenLabsVoiceId),
    cloneSampleBytes: Number(metadata.cloneSampleBytes || 0) || null,
    sampleUrl: radioVoiceSampleUrl(String(row.id)),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  }
}

/**
 * Gera/atualiza o clip de clonagem no Wasabi e grava a chave em metadata.
 * Preferir chamar no upload; voice-sample também regenera se faltar.
 */
export const ensureMusicGptCloneSample = async (input: {
  voiceId: string
  ownerUserId: string
  sampleStorageKey: string
  sourceBuffer?: Buffer | null
  force?: boolean
}): Promise<{ key: string; bytes: number; durationSec: number; regenerated: boolean }> => {
  if (!isUuid(input.voiceId) || !isUuid(input.ownerUserId)) {
    throw createError({ statusCode: 422, statusMessage: 'Identificadores de voz inválidos' })
  }
  const sampleKey = String(input.sampleStorageKey || '').trim()
  if (!isRadioStorageKey(sampleKey) || !sampleKey.startsWith('radio-indoor/voices/')) {
    throw createError({ statusCode: 422, statusMessage: 'Amostra da voz inválida' })
  }

  const row = await pgOneOrNull<any>(
    `select id, user_id, sample_storage_key, metadata
       from public.radio_voice_profiles
      where id = $1 and user_id = $2
      limit 1`,
    [input.voiceId, input.ownerUserId]
  )
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Voz não encontrada' })

  const { bucket } = getRadioStorageConfig()
  const meta = jsonObject(row.metadata)
  if (meta.cloneSampleMode === 'original') {
    if (sampleKey !== row.sample_storage_key || !sampleKey.toLowerCase().endsWith('.mp3')) {
      throw createError({ statusCode: 422, statusMessage: 'Amostra original de clonagem inválida' })
    }
    const head = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: sampleKey }))
    return {
      key: sampleKey,
      bytes: Number(head.ContentLength || 0),
      durationSec: Number(meta.cloneSampleDurationSec || 0),
      regenerated: false
    }
  }
  const existingKey = String(meta.cloneSampleKey || '').trim()
  if (!input.force && existingKey && isRadioStorageKey(existingKey)) {
    try {
      const head = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket, Key: existingKey }))
      return {
        key: existingKey,
        bytes: Number(head.ContentLength || meta.cloneSampleBytes || 0),
        durationSec: Number(meta.cloneSampleDurationSec || 0) || 18,
        regenerated: false
      }
    } catch {
      // regenera abaixo
    }
  }

  let source = input.sourceBuffer || null
  if (!source?.length) {
    const obj = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: sampleKey }))
    if (!obj.Body) throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada no Wasabi' })
    const chunks: Buffer[] = []
    for await (const chunk of obj.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    source = Buffer.concat(chunks)
  }

  const clip = await buildMusicGptVoiceClip(source)
  if (!clip) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Falha ao preparar clip de clonagem (ffmpeg). Confirme que o arquivo tem fala limpa.'
    })
  }

  const cloneKey = radioVoiceCloneStorageKey(input.ownerUserId, input.voiceId)
  await getS3Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: cloneKey,
    Body: clip.buffer,
    ContentType: 'audio/mpeg',
    Metadata: {
      source: 'jobvarejo-radio-voice-clone',
      voiceId: input.voiceId,
      durationSec: String(clip.durationSec)
    }
  }))

  await pgQuery(
    `update public.radio_voice_profiles
        set metadata = coalesce(metadata, '{}'::jsonb) || $1::jsonb,
            updated_at = now()
      where id = $2 and user_id = $3`,
    [
      jsonParam({
        cloneSampleKey: cloneKey,
        cloneSampleBytes: clip.buffer.length,
        cloneSampleDurationSec: clip.durationSec,
        cloneSampleStartSec: clip.startSec,
        cloneIsolateMode: clip.mode,
        clonePreparedAt: new Date().toISOString()
      }),
      input.voiceId,
      input.ownerUserId
    ]
  )

  return {
    key: cloneKey,
    bytes: clip.buffer.length,
    durationSec: clip.durationSec,
    regenerated: true
  }
}

export const listAccessibleRadioVoices = async (ownerUserId: string, stationId: string) => {
  const result = await pgQuery<any>(
    `select id, user_id, station_id, name, description, gender,
            sample_content_type, sample_size_bytes, consent_status,
            consent_version, consent_confirmed_at, status, metadata,
            created_at, updated_at
       from public.radio_voice_profiles
      where user_id = $1
        and status = 'active'
        and consent_status = 'confirmed'
        and (station_id is null or station_id = $2)
      order by lower(name), created_at desc, id`,
    [ownerUserId, stationId]
  )
  return result.rows
}

/** Vozes gerenciadas pelo administrador atual, incluindo as revogadas para
 * que o painel consiga mostrar o estado do banco sem expor a chave do Wasabi. */
export const listOwnedRadioVoices = async (ownerUserId: string) => {
  const result = await pgQuery<any>(
    `select id, user_id, station_id, name, description, gender,
            sample_content_type, sample_size_bytes, consent_status,
            consent_version, consent_confirmed_at, status, metadata,
            created_at, updated_at
       from public.radio_voice_profiles
      where user_id = $1
      order by (status = 'active') desc, lower(name), created_at desc, id`,
    [ownerUserId]
  )
  return result.rows
}

export const getOwnedRadioVoice = async (ownerUserId: string, voiceId: string) => {
  if (!isUuid(voiceId)) return null
  return pgOneOrNull<any>(
    `select id, user_id, station_id, name, description, gender,
            sample_storage_key, sample_content_type, sample_size_bytes,
            consent_status, consent_version, consent_confirmed_at,
            status, metadata, created_at, updated_at
       from public.radio_voice_profiles
      where id = $1 and user_id = $2
      limit 1`,
    [voiceId, ownerUserId]
  )
}

export const getAccessibleRadioVoice = async (
  ownerUserId: string,
  voiceId: string,
  stationId: string
) => {
  if (!isUuid(voiceId)) return null
  return pgOneOrNull<any>(
    `select id, user_id, station_id, name, description, gender,
            sample_storage_key, sample_content_type, sample_size_bytes,
            consent_status, consent_version, consent_confirmed_at,
            status, metadata, created_at, updated_at
       from public.radio_voice_profiles
      where id = $1
        and user_id = $2
        and status = 'active'
        and consent_status = 'confirmed'
        and (station_id is null or station_id = $3)
      limit 1`,
    [voiceId, ownerUserId, stationId]
  )
}

export const getRadioVoiceByIdForActor = async (actorUserId: string, voiceId: string) => {
  if (!isUuid(voiceId)) return null
  return pgOneOrNull<any>(
    `select v.id, v.user_id, v.station_id, v.name, v.description, v.gender,
            v.sample_storage_key, v.sample_content_type, v.sample_size_bytes,
            v.consent_status, v.consent_version, v.consent_confirmed_at,
            v.status, v.metadata, v.created_at, v.updated_at
       from public.radio_voice_profiles v
      where v.id = $1
        and v.status = 'active'
        and v.consent_status = 'confirmed'
        and (
          v.user_id = $2
          or exists (
            select 1
              from public.radio_station_members m
              join public.radio_stations s on s.id = m.station_id
             where m.user_id = $2
               and m.status = 'active'
               and s.user_id = v.user_id
               and (v.station_id is null or v.station_id = s.id)
          )
        )
      limit 1`,
    [voiceId, actorUserId]
  )
}

export const getRadioVoiceSampleUrl = async (voice: any, expiresIn = 900): Promise<string> => {
  const key = String(voice?.sample_storage_key || '').trim()
  if (!isRadioStorageKey(key) || !key.startsWith('radio-indoor/voices/')) {
    throw createError({ statusCode: 422, statusMessage: 'Amostra da voz inválida' })
  }
  const extension = key.split('.').pop()?.toLowerCase() || 'mp3'
  const safeExt = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'].includes(extension) ? extension : 'mp3'
  const mime = String(voice?.sample_content_type || '').split(';')[0]?.trim() || 'audio/mpeg'
  const { bucket } = getRadioStorageConfig()
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: mime,
      ResponseContentDisposition: `inline; filename="voice-sample.${safeExt}"`
    }),
    { expiresIn }
  )
}

const getVoiceSampleSigningSecret = (): string => {
  const config = useRuntimeConfig() as any
  const secret = String(
    config.musicgptWebhookSecret ||
    process.env.MUSICGPT_WEBHOOK_SECRET ||
    config.authJwtSecret ||
    process.env.AUTH_JWT_SECRET ||
    ''
  ).trim()
  if (!secret) throw createError({ statusCode: 500, statusMessage: 'Segredo para amostra MusicGPT ausente' })
  return secret
}

const encodeBase64Url = (value: string | Buffer): string =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const decodeBase64Url = (value: string): Buffer => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (normalized.length % 4)) % 4
  return Buffer.from(`${normalized}${'='.repeat(padLength)}`, 'base64')
}

const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Token curto para o MusicGPT baixar a amostra sem cookie de sessão. */
export const createMusicGptVoiceSampleToken = (input: {
  voiceId: string
  ownerUserId: string
  expiresInSeconds?: number
}): string => {
  if (!isUuid(input.voiceId) || !isUuid(input.ownerUserId)) {
    throw createError({ statusCode: 422, statusMessage: 'Identificadores de voz inválidos' })
  }
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(input.expiresInSeconds || 900, 1800))
  const payload = encodeBase64Url(JSON.stringify({ v: input.voiceId, o: input.ownerUserId, exp }))
  const signature = createHmac('sha256', getVoiceSampleSigningSecret()).update(`mgpt-voice:${payload}`).digest('base64url')
  return `${payload}.${signature}`
}

export const verifyMusicGptVoiceSampleToken = (token: string): { voiceId: string; ownerUserId: string } | null => {
  const raw = String(token || '').trim()
  const parts = raw.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [payloadPart, signature] = parts
  const expected = createHmac('sha256', getVoiceSampleSigningSecret()).update(`mgpt-voice:${payloadPart}`).digest('base64url')
  if (!safeEqual(signature, expected)) return null
  try {
    const parsed = JSON.parse(decodeBase64Url(payloadPart).toString('utf8')) as { v?: string; o?: string; exp?: number }
    if (!isUuid(parsed.v) || !isUuid(parsed.o)) return null
    if (!Number.isFinite(parsed.exp) || Number(parsed.exp) < Math.floor(Date.now() / 1000)) return null
    return { voiceId: String(parsed.v), ownerUserId: String(parsed.o) }
  } catch {
    return null
  }
}

const isLoopbackOrigin = (origin: string): boolean => {
  try {
    const host = new URL(origin).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')
  } catch {
    return true
  }
}

/** Origem pública que o MusicGPT consegue chamar (preferir APP_BASE_URL / webhook). */
export const resolveMusicGptPublicOrigin = (event?: H3Event): string | null => {
  const config = useRuntimeConfig() as any
  const webhook = String(config.musicgptWebhookUrl || process.env.MUSICGPT_WEBHOOK_URL || '').trim()
  if (webhook) {
    try {
      const origin = new URL(webhook).origin
      if (!isLoopbackOrigin(origin)) return origin
    } catch { /* ignore */ }
  }
  for (const candidate of [config.appBaseUrl, process.env.APP_BASE_URL, process.env.NUXT_PUBLIC_SITE_URL]) {
    const value = String(candidate || '').trim()
    if (!value) continue
    try {
      const origin = new URL(value).origin
      if (!isLoopbackOrigin(origin)) return origin
    } catch { /* ignore */ }
  }
  if (event) {
    try {
      const origin = getRequestURL(event).origin
      if (!isLoopbackOrigin(origin)) return origin
    } catch { /* ignore */ }
  }
  return null
}

/**
 * Prefere URL do JobVarejo (proxy autenticado por token) em vez da URL
 * assinada do Wasabi — o MusicGPT falhava ao baixar/converter a amostra S3.
 */
export const getMusicGptVoiceSampleUrl = async (
  event: H3Event,
  voice: any,
  ownerUserId: string,
  expiresIn = 900
): Promise<{ url: string; mode: 'app-proxy' | 'wasabi-presigned' }> => {
  const origin = resolveMusicGptPublicOrigin(event)
  if (origin) {
    const token = createMusicGptVoiceSampleToken({
      voiceId: String(voice.id),
      ownerUserId,
      expiresInSeconds: expiresIn
    })
    return {
      url: `${origin}/api/radio-indoor/ai/voice-sample?token=${encodeURIComponent(token)}`,
      mode: 'app-proxy'
    }
  }
  return { url: await getRadioVoiceSampleUrl(voice, expiresIn), mode: 'wasabi-presigned' }
}

export const cleanVoiceName = (value: unknown): string => cleanText(value, 120)
export const cleanVoiceDescription = (value: unknown): string | null => cleanText(value, 500) || null
