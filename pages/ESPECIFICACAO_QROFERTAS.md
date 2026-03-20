# Especificação Completa - Sistema de Criação de Encartes (baseado no QR Ofertas)

## Visão Geral

Sistema web para criação de encartes/panfletos digitais para varejo (supermercados, açougues, farmácias, etc). O usuário adiciona produtos com preços, escolhe um tema visual, configura a grade de layout, e gera uma imagem pronta para postar em redes sociais, imprimir ou exibir em TV.

URL de referência: https://www.qrofertas.com/criar-jornal/builder-v2/

---

## Arquitetura da Interface

A tela principal é dividida em 3 áreas:

### 1. Sidebar Esquerda (72px ícones + 403px painel)

Menu vertical com ícones que abre painéis laterais:

| Ícone | Painel | Descrição |
|-------|--------|-----------|
| Produtos | Buscar/Colar produtos | Adicionar produtos ao encarte |
| Temas | Galeria de temas | Escolher tema visual (fundo, cores) |
| Datas | Regras e datas | Período de validade + toggles |
| Sua Logo | Upload de logo | Enviar logo da empresa |
| Empresa | Dados da empresa | Toggles de visibilidade dos campos |
| Fontes | Configuração de fontes | Alterar fontes do encarte |
| Postar | Texto para redes sociais | Gera texto com #PraCegoVer |
| Encarte | Nome e categoria | Metadados do encarte |
| Portal | Configurações do portal | URL, CEP, segmentos |

### 2. Toolbar Superior (barra horizontal)

Controles inline para ajuste rápido:

| Controle | Opções | Comportamento |
|----------|--------|---------------|
| **Modelo** | Feed Facebook (1080x1080), Stories (1080x1920), Feed/Reels (1080x1350), A4 vertical (794x1123), A4 horizontal (1123x794), Grande (1200x1600), TV horizontal (1920x1080), TV vertical (1080x1920) | Muda dimensões do encarte |
| **Grade** | Automático, 1x1, 2x1, 2x2, 3x2, 3x3, 4x3, 4x4, etc. (30 opções) | Muda grid de produtos por página |
| **Boxes de Produtos** | Inteligente, Padrão | Estilo dos cards de produto |
| **Texto** | Texto Maior Possível, Texto Mínimo, Texto Médio | Tamanho do texto dos nomes |
| **Cores** | Inteligente, Padrão | Inteligente adapta cores ao tema |
| **Gerar Capa** | Toggle on/off | Gera página de capa |
| **Rodapé** | Redondo Grande, Quadrado Grande, Quadrado Compacto | Estilo visual do rodapé |
| **Zoom** | Auto, 30%, 40%, 50%, 60%, 70%, 80%, 90%, 100% | Zoom do canvas |

### 3. Canvas Central (área de preview)

Mostra o encarte em tempo real com:
- Background do tema (imagem ou cor)
- Header com título e logo
- Grid de produtos com imagens, nomes e preços
- Footer com dados da empresa e disclaimers
- Paginação (PÁGINA 1 DE X) com botões de navegação

---

## Painéis Detalhados

### Painel Produtos

**Duas abas:**

1. **Buscar** - Campo de busca que consulta banco de produtos do tenant. Mostra resultados com imagem, nome e botão "+ Adicionar"

2. **Colar Lista** - Textarea onde o usuário cola uma lista tipo:
```
ARROZ TIO URBANO 5KG 19.99
LEITE CONDENSADO ITALAC 395G 4.99
CAFE VASCONCELOS EXTRAFORTE 250G 13.99
```

O parser extrai automaticamente nome e preço. Formatos aceitos:
- `NOME PREÇO` (ex: `ARROZ 19.99`)
- `NOME - PREÇO` (ex: `ARROZ - 19.99`)
- `NOME R$PREÇO` (ex: `ARROZ R$19.99`)
- `NOME – PREÇO` (em-dash)

Após parsear, mostra lista com botão "Adicionar tudo" ou "+" individual por produto.

