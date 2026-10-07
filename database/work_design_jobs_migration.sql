-- Piloto separado do WhatsApp. Aplicação manual; nenhum DDL ocorre no runtime.
BEGIN;
CREATE TABLE IF NOT EXISTS public.work_design_jobs (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  idempotency_key uuid NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','draft','completed','failed','cancelled')),
  request jsonb NOT NULL,
  business jsonb NOT NULL,
  source_revision text,
  source_snapshot jsonb,
  lease_token uuid,
  lease_until timestamptz,
  draft_layout jsonb,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS work_design_jobs_queue_idx ON public.work_design_jobs(owner_id, status, created_at);
COMMIT;
