-- ============================================================================
-- Builder Section Templates - Templates dinamicos de header e footer
-- Admin cria layouts visuais, cliente apenas escolhe e preenche dados
-- ============================================================================

-- Header templates
CREATE TABLE IF NOT EXISTS builder_header_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    thumbnail TEXT,
    category TEXT DEFAULT 'geral',
    -- Altura do header em px (relativo ao modelo)
    height INT DEFAULT 200,
    -- Elementos posicionados (mesmo schema de CardTemplateElement)
    elements JSONB NOT NULL DEFAULT '[]',
    -- Estilos globais do container
    container_style JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Footer templates
CREATE TABLE IF NOT EXISTS builder_footer_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    thumbnail TEXT,
    category TEXT DEFAULT 'geral',
    -- Altura do footer em px
    height INT DEFAULT 180,
    -- Elementos posicionados
    elements JSONB NOT NULL DEFAULT '[]',
    -- Estilos globais do container
    container_style JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK nos flyers
ALTER TABLE builder_flyers ADD COLUMN IF NOT EXISTS
    header_template_id UUID REFERENCES builder_header_templates(id) ON DELETE SET NULL;

ALTER TABLE builder_flyers ADD COLUMN IF NOT EXISTS
    footer_template_id UUID REFERENCES builder_footer_templates(id) ON DELETE SET NULL;

-- ============================================================================
-- Seed: header templates
-- ============================================================================

INSERT INTO builder_header_templates (name, category, height, container_style, elements, sort_order) VALUES

('Simples com Logo', 'basico', 180,
 '{"bg":"var(--header-bg, #ffffff)","overflow":"hidden"}',
 '[
   {"id":"bg","type":"shape","slot":"","x":"0%","y":"0%","w":"100%","h":"100%","bg":"var(--header-bg, #ffffff)"},
   {"id":"logo","type":"image","slot":"logo","x":"35%","y":"15%","w":"30%","h":"70%","objectFit":"contain"}
 ]', 1),

('Logo + Titulo', 'basico', 200,
 '{"bg":"var(--header-bg, #1a1a2e)","overflow":"hidden"}',
 '[
   {"id":"bg","type":"shape","slot":"","x":"0%","y":"0%","w":"100%","h":"100%","bg":"linear-gradient(135deg, var(--primary, #e85d04), var(--secondary, #f48c06))"},
   {"id":"logo","type":"image","slot":"logo","x":"5%","y":"15%","w":"25%","h":"70%","objectFit":"contain"},
   {"id":"title","type":"text","slot":"company_name","x":"35%","y":"20%","w":"60%","h":"35%","fontSize":"auto","fontWeight":900,"textAlign":"left","textTransform":"uppercase","color":"#ffffff"},
   {"id":"slogan","type":"text","slot":"slogan","x":"35%","y":"58%","w":"60%","h":"20%","fontSize":"14px","fontWeight":400,"textAlign":"left","color":"rgba(255,255,255,0.8)","showIf":"has_value"}
 ]', 2),

('Banner Grande', 'destaque', 250,
 '{"bg":"#000000","overflow":"hidden"}',
 '[
   {"id":"bgimg","type":"image","slot":"background_image","x":"0%","y":"0%","w":"100%","h":"100%","objectFit":"cover","opacity":0.7},
   {"id":"overlay","type":"shape","slot":"","x":"0%","y":"50%","w":"100%","h":"50%","bg":"linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))"},
   {"id":"logo","type":"image","slot":"logo","x":"3%","y":"10%","w":"20%","h":"40%","objectFit":"contain","zIndex":5},
   {"id":"title","type":"text","slot":"company_name","x":"5%","y":"55%","w":"90%","h":"25%","fontSize":"auto","fontWeight":900,"textAlign":"center","color":"#ffffff","textTransform":"uppercase","zIndex":5},
   {"id":"promo","type":"text","slot":"promo_phrase","x":"10%","y":"80%","w":"80%","h":"15%","fontSize":"16px","fontWeight":700,"textAlign":"center","color":"var(--primary, #f48c06)","showIf":"has_value","zIndex":5}
 ]', 3),

