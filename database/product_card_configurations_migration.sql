-- Configuracao interna dos cards de produto por usuario.
-- As coordenadas dos elementos sao relativas ao card (0..100%).

CREATE TABLE IF NOT EXISTS public.product_card_configurations (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_product_card_configurations_updated_at
  ON public.product_card_configurations(updated_at);
