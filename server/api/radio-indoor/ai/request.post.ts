import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull, pgQuery } from '../../../utils/postgres'
import { ensureElevenLabsVoice, generateElevenLabsRadioMusic, generateElevenLabsRadioSpeech, getElevenLabsConfig } from '../../../utils/elevenlabs'
import {
  cleanText,
  jsonParam,
  parseRequestBody,
  radioTableErrorResponse
} from '../../../utils/radio-indoor'
import { requireRadioStationAccess } from '../../../utils/radio-access'
import { getAccessibleRadioVoice } from '../../../utils/radio-voices'

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
  // A voz cadastrada só é usada em off/locução; música não aceita voice_id.
  const voiceId = null
  const voiceProfileId = cleanText(body.voiceProfileId, 80) || null
  const requestedGender = ['male', 'female'].includes(String(body.gender || '').toLowerCase()) ? String(body.gender).toLowerCase() : null
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
    if ((kind === 'off' || kind === 'voice') && !selectedVoiceProfile) throw createError({ statusCode: 422, statusMessage: 'Selecione uma voz autorizada para esta locução.' })
    // Gênero do perfil manda no clone; formulário só entra se não houver perfil.
    const voiceGender = selectedVoiceProfile
      ? (String(selectedVoiceProfile.gender || '').toLowerCase() === 'male' ? 'male' : 'female')
      : (requestedGender || 'female')
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

    if (!getElevenLabsConfig().apiKey) throw createError({ statusCode: 503, statusMessage: 'Configure ELEVENLABS_API_KEY no servidor.' })
    await pgQuery("update public.radio_requests set status='processing',provider='elevenlabs' where id=$1 and user_id=$2", [request.id, ownerUserId])
    if (kind === 'off' || kind === 'voice') {
      const clone = await ensureElevenLabsVoice(ownerUserId, persistedVoiceProfileId!)
      await generateElevenLabsRadioSpeech({ ownerUserId, requestId: String(request.id), stationId: station?.id || null, title, text: lyrics || brief, voiceId: clone.voiceId, kind })
    } else {
      await generateElevenLabsRadioMusic({ ownerUserId, requestId: String(request.id), stationId: station?.id || null, title, brief, style, lyrics, kind: kind as 'jingle' | 'music' })
    }
    const updated = await pgOneOrNull<any>(
      `select id, station_id, kind, title, brief, lyrics, style, voice_id, voice_profile_id, status, provider,
              provider_task_id, provider_conversion_id, result_storage_key, result_source_url, result_format,
              result_duration_ms, error, metadata, created_at, updated_at
         from public.radio_requests where id=$1 and user_id=$2`,
      [request.id, ownerUserId]
    )
    return {
      success: true,
      request: updated,
      provider: { configured: true, accepted: true, message: 'Áudio ElevenLabs pronto para ouvir.' }
    }
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
    throw createError({ statusCode: 502, statusMessage: error?.message || 'Falha ao gerar áudio na ElevenLabs' })
  }
})
