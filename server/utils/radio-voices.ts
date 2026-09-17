import { cleanText, getRadioPresignedGetUrl, isRadioStorageKey, isUuid, jsonObject } from './radio-indoor'
import { pgOneOrNull, pgQuery } from './postgres'

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

export const radioVoiceSampleUrl = (voiceId: string): string =>
  `/api/radio-indoor/voices/sample?voiceId=${encodeURIComponent(voiceId)}`

export const serializeRadioVoice = (row: any) => ({
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
  metadata: jsonObject(row.metadata),
  sampleUrl: radioVoiceSampleUrl(String(row.id)),
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null
})

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
  return getRadioPresignedGetUrl(key, expiresIn)
}

export const cleanVoiceName = (value: unknown): string => cleanText(value, 120)
export const cleanVoiceDescription = (value: unknown): string | null => cleanText(value, 500) || null
