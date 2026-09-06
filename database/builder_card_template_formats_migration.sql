-- Matriz de compatibilidade dos templates de card com os formatos do Builder.
-- Lista vazia em model_ids significa "todos os formatos" e mantém templates
-- legados utilizáveis sem exigir uma atualização manual de cada registro.

ALTER TABLE public.builder_card_templates
  ADD COLUMN IF NOT EXISTS model_ids UUID[] DEFAULT '{}';

UPDATE public.builder_card_templates
SET model_ids = '{}'
WHERE model_ids IS NULL;

ALTER TABLE public.builder_card_templates
  ALTER COLUMN model_ids SET DEFAULT '{}';
