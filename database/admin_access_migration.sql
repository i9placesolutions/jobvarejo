-- Perfis administrativos e permissões dos editores do JobVarejo.
-- Aplicar antes de habilitar a criação de editores na aplicação.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'editor';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS editor_permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_editor_permissions_object'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_editor_permissions_object
      CHECK (jsonb_typeof(editor_permissions) = 'object');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_customer_accounts_idx
  ON public.profiles (created_at DESC, id)
  WHERE role = 'user' AND is_active;
