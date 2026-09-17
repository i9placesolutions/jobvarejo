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
  const album = String(query.album || '').trim().slice(0, 160)
  const viewMode = String(query.view || 'tracks').trim().toLowerCase() // 'tracks' | 'albums'
  const year = Number.parseInt(String(query.year || ''), 10)
  const limit = positiveInt(query.limit, 60, 500)
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
    if (genre && genre !== 'Todos') {
      params.push(genre)
      conditions.push(`lower(t.genre) = lower($${params.length})`)
    }
    if (artist && artist !== 'Todos') {
      params.push(`%${artist}%`)
      conditions.push(`t.artist ilike $${params.length}`)
    }
    if (album && album !== 'Todos') {
      params.push(album)
      conditions.push(`lower(coalesce(t.album, '')) = lower($${params.length})`)
    }
    if (Number.isFinite(year) && year >= 1900 && year <= 2200) {
      params.push(year)
      conditions.push(`t.release_year = $${params.length}`)
    }

    if (viewMode === 'albums') {
      // Modo de visão agrupado por álbum
      const albumConditions = [...conditions, `t.album is not null`, `trim(t.album) != ''`]
      params.push(limit, offset)
      const albumResult = await pgQuery<any>(
        `select t.album,
                t.artist,
                t.genre,
                coalesce(t.release_year, min(t.release_year)) as release_year,
                count(*)::int as track_count,
                min(t.thumbnail_key) as thumbnail_key,
                min(t.id)::text as sample_track_id,
                count(*) over()::int as total_count
           from public.radio_catalog_tracks t
          where ${albumConditions.join(' and ')}
          group by t.album, t.artist, t.genre, t.release_year
          order by t.artist asc, t.album asc
          limit $${params.length - 1} offset $${params.length}`,
        params
      )

      const albums = albumResult.rows.map((row) => ({
        album: String(row.album),
        artist: String(row.artist || 'Artista desconhecido'),
        genre: String(row.genre || 'Outros'),
        releaseYear: row.release_year == null ? null : Number(row.release_year),
        trackCount: Number(row.track_count || 0),
        thumbnailKey: row.thumbnail_key || null,
        thumbnailUrl: row.thumbnail_key ? `/api/radio-indoor/media?key=${encodeURIComponent(String(row.thumbnail_key))}` : null,
        sampleTrackId: row.sample_track_id || null
      }))

      return {
        success: true,
        stationId: station?.id || null,
        items: [],
        albums,
        total: Number(albumResult.rows[0]?.total_count || 0),
        facets: { genres: [], artists: [], albums: [] }
      }
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

    // Facetas completas de gêneros, artistas e álbuns para alimentar os filtros da UI
    const [facetGenres, facetArtists, facetAlbums] = await Promise.all([
      pgQuery<any>(
        `select genre, count(*)::int as count
           from public.radio_catalog_tracks t
          where t.user_id = $1 and t.status = 'ready' and t.genre is not null and trim(t.genre) != ''
          group by genre order by count desc, genre asc`,
        [scope.ownerUserId]
      ),
      pgQuery<any>(
        `select artist, count(*)::int as count
           from public.radio_catalog_tracks t
          where t.user_id = $1 and t.status = 'ready' and t.artist is not null and trim(t.artist) != ''
          group by artist order by artist asc`,
        [scope.ownerUserId]
      ),
      pgQuery<any>(
        `select album, artist, count(*)::int as count
           from public.radio_catalog_tracks t
          where t.user_id = $1 and t.status = 'ready' and t.album is not null and trim(t.album) != ''
          group by album, artist order by album asc`,
        [scope.ownerUserId]
      )
    ])

    return {
      success: true,
      stationId: station?.id || null,
      items: result.rows.map(serializeTrack),
      total: Number(result.rows[0]?.total_count || 0),
      facets: {
        genres: facetGenres.rows,
        artists: facetArtists.rows,
        albums: facetAlbums.rows
      }
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return { ...setup, items: [], total: 0, facets: { genres: [] } }
    throw createError({ statusCode: Number(error?.statusCode || 500), statusMessage: error?.statusMessage || error?.message || 'Falha ao carregar catálogo' })
  }
})
