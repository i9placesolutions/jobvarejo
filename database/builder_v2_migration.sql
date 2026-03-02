-- ===========================================
-- Builder V2 (Client Locked Builder) Migration
-- Tokenized public session + audited submissions
-- ===========================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS builder_config jsonb NOT NULL DEFAULT jsonb_build_object(
    'enabled', false,
    'templates', '[]'::jsonb,
    'allowedFields', jsonb_build_array(
      'name',
      'brand',
      'priceUnit',
      'pricePack',
      'priceSpecialUnit',
      'priceSpecial',
      'specialCondition',
      'imageUrl',
      'packageLabel',
      'packQuantity',
      'packUnit'
    ),
    'maxProductsPerSubmit', 120,
    'multiTemplateMode', true
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'project_builder_token_status'
  ) THEN
    CREATE TYPE public.project_builder_token_status AS ENUM ('active', 'revoked', 'expired');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.project_builder_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NULL,
  status public.project_builder_token_status NOT NULL DEFAULT 'active',
  max_submissions int NULL,
  submissions_count int NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_project_builder_tokens_project_id ON public.project_builder_tokens(project_id);
CREATE INDEX IF NOT EXISTS idx_project_builder_tokens_status ON public.project_builder_tokens(status);
CREATE INDEX IF NOT EXISTS idx_project_builder_tokens_expires_at ON public.project_builder_tokens(expires_at);

CREATE TABLE IF NOT EXISTS public.project_builder_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token_id uuid NOT NULL REFERENCES public.project_builder_tokens(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet NULL,
  user_agent text NULL
);

CREATE INDEX IF NOT EXISTS idx_project_builder_submissions_project_id ON public.project_builder_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_builder_submissions_token_id ON public.project_builder_submissions(token_id);
CREATE INDEX IF NOT EXISTS idx_project_builder_submissions_submitted_at ON public.project_builder_submissions(submitted_at DESC);

CREATE OR REPLACE FUNCTION public.builder_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_builder_tokens_updated_at ON public.project_builder_tokens;
CREATE TRIGGER trg_project_builder_tokens_updated_at
  BEFORE UPDATE ON public.project_builder_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.builder_touch_updated_at();
