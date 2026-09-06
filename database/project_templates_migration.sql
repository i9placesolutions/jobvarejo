-- Modelos de encarte reutilizaveis.
-- Sao projetos Fabric marcados como template: a edicao avancada monta o layout,
-- a edicao rapida instancia uma copia e so preenche os produtos.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS template_config JSONB;

CREATE INDEX IF NOT EXISTS idx_projects_user_template
  ON public.projects (user_id, is_template)
  WHERE is_template = true;