**O QR Ofertas tem um banco de imagens de produtos integrado** - quando o usuário digita "Arroz Tio Urbano", o sistema já busca e mostra a foto do produto automaticamente. Isso é o diferencial principal deles.

### Painel Temas

- Busca de temas por nome
- Categorias: Ofertas Grátis, Páscoa, Dia do Carpinteiro, Black Friday, Natal, etc.
- Cada tema tem: nome, thumbnail, backgroundImage (imagem de fundo do header), cssConfig (cores), isPremium
- Preview do tema antes de aplicar
- Temas definem: cor primária, secundária, fundo, texto, header, footer, border-radius, accent

### Painel Datas/Regras

| Campo | Tipo | Default |
|-------|------|---------|
| Data de Início | date input | vazio |
| Data Final | date input | vazio |
| Mostrar datas | toggle | ON |
| Enquanto durarem os estoques | toggle | OFF |
| Imagens Meramente Ilustrativas | toggle | ON |
| Advertência Medicamento | toggle | OFF |
| Mostrar Frase Promocional | toggle | OFF |
| Frase Promocional | textarea | vazio |
| Publicar este encarte no portal? | toggle | OFF |

Esses toggles controlam textos que aparecem no rodapé do encarte.

### Painel Logo

- Área de upload com preview
- Suporte a PNG e JPG
- Logo aparece no header do encarte
- Logo é arrastável e redimensionável no canvas (drag & drop + resize handles)
- Posição salva como { top, left, width, height } em percentual

### Painel Empresa

Lista de toggles com botão de edição (lápis) ao lado de cada um:

| Toggle | Campo editável |
|--------|----------------|
| Mostrar Telefone | phone |
| Mostrar Whatsapp | whatsapp |
| Legenda dos telefones | (label "Tel:" / "WhatsApp:") |
| Mostrar Nome da Empresa | name |
| Mostrar Slogan | slogan |
| Mostrar Formas de pagamento | (sem campo) |
| Mostrar observação de pagamento | paymentNotes |
| Mostrar endereço | address |
| Mostrar Instagram | instagram |
| Mostrar Facebook | facebook |
| Mostrar Website | website |

Quando o toggle está ON e o campo preenchido, a informação aparece no rodapé do encarte.

### Painel Fontes

- Filtros: Peso (todos, leve, normal, bold), Estilo (todos, normal, itálico), Nome (dropdown)
- Checkboxes para aplicar em: Título do produto, Etiqueta de preço, Mensagem promocional, Textos do rodapé
- Preview das fontes disponíveis (Google Fonts)

### Painel Postar

Gera automaticamente texto para redes sociais:

```
🎉 Ofertas Imperdíveis 🎉

Confira:
✅ Arroz Tio Urbano 5Kg - R$19,99
✅ Leite Condensado Italac 395G - R$4,99
...

📅 Válido de 19/03 até 25/03

#Ofertas #Encartes #Promoções #Economia
```

