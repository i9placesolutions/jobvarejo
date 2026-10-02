import type { AuthenticatedUser } from './auth'
import { isCompleteBusinessProfile, ensureBusinessProfileColumn } from './business-profile'
import { pgOneOrNull } from './postgres'

/** Enforce onboarding only when a regular user account is creating an offer.
 * Staff working in their own account retain existing permissions; staff acting
 * on a selected customer account are checked against that effective account.
 */
export const requireBusinessProfileForOfferCreation = async (user: AuthenticatedUser): Promise<void> => {
  const isOwnStaffAccount = user.id === user.actorId && user.role !== 'user'
  if (isOwnStaffAccount) return

  await ensureBusinessProfileColumn()
  const row = await pgOneOrNull<{ business_profile: unknown }>(
    'select business_profile from public.profiles where id = $1 limit 1',
    [user.id]
  )

  if (!row || !isCompleteBusinessProfile(row.business_profile)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Complete o cadastro da empresa antes de criar ofertas.'
    })
  }
}
