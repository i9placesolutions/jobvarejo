import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { pgOneOrNull, pgQuery } from './postgres'

export interface RadioPlayerIdentity {
  playerId: string
  userId: string
  stationId: string
  name: string
}
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

const readPlayerToken = (event: H3Event): string | null => {
  const explicit = String(getHeader(event, 'x-radio-player-token') || '').trim()
  if (explicit) return explicit
  const authorization = String(getHeader(event, 'authorization') || '').trim()
  const match = /^RadioPlayer\s+(.+)$/i.exec(authorization)
  return match?.[1]?.trim() || null
}

export const getRadioPlayerIdentity = async (event: H3Event): Promise<RadioPlayerIdentity | null> => {
  const token = readPlayerToken(event)
  if (!token) return null
  const row = await pgOneOrNull<any>(
    `select id, user_id, station_id, name
       from public.radio_players
      where token_hash = $1 and status = 'active'
      limit 1`,
    [hashToken(token)]
  )
  if (!row) throw createError({ statusCode: 401, statusMessage: 'Token do player inválido ou revogado' })
  void pgQuery(
    `update public.radio_players set last_seen_at = now() where id = $1`,
    [row.id]
  ).catch(() => undefined)
  return { playerId: String(row.id), userId: String(row.user_id), stationId: String(row.station_id), name: String(row.name || 'Player') }
}
