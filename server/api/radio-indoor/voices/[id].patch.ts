import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgOneOrNull } from '../../../utils/postgres'
import { cleanText, jsonParam, radioTableErrorResponse } from '../../../utils/radio-indoor'
import { getOwnedRadioVoice, serializeRadioVoice } from '../../../utils/radio-voices'

export default defineEventHandler(async (event) => {
  const { user: actor } = await requireAdminUser(event)
  await enforceRateLimit(event, `radio-voices-update:${actor.id}`, 30, 60_000)
  const voiceId = cleanText(getRouterParam(event, 'id'), 80)
  const body = await readBody<Record<string, any>>(event)
  const action = cleanText(body?.action || '', 30).toLowerCase()
  if (action !== 'revoke') throw createError({ statusCode: 400, statusMessage: 'Ação de voz inválida' })

  try {
    const current = await getOwnedRadioVoice(actor.id, voiceId)
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Voz não encontrada' })
    const row = await pgOneOrNull<any>(
      `update public.radio_voice_profiles
          set status = 'revoked',
              consent_status = 'revoked',
              metadata = metadata || $1::jsonb,
              updated_at = now()
        where id = $2 and user_id = $3 and status = 'active'
        returning id, user_id, station_id, name, description, gender,
                  sample_content_type, sample_size_bytes, consent_status,
                  consent_version, consent_confirmed_at, status, metadata,
                  created_at, updated_at`,
      [
        jsonParam({ lastAction: action, changedBy: actor.id }),
        voiceId,
        actor.id
      ]
    )
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Voz não encontrada' })
    return { success: true, voice: serializeRadioVoice(row) }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Falha ao atualizar a voz' })
  }
})
