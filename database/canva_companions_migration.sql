-- Tabela de vinculação entre templates companions (Feed ↔ Story)
CREATE TABLE IF NOT EXISTS canva_template_companions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES canva_templates(id) ON DELETE CASCADE,
    companion_id UUID NOT NULL REFERENCES canva_templates(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Story', -- texto exibido: "Aproveite e faça para Story também!"
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_id, companion_id)
);

COMMENT ON TABLE canva_template_companions IS 'Vincula templates que devem ser sugeridos juntos (ex: Feed sugere Story)';
CREATE INDEX IF NOT EXISTS idx_canva_companions_template ON canva_template_companions(template_id);
