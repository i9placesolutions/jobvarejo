-- Composicao visual dos temas do Builder.
-- Coordenadas dos elementos sao percentuais do canvas para permitir reutilizar
-- a mesma composicao em Feed, Story, A4, cartaz e TV.

ALTER TABLE public.builder_themes
  ADD COLUMN IF NOT EXISTS composition JSONB DEFAULT '{}';

UPDATE public.builder_themes
SET composition = '{}'
WHERE composition IS NULL;

ALTER TABLE public.builder_themes
  ALTER COLUMN composition SET DEFAULT '{}';
