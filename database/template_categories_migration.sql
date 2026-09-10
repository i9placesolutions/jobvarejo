-- Categorias para organizar os modelos de encarte reutilizáveis.
-- A categoria é guardada em projects.template_config.category, para que a
-- cópia do modelo preserve a classificação sem alterar os encartes existentes.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS template_config JSONB;

-- A biblioteca filtra modelos por usuário e categoria. Modelos antigos sem
-- categoria continuam válidos e aparecem em “Todas”.
CREATE INDEX IF NOT EXISTS idx_projects_user_template_category
  ON public.projects (
    user_id,
    lower(btrim(template_config ->> 'category'))
  )
  WHERE coalesce(is_template, false) = true
    AND nullif(btrim(template_config ->> 'category'), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_user_template_subcategory
  ON public.projects (
    user_id,
    lower(btrim(template_config ->> 'subcategory'))
  )
  WHERE coalesce(is_template, false) = true
    AND nullif(btrim(template_config ->> 'subcategory'), '') IS NOT NULL;

-- Catálogo independente: uma categoria pode existir antes de qualquer modelo.
-- `normalized_name` impede duplicatas como “Hortifruti” e “ hortifruti ” no
-- mesmo nível, mantendo a aparência original do nome em `name`.
CREATE TABLE IF NOT EXISTS public.flyer_template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  parent_id UUID REFERENCES public.flyer_template_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT flyer_template_categories_name_length
    CHECK (char_length(name) BETWEEN 1 AND 60),
  CONSTRAINT flyer_template_categories_normalized_name_length
    CHECK (char_length(normalized_name) BETWEEN 1 AND 60)
);

-- Compatibilidade com a primeira versão da tabela, que ainda era plana.
ALTER TABLE public.flyer_template_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'flyer_template_categories_parent_id_fkey'
      AND conrelid = 'public.flyer_template_categories'::regclass
  ) THEN
    ALTER TABLE public.flyer_template_categories
      ADD CONSTRAINT flyer_template_categories_parent_id_fkey
      FOREIGN KEY (parent_id)
      REFERENCES public.flyer_template_categories(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- A versão plana tinha unicidade global. Agora o mesmo nome pode existir em
-- categorias principais distintas, mas não pode duplicar dentro do mesmo pai.
ALTER TABLE public.flyer_template_categories
  DROP CONSTRAINT IF EXISTS flyer_template_categories_user_normalized_name_key;

DROP INDEX IF EXISTS public.flyer_template_categories_user_normalized_name_key;

CREATE INDEX IF NOT EXISTS idx_flyer_template_categories_user_name
  ON public.flyer_template_categories (user_id, name);

CREATE INDEX IF NOT EXISTS idx_flyer_template_categories_user_parent
  ON public.flyer_template_categories (user_id, parent_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_flyer_template_categories_root_name
  ON public.flyer_template_categories (user_id, normalized_name)
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flyer_template_categories_child_name
  ON public.flyer_template_categories (user_id, parent_id, normalized_name)
  WHERE parent_id IS NOT NULL;

-- O backend já filtra por user_id. As policies protegem a mesma fronteira
-- caso a tabela seja acessada pelo cliente autenticado via Supabase.
ALTER TABLE public.flyer_template_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own flyer template categories" ON public.flyer_template_categories;
CREATE POLICY "Users can view own flyer template categories"
  ON public.flyer_template_categories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own flyer template categories" ON public.flyer_template_categories;
CREATE POLICY "Users can insert own flyer template categories"
  ON public.flyer_template_categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own flyer template categories" ON public.flyer_template_categories;
CREATE POLICY "Users can update own flyer template categories"
  ON public.flyer_template_categories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own flyer template categories" ON public.flyer_template_categories;
CREATE POLICY "Users can delete own flyer template categories"
  ON public.flyer_template_categories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
