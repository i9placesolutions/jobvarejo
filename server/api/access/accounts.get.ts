import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgQuery } from '../../utils/postgres'
import { PROFILE_ACTIVE_SQL } from '../../utils/account-access'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  if (user.role !== 'super_admin' && user.role !== 'admin' && user.role !== 'editor') {
    throw createError({ statusCode: 403, statusMessage: 'Acesso administrativo necessário.' })
  }
  if (user.role === 'editor' && !Object.values(user.editorPermissions).some(actions => actions?.view)) {
    throw createError({ statusCode: 403, statusMessage: 'Editor sem áreas liberadas.' })
  }
  await enforceRateLimit(event, `access-accounts:${user.actorId}`, 120, 60_000)
  const search = String(getQuery(event).search || '').trim().slice(0, 120)
  const pattern = `%${search.replace(/[!%_]/g, '!$&')}%`
  const { rows } = await pgQuery<{ id: string; label: string; email: string }>(`
    SELECT p.id,
           COALESCE(NULLIF(BTRIM(p.business_profile->>'companyName'), ''), NULLIF(BTRIM(p.name), ''), p.email) AS label,
           CASE WHEN COALESCE((p.business_profile->>'internalOnly')::boolean, false) THEN '' ELSE p.email END AS email
      FROM public.profiles p
     WHERE p.role = 'user'
       AND (${PROFILE_ACTIVE_SQL})
       AND ($1 = '' OR p.name ILIKE $2 ESCAPE '!' OR p.email ILIKE $2 ESCAPE '!'
            OR p.business_profile->>'companyName' ILIKE $2 ESCAPE '!')
     ORDER BY label ASC, p.id ASC
     LIMIT 100
  `, [search, pattern])
  const selectedId = String(getCookie(event, 'active-account-id') || '').trim()
  if (selectedId && !rows.some(row => row.id === selectedId)) {
    const selected = await pgQuery<{ id: string; label: string; email: string }>(`
      SELECT p.id,
             COALESCE(NULLIF(BTRIM(p.business_profile->>'companyName'), ''), NULLIF(BTRIM(p.name), ''), p.email) AS label,
             CASE WHEN COALESCE((p.business_profile->>'internalOnly')::boolean, false) THEN '' ELSE p.email END AS email
        FROM public.profiles p
       WHERE p.id = $1 AND p.role = 'user'
         AND (${PROFILE_ACTIVE_SQL})
       LIMIT 1
    `, [selectedId])
    if (selected.rows[0]) rows.unshift(selected.rows[0])
  }
  return { accounts: rows, selectedId: rows.some(row => row.id === selectedId) ? selectedId : null }
})
