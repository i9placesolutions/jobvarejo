import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { UserRole } from '~/types/auth'
import type { EditorPermissions } from '../../shared/access-control'
import { pgOneOrNull, pgQuery } from './postgres'
import { PROFILE_ACTIVE_SQL } from './account-access'

type ProfileRow = {
  id: string
  email: string
  login_whatsapp?: string | null
  login_whatsapp_verified_at?: string | null
  name: string | null
  avatar_url: string | null
  role: UserRole
  is_active?: boolean
  has_active_column?: boolean
  has_permissions_column?: boolean
  editor_permissions?: EditorPermissions
  business_profile?: { companyName?: string; internalOnly?: boolean } | null
  password_hash?: string | null
  reset_token_hash?: string | null
  reset_token_expires_at?: string | null
  selected_modules?: string[]
  trial_starts_at?: string | null
  trial_ends_at?: string | null
  subscription_status?: string
  onboarding_completed?: boolean
}

let authColumnsEnsured = false

export const ensureAuthColumns = async (): Promise<void> => {
  if (authColumnsEnsured) return

  await pgQuery(`
    alter table public.profiles
      add column if not exists password_hash text,
      add column if not exists reset_token_hash text,
      add column if not exists reset_token_expires_at timestamptz,
      add column if not exists last_login_at timestamptz,
      add column if not exists login_whatsapp text,
      add column if not exists login_whatsapp_verified_at timestamptz,
      add column if not exists selected_modules jsonb not null default '["encartes", "cartazes", "radio"]'::jsonb,
      add column if not exists trial_starts_at timestamptz not null default now(),
      add column if not exists trial_ends_at timestamptz not null default (now() + interval '15 days'),
      add column if not exists subscription_status text not null default 'trial',
      add column if not exists onboarding_completed boolean not null default false
  `)

  await pgQuery(`
    create index if not exists idx_profiles_reset_token_hash
      on public.profiles (reset_token_hash)
  `)

  await pgQuery(`
    create unique index if not exists idx_profiles_login_whatsapp_unique
      on public.profiles (login_whatsapp)
      where login_whatsapp is not null
  `)

  try {
    await pgQuery(`
      create unique index if not exists idx_profiles_email_lower_unique
        on public.profiles ((lower(email)))
    `)
  } catch (error) {
    console.warn('[auth-db] Nao foi possivel criar indice unico de e-mail automaticamente:', error)
  }

  authColumnsEnsured = true
}

export const normalizeEmail = (email: unknown): string =>
  String(email || '').trim().toLowerCase()

export const countProfiles = async (): Promise<number> => {
  const row = await pgOneOrNull<{ total: string | number }>(
    `select count(*)::text as total from public.profiles`
  )
  return Number.parseInt(String(row?.total || '0'), 10) || 0
}

export const getProfileByEmail = async (email: string): Promise<ProfileRow | null> => {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  return pgOneOrNull<ProfileRow>(
    `select id, email, login_whatsapp, login_whatsapp_verified_at, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at
     from public.profiles
     where lower(email) = $1
     limit 1`,
    [normalized]
  )
}

export const getProfileByWhatsApp = async (whatsapp: string): Promise<ProfileRow | null> => {
  const normalized = String(whatsapp || '').trim()
  if (!normalized) return null
  return pgOneOrNull<ProfileRow>(
    `select id, email, login_whatsapp, login_whatsapp_verified_at, name, avatar_url, role::text as role, password_hash
     from public.profiles
     where login_whatsapp = $1
       and login_whatsapp_verified_at is not null
     limit 1`,
    [normalized]
  )
}

export const getProfileById = async (id: string): Promise<ProfileRow | null> => {
  const normalized = String(id || '').trim()
  if (!normalized) return null
  return pgOneOrNull<ProfileRow>(
    `select p.id, p.email, p.login_whatsapp, p.login_whatsapp_verified_at, p.name, p.avatar_url,
            p.role::text as role, p.password_hash, p.reset_token_hash, p.reset_token_expires_at,
            (${PROFILE_ACTIVE_SQL}) as is_active,
            to_jsonb(p) ? 'is_active' as has_active_column,
            to_jsonb(p) ? 'editor_permissions' as has_permissions_column,
            coalesce(to_jsonb(p)->'editor_permissions', '{}'::jsonb) as editor_permissions,
            p.business_profile,
            coalesce(to_jsonb(p)->'selected_modules', '["encartes", "cartazes", "radio"]'::jsonb) as selected_modules,
            p.trial_starts_at,
            p.trial_ends_at,
            coalesce(p.subscription_status, 'trial') as subscription_status,
            coalesce(p.onboarding_completed, false) as onboarding_completed
     from public.profiles p
     where p.id = $1
     limit 1`,
    [normalized]
  )
}

