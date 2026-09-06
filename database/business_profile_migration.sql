-- Perfil comercial nativo do JobVarejo.
-- Os dois editores usam estes dados; nao depende das tabelas legadas do Builder.

alter table public.profiles
  add column if not exists business_profile jsonb not null default '{}'::jsonb;
