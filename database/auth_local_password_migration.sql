-- ============================================================================
-- Local auth on PostgreSQL (without Supabase Auth)
-- ============================================================================
-- This migration adds password-based auth columns directly on public.profiles.
-- Run once on target PostgreSQL (Coolify).

alter table public.profiles
  add column if not exists password_hash text,
  add column if not exists reset_token_hash text,
  add column if not exists reset_token_expires_at timestamptz,
  add column if not exists last_login_at timestamptz;

create index if not exists idx_profiles_reset_token_hash
  on public.profiles (reset_token_hash);

create unique index if not exists idx_profiles_email_lower_unique
  on public.profiles ((lower(email)));
