import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getS3Client } from '../../../utils/s3'
import {
  cleanVoiceDescription,
  cleanVoiceName,
  ensureMusicGptCloneSample,
  isAllowedVoiceMime,
  RADIO_VOICE_CONSENT_TEXT,
  RADIO_VOICE_CONSENT_VERSION,
  RADIO_VOICE_MAX_BYTES,
  radioVoiceStorageKey,
  serializeRadioVoice,
  voiceExtensionForMime,
  normalizeVoiceGender
} from '../../../utils/radio-voices'
import { getRadioStorageConfig, jsonParam, radioTableErrorResponse } from '../../../utils/radio-indoor'
import { requireRadioStationAccess } from '../../../utils/radio-access'
import { pgOneOrNull } from '../../../utils/postgres'

const asBoolean = (value: unknown): boolean => ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())

export default defineEventHandler(async (event) => {
  // A voz clonada é um recurso controlado pelo administrador do JobVarejo.
  // Usuários de loja só recebem a lista de vozes liberadas e podem selecioná-la
  // ao solicitar uma locução.
  const { user: actor } = await requireAdminUser(event)
  await enforceRateLimit(event, `radio-voices-write:${actor.id}`, 20, 60_000)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) throw createError({ statusCode: 400, statusMessage: 'Envie um arquivo de áudio para criar a voz' })
  const file = parts.find((part) => part.name === 'file' && part.filename && part.data)
  const fileData = file?.data
  if (!fileData?.length) throw createError({ statusCode: 400, statusMessage: 'Arquivo de áudio obrigatório' })

  const fields: Record<string, string> = {}
  for (const part of parts) {
    const name = String(part.name || '')
    if (name && !part.filename && part.data) fields[name] = Buffer.from(part.data).toString('utf8')
  }

  const name = cleanVoiceName(fields.name)
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Informe um nome para a voz' })
  if (!asBoolean(fields.consentConfirmed)) {
    throw createError({ statusCode: 400, statusMessage: 'Confirme a autorização para clonar esta voz' })
  }

  const buffer = Buffer.from(fileData)
  if (buffer.length > RADIO_VOICE_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Amostra muito grande. Envie um arquivo de até 25 MB' })
  }
  const mime = String(file?.type || '').split(';')[0] || ''
  const normalizedMime = mime.trim().toLowerCase()
  if (!isAllowedVoiceMime(normalizedMime)) {
    throw createError({ statusCode: 400, statusMessage: 'Formato inválido. Use MP3, WAV, M4A, OGG, WEBM, AAC ou FLAC' })
  }

  try {
    const shareAllStations = asBoolean(fields.shareAllStations)
    const stationId = String(fields.stationId || '').trim() || null
    let scopedStationId: string | null = null
    if (stationId && !shareAllStations) {
      const scope = await requireRadioStationAccess(actor.id, stationId, 'owner', { createIfMissing: false })
      scopedStationId = String(scope.station.id)
    }
    const voiceId = randomUUID()
    const extension = voiceExtensionForMime(normalizedMime, file?.filename)
    const key = radioVoiceStorageKey(actor.id, voiceId, extension)
    const { bucket } = getRadioStorageConfig()

    await getS3Client().send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: normalizedMime,
      Metadata: {
        source: 'jobvarejo-radio-voice',
        voiceId,
        consentVersion: RADIO_VOICE_CONSENT_VERSION
      }
    }))

    try {
      const row = await pgOneOrNull<any>(
        `insert into public.radio_voice_profiles
          (id, user_id, station_id, name, description, gender, sample_storage_key,
           sample_content_type, sample_size_bytes, consent_status, consent_version,
           consent_confirmed_at, status, created_by, metadata)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed',$10,now(),'active',$11,$12::jsonb)
         returning id, user_id, station_id, name, description, gender,
                   sample_content_type, sample_size_bytes, consent_status,
                   consent_version, consent_confirmed_at, status, metadata,
                   created_at, updated_at`,
        [
          voiceId,
          actor.id,
          shareAllStations ? null : scopedStationId,
          name,
          cleanVoiceDescription(fields.description),
          normalizeVoiceGender(fields.gender),
          key,
          normalizedMime,
          buffer.length,
          RADIO_VOICE_CONSENT_VERSION,
          actor.id,
          jsonParam({
            consentText: RADIO_VOICE_CONSENT_TEXT,
            shareAllStations,
            uploadedBy: actor.id
          })
        ]
      )
      if (!row) throw createError({ statusCode: 500, statusMessage: 'Não foi possível salvar a voz' })
      // Clip curto otimizado para o MusicGPT — falha aqui não desfaz o cadastro,
      // mas o voice-sample regenera sob demanda.
      let cloneReady = false
      try {
        await ensureMusicGptCloneSample({
          voiceId,
          ownerUserId: actor.id,
          sampleStorageKey: key,
          sourceBuffer: buffer,
          force: true
        })
        cloneReady = true
      } catch (cloneError: any) {
        console.warn('[radio-voices] falha ao preparar clip MusicGPT', String(cloneError?.message || cloneError).slice(0, 200))
      }
      const refreshed = await pgOneOrNull<any>(
        `select id, user_id, station_id, name, description, gender,
                sample_content_type, sample_size_bytes, consent_status,
                consent_version, consent_confirmed_at, status, metadata,
                created_at, updated_at
           from public.radio_voice_profiles where id = $1 limit 1`,
        [voiceId]
      )
      return {
        success: true,
        voice: serializeRadioVoice(refreshed || row),
        cloneReady,
        message: cloneReady
          ? 'Voz salva com clip de clonagem pronto para o MusicGPT.'
          : 'Voz salva. O clip de clonagem será gerado na primeira solicitação.'
      }
    } catch (error) {
      await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined)
      throw error
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Falha ao salvar a voz no banco do JobVarejo' })
  }
})
