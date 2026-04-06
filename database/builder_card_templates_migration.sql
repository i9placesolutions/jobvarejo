-- ============================================================================
-- Builder Card Templates - Templates dinamicos de card de produto
-- Admin cria templates visuais, cliente apenas escolhe e preenche dados
-- ============================================================================

CREATE TABLE IF NOT EXISTS builder_card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    thumbnail TEXT,
    category TEXT DEFAULT 'geral',
    -- Definicao dos elementos posicionados (array de CardTemplateElement)
    elements JSONB NOT NULL DEFAULT '[]',
    -- Estilos globais do card (fundo, borda, sombra, overflow)
    card_style JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK no flyer para associar um card template
ALTER TABLE builder_flyers ADD COLUMN IF NOT EXISTS
    card_template_id UUID REFERENCES builder_card_templates(id) ON DELETE SET NULL;

-- ============================================================================
-- Seed: templates iniciais convertidos dos layouts hardcoded
-- ============================================================================

INSERT INTO builder_card_templates (name, category, card_style, elements, sort_order) VALUES

-- 1. Classico (nome topo, imagem centro, preco base)
('Classico', 'basico',
 '{"bg":"var(--card-bg, #ffffff)","borderRadius":"8px","overflow":"hidden","boxShadow":"0 1px 4px rgba(0,0,0,0.08)"}',
 '[
   {"id":"badge","type":"badge","slot":"badge","x":"0%","y":"0%","w":"35%","h":"12%","showIf":"has_value","zIndex":10},
   {"id":"name","type":"text","slot":"product_name","x":"4%","y":"2%","w":"92%","h":"18%","fontSize":"auto","fontWeight":800,"textAlign":"center","textTransform":"uppercase","color":"inherit","overflow":"hidden"},
   {"id":"img","type":"image","slot":"product_image","x":"5%","y":"22%","w":"90%","h":"48%","objectFit":"contain"},
   {"id":"price","type":"price","slot":"offer_price","x":"5%","y":"72%","w":"90%","h":"22%","fontSize":"auto"},
   {"id":"unit","type":"unit","slot":"unit","x":"70%","y":"90%","w":"28%","h":"8%","fontSize":"10px","color":"rgba(0,0,0,0.5)","showIf":"has_value"},
   {"id":"obs","type":"observation","slot":"observation","x":"4%","y":"94%","w":"92%","h":"5%","fontSize":"8px","color":"rgba(0,0,0,0.4)","showIf":"has_value"}
 ]', 1),

