-- ============================================================
-- Migração: Módulo de Integração com Canva
-- Descrição: Cria tabelas para gerenciar templates do Canva,
--            pastas de organização e cópias de designs dos clientes.
-- Data: 2026-04-02
-- ============================================================

-- ============================================================
-- 1. canva_templates — Templates disponíveis (cadastrados pelo admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS canva_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ID do design original no Canva (ex: DAGyAYxE4mk)
    canva_design_id TEXT NOT NULL,

    -- Título do template exibido para o cliente
    title TEXT NOT NULL,

    -- Descrição opcional do template
    description TEXT,

    -- Categoria do template (ex: 'carne', 'hortifruti', 'padaria', 'geral')
    category TEXT,

    -- URL da miniatura do template
    thumbnail_url TEXT,

    -- Quantidade de páginas do design
    page_count INTEGER DEFAULT 1,

    -- Quantidade de produtos por página em formato JSON (ex: {"1": 16, "2": 3})
    products_per_page JSONB,

    -- Padrão de preenchimento dos produtos (ex: 'name_with_unit', 'price_split')
    pattern TEXT,

    -- Se o template está ativo e visível para os clientes
    is_active BOOLEAN DEFAULT true,

    -- Ordem de exibição na listagem
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE canva_templates IS 'Templates do Canva cadastrados pelo admin, disponíveis para cópia pelos clientes';
COMMENT ON COLUMN canva_templates.canva_design_id IS 'ID do design original no Canva';
COMMENT ON COLUMN canva_templates.products_per_page IS 'Mapa de quantidade de produtos por página em JSON';
COMMENT ON COLUMN canva_templates.pattern IS 'Padrão de preenchimento dos campos de produto';

-- ============================================================
-- 2. canva_folders — Pastas de organização dos clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS canva_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant (cliente) dono da pasta
    tenant_id UUID NOT NULL REFERENCES builder_tenants(id) ON DELETE CASCADE,

    -- Nome da pasta
    name TEXT NOT NULL,

    -- Pasta pai para suporte a subpastas (NULL = pasta raiz)
    parent_id UUID REFERENCES canva_folders(id) ON DELETE CASCADE,

    -- Ordem de exibição dentro da pasta pai
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE canva_folders IS 'Pastas criadas pelos clientes para organizar suas cópias de designs do Canva';
COMMENT ON COLUMN canva_folders.parent_id IS 'Referência à pasta pai para suporte a subpastas (NULL indica pasta raiz)';

-- Índice composto para buscar pastas de um tenant dentro de uma pasta pai
CREATE INDEX IF NOT EXISTS idx_canva_folders_tenant_parent
    ON canva_folders (tenant_id, parent_id);

-- ============================================================
-- 3. canva_designs — Cópias de designs dos clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS canva_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant (cliente) dono da cópia
    tenant_id UUID NOT NULL REFERENCES builder_tenants(id) ON DELETE CASCADE,

    -- Template de origem (NULL se o template for removido)
    template_id UUID REFERENCES canva_templates(id) ON DELETE SET NULL,

    -- ID da CÓPIA do design no Canva (diferente do template original)
    canva_design_id TEXT NOT NULL,

    -- Pasta onde o design está organizado (NULL = raiz)
    folder_id UUID REFERENCES canva_folders(id) ON DELETE SET NULL,

    -- Título do design dado pelo cliente
    title TEXT NOT NULL,

    -- URL da miniatura do design
    thumbnail_url TEXT,

    -- URL para editar o design no Canva
    canva_edit_url TEXT,

    -- URL para visualizar o design no Canva
    canva_view_url TEXT,

    -- Status do design: DRAFT (rascunho), PUBLISHED (publicado), ARCHIVED (arquivado)
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),

    -- Quantidade de páginas do design
    page_count INTEGER DEFAULT 1,

    -- Data/hora da última sincronização com o Canva
    last_synced_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE canva_designs IS 'Cópias de designs do Canva pertencentes aos clientes (geradas a partir de templates)';
COMMENT ON COLUMN canva_designs.canva_design_id IS 'ID da cópia do design no Canva (diferente do ID do template original)';
COMMENT ON COLUMN canva_designs.status IS 'Status do design: DRAFT, PUBLISHED ou ARCHIVED';
COMMENT ON COLUMN canva_designs.last_synced_at IS 'Última vez que os dados foram sincronizados com a API do Canva';

-- Índice para buscar designs de um tenant
CREATE INDEX IF NOT EXISTS idx_canva_designs_tenant
    ON canva_designs (tenant_id);

-- Índice para buscar designs dentro de uma pasta
CREATE INDEX IF NOT EXISTS idx_canva_designs_folder
    ON canva_designs (folder_id);

-- Índice para buscar designs por template de origem
CREATE INDEX IF NOT EXISTS idx_canva_designs_template
    ON canva_designs (template_id);

-- Índice para filtrar designs por status
CREATE INDEX IF NOT EXISTS idx_canva_designs_status
    ON canva_designs (status);
