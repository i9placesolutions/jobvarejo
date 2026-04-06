ALTER TABLE public.builder_flyer_products
  ADD COLUMN IF NOT EXISTS extra_images_layout TEXT DEFAULT 'auto';

UPDATE public.builder_flyer_products
SET extra_images_layout = 'auto'
WHERE extra_images_layout IS NULL;

COMMENT ON COLUMN public.builder_flyer_products.extra_images_layout IS 'Layout das imagens duplicadas do produto: auto, horizontal ou vertical';
