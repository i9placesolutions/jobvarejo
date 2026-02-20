import { randomUUID } from 'node:crypto'
import type { UserRole } from '~/types/auth'
import { pgOneOrNull, pgQuery } from './postgres'

type ProfileRow = {
  id: string
  email: string
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
      add column if not exists last_login_at timestamptz
  `)

  await pgQuery(`
    create index if not exists idx_profiles_reset_token_hash
      on public.profiles (reset_token_hash)
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
    `select id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at
     from public.profiles
     where lower(email) = $1
     limit 1`,
    [normalized]
  )
}

export const getProfileById = async (id: string): Promise<ProfileRow | null> => {
  const normalized = String(id || '').trim()
  if (!normalized) return null
  return pgOneOrNull<ProfileRow>(
    `select id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at
     from public.profiles
     where id = $1
     limit 1`,
    [normalized]
  )
}

export const createProfileWithPassword = async (params: {
  name: string
  email: string
  passwordHash: string
  role: UserRole
}): Promise<ProfileRow> => {
  const id = randomUUID()
  const normalizedEmail = normalizeEmail(params.email)
  const trimmedName = String(params.name || '').trim()

  let rows: ProfileRow[] = []
  try {
    const first = await pgQuery<ProfileRow>(
      `insert into public.profiles
         (id, email, name, role, password_hash)
       values
         ($1::uuid, $2, $3, $4::user_role, $5)
       returning id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at`,
      [id, normalizedEmail, trimmedName, params.role, params.passwordHash]
    )
    rows = first.rows || []
  } catch (error: any) {
    const code = String(error?.code || '').trim()
    const message = String(error?.message || '').toLowerCase()
    const missingEnum = code === '42704' || (message.includes('type') && message.includes('user_role') && message.includes('does not exist'))
    if (!missingEnum) throw error

    const fallback = await pgQuery<ProfileRow>(
      `insert into public.profiles
         (id, email, name, role, password_hash)
       values
         ($1::uuid, $2, $3, $4, $5)
       returning id, email, name, avatar_url, role::text as role, password_hash, reset_token_hash, reset_token_expires_at`,
      [id, normalizedEmail, trimmedName, params.role, params.passwordHash]
    )
    rows = fallback.rows || []
  }

  const created = rows[0]
  if (!created) throw new Error('Failed to create profile')
  return created
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
