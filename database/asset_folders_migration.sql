-- ===========================================
-- Asset Folders: persistência de "mover imagem para pasta"
-- OBRIGATÓRIO: Supabase Dashboard → SQL Editor → New query → colar tudo → Run.
-- Sem esta migration, mover imagens para pastas retorna 404 e NÃO persiste.
-- ===========================================

CREATE TABLE IF NOT EXISTS public.asset_folders (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, asset_key)
);

CREATE INDEX IF NOT EXISTS idx_asset_folders_user_id ON public.asset_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_folders_folder_id ON public.asset_folders(folder_id);

ALTER TABLE public.asset_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own asset_folders" ON public.asset_folders;
CREATE POLICY "Users can view own asset_folders"
  ON public.asset_folders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own asset_folders" ON public.asset_folders;
CREATE POLICY "Users can insert own asset_folders"
  ON public.asset_folders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own asset_folders" ON public.asset_folders;
CREATE POLICY "Users can update own asset_folders"
  ON public.asset_folders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own asset_folders" ON public.asset_folders;
CREATE POLICY "Users can delete own asset_folders"
  ON public.asset_folders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Confirma que a tabela existe (aparece no resultado do Run):
SELECT 'asset_folders criada/atualizada com sucesso' AS status;
