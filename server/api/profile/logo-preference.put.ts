import { requireAuthenticatedUser } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'
import { pgOneOrNull } from '../../utils/postgres'
import { ensureBusinessProfileColumn } from '../../utils/business-profile'
import { normalizeLogoPreference } from '../../../utils/logoPreference'

export default defineEventHandler(async event => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `logo-preference:${user.id}`, 120, 60_000)
  const preference = normalizeLogoPreference(await readBody(event))
  if (!preference) throw createError({ statusCode: 400, statusMessage: 'Preferência de logo inválida.' })
  await ensureBusinessProfileColumn()
  // Atomic patch: changing a logo never overwrites contact details from another tab.
  const row = await pgOneOrNull<{ business_profile: unknown }>(
    `UPDATE public.profiles SET business_profile = coalesce(business_profile, '{}'::jsonb)
       || jsonb_build_object('logoPreference', $1::jsonb), updated_at = timezone('utc', now())
     WHERE id = $2 RETURNING business_profile`, [JSON.stringify(preference), user.id])
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Perfil não encontrado.' })
  return { ...row, id: user.id }
})
