-- ============================================================================
-- Builder de Encartes - Database Migration
-- Editor simplificado para clientes finais montarem seus encartes
-- ============================================================================

-- 1. Tenants (empresas/clientes do builder)
CREATE TABLE IF NOT EXISTS builder_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT,
    logo TEXT,
    logo_position JSONB DEFAULT '{}',
    slogan TEXT,
    phone TEXT,
    phone2 TEXT,
    whatsapp TEXT,
    instagram TEXT,
    facebook TEXT,
    website TEXT,
    address TEXT,
    payment_notes TEXT,
    cep TEXT,
    segment1 TEXT,
    segment2 TEXT,
    segment3 TEXT,
    show_on_portal BOOLEAN DEFAULT FALSE,
    plan TEXT DEFAULT 'free',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    reset_token_hash TEXT,
    reset_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_tenants_email ON builder_tenants ((LOWER(email)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_tenants_slug ON builder_tenants (slug) WHERE slug IS NOT NULL;

-- 2. Temas visuais
CREATE TABLE IF NOT EXISTS builder_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    thumbnail TEXT,
    background_image TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    category_name TEXT,
    tags TEXT[] DEFAULT '{}',
    css_config JSONB DEFAULT '{}',
    header_config JSONB DEFAULT '{}',
    body_config JSONB DEFAULT '{}',
    footer_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Modelos (formatos: Feed, Stories, A4, TV, etc.)
CREATE TABLE IF NOT EXISTS builder_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'SOCIAL',
    width INT NOT NULL,
    height INT NOT NULL,
    aspect_ratio TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Layouts (grades de produtos)
CREATE TABLE IF NOT EXISTS builder_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    products_per_page INT NOT NULL,
    columns INT NOT NULL,
    rows INT NOT NULL,
    grid_config JSONB DEFAULT '{}',
    highlight_positions INT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    model_id UUID REFERENCES builder_models(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Estilos de etiqueta de preco
CREATE TABLE IF NOT EXISTS builder_price_tag_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    thumbnail TEXT,
    css_config JSONB DEFAULT '{}',
    is_global BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Estilos de badge/selo
CREATE TABLE IF NOT EXISTS builder_badge_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    thumbnail TEXT,
    type TEXT NOT NULL DEFAULT 'PROMO',
    css_config JSONB DEFAULT '{}',
    is_global BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Configuracoes de fonte
CREATE TABLE IF NOT EXISTS builder_font_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    family TEXT NOT NULL,
    weight TEXT DEFAULT 'normal',
    style TEXT DEFAULT 'normal',
    google_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Catalogo de produtos por tenant
CREATE TABLE IF NOT EXISTS builder_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES builder_tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image TEXT,
    barcode TEXT,
    brand TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_products_tenant ON builder_products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_builder_products_name ON builder_products USING GIN (to_tsvector('portuguese', name));

-- 9. Encartes (flyers)
CREATE TABLE IF NOT EXISTS builder_flyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES builder_tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Novo Encarte',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    start_date DATE,
    end_date DATE,
    category TEXT,
    observations TEXT,
    custom_message TEXT,

    -- Display toggles
    show_dates BOOLEAN DEFAULT TRUE,
    show_stock_warning BOOLEAN DEFAULT FALSE,
    show_illustrative_note BOOLEAN DEFAULT TRUE,
    show_medicine_warning BOOLEAN DEFAULT FALSE,
    show_promo_phrase BOOLEAN DEFAULT FALSE,
    promo_phrase TEXT,
    publish_to_portal BOOLEAN DEFAULT FALSE,

    -- Company field toggles
    show_phone BOOLEAN DEFAULT TRUE,
    show_whatsapp BOOLEAN DEFAULT TRUE,
    show_phone_label BOOLEAN DEFAULT TRUE,
    show_company_name BOOLEAN DEFAULT TRUE,
    show_slogan BOOLEAN DEFAULT FALSE,
    show_payment_methods BOOLEAN DEFAULT FALSE,
    show_payment_notes BOOLEAN DEFAULT FALSE,
    show_address BOOLEAN DEFAULT TRUE,
    show_instagram BOOLEAN DEFAULT TRUE,
    show_facebook BOOLEAN DEFAULT FALSE,
    show_website BOOLEAN DEFAULT FALSE,

    -- Visual config
    text_size_mode TEXT DEFAULT 'MAXIMUM',
    product_box_style TEXT DEFAULT 'smart',
    color_mode TEXT DEFAULT 'smart',
    footer_style TEXT DEFAULT 'rounded_large',
    ink_economy INT DEFAULT 0,
    show_cover BOOLEAN DEFAULT FALSE,

    -- JSON configs
    font_config JSONB DEFAULT '{}',
    logo_position JSONB DEFAULT '{}',
    color_palette JSONB DEFAULT '{}',

    -- FK references
    theme_id UUID REFERENCES builder_themes(id) ON DELETE SET NULL,
    model_id UUID REFERENCES builder_models(id) ON DELETE SET NULL,
    layout_id UUID REFERENCES builder_layouts(id) ON DELETE SET NULL,
    price_tag_style_id UUID REFERENCES builder_price_tag_styles(id) ON DELETE SET NULL,
    badge_style_id UUID REFERENCES builder_badge_styles(id) ON DELETE SET NULL,

    -- Snapshot
    snapshot_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_flyers_tenant ON builder_flyers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_builder_flyers_status ON builder_flyers (tenant_id, status);

-- 10. Produtos no encarte
CREATE TABLE IF NOT EXISTS builder_flyer_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flyer_id UUID NOT NULL REFERENCES builder_flyers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES builder_products(id) ON DELETE SET NULL,
    position INT NOT NULL DEFAULT 0,

    custom_name TEXT,
    custom_image TEXT,
    offer_price NUMERIC(10,2),
    original_price NUMERIC(10,2),
    unit TEXT DEFAULT 'UN',
    observation TEXT,
    purchase_limit INT,

    -- Price mode (simple, from_to, x_per_y, take_pay, installment, symbolic, club_price, anticipation, none)
    price_mode TEXT DEFAULT 'simple',
    take_quantity INT,
    pay_quantity INT,
    installment_count INT,
    installment_price NUMERIC(10,2),
    no_interest BOOLEAN DEFAULT TRUE,
    club_name TEXT,
    anticipation_text TEXT,
    show_discount BOOLEAN DEFAULT FALSE,
    quantity_unit TEXT,

    -- Visual overrides
    is_highlight BOOLEAN DEFAULT FALSE,
    is_adult BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_price_pinned BOOLEAN DEFAULT FALSE,
    bg_opacity NUMERIC(3,2) DEFAULT 1.0,
    custom_lines JSONB DEFAULT '[]',

    -- Style overrides
    price_tag_style_id UUID REFERENCES builder_price_tag_styles(id) ON DELETE SET NULL,
    badge_style_id UUID REFERENCES builder_badge_styles(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_builder_flyer_products_flyer ON builder_flyer_products (flyer_id);
CREATE INDEX IF NOT EXISTS idx_builder_flyer_products_position ON builder_flyer_products (flyer_id, position);

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Modelos (formatos)
INSERT INTO builder_models (name, type, width, height, aspect_ratio, sort_order) VALUES
    ('Feed Facebook', 'SOCIAL', 1080, 1080, '1:1', 1),
    ('Stories', 'SOCIAL', 1080, 1920, '9:16', 2),
    ('Feed/Reels', 'SOCIAL', 1080, 1350, '4:5', 3),
    ('A4 Vertical', 'PRINT', 794, 1123, '210:297', 4),
    ('A4 Horizontal', 'PRINT', 1123, 794, '297:210', 5),
    ('Grande', 'PRINT', 1200, 1600, '3:4', 6),
    ('TV Horizontal', 'TV', 1920, 1080, '16:9', 7),
    ('TV Vertical', 'TV', 1080, 1920, '9:16', 8)
ON CONFLICT DO NOTHING;

-- Layouts (grades) — vinculados ao modelo Feed (1:1) como default
-- columns=0, rows=0 indica layout automático (calcula baseado na qtd de produtos)
INSERT INTO builder_layouts (name, products_per_page, columns, rows, sort_order, grid_config) VALUES
    ('Automatico', 0, 0, 0, 0, '{}'),
    ('1 Produto', 1, 1, 1, 1, '{}'),
    ('2 Produtos (1x2)', 2, 2, 1, 2, '{}'),
    ('2 Produtos (2x1)', 2, 1, 2, 3, '{}'),
    ('4 Produtos', 4, 2, 2, 4, '{}'),
    ('6 Produtos (3x2)', 6, 3, 2, 5, '{}'),
    ('6 Produtos (2x3)', 6, 2, 3, 6, '{}'),
    ('8 Produtos', 8, 4, 2, 7, '{}'),
    ('9 Produtos', 9, 3, 3, 8, '{}'),
    ('12 Produtos (4x3)', 12, 4, 3, 9, '{}'),
    ('12 Produtos (3x4)', 12, 3, 4, 10, '{}'),
    ('16 Produtos', 16, 4, 4, 11, '{}'),
    ('20 Produtos', 20, 5, 4, 12, '{}'),
    ('25 Produtos', 25, 5, 5, 13, '{}'),
    ('30 Produtos', 30, 6, 5, 14, '{}'),
    -- Layouts com destaque (highlight)
    ('5 - 1 Destaque Esq.', 5, 3, 2, 20, '{"columns":"2fr 1fr 1fr","rows":"1fr 1fr","areas":"\"d0 p1 p2\" \"d0 p3 p4\""}'),
    ('5 - 1 Destaque Dir.', 5, 3, 2, 21, '{"columns":"1fr 1fr 2fr","rows":"1fr 1fr","areas":"\"p1 p2 d0\" \"p3 p4 d0\""}'),
    ('5 - 1 Destaque Topo', 5, 4, 2, 22, '{"columns":"1fr 1fr 1fr 1fr","rows":"2fr 1fr","areas":"\"d0 d0 d0 d0\" \"p1 p2 p3 p4\""}'),
    ('6 - 2 Dest. Topo', 6, 4, 2, 23, '{"columns":"1fr 1fr 1fr 1fr","rows":"1.3fr 1fr","areas":"\"d0 d0 d1 d1\" \"p2 p3 p4 p5\""}'),
    ('7 - 3 Dest. Topo', 7, 3, 3, 24, '{"columns":"1fr 1fr 1fr","rows":"1.4fr 1fr 1fr","areas":"\"d0 d1 d2\" \"p3 p4 p5\" \"p6 . .\""}'),
    ('8 - 2 Dest. Topo', 8, 3, 3, 25, '{"columns":"1fr 1fr 1fr","rows":"1.5fr 1fr 1fr","areas":"\"d0 d0 d1\" \"p2 p3 p4\" \"p5 p6 p7\""}'),
    ('9 - 1 Dest. Centro', 9, 3, 3, 26, '{"columns":"1fr 2fr 1fr","rows":"1fr 1fr 1fr","areas":"\"p1 d0 p2\" \"p3 d0 p4\" \"p5 p6 p7\""}'),
    ('12 - 4 Dest. Topo', 12, 4, 3, 27, '{"columns":"1fr 1fr 1fr 1fr","rows":"1.5fr 1fr 1fr","areas":"\"d0 d1 d2 d3\" \"p4 p5 p6 p7\" \"p8 p9 p10 p11\""}')
ON CONFLICT DO NOTHING;

-- Price tag styles
INSERT INTO builder_price_tag_styles (name, css_config, sort_order) VALUES
    ('Vermelho Clássico', '{"bgColor": "#e53e3e", "textColor": "#ffffff", "shape": "rounded"}', 1),
    ('Azul', '{"bgColor": "#3182ce", "textColor": "#ffffff", "shape": "rounded"}', 2),
    ('Verde', '{"bgColor": "#38a169", "textColor": "#ffffff", "shape": "rounded"}', 3),
    ('Amarelo', '{"bgColor": "#ecc94b", "textColor": "#1a202c", "shape": "rounded"}', 4),
    ('Laranja', '{"bgColor": "#dd6b20", "textColor": "#ffffff", "shape": "rounded"}', 5),
    ('Preto', '{"bgColor": "#1a202c", "textColor": "#ffffff", "shape": "rounded"}', 6),
    ('Vermelho Pill', '{"bgColor": "#e53e3e", "textColor": "#ffffff", "shape": "pill"}', 7),
    ('Azul Quadrado', '{"bgColor": "#3182ce", "textColor": "#ffffff", "shape": "square"}', 8)
ON CONFLICT DO NOTHING;

-- Badge styles
INSERT INTO builder_badge_styles (name, type, css_config, sort_order) VALUES
    ('Promoção', 'PROMO', '{"bgColor": "#e53e3e", "textColor": "#ffffff", "text": "PROMOÇÃO", "position": "top-right"}', 1),
    ('Oferta', 'OFFER', '{"bgColor": "#dd6b20", "textColor": "#ffffff", "text": "OFERTA", "position": "top-right"}', 2),
    ('Novo', 'NEW', '{"bgColor": "#38a169", "textColor": "#ffffff", "text": "NOVO", "position": "top-right"}', 3),
    ('Destaque', 'FEATURED', '{"bgColor": "#ecc94b", "textColor": "#1a202c", "text": "DESTAQUE", "position": "top-right"}', 4)
ON CONFLICT DO NOTHING;

-- Font configs
INSERT INTO builder_font_configs (name, family, weight, style, google_url, sort_order) VALUES
    ('Roboto', 'Roboto', 'normal', 'normal', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap', 1),
    ('Roboto Bold', 'Roboto', 'bold', 'normal', 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap', 2),
    ('Open Sans', 'Open Sans', 'normal', 'normal', 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700;800&display=swap', 3),
    ('Montserrat', 'Montserrat', 'normal', 'normal', 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap', 4),
    ('Oswald', 'Oswald', 'normal', 'normal', 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap', 5),
    ('Poppins', 'Poppins', 'normal', 'normal', 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;700;900&display=swap', 6),
    ('Barlow', 'Barlow', 'normal', 'normal', 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;700;900&display=swap', 7),
    ('Nunito', 'Nunito', 'normal', 'normal', 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap', 8)
ON CONFLICT DO NOTHING;

-- Temas iniciais
INSERT INTO builder_themes (name, slug, category_name, sort_order, css_config, header_config, body_config, footer_config) VALUES
    ('Ofertas Vermelho', 'ofertas-vermelho', 'Ofertas', 1,
     '{"primaryColor": "#e53e3e", "secondaryColor": "#c53030", "bgColor": "#fff5f5", "textColor": "#1a202c", "borderRadius": "8px", "headerBg": "#c53030", "bodyBg": "#fff5f5", "footerBg": "#c53030", "accentColor": "#fed7d7"}',
     '{"layout": "center", "showLogo": true, "showDates": true, "showTitle": true, "height": 130}',
     '{"padding": 8, "gap": 4, "productCardStyle": "rounded"}',
     '{"showWatermark": false, "style": "default", "height": 70}'),

    ('Super Economia', 'super-economia', 'Ofertas', 2,
     '{"primaryColor": "#38a169", "secondaryColor": "#276749", "bgColor": "#f0fff4", "textColor": "#1a202c", "borderRadius": "8px", "headerBg": "#276749", "bodyBg": "#f0fff4", "footerBg": "#276749", "accentColor": "#c6f6d5"}',
     '{"layout": "center", "showLogo": true, "showDates": true, "showTitle": true, "height": 130}',
     '{"padding": 8, "gap": 4, "productCardStyle": "rounded"}',
     '{"showWatermark": false, "style": "default", "height": 70}'),

    ('Black Friday', 'black-friday', 'Black Friday', 3,
     '{"primaryColor": "#ecc94b", "secondaryColor": "#d69e2e", "bgColor": "#1a202c", "textColor": "#ffffff", "borderRadius": "4px", "headerBg": "#000000", "bodyBg": "#1a202c", "footerBg": "#000000", "accentColor": "#ecc94b"}',
     '{"layout": "center", "showLogo": true, "showDates": true, "showTitle": true, "height": 130}',
     '{"padding": 8, "gap": 4, "productCardStyle": "square"}',
     '{"showWatermark": false, "style": "default", "height": 70}'),

    ('Azul Moderno', 'azul-moderno', 'Ofertas', 4,
     '{"primaryColor": "#3182ce", "secondaryColor": "#2b6cb0", "bgColor": "#ebf8ff", "textColor": "#1a202c", "borderRadius": "12px", "headerBg": "#2b6cb0", "bodyBg": "#ebf8ff", "footerBg": "#2b6cb0", "accentColor": "#bee3f8"}',
     '{"layout": "center", "showLogo": true, "showDates": true, "showTitle": true, "height": 130}',
     '{"padding": 10, "gap": 6, "productCardStyle": "rounded"}',
     '{"showWatermark": false, "style": "default", "height": 70}'),

    ('Laranja Quente', 'laranja-quente', 'Ofertas', 5,
     '{"primaryColor": "#dd6b20", "secondaryColor": "#c05621", "bgColor": "#fffaf0", "textColor": "#1a202c", "borderRadius": "8px", "headerBg": "#c05621", "bodyBg": "#fffaf0", "footerBg": "#c05621", "accentColor": "#feebc8"}',
     '{"layout": "center", "showLogo": true, "showDates": true, "showTitle": true, "height": 130}',
     '{"padding": 8, "gap": 4, "productCardStyle": "rounded"}',
     '{"showWatermark": false, "style": "default", "height": 70}')
ON CONFLICT DO NOTHING;
