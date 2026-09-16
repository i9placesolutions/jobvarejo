import { cleanText, ensureRadioStation, isUuid } from './radio-indoor'
import { pgOneOrNull, pgQuery } from './postgres'

export const RADIO_ACCESS_LEVELS = ['owner', 'manager', 'editor', 'operator', 'player'] as const
export type RadioAccessLevel = typeof RADIO_ACCESS_LEVELS[number]

const ACCESS_RANK: Record<RadioAccessLevel, number> = {
  player: 10,
  operator: 20,
  editor: 30,
  manager: 40,
  owner: 50
}

export const radioAccessLabel = (level: unknown): string => ({
  owner: 'Proprietário',
  manager: 'Gerente',
  editor: 'Editor de programação',
  operator: 'Operador',
  player: 'Player'
} as Record<string, string>)[String(level || 'operator')] || 'Operador'

export const normalizeRadioAccessLevel = (value: unknown, fallback: RadioAccessLevel = 'operator'): RadioAccessLevel => {
  const level = String(value || '').trim().toLowerCase() as RadioAccessLevel
  return RADIO_ACCESS_LEVELS.includes(level) ? level : fallback
}

export const radioAccessAllows = (actual: unknown, required: RadioAccessLevel): boolean =>
  ACCESS_RANK[normalizeRadioAccessLevel(actual, 'player')] >= ACCESS_RANK[required]

export interface RadioStationScope {
  station: any
  ownerUserId: string
  accessLevel: RadioAccessLevel
  isOwner: boolean
}

export const ensureRadioOwnerMembership = async (stationId: string, userId: string, createdBy = userId) => {
  await pgQuery(
    `insert into public.radio_station_members (station_id, user_id, access_level, status, created_by)
     values ($1, $2, 'owner', 'active', $3)
     on conflict (station_id, user_id) do update
       set access_level = 'owner', status = 'active', updated_at = now()`,
    [stationId, userId, createdBy]
  )
}

const scopeRow = (row: any): RadioStationScope => ({
  station: row,
  ownerUserId: String(row.user_id),
  accessLevel: normalizeRadioAccessLevel(row.access_level, row.is_owner ? 'owner' : 'player'),
  isOwner: Boolean(row.is_owner)
})

const findStation = async (actorUserId: string, stationId?: string | null): Promise<RadioStationScope | null> => {
  const params: any[] = [actorUserId]
  const stationCondition = stationId && isUuid(stationId) ? ' and s.id = $2' : ''
  if (stationCondition) params.push(stationId)
  const order = stationCondition ? '' : ' order by (s.user_id = $1) desc, lower(s.name), s.created_at, s.id limit 1'
  const row = await pgOneOrNull<any>(
    `select s.id, s.user_id, s.name, s.slug, s.timezone, s.status, s.settings, s.created_at, s.updated_at,
            case when s.user_id = $1 then 'owner' else m.access_level end as access_level,
            (s.user_id = $1) as is_owner
       from public.radio_stations s
       left join public.radio_station_members m
         on m.station_id = s.id and m.user_id = $1 and m.status = 'active'
      where (s.user_id = $1 or m.id is not null)${stationCondition}${order}`,
    params
  )
  return row ? scopeRow(row) : null
}

export const getRadioStationScope = async (
  actorUserId: string,
  stationId?: string | null,
  options: { createIfMissing?: boolean } = {}
): Promise<RadioStationScope | null> => {
  const normalizedStationId = stationId && isUuid(stationId) ? stationId : null
  let scope = await findStation(actorUserId, normalizedStationId)
  if (scope || normalizedStationId || options.createIfMissing === false) return scope

  const station = await ensureRadioStation(actorUserId)
  if (!station) return null
  await ensureRadioOwnerMembership(String(station.id), actorUserId)
  scope = await findStation(actorUserId, String(station.id))
  return scope
}