export const createProfileWithPassword = async (params: {
  name: string
  email: string
  whatsapp?: string | null
  passwordHash: string | null
  role: UserRole
  businessProfile?: Record<string, any> | null
  selectedModules?: string[] | null
  onboardingCompleted?: boolean
}, client?: PoolClient): Promise<ProfileRow> => {
  const query = <T extends import('pg').QueryResultRow>(sql: string, values: unknown[]) =>
    client ? client.query<T>(sql, values) : pgQuery<T>(sql, values)
  const id = randomUUID()
  const normalizedEmail = normalizeEmail(params.email)
  const trimmedName = String(params.name || '').trim()

  // Esta instalação mantém public.profiles ligado a auth.users por uma FK.
  // Criar primeiro a identidade do Supabase deixa o trigger criar o perfil e
  // mantém o fluxo de cadastro próprio do JobVarejo compatível com os dois
  // formatos de banco (com ou sem schema auth).
  let authUserCreated = false
  if (client) await client.query('SAVEPOINT auth_user_insert')
  try {
    await query(
      `insert into auth.users
        (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1::uuid, 'authenticated', 'authenticated', $2, now(), $3::jsonb, $4::jsonb, now(), now())
       on conflict (id) do nothing`,
      [id, normalizedEmail, JSON.stringify({ provider: 'jobvarejo' }), JSON.stringify({ name: trimmedName, email: normalizedEmail })]
    )
    authUserCreated = true
    if (client) await client.query('RELEASE SAVEPOINT auth_user_insert')
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK TO SAVEPOINT auth_user_insert')
      await client.query('RELEASE SAVEPOINT auth_user_insert')
    }
    const code = String(error?.code || '')
    const message = String(error?.message || '').toLowerCase()
    const authUnavailable = code === '42P01' || code === '3F000' || message.includes('schema "auth"') || message.includes('relation "auth.users"')
    if (!authUnavailable) throw error
  }

  const businessProfileJson = JSON.stringify(params.businessProfile || {})
  const selectedModulesJson = JSON.stringify(params.selectedModules || ['encartes', 'cartazes', 'radio'])
  const onboardingCompleted = Boolean(params.onboardingCompleted)

  if (authUserCreated) {
    const synchronized = (await query<ProfileRow>(
      `update public.profiles
          set email = $2, login_whatsapp = $3,
              login_whatsapp_verified_at = case when $3::text is null then null else timezone('utc', now()) end,
              name = $4, role = $5::user_role, password_hash = $6,
              business_profile = $7::jsonb,
              selected_modules = $8::jsonb,
              onboarding_completed = $9::boolean,
              trial_starts_at = now(),
              trial_ends_at = now() + interval '15 days',
              subscription_status = 'trial',
              updated_at = timezone('utc', now())
        where id = $1
        returning id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at,
                  business_profile, selected_modules, trial_starts_at, trial_ends_at, subscription_status, onboarding_completed`,
      [id, normalizedEmail, params.whatsapp || null, trimmedName, params.role, params.passwordHash, businessProfileJson, selectedModulesJson, onboardingCompleted]
    )).rows[0] || null
    if (synchronized) return synchronized
  }

  let rows: ProfileRow[] = []
  if (client) await client.query('SAVEPOINT profile_insert')
  try {
    const first = await query<ProfileRow>(
      `insert into public.profiles
         (id, email, login_whatsapp, login_whatsapp_verified_at, name, role, password_hash, business_profile, selected_modules, onboarding_completed, trial_starts_at, trial_ends_at, subscription_status)
       values
         ($1::uuid, $2, $3, case when $3::text is null then null else timezone('utc', now()) end, $4, $5::user_role, $6, $7::jsonb, $8::jsonb, $9::boolean, now(), now() + interval '15 days', 'trial')
       returning id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at,
                 business_profile, selected_modules, trial_starts_at, trial_ends_at, subscription_status, onboarding_completed`,
      [id, normalizedEmail, params.whatsapp || null, trimmedName, params.role, params.passwordHash, businessProfileJson, selectedModulesJson, onboardingCompleted]
    )
    rows = first.rows || []
    if (client) await client.query('RELEASE SAVEPOINT profile_insert')
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK TO SAVEPOINT profile_insert')
      await client.query('RELEASE SAVEPOINT profile_insert')
    }
    const code = String(error?.code || '').trim()
    const message = String(error?.message || '').toLowerCase()
    const missingEnum = code === '42704' || (message.includes('type') && message.includes('user_role') && message.includes('does not exist'))
    if (!missingEnum) throw error

    const fallback = await query<ProfileRow>(
      `insert into public.profiles
         (id, email, login_whatsapp, login_whatsapp_verified_at, name, role, password_hash, business_profile, selected_modules, onboarding_completed, trial_starts_at, trial_ends_at, subscription_status)
       values
         ($1::uuid, $2, $3, case when $3::text is null then null else timezone('utc', now()) end, $4, $5, $6, $7::jsonb, $8::jsonb, $9::boolean, now(), now() + interval '15 days', 'trial')
       returning id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at,
                 business_profile, selected_modules, trial_starts_at, trial_ends_at, subscription_status, onboarding_completed`,
      [id, normalizedEmail, params.whatsapp || null, trimmedName, params.role, params.passwordHash, businessProfileJson, selectedModulesJson, onboardingCompleted]
    )
    rows = fallback.rows || []
  }

  const created = rows[0]
  if (!created) throw new Error('Failed to create profile')
  return created
}

