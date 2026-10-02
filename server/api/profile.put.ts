import { requireAuthenticatedUser } from '../utils/auth'
import { enforceRateLimit } from '../utils/rate-limit'
import { pgOneOrNull } from '../utils/postgres'
import {
  ensureBusinessProfileColumn,
  isCompleteBusinessProfile,
  mergeBusinessProfile
} from '../utils/business-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuthenticatedUser(event)
  await enforceRateLimit(event, `profile-put:${user.id}`, 60, 60_000)
  await ensureBusinessProfileColumn()

  const body = await readBody<Record<string, any>>(event)
  const current = await pgOneOrNull<{ business_profile: unknown }>(
    `select business_profile from public.profiles where id = $1 limit 1`,
    [user.id]
  )
  const incoming = body?.business_profile ?? body ?? {}
  const businessProfile = mergeBusinessProfile(current?.business_profile, incoming)

  const incomingModules = Array.isArray(body?.selected_modules)
    ? JSON.stringify(body.selected_modules.filter((m: any) => typeof m === 'string'))
    : null
  const onboardingCompleted = isCompleteBusinessProfile(businessProfile)

  const row = await pgOneOrNull<any>(
    `update public.profiles
        set business_profile = ($1::jsonb - 'logoPreference' - 'internalOnly') ||
            CASE WHEN business_profile ? 'logoPreference'
              THEN jsonb_build_object('logoPreference', business_profile->'logoPreference')
              ELSE '{}'::jsonb END ||
            CASE WHEN business_profile ? 'internalOnly'
              THEN jsonb_build_object('internalOnly', business_profile->'internalOnly')
              ELSE '{}'::jsonb END,
            selected_modules = coalesce($3::jsonb, selected_modules),
            onboarding_completed = $4::boolean,
            updated_at = timezone('utc', now())
      where id = $2
      returning id,
                CASE WHEN COALESCE((business_profile->>'internalOnly')::boolean, false) THEN '' ELSE email END AS email,
                name, avatar_url, role, created_at, updated_at, business_profile,
                coalesce(selected_modules, '["encartes", "cartazes", "radio"]'::jsonb) as selected_modules,
                trial_starts_at, trial_ends_at,
                coalesce(subscription_status, 'trial') as subscription_status,
                coalesce(onboarding_completed, false) as onboarding_completed`,
    [JSON.stringify(businessProfile), user.id, incomingModules, onboardingCompleted]
  )

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Perfil nao encontrado' })
  }

  return row
})