Também gera texto de acessibilidade (#PraCegoVer):
```
#PraCegoVer
Encarte de ofertas "Ofertas Imperdíveis" com 12 produtos em promoção.
1. Arroz Tio Urbano 5Kg - R$19,99
2. Leite Condensado Italac 395G - R$4,99
...
```

Botão "Copiar" para clipboard.

### Painel Encarte

- Nome do Encarte (texto)
- Observações (textarea interno, não aparece no encarte)
- Categoria (dropdown: Supermercado, Açougue, Padaria, Farmácia, etc.)

### Painel Portal

- Nome para URL (slug)
- CEP
- 3 seletores de Segmento (ex: Supermercado, Bebidas, Hortifrúti)
- Toggle "Mostrar minha empresa no portal de ofertas?"
- Toggle "Publicar este encarte no portal?"

---

## Edição de Produtos no Encarte

Abaixo do canvas, seção "Editar Produtos" com card para cada produto:

### Campos por produto:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Imagem | thumbnail + upload | Foto do produto |
| Produto | text input | Nome editável |
| Preço Oferta | R$ input | Preço promocional |
| Texto de Observação | text input | Ex: "próximo ao vencimento" |
| Opções de Preço | dropdown | Preço Simples, De X por Y, Leve X Pague Y, A partir de, Por Unidade |
| Unidade | dropdown | UN, KG, G, L, ML, PCT, CX, DZ, BD, FD, SC |
| Apenas Maiores de 18 | checkbox | Marca produto como +18 |
| Enviar Imagem | link | Upload de nova imagem |
| Editar Imagem | link | Abre cropper para recortar/ajustar |
| Buscar Imagem | link | Busca imagens no banco |
| ARRASTE | botão | Drag handle para reordenar |
| VER | botão | Preview individual do produto |
| Remover | botão vermelho | Remove produto do encarte |

### Modos de Preço:

1. **Preço Simples** - Mostra apenas o preço de oferta
2. **De X por Y** - Mostra preço original riscado + preço de oferta ("De R$25,99 por R$19,99")
3. **Leve X Pague Y** - Badge "Leve 3 Pague 2" + preço unitário (inputs: takeQuantity, payQuantity)
4. **A partir de** - Label "A partir de" acima do preço
5. **Por Unidade** - Preço com "cada kg" / "cada un" / "cada L"

### Selo de Preço (PriceTag):

Visual do preço no card do produto:
- Cor de fundo (bgColor) - vermelho, azul, verde, amarelo, laranja, preto
- Cor do texto (textColor)
- Formato (shape) - rounded, square, pill, circle
- Mostra: R$ | parte inteira grande | ,decimal + /unidade
- Exemplo visual: `R$ 19,99 /kg`

### Badge de Promoção:

Selos que aparecem no canto do card:
- PROMOÇÃO (vermelho)
- OFERTA (laranja)
- NOVO (verde)
- DESTAQUE (amarelo)
- Posição configurável: top-right, top-left

---

## Estrutura do Encarte (Canvas)

### Composição de cada página:

```
┌─────────────────────────────┐
│         HEADER              │ ← Background do tema + título + logo + datas
│  [Logo]  "Ofertão do DIA"  │
│      Válido de X até Y      │
├─────────────────────────────┤
│                             │
│    ┌───┐ ┌───┐ ┌───┐      │ ← Grid de produtos
│    │ P1│ │ P2│ │ P3│      │   (colunas x linhas configurável)
│    │   │ │   │ │   │      │
│    │R$ │ │R$ │ │R$ │      │
│    └───┘ └───┘ └───┘      │
│    ┌───┐ ┌───┐ ┌───┐      │
│    │ P4│ │ P5│ │ P6│      │
│    └───┘ └───┘ └───┘      │
│                             │
├─────────────────────────────┤
│         FOOTER              │ ← Nome empresa, telefone, endereço,
│  *Imagens ilustrativas      │   instagram, disclaimers, watermark
│  Feito com QR Ofertas       │
└─────────────────────────────┘
```

### Paginação:

- Se mais produtos que a grade suporta, cria múltiplas páginas
- "PÁGINA 1 DE 3" com botões de navegação
- Botões: "Só esta página", "Modo Leve", "Download", "Publicação Turbo"

### Download:

- Formato: PNG (imagem)
- Escalas: 1x (mínimo), 2x (normal), 3x (grande), 4x (muito grande)
- Opção "Só esta página" ou todas
- "Modo Leve" - versão menor/mais rápida

---

## Modelos de Dados

### Tenant (Empresa)
```
id, name, slug, logo, logoPosition (JSON), slogan, phone, phone2, whatsapp,
instagram, facebook, website, address, paymentNotes, cep, segment1, segment2,
segment3, showOnPortal
```

### Flyer (Encarte)
```
id, title, status (DRAFT/PUBLISHED/ARCHIVED), startDate, endDate,
customMessage, textSizeMode (MAXIMUM/MINIMUM/MEDIUM), observations, category,
showDates, showStockWarning, showIllustrativeNote, showMedicineWarning,
showPromoPhrase, promoPhrase, publishToPortal,
showPhone, showWhatsapp, showPhoneLabel, showCompanyName, showSlogan,
showPaymentMethods, showPaymentNotes, showAddress, showInstagram,
showFacebook, showWebsite,
productBoxStyle (smart/standard), colorMode (smart/standard),
fontConfig (JSON), logoPosition (JSON), colorPalette (JSON),
footerStyle, inkEconomy (0-100), showCover,
snapshotUrl, tenantId, themeId, modelId, layoutId, createdById,
priceTagStyleId, badgeStyleId
```

### FlyerProduct (Produto no Encarte)
```
id, flyerId, productId (nullable), position, offerPrice, originalPrice,
unit (UN/KG/G/L/ML/PCT/CX/DZ/BD/FD/SC), customName, customImage,
observation, limit, isHighlight, isAdult, isPinned, isPricePinned,
customLines (JSON), bgOpacity, priceTagStyleId, badgeStyleId,
priceMode (simple/from_to/take_pay/starting_at/per_unit),
takeQuantity, payQuantity
```

### Product (Cadastro de Produto)
```
id, name, image, barcode, brand, isActive, tenantId, categoryId
```

### Theme (Tema Visual)
```
id, name, slug, thumbnail, backgroundImage, isPremium, isPublic, isActive,
order, cssConfig (JSON), headerConfig (JSON), bodyConfig (JSON),
footerConfig (JSON), categoryName, tags (array)
```

**cssConfig:**
```json
{
  "primaryColor": "#e53e3e",
  "secondaryColor": "#dd6b20",
  "bgColor": "#fef3c7",
  "textColor": "#1a202c",
  "borderRadius": "8px",
  "headerBg": "#c53030",
  "bodyBg": "#fef3c7",
  "footerBg": "#c53030",
  "accentColor": "#f6e05e"
}
```

**headerConfig:**
```json
{
  "layout": "center",
  "showLogo": true,
  "showDates": true,
  "showTitle": true,
  "height": 130,
  "backgroundImage": "url_da_imagem_do_header"
}
```

**bodyConfig:**
```json
{
  "padding": 8,
  "gap": 4,
  "productCardStyle": "rounded"
}
```

**footerConfig:**
```json
{
  "text": "",
  "showWatermark": true,
  "style": "default",
  "height": 70
}
```

### Model (Formato/Modelo)
```
id, name, type (SOCIAL/PRINT/TV), width, height, aspectRatio, isActive, order
```

### Layout (Grade)
```
id, name, productsPerPage, columns, rows, gridConfig (JSON),
highlightPositions (array), isActive, order, modelId
```

### PriceTagStyle (Estilo do Selo de Preço)
```
id, name, thumbnail, cssConfig (JSON: bgColor, textColor, shape), isGlobal, isActive, order
```

### BadgeStyle (Estilo do Badge)
```
id, name, thumbnail, type (PROMO/OFFER/NEW/FEATURED),
cssConfig (JSON: bgColor, textColor, text, position), isGlobal, isActive, order
```

### FontConfig (Configuração de Fonte)
```
id, name, family, weight, style, googleUrl, isActive, order
```

---

## Fluxo do Usuário

1. Acessa o builder
2. Escolhe um tema (sidebar Temas)
3. Adiciona produtos (busca individual OU cola lista de texto)
4. Sistema monta encarte automaticamente com grade inteligente
5. Ajusta: modelo, grade, texto, cores, rodapé (toolbar)
6. Configura: datas, empresa, logo (sidebar)
7. Edita produtos individualmente se necessário (preço, imagem, modo de preço)
8. Faz download da imagem ou publica no portal

---

## Stack Técnica Recomendada

- **Frontend**: Next.js + React + TypeScript + Tailwind CSS + Zustand (state)
- **Backend**: Next.js API Routes com SQL direto (pg)
- **Banco**: PostgreSQL
- **Storage**: S3-compatível (Wasabi, MinIO, AWS S3)
- **Componentes UI**: Radix UI (shadcn/ui)
- **Drag & Drop**: @dnd-kit
- **Image Crop**: react-image-crop
- **Renderização**: html2canvas-pro ou Puppeteer para gerar PNG/PDF
