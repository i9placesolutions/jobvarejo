-- ============================================================================
-- Migração: Adicionar campos de etiqueta de preço expandidos
-- Novos modos: x_per_y, installment, symbolic, club_price, anticipation, none
-- ============================================================================

ALTER TABLE builder_flyer_products ADD COLUMN IF NOT EXISTS installment_count INT;
ALTER TABLE builder_flyer_products ADD COLUMN IF NOT EXISTS installment_price NUMERIC(10,2);
ALTER TABLE builder_flyer_products ADD COLUMN IF NOT EXISTS no_interest BOOLEAN DEFAULT TRUE;
ALTER TABLE builder_flyer_products ADD COLUMN IF NOT EXISTS club_name TEXT;
ALTER TABLE builder_flyer_products ADD COLUMN IF NOT EXISTS anticipation_text TEXT;
ALTER TABLE builder_flyer_products ADD COLUMN IF NOT EXISTS show_discount BOOLEAN DEFAULT FALSE;
ALTER TABLE builder_flyer_products ADD COLUMN IF NOT EXISTS quantity_unit TEXT;