-- 2. Lateral (imagem esquerda, info direita)
('Lateral', 'basico',
 '{"bg":"var(--card-bg, #ffffff)","borderRadius":"8px","overflow":"hidden","boxShadow":"0 1px 4px rgba(0,0,0,0.08)"}',
 '[
   {"id":"badge","type":"badge","slot":"badge","x":"0%","y":"0%","w":"30%","h":"14%","showIf":"has_value","zIndex":10},
   {"id":"img","type":"image","slot":"product_image","x":"2%","y":"5%","w":"40%","h":"90%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"product_name","x":"45%","y":"5%","w":"52%","h":"30%","fontSize":"auto","fontWeight":700,"textAlign":"left","textTransform":"uppercase","color":"inherit","overflow":"hidden"},
   {"id":"obs","type":"observation","slot":"observation","x":"45%","y":"36%","w":"52%","h":"10%","fontSize":"8px","color":"rgba(0,0,0,0.4)","showIf":"has_value"},
   {"id":"price","type":"price","slot":"offer_price","x":"45%","y":"48%","w":"52%","h":"40%","fontSize":"auto"},
   {"id":"unit","type":"unit","slot":"unit","x":"75%","y":"88%","w":"22%","h":"10%","fontSize":"9px","color":"rgba(0,0,0,0.5)","showIf":"has_value"}
 ]', 2),

-- 3. Premium (imagem dominante 70%, info na base)
('Premium', 'basico',
 '{"bg":"var(--card-bg, #ffffff)","borderRadius":"10px","overflow":"hidden","boxShadow":"0 2px 8px rgba(0,0,0,0.1)"}',
 '[
   {"id":"badge","type":"badge","slot":"badge","x":"0%","y":"0%","w":"35%","h":"10%","showIf":"has_value","zIndex":10},
   {"id":"img","type":"image","slot":"product_image","x":"0%","y":"0%","w":"100%","h":"65%","objectFit":"cover"},
   {"id":"name","type":"text","slot":"product_name","x":"5%","y":"67%","w":"55%","h":"15%","fontSize":"auto","fontWeight":800,"textAlign":"left","textTransform":"uppercase","color":"inherit","overflow":"hidden"},
   {"id":"price","type":"price","slot":"offer_price","x":"55%","y":"67%","w":"42%","h":"28%","fontSize":"auto"},
   {"id":"obs","type":"observation","slot":"observation","x":"5%","y":"83%","w":"50%","h":"7%","fontSize":"8px","color":"rgba(0,0,0,0.4)","showIf":"has_value"},
   {"id":"unit","type":"unit","slot":"unit","x":"5%","y":"91%","w":"30%","h":"7%","fontSize":"9px","color":"rgba(0,0,0,0.5)","showIf":"has_value"}
 ]', 3),

-- 4. Compacto (vertical apertado)
('Compacto', 'basico',
 '{"bg":"var(--card-bg, #ffffff)","borderRadius":"6px","overflow":"hidden","boxShadow":"0 1px 3px rgba(0,0,0,0.06)"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"10%","y":"2%","w":"80%","h":"45%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"product_name","x":"3%","y":"49%","w":"94%","h":"18%","fontSize":"auto","fontWeight":700,"textAlign":"center","textTransform":"uppercase","color":"inherit","overflow":"hidden"},
   {"id":"price","type":"price","slot":"offer_price","x":"5%","y":"68%","w":"90%","h":"28%","fontSize":"auto"},
   {"id":"unit","type":"unit","slot":"unit","x":"70%","y":"92%","w":"27%","h":"7%","fontSize":"9px","color":"rgba(0,0,0,0.5)","showIf":"has_value"}
 ]', 4),

-- 5. Grade / Atacadao (imagem full + preco overlay)
('Grade / Atacadao', 'destaque',
 '{"bg":"var(--card-bg, #ffffff)","borderRadius":"6px","overflow":"hidden","boxShadow":"0 1px 4px rgba(0,0,0,0.1)"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"0%","y":"0%","w":"100%","h":"100%","objectFit":"cover"},
   {"id":"name","type":"text","slot":"product_name","x":"3%","y":"3%","w":"70%","h":"15%","fontSize":"auto","fontWeight":800,"textAlign":"left","color":"#ffffff","textTransform":"uppercase","bg":"rgba(0,0,0,0.6)","borderRadius":"4px","overflow":"hidden"},
   {"id":"price","type":"price","slot":"offer_price","x":"50%","y":"65%","w":"48%","h":"33%","fontSize":"auto","bg":"rgba(0,0,0,0.7)","borderRadius":"8px"},
   {"id":"badge","type":"badge","slot":"badge","x":"0%","y":"0%","w":"30%","h":"12%","showIf":"has_value","zIndex":10}
 ]', 5),

-- 6. Vitrine (imagem + gradient bar escura)
('Vitrine', 'destaque',
 '{"bg":"#111111","borderRadius":"10px","overflow":"hidden","boxShadow":"0 4px 16px rgba(0,0,0,0.2)"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"0%","y":"0%","w":"100%","h":"65%","objectFit":"cover"},
   {"id":"gradient","type":"shape","slot":"","x":"0%","y":"50%","w":"100%","h":"50%","bg":"linear-gradient(to bottom, transparent, rgba(0,0,0,0.9))"},
   {"id":"name","type":"text","slot":"product_name","x":"5%","y":"62%","w":"90%","h":"15%","fontSize":"auto","fontWeight":800,"textAlign":"center","color":"#ffffff","textTransform":"uppercase","zIndex":2},
   {"id":"price","type":"price","slot":"offer_price","x":"10%","y":"78%","w":"80%","h":"20%","fontSize":"auto","zIndex":2},
   {"id":"badge","type":"badge","slot":"badge","x":"5%","y":"3%","w":"30%","h":"10%","showIf":"has_value","zIndex":10}
 ]', 6),

-- 7. Mini / Lista (horizontal tipo lista)
('Mini Lista', 'compacto',
 '{"bg":"var(--card-bg, #ffffff)","borderRadius":"4px","overflow":"hidden","border":"1px solid rgba(0,0,0,0.06)"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"2%","y":"10%","w":"18%","h":"80%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"product_name","x":"23%","y":"10%","w":"42%","h":"45%","fontSize":"auto","fontWeight":700,"textAlign":"left","color":"inherit","overflow":"hidden"},
   {"id":"obs","type":"observation","slot":"observation","x":"23%","y":"58%","w":"42%","h":"30%","fontSize":"8px","color":"rgba(0,0,0,0.4)","showIf":"has_value"},
   {"id":"price","type":"price","slot":"offer_price","x":"68%","y":"10%","w":"30%","h":"80%","fontSize":"auto"}
 ]', 7),

-- 8. Etiqueta / Gondola (shelf label)
('Etiqueta Gondola', 'compacto',
 '{"bg":"#ffffff","borderRadius":"0","overflow":"hidden","border":"2px solid #E53935","boxShadow":"none"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"2%","y":"8%","w":"22%","h":"84%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"product_name","x":"26%","y":"5%","w":"45%","h":"40%","fontSize":"auto","fontWeight":700,"textAlign":"left","textTransform":"uppercase","color":"#333"},
   {"id":"obs","type":"observation","slot":"observation","x":"26%","y":"48%","w":"45%","h":"20%","fontSize":"9px","color":"#666","showIf":"has_value"},
   {"id":"price","type":"price","slot":"offer_price","x":"26%","y":"65%","w":"72%","h":"32%","fontSize":"auto"},
   {"id":"unit","type":"unit","slot":"unit","x":"72%","y":"5%","w":"26%","h":"15%","fontSize":"11px","fontWeight":700,"color":"#E53935","textAlign":"right","showIf":"has_value"}
 ]', 8),

-- 9. Splash (fundo vibrante, estilo promocional agressivo)
('Splash Promocional', 'destaque',
 '{"bg":"var(--builder-primary, #E53935)","borderRadius":"12px","overflow":"hidden","boxShadow":"0 4px 12px rgba(229,57,53,0.3)"}',
 '[
   {"id":"name","type":"text","slot":"product_name","x":"5%","y":"3%","w":"90%","h":"18%","fontSize":"auto","fontWeight":900,"textAlign":"center","textTransform":"uppercase","color":"#ffffff"},
   {"id":"img","type":"image","slot":"product_image","x":"10%","y":"22%","w":"80%","h":"42%","objectFit":"contain"},
   {"id":"price","type":"price","slot":"offer_price","x":"5%","y":"66%","w":"90%","h":"28%","fontSize":"auto"},
   {"id":"badge","type":"badge","slot":"badge","x":"60%","y":"0%","w":"40%","h":"14%","showIf":"has_value","zIndex":10,"rotation":8}
 ]', 9),

-- 10. Minimalista (clean, leve, espacoso)
('Minimalista', 'moderno',
 '{"bg":"#fafafa","borderRadius":"12px","overflow":"hidden","boxShadow":"0 2px 12px rgba(0,0,0,0.06)","border":"none"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"15%","y":"8%","w":"70%","h":"45%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"product_name","x":"8%","y":"56%","w":"84%","h":"16%","fontSize":"auto","fontWeight":600,"textAlign":"center","color":"#333"},
   {"id":"price","type":"price","slot":"offer_price","x":"15%","y":"74%","w":"70%","h":"20%","fontSize":"auto"},
   {"id":"obs","type":"observation","slot":"observation","x":"10%","y":"94%","w":"80%","h":"5%","fontSize":"8px","color":"rgba(0,0,0,0.3)","textAlign":"center","showIf":"has_value"}
 ]', 10),

-- 11. Flat Design (fundo solido, pill-shaped price)
('Flat Design', 'moderno',
 '{"bg":"var(--card-bg, #ffffff)","borderRadius":"8px","overflow":"hidden","boxShadow":"none","border":"1px solid rgba(0,0,0,0.05)"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"10%","y":"5%","w":"80%","h":"45%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"product_name","x":"5%","y":"52%","w":"90%","h":"16%","fontSize":"auto","fontWeight":700,"textAlign":"center","textTransform":"uppercase","color":"inherit"},
   {"id":"price","type":"price","slot":"offer_price","x":"15%","y":"70%","w":"70%","h":"24%","fontSize":"auto","borderRadius":"20px"},
   {"id":"unit","type":"unit","slot":"unit","x":"65%","y":"90%","w":"30%","h":"8%","fontSize":"9px","color":"rgba(0,0,0,0.4)","showIf":"has_value"}
 ]', 11),

-- 12. Tabloide / Jornal (estilo newspaper)
('Tabloide', 'tradicional',
 '{"bg":"#FFFDE7","borderRadius":"0","overflow":"hidden","border":"3px solid #D32F2F","boxShadow":"none"}',
 '[
   {"id":"name","type":"text","slot":"product_name","x":"3%","y":"2%","w":"94%","h":"20%","fontSize":"auto","fontWeight":900,"textAlign":"center","textTransform":"uppercase","color":"#D32F2F"},
   {"id":"img","type":"image","slot":"product_image","x":"10%","y":"24%","w":"80%","h":"40%","objectFit":"contain"},
   {"id":"price","type":"price","slot":"offer_price","x":"5%","y":"66%","w":"90%","h":"28%","fontSize":"auto"},
   {"id":"obs","type":"observation","slot":"observation","x":"3%","y":"94%","w":"94%","h":"5%","fontSize":"8px","color":"#666","textAlign":"center","showIf":"has_value"}
 ]', 12),

-- 13. Elegante / Gourmet (borda dourada, sofisticado)
('Elegante Gourmet', 'premium',
 '{"bg":"#FFFEF5","borderRadius":"4px","overflow":"hidden","border":"1px solid #D4AF37","boxShadow":"0 2px 8px rgba(212,175,55,0.15)"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"10%","y":"5%","w":"80%","h":"48%","objectFit":"contain"},
   {"id":"sep","type":"shape","slot":"","x":"20%","y":"55%","w":"60%","h":"1px","bg":"linear-gradient(90deg, transparent, #D4AF37, transparent)"},
   {"id":"name","type":"text","slot":"product_name","x":"5%","y":"58%","w":"90%","h":"16%","fontSize":"auto","fontWeight":700,"textAlign":"center","textTransform":"uppercase","color":"#333","fontFamily":"serif"},
   {"id":"price","type":"price","slot":"offer_price","x":"10%","y":"76%","w":"80%","h":"20%","fontSize":"auto"},
   {"id":"unit","type":"unit","slot":"unit","x":"65%","y":"92%","w":"30%","h":"7%","fontSize":"9px","color":"#999","showIf":"has_value"}
 ]', 13),

-- 14. Dark / Noturno (fundo escuro, preco neon)
('Dark Noturno', 'premium',
 '{"bg":"#1a1a2e","borderRadius":"10px","overflow":"hidden","boxShadow":"0 4px 16px rgba(0,0,0,0.3)"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"10%","y":"5%","w":"80%","h":"48%","objectFit":"contain"},
   {"id":"name","type":"text","slot":"product_name","x":"5%","y":"55%","w":"90%","h":"16%","fontSize":"auto","fontWeight":800,"textAlign":"center","textTransform":"uppercase","color":"#ffffff"},
   {"id":"price","type":"price","slot":"offer_price","x":"10%","y":"73%","w":"80%","h":"22%","fontSize":"auto","color":"#00E5FF"},
   {"id":"badge","type":"badge","slot":"badge","x":"60%","y":"0%","w":"40%","h":"12%","showIf":"has_value","zIndex":10}
 ]', 14),

-- 15. Circular Destaque (imagem redonda, moderno)
('Circular Destaque', 'moderno',
 '{"bg":"transparent","overflow":"visible"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"10%","y":"2%","w":"80%","h":"52%","borderRadius":"50%","objectFit":"cover","overflow":"hidden","boxShadow":"0 4px 12px rgba(0,0,0,0.15)"},
   {"id":"badge","type":"badge","slot":"price_label","x":"58%","y":"0%","w":"42%","h":"16%","rotation":12,"zIndex":10,"showIf":"has_value"},
   {"id":"name","type":"text","slot":"product_name","x":"2%","y":"57%","w":"96%","h":"16%","fontSize":"auto","fontWeight":800,"textAlign":"center","textTransform":"uppercase","color":"inherit"},
   {"id":"price","type":"price","slot":"offer_price","x":"10%","y":"75%","w":"80%","h":"22%","fontSize":"auto"}
 ]', 15),

-- 16. Imagem Sobreposta (preco sobre a imagem)
('Imagem Sobreposta', 'destaque',
 '{"bg":"var(--card-bg, #ffffff)","borderRadius":"12px","overflow":"hidden","boxShadow":"0 2px 8px rgba(0,0,0,0.1)"}',
 '[
   {"id":"img","type":"image","slot":"product_image","x":"0%","y":"0%","w":"100%","h":"70%","objectFit":"cover"},
   {"id":"overlay","type":"shape","slot":"","x":"0%","y":"45%","w":"100%","h":"25%","bg":"linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))"},
   {"id":"name","type":"text","slot":"product_name","x":"5%","y":"50%","w":"90%","h":"18%","fontSize":"auto","fontWeight":800,"textAlign":"left","color":"#ffffff","textTransform":"uppercase","zIndex":2},
   {"id":"price","type":"price","slot":"offer_price","x":"5%","y":"72%","w":"90%","h":"25%","fontSize":"auto"},
   {"id":"badge","type":"badge","slot":"badge","x":"0%","y":"0%","w":"35%","h":"12%","showIf":"has_value","zIndex":10}
 ]', 16)

ON CONFLICT DO NOTHING;