('Minimalista', 'moderno', 120,
 '{"bg":"var(--header-bg, #ffffff)","overflow":"hidden"}',
 '[
   {"id":"line","type":"shape","slot":"","x":"0%","y":"95%","w":"100%","h":"5%","bg":"linear-gradient(90deg, var(--primary, #e85d04), var(--secondary, #f48c06))"},
   {"id":"logo","type":"image","slot":"logo","x":"38%","y":"10%","w":"24%","h":"80%","objectFit":"contain"}
 ]', 4)

ON CONFLICT DO NOTHING;

-- ============================================================================
-- Seed: footer templates
-- ============================================================================

INSERT INTO builder_footer_templates (name, category, height, container_style, elements, sort_order) VALUES

('Classico Supermercado', 'basico', 180,
 '{"bg":"#1a1a2e","overflow":"hidden"}',
 '[
   {"id":"accent","type":"shape","slot":"","x":"0%","y":"0%","w":"100%","h":"2%","bg":"linear-gradient(90deg, var(--primary, #e85d04), var(--secondary, #f48c06))"},
   {"id":"social_bar","type":"shape","slot":"","x":"0%","y":"2%","w":"100%","h":"18%","bg":"rgba(0,0,0,0.3)"},
   {"id":"whatsapp","type":"text","slot":"whatsapp","x":"25%","y":"4%","w":"50%","h":"14%","fontSize":"12px","fontWeight":700,"textAlign":"center","color":"#ffffff","showIf":"has_value"},
   {"id":"main_bar","type":"shape","slot":"","x":"0%","y":"20%","w":"100%","h":"50%","bg":"linear-gradient(90deg, var(--primary, #e85d04), var(--secondary, #f48c06))"},
   {"id":"logo","type":"image","slot":"logo","x":"3%","y":"24%","w":"18%","h":"42%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"company_name","x":"24%","y":"25%","w":"40%","h":"20%","fontSize":"auto","fontWeight":900,"textAlign":"left","textTransform":"uppercase","color":"#ffffff"},
   {"id":"address","type":"text","slot":"address","x":"24%","y":"46%","w":"40%","h":"12%","fontSize":"10px","color":"rgba(255,255,255,0.8)","textAlign":"left","showIf":"has_value"},
   {"id":"payments","type":"text","slot":"payments","x":"68%","y":"25%","w":"30%","h":"40%","fontSize":"9px","color":"#ffffff","textAlign":"center"},
   {"id":"date_bar","type":"shape","slot":"","x":"0%","y":"70%","w":"100%","h":"16%","bg":"rgba(0,0,0,0.2)"},
   {"id":"validity","type":"text","slot":"validity","x":"5%","y":"72%","w":"90%","h":"12%","fontSize":"12px","fontWeight":700,"textAlign":"center","color":"#ffffff","showIf":"has_value"},
   {"id":"disclaimer","type":"text","slot":"disclaimer","x":"5%","y":"88%","w":"90%","h":"10%","fontSize":"8px","color":"rgba(255,255,255,0.35)","textAlign":"center","fontStyle":"italic"}
 ]', 1),

('Moderno Glass', 'moderno', 200,
 '{"bg":"linear-gradient(160deg, #1a1a2e, #2d2d4e)","overflow":"hidden"}',
 '[
   {"id":"accent","type":"shape","slot":"","x":"0%","y":"0%","w":"100%","h":"2%","bg":"linear-gradient(90deg, var(--primary, #e85d04), var(--secondary, #f48c06))"},
   {"id":"logo","type":"image","slot":"logo","x":"35%","y":"5%","w":"30%","h":"22%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"company_name","x":"10%","y":"28%","w":"80%","h":"12%","fontSize":"auto","fontWeight":900,"textAlign":"center","textTransform":"uppercase","color":"#ffffff"},
   {"id":"underline","type":"shape","slot":"","x":"40%","y":"41%","w":"20%","h":"1%","bg":"linear-gradient(90deg, var(--primary), var(--secondary))","borderRadius":"2px"},
   {"id":"card_wpp","type":"shape","slot":"","x":"5%","y":"46%","w":"28%","h":"24%","bg":"linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))","borderRadius":"16px","boxShadow":"0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)"},
   {"id":"whatsapp","type":"text","slot":"whatsapp","x":"7%","y":"51%","w":"24%","h":"14%","fontSize":"14px","fontWeight":700,"textAlign":"center","color":"#ffffff","showIf":"has_value"},
   {"id":"card_addr","type":"shape","slot":"","x":"36%","y":"46%","w":"28%","h":"24%","bg":"linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))","borderRadius":"16px","boxShadow":"0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)"},
   {"id":"address","type":"text","slot":"address","x":"38%","y":"49%","w":"24%","h":"18%","fontSize":"10px","color":"rgba(255,255,255,0.85)","textAlign":"center","showIf":"has_value"},
   {"id":"card_hours","type":"shape","slot":"","x":"67%","y":"46%","w":"28%","h":"24%","bg":"linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))","borderRadius":"16px","boxShadow":"0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)"},
   {"id":"hours","type":"text","slot":"hours","x":"69%","y":"52%","w":"24%","h":"14%","fontSize":"10px","color":"rgba(255,255,255,0.85)","textAlign":"center","showIf":"has_value"},
   {"id":"payments","type":"text","slot":"payments","x":"15%","y":"74%","w":"70%","h":"10%","fontSize":"9px","color":"rgba(255,255,255,0.5)","textAlign":"center"},
   {"id":"disclaimer","type":"text","slot":"disclaimer","x":"5%","y":"88%","w":"90%","h":"10%","fontSize":"8px","color":"rgba(255,255,255,0.3)","textAlign":"center","fontStyle":"italic"}
 ]', 2),

('Banner Impacto', 'destaque', 190,
 '{"bg":"#1a1a2e","overflow":"hidden"}',
 '[
   {"id":"diagonal","type":"shape","slot":"","x":"0%","y":"0%","w":"100%","h":"8%","bg":"var(--primary, #e85d04)"},
   {"id":"hero","type":"shape","slot":"","x":"0%","y":"8%","w":"100%","h":"55%","bg":"linear-gradient(90deg, var(--primary, #e85d04), var(--secondary, #f48c06))"},
   {"id":"circle","type":"shape","slot":"","x":"80%","y":"0%","w":"25%","h":"40%","bg":"rgba(255,255,255,0.06)","borderRadius":"50%"},
   {"id":"logo","type":"image","slot":"logo","x":"3%","y":"12%","w":"15%","h":"46%","objectFit":"contain","zIndex":5},
   {"id":"name","type":"text","slot":"company_name","x":"20%","y":"14%","w":"45%","h":"20%","fontSize":"auto","fontWeight":900,"textAlign":"left","textTransform":"uppercase","color":"#ffffff","zIndex":5},
   {"id":"address","type":"text","slot":"address","x":"20%","y":"35%","w":"45%","h":"12%","fontSize":"10px","color":"rgba(255,255,255,0.8)","textAlign":"left","showIf":"has_value","zIndex":5},
   {"id":"wpp_box","type":"shape","slot":"","x":"68%","y":"14%","w":"29%","h":"42%","bg":"rgba(0,0,0,0.25)","borderRadius":"16px","zIndex":4},
   {"id":"whatsapp","type":"text","slot":"whatsapp","x":"70%","y":"24%","w":"25%","h":"18%","fontSize":"20px","fontWeight":800,"textAlign":"center","color":"#ffffff","zIndex":5,"showIf":"has_value"},
   {"id":"strip","type":"shape","slot":"","x":"0%","y":"63%","w":"100%","h":"18%","bg":"rgba(0,0,0,0.15)"},
   {"id":"social","type":"text","slot":"social","x":"5%","y":"65%","w":"40%","h":"14%","fontSize":"10px","color":"rgba(255,255,255,0.7)","textAlign":"left","showIf":"has_value"},
   {"id":"payments","type":"text","slot":"payments","x":"55%","y":"65%","w":"40%","h":"14%","fontSize":"9px","color":"rgba(255,255,255,0.6)","textAlign":"right"},
   {"id":"validity","type":"text","slot":"validity","x":"5%","y":"82%","w":"90%","h":"8%","fontSize":"12px","fontWeight":800,"textAlign":"center","color":"#ffffff","showIf":"has_value"},
   {"id":"disclaimer","type":"text","slot":"disclaimer","x":"5%","y":"91%","w":"90%","h":"8%","fontSize":"8px","color":"rgba(255,255,255,0.3)","textAlign":"center"}
 ]', 3),

('Elegante Fino', 'premium', 160,
 '{"bg":"linear-gradient(160deg, #1a1a2e, #2a2a3e)","overflow":"hidden"}',
 '[
   {"id":"line1","type":"shape","slot":"","x":"0%","y":"0%","w":"100%","h":"1.5%","bg":"linear-gradient(90deg, var(--primary), var(--secondary))"},
   {"id":"line2","type":"shape","slot":"","x":"0%","y":"2.5%","w":"100%","h":"0.5%","bg":"rgba(232,93,4,0.3)"},
   {"id":"logo","type":"image","slot":"logo","x":"3%","y":"12%","w":"18%","h":"55%","objectFit":"contain"},
   {"id":"divider1","type":"shape","slot":"","x":"23%","y":"15%","w":"0.3%","h":"50%","bg":"linear-gradient(180deg, transparent, var(--primary), transparent)"},
   {"id":"name","type":"text","slot":"company_name","x":"26%","y":"15%","w":"40%","h":"18%","fontSize":"auto","fontWeight":900,"textAlign":"left","textTransform":"uppercase","color":"#ffffff"},
   {"id":"namesub","type":"shape","slot":"","x":"26%","y":"34%","w":"30%","h":"0.5%","bg":"linear-gradient(90deg, transparent, rgba(232,93,4,0.5), transparent)"},
   {"id":"address","type":"text","slot":"address","x":"26%","y":"38%","w":"40%","h":"12%","fontSize":"10px","color":"rgba(255,255,255,0.6)","textAlign":"left","showIf":"has_value"},
   {"id":"hours","type":"text","slot":"hours","x":"26%","y":"52%","w":"40%","h":"10%","fontSize":"9px","color":"rgba(255,255,255,0.45)","textAlign":"left","showIf":"has_value"},
   {"id":"divider2","type":"shape","slot":"","x":"68%","y":"15%","w":"0.3%","h":"50%","bg":"linear-gradient(180deg, transparent, var(--primary), transparent)"},
   {"id":"whatsapp","type":"text","slot":"whatsapp","x":"71%","y":"18%","w":"26%","h":"16%","fontSize":"13px","fontWeight":700,"color":"#ffffff","textAlign":"left","showIf":"has_value"},
   {"id":"social","type":"text","slot":"social","x":"71%","y":"38%","w":"26%","h":"24%","fontSize":"10px","color":"rgba(255,255,255,0.6)","textAlign":"left","showIf":"has_value"},
   {"id":"pay_line","type":"shape","slot":"","x":"10%","y":"72%","w":"80%","h":"0.5%","bg":"linear-gradient(90deg, transparent, rgba(232,93,4,0.25), transparent)"},
   {"id":"payments","type":"text","slot":"payments","x":"15%","y":"76%","w":"70%","h":"10%","fontSize":"8px","color":"rgba(255,255,255,0.35)","textAlign":"center"},
   {"id":"disclaimer","type":"text","slot":"disclaimer","x":"5%","y":"88%","w":"90%","h":"10%","fontSize":"8px","color":"rgba(255,255,255,0.25)","textAlign":"center"}
 ]', 4)

ON CONFLICT DO NOTHING;
