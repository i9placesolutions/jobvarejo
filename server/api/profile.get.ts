import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull } from '../utils/postgres'
import { ensureBusinessProfileColumn, normalizeBusinessProfile } from '../utils/business-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `profile-get:${user.id}`, 240, 60_000)
  await ensureBusinessProfileColumn()

  try {
    const row = await pgOneOrNull<any>(
      `select id, email, name, avatar_url, role, created_at, updated_at, business_profile
       from public.profiles
       where id = $1
       limit 1`,
      [user.id]
    )
    if (row) {
      const source = row.business_profile && typeof row.business_profile === 'object'
        ? row.business_profile as Record<string, unknown>
        : {}
      const hasStoredPaymentMethods = ['paymentMethods', 'payment_methods']
        .some(key => Object.prototype.hasOwnProperty.call(source, key))
      const paymentMethodsConfigured = source.__paymentMethodsConfigured === true
        || (source.__paymentMethodsConfigured === undefined && hasStoredPaymentMethods)
      return {
        ...row,
        business_profile: {
          ...normalizeBusinessProfile(row.business_profile),
          __paymentMethodsConfigured: paymentMethodsConfigured
        }
      }
    }

    const metadata = (user.user_metadata && typeof user.user_metadata === 'object')
      ? user.user_metadata as Record<string, any>
      : {}
    const fallbackNameSource = String(metadata.name || metadata.full_name || user.email || 'Usuário')
    const fallbackName = (fallbackNameSource.split('@')[0] || fallbackNameSource).trim() || 'Usuário'

    return {
      id: user.id,
      email: user.email || null,
      name: fallbackName,
      avatar_url: metadata.avatar_url || metadata.picture || null,
      role: 'user',
      business_profile: {
        ...normalizeBusinessProfile(null),
        __paymentMethodsConfigured: false
      }
    }
  } catch (error: any) {
    throw createError({ statusCode: 500, statusMessage: error?.message || 'Failed to load profile' })
  }
})
