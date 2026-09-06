-- Matriz de compatibilidade dos temas com os formatos do Builder.
-- Lista vazia em model_ids significa "todos os formatos" e mantém temas legados
-- utilizáveis sem exigir uma atualização manual de cada registro.

ALTER TABLE public.builder_themes
  ADD COLUMN IF NOT EXISTS model_ids UUID[] DEFAULT '{}';

UPDATE public.builder_themes
SET model_ids = '{}'
WHERE model_ids IS NULL;

ALTER TABLE public.builder_themes
  ALTER COLUMN model_ids SET DEFAULT '{}';
