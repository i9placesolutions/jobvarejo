import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgQuery } from '../../utils/postgres'
import { radioTableErrorResponse } from '../../utils/radio-indoor'
import { listRadioStationMembers, requireRadioStationAccess, serializeRadioPlayer } from '../../utils/radio-access'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-members:${user.id}`, 120, 60_000)
  try {
    const stationId = String(getQuery(event).stationId || '').trim() || null
    const scope = await requireRadioStationAccess(user.id, stationId, 'manager')
    const [members, players] = await Promise.all([
      listRadioStationMembers(scope.station.id),
      pgQuery<any>(
        `select id, station_id, name, token_hint, status, last_seen_at, created_at, updated_at
           from public.radio_players where station_id = $1 order by lower(name), created_at`,
        [scope.station.id]
      )
    ])
    return {
      success: true,
      stationId: scope.station.id,
      access: scope.accessLevel,
      members,
      players: players.rows.map(serializeRadioPlayer)
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return { ...setup, members: [], players: [] }
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Falha ao carregar equipe da loja' })
  }
})