export const setLoginWhatsAppForUser = async (userId: string, whatsapp: string): Promise<ProfileRow | null> => {
  return pgOneOrNull<ProfileRow>(
    `update public.profiles
        set login_whatsapp = $1,
            login_whatsapp_verified_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
      where id = $2
        and login_whatsapp is null
      returning id, email, login_whatsapp, login_whatsapp_verified_at, name, avatar_url, role::text as role`,
    [whatsapp, userId]
  )
}

export const updateLastLoginAt = async (userId: string): Promise<void> => {
  await pgQuery(
    `update public.profiles
     set last_login_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
     where id = $1`,
    [userId]
  )
}

export const setResetTokenForEmail = async (
  email: string,
  tokenHash: string,
  expiresAtIso: string
): Promise<{ id: string; email: string } | null> => {
  const normalizedEmail = normalizeEmail(email)
  return pgOneOrNull<{ id: string; email: string }>(
    `update public.profiles
     set reset_token_hash = $1,
         reset_token_expires_at = $2::timestamptz,
         updated_at = timezone('utc', now())
     where lower(email) = $3
     returning id, email`,
    [tokenHash, expiresAtIso, normalizedEmail]
  )
}

export const getProfileByResetTokenHash = async (tokenHash: string): Promise<ProfileRow | null> => {
  const normalizedHash = String(tokenHash || '').trim()
  if (!normalizedHash) return null
  return pgOneOrNull<ProfileRow>(
    `select id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at
     from public.profiles
     where reset_token_hash = $1
       and reset_token_expires_at is not null
       and reset_token_expires_at > timezone('utc', now())
     limit 1`,
    [normalizedHash]
  )
}

export const updatePasswordForUser = async (userId: string, passwordHash: string): Promise<void> => {
  await pgQuery(
    `update public.profiles
     set password_hash = $1,
         reset_token_hash = null,
         reset_token_expires_at = null,
         updated_at = timezone('utc', now())
     where id = $2`,
    [passwordHash, userId]
  )
}

export const clearResetTokenForUser = async (userId: string): Promise<void> => {
  await pgQuery(
    `update public.profiles
     set reset_token_hash = null,
         reset_token_expires_at = null,
         updated_at = timezone('utc', now())
     where id = $1`,
    [userId]
  )
}
