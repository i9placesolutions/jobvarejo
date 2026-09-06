-- ============================================================
-- Label templates: per-user catalog scope for built-in models
-- ============================================================
-- Built-in template IDs are canonical (tpl_default, tpl_red_burst, ...),
-- but the table primary key is global. Keep the canonical key separately so
-- each authenticated user can own/edit the same built-in model without a
-- primary-key collision with another user's catalog.

ALTER TABLE public.label_templates
  ADD COLUMN IF NOT EXISTS template_key text NULL;

CREATE UNIQUE INDEX IF NOT EXISTS label_templates_user_template_key_idx
  ON public.label_templates (user_id, template_key)
  WHERE template_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS label_templates_template_key_idx
  ON public.label_templates (template_key)
  WHERE template_key IS NOT NULL;
