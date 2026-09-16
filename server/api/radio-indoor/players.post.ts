import { createHash, randomBytes } from 'node:crypto'
import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgOneOrNull } from '../../utils/postgres'
import { cleanText, jsonParam, parseRequestBody, radioTableErrorResponse } from '../../utils/radio-indoor'
import { requireRadioStationAccess, serializeRadioPlayer } from '../../utils/radio-access'

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

export default defineEventHandler(async (event) => {
  const actor = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-players-write:${actor.id}`, 60, 60_000)
  const body = await parseRequestBody(event)
  const action = cleanText(body.action || 'create', 30).toLowerCase()

  try {
    const scope = await requireRadioStationAccess(actor.id, String(body.stationId || '').trim() || null, 'manager')
    if (action === 'revoke' || action === 'pause' || action === 'resume') {
      const playerId = String(body.playerId || '').trim()
      if (!playerId) throw createError({ statusCode: 400, statusMessage: 'Player inválido' })
      const status = action === 'revoke' ? 'revoked' : action === 'pause' ? 'paused' : 'active'
      const result = await pgOneOrNull<any>(
        `update public.radio_players set status = $1 where id = $2 and station_id = $3 returning id, station_id, name, token_hint, status, last_seen_at, created_at, updated_at`,
        [status, playerId, scope.station.id]
      )
      if (!result) throw createError({ statusCode: 404, statusMessage: 'Player não encontrado' })
      return { success: true, player: serializeRadioPlayer(result) }
    }

    const name = cleanText(body.name, 120) || 'Player da loja'
    const rawToken = `jv_radio_${randomBytes(32).toString('base64url')}`
    const player = await pgOneOrNull<any>(
      `insert into public.radio_players
        (station_id, user_id, name, token_hash, token_hint, status, metadata, created_by)
       values ($1, $2, $3, $4, $5, 'active', $6::jsonb, $7)
       returning id, station_id, name, token_hint, status, last_seen_at, created_at, updated_at`,
      [scope.station.id, scope.ownerUserId, name, tokenHash(rawToken), rawToken.slice(-6), jsonParam({ createdBy: actor.id }), actor.id]
    )
    if (!player) throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o player' })
    return {
      success: true,
      player: serializeRadioPlayer(player),
      token: rawToken,
      tokenNotice: 'Copie este token agora. Por segurança, ele não será exibido novamente.'
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Falha ao gerenciar players da loja' })
  }
})
