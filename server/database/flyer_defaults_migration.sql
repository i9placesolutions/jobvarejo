-- Add flyer_defaults JSONB column to builder_tenants
-- Stores default configuration for new flyers (visibility toggles, payment methods, footer layout, etc.)
ALTER TABLE public.builder_tenants
  ADD COLUMN IF NOT EXISTS flyer_defaults JSONB DEFAULT NULL;

COMMENT ON COLUMN public.builder_tenants.flyer_defaults IS 'Default flyer configuration: show_* toggles, payment_methods, footer_layout, logo position/size, footer colors';

-- Add image crop fields to builder_flyer_products
ALTER TABLE public.builder_flyer_products
  ADD COLUMN IF NOT EXISTS image_zoom INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS image_x INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_y INT DEFAULT 0;
