-- Estruturas globais de zonas por quantidade de produtos (1..24).
-- A configuracao pertence ao usuario e e aplicada automaticamente no editor.

CREATE TABLE IF NOT EXISTS public.product_zone_structures (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  structures JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_product_zone_structures_updated_at
  ON public.product_zone_structures(updated_at);
