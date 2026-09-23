-- Login principal por WhatsApp com senha local já existente.
-- O número só pode ser associado após confirmar um código enviado ao próprio WhatsApp.

alter table public.profiles
  add column if not exists login_whatsapp text,
  add column if not exists login_whatsapp_verified_at timestamptz;

create unique index if not exists idx_profiles_login_whatsapp_unique
  on public.profiles (login_whatsapp)
  where login_whatsapp is not null;

create table if not exists public.auth_whatsapp_challenges (
  phone_e164 text not null,
  purpose text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  code_hash text not null,
  attempts smallint not null default 0 check (attempts >= 0 and attempts <= 5),
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default timezone('utc', now()),
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (phone_e164, purpose)
);

alter table public.auth_whatsapp_challenges
  drop constraint if exists auth_whatsapp_challenges_purpose_check;

alter table public.auth_whatsapp_challenges
  add constraint auth_whatsapp_challenges_purpose_check
  check (purpose in ('register', 'link', 'password_reset'));

create index if not exists idx_auth_whatsapp_challenges_expiry
  on public.auth_whatsapp_challenges (expires_at);
