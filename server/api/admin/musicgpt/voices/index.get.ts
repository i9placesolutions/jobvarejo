import { requireAdminUser } from '../../../../utils/auth'
import { enforceRateLimit } from '../../../../utils/rate-limit'
import { getElevenLabsConfig } from '../../../../utils/elevenlabs'
import { radioTableErrorResponse } from '../../../../utils/radio-indoor'
import { listOwnedRadioVoices, serializeRadioVoice } from '../../../../utils/radio-voices'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  await enforceRateLimit(event, `admin-musicgpt-voices:${user.id}`, 120, 60_000)
  try {
    const rows = await listOwnedRadioVoices(user.id)
    return {
      success: true,
      items: rows.map(serializeRadioVoice),
      provider: { configured: Boolean(getElevenLabsConfig().apiKey), name: 'elevenlabs' }
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return { ...setup, items: [], provider: { configured: Boolean(getElevenLabsConfig().apiKey), name: 'elevenlabs' } }
    throw createError({ statusCode: 500, statusMessage: 'Falha ao carregar o banco de vozes' })
  }
})
