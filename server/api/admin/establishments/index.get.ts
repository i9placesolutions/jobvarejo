import { requireSuperAdminUser } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { pgQuery } from '../../../utils/postgres'

export default defineEventHandler(async (event) => {
  const user = await requireSuperAdminUser(event)
  await enforceRateLimit(event, `admin-establishments:${user.id}`, 120, 60_000)

  const { rows } = await pgQuery<{ id: string; label: string | null }>(
    `SELECT id::text AS id,
            COALESCE(
              NULLIF(BTRIM(business_profile->>'companyName'), ''),
              NULLIF(BTRIM(business_profile->>'name'), ''),
              NULLIF(BTRIM(name), ''),
              ''
            ) AS label
       FROM public.profiles
      ORDER BY label ASC NULLS LAST, created_at DESC NULLS LAST, id ASC`
  )

  return {
    establishments: rows.map(row => ({
      id: row.id,
      label: row.label || `Estabelecimento ${row.id.slice(0, 8)}`
    }))
  }
})
