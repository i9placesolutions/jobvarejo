import { requireAuthenticatedUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { radioTableErrorResponse } from '../../../utils/radio-indoor'
import { listAccessibleRadioVoices, serializeRadioVoice } from '../../../utils/radio-voices'
import { requireRadioStationAccess } from '../../../utils/radio-access'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-voices:${user.id}`, 120, 60_000)
  try {
    const stationId = String(getQuery(event).stationId || '').trim() || null
    const scope = await requireRadioStationAccess(user.id, stationId, 'player')
    const rows = await listAccessibleRadioVoices(scope.ownerUserId, String(scope.station.id))
    return {
      success: true,
      items: rows.map(serializeRadioVoice),
      // O cadastro e a revogação são exclusivos do painel Admin do MusicGPT.
      canManage: false
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return { ...setup, items: [], canManage: false }
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Falha ao carregar o banco de vozes' })
  }
})
