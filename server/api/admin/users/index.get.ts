import { requireAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'
import { normalizeEditorPermissions } from '../../../../shared/access-control'
import { isTechnicalAdminEmail } from '../../../utils/admin-users'
import { PROFILE_ACTIVE_SQL } from '../../../utils/account-access'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminUser(event)
  await enforceRateLimit(event, `admin-users-list:${user.actorId}`, 120, 60_000)
  const search = String(getQuery(event).search || '').trim().slice(0, 120)
  const pattern = `%${search.replace(/[!%_]/g, '!$&')}%`
  const { rows } = await pgQuery<any>(`
    SELECT p.id, p.name,
           CASE WHEN COALESCE((p.business_profile->>'internalOnly')::boolean, false) THEN '' ELSE p.email END AS email,
           p.login_whatsapp AS whatsapp, p.role::text AS role,
           p.business_profile->>'companyName' AS company_name,
           COALESCE((p.business_profile->>'internalOnly')::boolean, false) AS internal_only,
           (${PROFILE_ACTIVE_SQL}) AS is_active,
           COALESCE(to_jsonb(p)->'editor_permissions', '{}'::jsonb) AS permissions,
           p.created_at, p.last_login_at
      FROM public.profiles p
     WHERE COALESCE(p.business_profile->'adminAccess'->>'removedAt', '') = ''
       AND ($1 = '' OR p.name ILIKE $2 ESCAPE '!' OR p.email ILIKE $2 ESCAPE '!'
           OR p.login_whatsapp ILIKE $2 ESCAPE '!'
           OR p.business_profile->>'companyName' ILIKE $2 ESCAPE '!')
     ORDER BY p.created_at DESC NULLS LAST, p.id DESC
     LIMIT 100
  `, [search, pattern])
  return { users: rows.map(row => ({ ...row, email: isTechnicalAdminEmail(row.email) ? '' : row.email, permissions: normalizeEditorPermissions(row.permissions) })) }
})
