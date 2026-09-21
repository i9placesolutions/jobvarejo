-- Área independente. Nenhuma alteração em projects, profiles ou radio_*.
BEGIN;
CREATE TABLE IF NOT EXISTS public.video_studio_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
 title text NOT NULL, document jsonb NOT NULL, script_source text NOT NULL DEFAULT '', revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id)
);
CREATE INDEX IF NOT EXISTS video_studio_projects_owner ON public.video_studio_projects(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS public.video_studio_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('image','music','voice','render')), name text NOT NULL, storage_key text NOT NULL UNIQUE,
 content_type text NOT NULL, bytes bigint NOT NULL, duration double precision, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS video_studio_assets_owner ON public.video_studio_assets(user_id,kind,created_at DESC);
CREATE TABLE IF NOT EXISTS public.video_studio_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, project_id uuid NOT NULL, revision integer NOT NULL,
 kind text NOT NULL CHECK(kind IN ('voice','render','music')), fingerprint text NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','ready','failed')),
 payload jsonb NOT NULL, result jsonb NOT NULL DEFAULT '{}', provider_state jsonb NOT NULL DEFAULT '{}',
 progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100), error text,
 lease_token uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(project_id,user_id) REFERENCES public.video_studio_projects(id,user_id)
);
CREATE INDEX IF NOT EXISTS video_studio_jobs_owner ON public.video_studio_jobs(user_id,project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS video_studio_jobs_queue ON public.video_studio_jobs(status,created_at) WHERE status IN ('queued','running');
CREATE UNIQUE INDEX IF NOT EXISTS video_studio_jobs_dedup ON public.video_studio_jobs(user_id,project_id,kind,fingerprint) WHERE status IN ('queued','running','ready');
CREATE TABLE IF NOT EXISTS public.video_studio_workers (id text PRIMARY KEY, heartbeat_at timestamptz NOT NULL DEFAULT now());
-- JWT próprio: acesso somente pelo servidor/worker. Sem políticas públicas permissivas.
ALTER TABLE public.video_studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_studio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_studio_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_studio_workers ENABLE ROW LEVEL SECURITY;
COMMIT;
-- Rollback operacional: desativar o worker e a rota. Preservar dados; não excluir tabelas automaticamente.