export const requireRadioStationAccess = async (
  actorUserId: string,
  stationId?: string | null,
  required: RadioAccessLevel = 'player',
  options: { createIfMissing?: boolean } = {}
): Promise<RadioStationScope> => {
  const scope = await getRadioStationScope(actorUserId, stationId, options)
  if (!scope) throw createError({ statusCode: 404, statusMessage: 'Loja da Rádio Indoor não encontrada' })
  if (!radioAccessAllows(scope.accessLevel, required)) {
    throw createError({ statusCode: 403, statusMessage: `Seu nível (${radioAccessLabel(scope.accessLevel)}) não permite esta ação` })
  }
  return scope
}

export const listAccessibleStations = async (actorUserId: string) => {
  const result = await pgQuery<any>(
    `select s.id, s.user_id, s.name, s.slug, s.timezone, s.status, s.settings, s.created_at, s.updated_at,
            case when s.user_id = $1 then 'owner' else m.access_level end as access_level,
            (s.user_id = $1) as is_owner
       from public.radio_stations s
       left join public.radio_station_members m
         on m.station_id = s.id and m.user_id = $1 and m.status = 'active'
      where s.user_id = $1 or m.id is not null
      order by (s.user_id = $1) desc, lower(s.name), s.created_at, s.id`,
    [actorUserId]
  )
  return result.rows
}

export const listRadioStationMembers = async (stationId: string) => {
  const result = await pgQuery<any>(
    `select m.id, m.station_id, m.user_id, m.access_level, m.status, m.created_at, m.updated_at,
            p.email, p.name, p.avatar_url, p.role::text as profile_role,
            (s.user_id = m.user_id) as is_owner
       from public.radio_station_members m
       join public.radio_stations s on s.id = m.station_id
       join public.profiles p on p.id = m.user_id
      where m.station_id = $1
      order by (m.access_level = 'owner') desc, lower(coalesce(p.name, p.email)), p.email`,
    [stationId]
  )
  return result.rows.map((row) => ({
    id: String(row.id),
    stationId: String(row.station_id),
    userId: String(row.user_id),
    name: row.name || row.email,
    email: row.email,
    avatarUrl: row.avatar_url || null,
    accessLevel: normalizeRadioAccessLevel(row.access_level, row.is_owner ? 'owner' : 'operator'),
    accessLabel: radioAccessLabel(row.access_level),
    status: row.status || 'active',
    profileRole: row.profile_role || 'user',
    isOwner: Boolean(row.is_owner),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export const getRadioStationMember = async (stationId: string, userId: string) =>
  pgOneOrNull<any>(
    `select id, station_id, user_id, access_level, status, created_at, updated_at
       from public.radio_station_members where station_id = $1 and user_id = $2 limit 1`,
    [stationId, userId]
  )

export const getAccessibleTrack = async (actorUserId: string, trackId: string, stationId?: string | null) => {
  if (!isUuid(trackId)) return null
  const stationCondition = stationId && isUuid(stationId) ? ' and (t.station_id is null or t.station_id = $3)' : ''
  const params: any[] = [trackId, actorUserId]
  if (stationCondition) params.push(stationId)
  return pgOneOrNull<any>(
    `select t.*
       from public.radio_catalog_tracks t
      where t.id = $1
        and (
          t.user_id = $2
          or exists (
            select 1
              from public.radio_station_members m
              join public.radio_stations s on s.id = m.station_id
             where m.user_id = $2 and m.status = 'active' and s.user_id = t.user_id
               and (t.station_id is null or t.station_id = s.id)
          )
        )
      ${stationCondition}
      limit 1`,
    params
  )
}

export const radioOwnerIdFromScope = (scope: RadioStationScope): string => scope.ownerUserId

export const cleanRadioPlayerName = (value: unknown): string => cleanText(value, 120) || 'Player da loja'

export const serializeRadioPlayer = (row: any) => ({
  id: String(row.id),
  stationId: String(row.station_id),
  name: String(row.name || 'Player da loja'),
  tokenHint: row.token_hint || null,
  status: row.status || 'active',
  lastSeenAt: row.last_seen_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null
})
