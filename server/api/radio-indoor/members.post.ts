import { requireAuthenticatedUser } from '../../utils/auth'
import { ensureAuthColumns, createProfileWithPassword, getProfileByEmail, normalizeEmail } from '../../utils/auth-db'
import { enforceRateLimit } from '../../utils/rate-limit'
import { hashPassword } from '../../utils/password'
import { pgQuery } from '../../utils/postgres'
import { cleanText, parseRequestBody, radioTableErrorResponse } from '../../utils/radio-indoor'
import {
  getRadioStationMember,
  getRadioStationScope,
  listRadioStationMembers,
  normalizeRadioAccessLevel,
  requireRadioStationAccess,
  type RadioAccessLevel
} from '../../utils/radio-access'

const assignableLevels: RadioAccessLevel[] = ['manager', 'editor', 'operator', 'player']

const stationIdsFromBody = (body: Record<string, any>, fallback: string): string[] => {
  const raw = Array.isArray(body.stationIds) ? body.stationIds : [body.stationId || fallback]
  return Array.from(new Set(raw.map((item: any) => String(item || '').trim()).filter(Boolean)))
}

export default defineEventHandler(async (event) => {
  const actor = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `radio-members-write:${actor.id}`, 60, 60_000)
  const body = await parseRequestBody(event)
  const action = cleanText(body.action || 'create', 30).toLowerCase()

  try {
    const requestedStationId = String(body.stationId || '').trim() || null
    const currentScope = await requireRadioStationAccess(actor.id, requestedStationId, 'manager')
    const stationIds = stationIdsFromBody(body, String(currentScope.station.id))
    const scopes = [] as Awaited<ReturnType<typeof getRadioStationScope>>[]
    for (const stationId of stationIds) {
      const scope = await requireRadioStationAccess(actor.id, stationId, 'manager')
      if (scope.ownerUserId !== currentScope.ownerUserId) {
        throw createError({ statusCode: 403, statusMessage: 'As lojas precisam pertencer à mesma conta' })
      }
      scopes.push(scope)
    }

    if (action === 'update') {
      const memberId = String(body.memberId || '').trim()
      const level = normalizeRadioAccessLevel(body.accessLevel, 'operator')
      if (!memberId || !assignableLevels.includes(level)) throw createError({ statusCode: 400, statusMessage: 'Membro ou nível inválido' })
      if (level === 'manager' && currentScope.accessLevel !== 'owner') {
        throw createError({ statusCode: 403, statusMessage: 'Somente o proprietário pode promover outro gerente' })
      }
      const existing = await pgQuery<any>(
        `select m.id, m.station_id, m.user_id, m.access_level, m.status
           from public.radio_station_members m
           join public.radio_stations s on s.id = m.station_id
          where m.id = $1 and (($4 = 'owner' and s.user_id = $2) or exists (
            select 1 from public.radio_station_members own
            where own.station_id = s.id and own.user_id = $3 and own.status = 'active' and own.access_level in ('owner','manager')
          )) limit 1`,
        [memberId, currentScope.ownerUserId, actor.id, currentScope.accessLevel]
      )
      const member = existing.rows[0]
      if (!member) throw createError({ statusCode: 404, statusMessage: 'Membro não encontrado' })
      if (member.access_level === 'owner') throw createError({ statusCode: 409, statusMessage: 'O proprietário principal não pode ser rebaixado' })
      const result = await pgQuery<any>(
        `update public.radio_station_members set access_level = $1, status = $2 where id = $3 returning id, station_id, user_id, access_level, status`,
        [level, body.status === 'suspended' ? 'suspended' : 'active', memberId]
      )
      return { success: true, member: result.rows[0] }
    }

    const name = cleanText(body.name, 120).replace(/\s+/g, ' ')
    const email = normalizeEmail(body.email)
    if (!name || name.length < 2) throw createError({ statusCode: 400, statusMessage: 'Nome inválido' })
    if (!email || !email.includes('@')) throw createError({ statusCode: 400, statusMessage: 'E-mail inválido' })
    const accessLevel = normalizeRadioAccessLevel(body.accessLevel, 'operator')
    if (!assignableLevels.includes(accessLevel)) throw createError({ statusCode: 400, statusMessage: 'Escolha um nível de acesso válido' })
    if (accessLevel === 'manager' && currentScope.accessLevel !== 'owner') {
      throw createError({ statusCode: 403, statusMessage: 'Somente o proprietário pode cadastrar gerente' })
    }

    await ensureAuthColumns()
    let profile = await getProfileByEmail(email)
    let createdProfile = false
    if (!profile) {
      const password = String(body.password || '')
      if (password.length < 8) throw createError({ statusCode: 400, statusMessage: 'A senha inicial precisa ter pelo menos 8 caracteres' })
      profile = await createProfileWithPassword({
        name,
        email,
        passwordHash: await hashPassword(password),
        role: 'user'
      })
      createdProfile = true
    }

    for (const scope of scopes) {
      if (!scope) continue
      const existing = await getRadioStationMember(String(scope.station.id), String(profile.id))
      if (existing?.access_level === 'owner' || String(profile.id) === scope.ownerUserId) {
        throw createError({ statusCode: 409, statusMessage: 'O proprietário principal não pode ser cadastrado como membro' })
      }
      await pgQuery(
        `insert into public.radio_station_members (station_id, user_id, access_level, status, created_by)
         values ($1, $2, $3, 'active', $4)
         on conflict (station_id, user_id) do update
           set access_level = excluded.access_level, status = 'active', created_by = excluded.created_by, updated_at = now()`,
        [scope.station.id, profile.id, accessLevel, actor.id]
      )
    }

    const members = await listRadioStationMembers(String(currentScope.station.id))
    const member = members.find((item) => item.userId === String(profile!.id)) || null
    return {
      success: true,
      createdProfile,
      member,
      memberships: stationIds,
      message: createdProfile ? 'Usuário criado e vinculado às lojas selecionadas.' : 'Usuário vinculado às lojas selecionadas.'
    }
  } catch (error: any) {
    const setup = radioTableErrorResponse(error)
    if (setup) return setup
    if (error?.statusCode) throw error
    const code = String(error?.code || '')
    if (code === '23505') throw createError({ statusCode: 409, statusMessage: 'Este e-mail já está sendo cadastrado' })
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Falha ao cadastrar usuário da rádio' })
  }
})
