import { randomUUID } from 'node:crypto'
import type { UserRole } from '~/types/auth'
import { pgOneOrNull, pgQuery } from './postgres'

type ProfileRow = {
  id: string
  email: string
  login_whatsapp?: string | null
  login_whatsapp_verified_at?: string | null
  name: string | null
  avatar_url: string | null
  role: UserRole
  password_hash?: string | null
  reset_token_hash?: string | null
  reset_token_expires_at?: string | null
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
      add column if not exists login_whatsapp_verified_at timestamptz
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
    `select id, email, login_whatsapp, login_whatsapp_verified_at, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at
     from public.profiles
     where id = $1
     limit 1`,
    [normalized]
  )
}

export const createProfileWithPassword = async (params: {
  name: string
  email: string
  whatsapp?: string | null
  passwordHash: string
  role: UserRole
}): Promise<ProfileRow> => {
  const id = randomUUID()
  const normalizedEmail = normalizeEmail(params.email)
  const trimmedName = String(params.name || '').trim()

  // Esta instalação mantém public.profiles ligado a auth.users por uma FK.
  // Criar primeiro a identidade do Supabase deixa o trigger criar o perfil e
  // mantém o fluxo de cadastro próprio do JobVarejo compatível com os dois
  // formatos de banco (com ou sem schema auth).
  let authUserCreated = false
  try {
    await pgQuery(
      `insert into auth.users
        (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1::uuid, 'authenticated', 'authenticated', $2, now(), $3::jsonb, $4::jsonb, now(), now())
       on conflict (id) do nothing`,
      [id, normalizedEmail, JSON.stringify({ provider: 'jobvarejo' }), JSON.stringify({ name: trimmedName, email: normalizedEmail })]
    )
    authUserCreated = true
  } catch (error: any) {
    const code = String(error?.code || '')
    const message = String(error?.message || '').toLowerCase()
    const authUnavailable = code === '42P01' || code === '3F000' || message.includes('schema "auth"') || message.includes('relation "auth.users"')
    if (!authUnavailable) throw error
  }

  if (authUserCreated) {
    const synchronized = await pgOneOrNull<ProfileRow>(
      `update public.profiles
          set email = $2, login_whatsapp = $3,
              login_whatsapp_verified_at = case when $3 is null then null else timezone('utc', now()) end,
              name = $4, role = $5::user_role, password_hash = $6, updated_at = timezone('utc', now())
        where id = $1
        returning id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at`,
      [id, normalizedEmail, params.whatsapp || null, trimmedName, params.role, params.passwordHash]
    )
    if (synchronized) return synchronized
  }

  let rows: ProfileRow[] = []
  try {
    const first = await pgQuery<ProfileRow>(
      `insert into public.profiles
         (id, email, login_whatsapp, login_whatsapp_verified_at, name, role, password_hash)
       values
         ($1::uuid, $2, $3, case when $3 is null then null else timezone('utc', now()) end, $4, $5::user_role, $6)
       returning id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at`,
      [id, normalizedEmail, params.whatsapp || null, trimmedName, params.role, params.passwordHash]
    )
    rows = first.rows || []
  } catch (error: any) {
    const code = String(error?.code || '').trim()
    const message = String(error?.message || '').toLowerCase()
    const missingEnum = code === '42704' || (message.includes('type') && message.includes('user_role') && message.includes('does not exist'))
    if (!missingEnum) throw error

    const fallback = await pgQuery<ProfileRow>(
      `insert into public.profiles
         (id, email, login_whatsapp, login_whatsapp_verified_at, name, role, password_hash)
       values
         ($1::uuid, $2, $3, case when $3 is null then null else timezone('utc', now()) end, $4, $5, $6)
       returning id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at`,
      [id, normalizedEmail, params.whatsapp || null, trimmedName, params.role, params.passwordHash]
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
