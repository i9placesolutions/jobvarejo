-- ===========================================
-- Label Templates (Price Tag Models) Table
-- Run this in your Supabase SQL Editor
-- ===========================================

CREATE TABLE IF NOT EXISTS public.label_templates (
  id text PRIMARY KEY,
  user_id uuid NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'priceGroup-v1',
  "group" jsonb NOT NULL,
  preview_data_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS label_templates_user_id_idx ON public.label_templates(user_id);

-- Optional: keep updated_at in sync (Supabase supports this via triggers too).
-- This lightweight trigger works in vanilla Postgres.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'label_templates_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    CREATE TRIGGER label_templates_set_updated_at
    BEFORE UPDATE ON public.label_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

