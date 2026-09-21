-- Editor Cartazista: módulo isolado dos projetos, encartes e do Estúdio de Artes.
-- Aplicação manual: esta migração não é executada automaticamente pelo Nitro.
BEGIN;

CREATE TABLE IF NOT EXISTS public.cartazista_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  model_key text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  composition jsonb,
  published boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cartazista_templates_model_key_idx
  ON public.cartazista_templates(model_key, owner_id);
CREATE INDEX IF NOT EXISTS cartazista_templates_catalog_idx
  ON public.cartazista_templates(published, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.cartazista_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL,
  state jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cartazista_designs_owner_idx
  ON public.cartazista_designs(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.cartazista_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  template_id uuid REFERENCES public.cartazista_templates(id),
  action text NOT NULL,
  revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
