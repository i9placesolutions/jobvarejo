import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgQuery } from '../../utils/postgres'
import {
  positiveInt,
  radioTableErrorResponse,
  serializeTrack
} from '../../utils/radio-indoor'
import { requireRadioStationAccess } from '../../utils/radio-access'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-catalog:${user.id}`, 240, 60_000)
  const query = getQuery(event)
  const q = String(query.q || '').trim().slice(0, 120)
  const genre = String(query.genre || '').trim().slice(0, 80)
  const artist = String(query.artist || '').trim().slice(0, 120)
  const year = Number.parseInt(String(query.year || ''), 10)
  const limit = positiveInt(query.limit, 60, 100)
  const offset = positiveInt(query.offset, 0, 10_000)

  try {
    const requestedStationId = String(query.stationId || '').trim() || null
    const scope = await requireRadioStationAccess(user.id, requestedStationId, 'player')
    const station = scope.station
    // O catálogo é compartilhado pela conta; playlists, programas e horários
    // continuam isolados por estação/loja.
    const params: any[] = [scope.ownerUserId]
    const conditions = [
      `t.user_id = $1`,
      `t.status = 'ready'`
    ]
    if (q) {
      params.push(`%${q}%`)
      conditions.push(`(t.title ilike $${params.length} or t.artist ilike $${params.length} or coalesce(t.album, '') ilike $${params.length})`)
    }
    if (genre) {
      params.push(genre)
      conditions.push(`lower(t.genre) = lower($${params.length})`)
    }
    if (artist) {
      params.push(`%${artist}%`)
      conditions.push(`t.artist ilike $${params.length}`)
    }
    if (Number.isFinite(year) && year >= 1900 && year <= 2200) {
      params.push(year)
      conditions.push(`t.release_year = $${params.length}`)
    }
    params.push(limit, offset)
    const result = await pgQuery<any>(
      `select t.*,
              count(*) over()::int as total_count
         from public.radio_catalog_tracks t
        where ${conditions.join(' and ')}
        order by t.release_year desc nulls last, t.artist asc, t.title asc
        limit $${params.length - 1} offset $${params.length}`,
      params
    )
    const facetResult = await pgQuery<any>(
      `select genre, count(*)::int as count
         from public.radio_catalog_tracks t
        where t.user_id = $1 and t.status = 'ready'
        group by genre order by count desc, genre asc`,
        [scope.ownerUserId]
    )
    return {
      success: true,
      stationId: station?.id || null,
      items: result.rows.map(serializeTrack),
      total: Number(result.rows[0]?.total_count || 0),
      facets: { genres: facetResult.rows }
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return { ...setup, items: [], total: 0, facets: { genres: [] } }
    throw createError({ statusCode: Number(error?.statusCode || 500), statusMessage: error?.statusMessage || error?.message || 'Falha ao carregar catálogo' })
  }
})
