import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../../../utils/postgres'
import { getMusicGptConfig, submitMusicGptMusicAi, submitMusicGptTextToSpeech } from '../../../utils/musicgpt'
import {
  cleanText,
  jsonParam,
  parseRequestBody,
  radioTableErrorResponse
} from '../../../utils/radio-indoor'
import { requireRadioStationAccess } from '../../../utils/radio-access'
import { getAccessibleRadioVoice, getRadioVoiceSampleUrl } from '../../../utils/radio-voices'

const allowedKinds = new Set(['jingle', 'off', 'voice', 'music'])

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-ai-request:${user.id}`, 30, 60_000)
  const body = await parseRequestBody(event)
  const kind = cleanText(body.kind || 'jingle', 20).toLowerCase()
  if (!allowedKinds.has(kind)) throw createError({ statusCode: 400, statusMessage: 'Tipo de solicitação inválido' })
  const title = cleanText(body.title || body.brief || 'Solicitação de áudio', 180)
  const brief = cleanText(body.brief, 3000)
  if (!brief) throw createError({ statusCode: 400, statusMessage: 'Descreva o áudio que você precisa' })
  const lyrics = cleanText(body.lyrics, 6000) || null
  const style = cleanText(body.style || (kind === 'jingle' ? 'vinheta curta para rádio indoor, energética e clara' : 'locução comercial em português do Brasil'), 240) || null
  // Locuções usam somente o banco aprovado pelo Admin (ou o padrão do
  // servidor). Não aceitamos um voice_id arbitrário enviado pelo usuário da
  // loja; para MusicAI mantemos o campo compatível com integrações existentes.
  const requestedVoiceId = cleanText(body.voiceId, 120) || null
  const voiceId = kind === 'off' || kind === 'voice' ? null : requestedVoiceId
  const voiceProfileId = cleanText(body.voiceProfileId, 80) || null
  const voiceGender = ['male', 'female'].includes(String(body.gender || '').toLowerCase()) ? String(body.gender).toLowerCase() : 'female'
  let requestId: string | null = null
  let ownerUserId = user.id

  try {
    const stationId = String(body.stationId || '').trim() || null
    const scope = await requireRadioStationAccess(user.id, stationId, 'operator')
    const station = scope.station
    ownerUserId = scope.ownerUserId
    let selectedVoiceProfile: any | null = null
    const persistedVoiceProfileId = (kind === 'off' || kind === 'voice') && voiceProfileId ? voiceProfileId : null
    if (persistedVoiceProfileId) {
      selectedVoiceProfile = await getAccessibleRadioVoice(ownerUserId, persistedVoiceProfileId, String(station.id))
      if (!selectedVoiceProfile) throw createError({ statusCode: 404, statusMessage: 'Banco de voz não encontrado ou sem autorização' })
    }
    const request = await pgOneOrNull<any>(
      `insert into public.radio_requests
        (user_id, station_id, kind, title, brief, lyrics, style, voice_id, voice_profile_id, status, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10::jsonb)
       returning id, station_id, kind, title, brief, lyrics, style, voice_id, voice_profile_id, status, provider, provider_task_id,
                 provider_conversion_id, result_storage_key, result_source_url, result_format,
                 result_duration_ms, error, metadata, created_at, updated_at`,
      [ownerUserId, station?.id || null, kind, title, brief, lyrics, style, voiceId, persistedVoiceProfileId, jsonParam({ requestedFrom: 'radio-indoor-player', requestedBy: user.id, voiceGender, voiceProfileId: persistedVoiceProfileId })]
    )
    if (!request) throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar a solicitação' })
    requestId = String(request.id)

    const provider = getMusicGptConfig()
    if (!provider.configured) {
      await pgQuery(`update public.radio_requests set status = 'queued', metadata = metadata || $1::jsonb where id = $2 and user_id = $3`, [jsonParam({ awaitingProviderConfig: true }), request.id, ownerUserId])
      return {
        success: true,
        request: { ...request, status: 'queued', provider: null },
        provider: { configured: false, message: 'Configure MUSICGPT_API_KEY no servidor para enviar automaticamente.' }
      }
    }

    await pgQuery(`update public.radio_requests set status = 'processing', provider = 'musicgpt' where id = $1 and user_id = $2`, [request.id, ownerUserId])
    let sampleAudioUrl: string | null = null
    let voiceProfileName: string | null = null
    if (selectedVoiceProfile) {
      sampleAudioUrl = await getRadioVoiceSampleUrl(selectedVoiceProfile, 900)
      voiceProfileName = String(selectedVoiceProfile.name || '').slice(0, 120) || null
    }
    const effectiveVoiceId = sampleAudioUrl ? null : (voiceId || provider.defaultVoiceId)
    if ((kind === 'off' || kind === 'voice') && !effectiveVoiceId && !sampleAudioUrl) {
      const queued = await pgOneOrNull<any>(
        `update public.radio_requests set status = 'queued', metadata = metadata || $1::jsonb where id = $2 and user_id = $3
         returning id, status, provider, metadata, created_at, updated_at`,
        [jsonParam({ awaitingVoiceId: true }), request.id, ownerUserId]
      )
      return { success: true, request: queued || request, provider: { configured: true, accepted: false, message: 'Selecione uma voz liberada no banco ou configure MUSICGPT_DEFAULT_VOICE_ID.' } }
    }
    const submission = (kind === 'off' || kind === 'voice')
      ? await submitMusicGptTextToSpeech({ text: lyrics || brief, voiceId: effectiveVoiceId, sampleAudioUrl, gender: voiceGender })
      : await submitMusicGptMusicAi(event, {
          prompt: `${kind === 'jingle' ? 'Crie uma vinheta de rádio indoor' : 'Crie uma música para rádio indoor'}: ${brief}`,
          musicStyle: style,
          lyrics,
          makeInstrumental: kind === 'music' && !lyrics,
          vocalOnly: false,
          voiceId
        })
    const updated = await pgOneOrNull<any>(
      `update public.radio_requests
          set status = 'queued', provider = 'musicgpt', provider_task_id = $1,
              provider_conversion_id = $2, metadata = metadata || $3::jsonb, updated_at = now()
        where id = $4 and user_id = $5
        returning id, station_id, kind, title, brief, lyrics, style, voice_id, voice_profile_id, status, provider,
                  provider_task_id, provider_conversion_id, result_storage_key, result_source_url,
                  result_format, result_duration_ms, error, metadata, created_at, updated_at`,
      [submission.taskId, submission.conversionId, jsonParam({ providerResponse: submission.raw, requestedBy: user.id, voiceProfileId: persistedVoiceProfileId, voiceProfileName }), request.id, ownerUserId]
    )
    return { success: true, request: updated || request, provider: { configured: true, accepted: true } }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    if (requestId) {
      await pgQuery(
        `update public.radio_requests set status = 'failed', error = $1, updated_at = now() where id = $2 and user_id = $3`,
        [String(error?.statusMessage || error?.message || 'Falha ao solicitar áudio').slice(0, 500), requestId, ownerUserId]
      ).catch(() => undefined)
    }
    if (error?.statusCode) throw error
    throw createError({ statusCode: 502, statusMessage: error?.message || 'Falha ao solicitar áudio ao MusicGPT' })
  }
})
