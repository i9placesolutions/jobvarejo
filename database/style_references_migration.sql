-- ============================================================================
-- Migração: style_references
-- Acervo de inspirações visuais do usuário para geração de artes institucionais
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.style_references (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  s3_key TEXT NOT NULL,
  display_name TEXT,
  -- Análise de estilo feita por GPT-4o Vision no upload
  -- { palette: string[], style: string, elements: string[], layout: string, mood: string }
  style_analysis JSONB DEFAULT '{}',
  -- Tags para busca (ex: 'natal', 'pascoa', 'institucional', 'moderno')
  tags TEXT[] DEFAULT '{}',
  -- Quantas vezes foi usada como referência em gerações
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_style_refs_user_id ON public.style_references(user_id);
CREATE INDEX IF NOT EXISTS idx_style_refs_tags ON public.style_references USING GIN(tags);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_style_references_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_style_references_updated_at ON public.style_references;
CREATE TRIGGER trg_style_references_updated_at
  BEFORE UPDATE ON public.style_references
  FOR EACH ROW EXECUTE FUNCTION update_style_references_updated_at();
