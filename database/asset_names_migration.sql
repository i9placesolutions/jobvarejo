-- ===========================================
-- Asset Names: persistência de "renomear imagem"
-- OBRIGATÓRIO: Supabase Dashboard → SQL Editor → New query → colar tudo → Run.
-- Sem esta migration, renomear imagens retorna 404 e NÃO persiste.
-- ===========================================

-- Persist custom display names for Wasabi assets (per user).
-- Use this when users want to rename uploaded images and keep the name after reload.

CREATE TABLE IF NOT EXISTS public.asset_names (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, asset_key)
);

CREATE INDEX IF NOT EXISTS idx_asset_names_user_id ON public.asset_names(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_names_asset_key ON public.asset_names(asset_key);

ALTER TABLE public.asset_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own asset_names" ON public.asset_names;
CREATE POLICY "Users can view own asset_names"
  ON public.asset_names FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own asset_names" ON public.asset_names;
CREATE POLICY "Users can insert own asset_names"
  ON public.asset_names FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own asset_names" ON public.asset_names;
CREATE POLICY "Users can update own asset_names"
  ON public.asset_names FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own asset_names" ON public.asset_names;
CREATE POLICY "Users can delete own asset_names"
  ON public.asset_names FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

SELECT 'asset_names criada/atualizada com sucesso' AS status;

-- Force PostgREST to reload schema cache (helps avoid transient 404s after DDL)
SELECT pg_notify('pgrst', 'reload schema');
