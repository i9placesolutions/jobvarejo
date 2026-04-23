-- Persist builder flyer general visual/configuration controls used by the UI.
-- Apply manually on existing databases.

ALTER TABLE public.builder_flyers
  ADD COLUMN IF NOT EXISTS custom_products_per_page INT,
  ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS custom_logo TEXT,
  ADD COLUMN IF NOT EXISTS logo_size INT DEFAULT 80,
  ADD COLUMN IF NOT EXISTS logo_x INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS logo_y INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS segments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS footer_bg TEXT,
  ADD COLUMN IF NOT EXISTS footer_text_color TEXT,
  ADD COLUMN IF NOT EXISTS footer_primary TEXT,
  ADD COLUMN IF NOT EXISTS footer_secondary TEXT,
  ADD COLUMN IF NOT EXISTS footer_show_logo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS footer_logo_size INT DEFAULT 52;
