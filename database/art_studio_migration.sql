-- Módulo isolado. Nenhuma tabela, trigger ou projeto dos editores de ofertas é alterado.
BEGIN;
CREATE TABLE IF NOT EXISTS public.art_studio_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.profiles(id),
 name text NOT NULL, category text NOT NULL, collection text NOT NULL DEFAULT '', tags text[] NOT NULL DEFAULT '{}',
 composition jsonb NOT NULL, published boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS art_studio_templates_catalog_idx ON public.art_studio_templates(published, category, updated_at DESC);
CREATE TABLE IF NOT EXISTS public.art_studio_designs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.profiles(id),
 name text NOT NULL, template_id text, composition jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS art_studio_designs_owner_idx ON public.art_studio_designs(owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS public.art_studio_assets (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES public.profiles(id), storage_key text NOT NULL UNIQUE,
 shared boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS art_studio_assets_owner_idx ON public.art_studio_assets(owner_id);
CREATE TABLE IF NOT EXISTS public.art_studio_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.profiles(id),
 template_id uuid NOT NULL REFERENCES public.art_studio_templates(id), action text NOT NULL,
 revision integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- A API Nitro usa conexão de serviço e autenticação JWT própria: não depende de auth.uid().
-- Não conceder acesso direto de navegador a estas tabelas; ownership aplicado em toda query privada.
COMMIT;
