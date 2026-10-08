# Especificação Completa para Implementação - Sistema de Criação de Encartes

> **INSTRUÇÕES PARA O CLAUDE CODE**: Este documento contém TODA a especificação para implementar um sistema de criação de encartes digitais para varejo. Implemente TUDO que está descrito aqui. O sistema foi analisado a partir do QR Ofertas (https://www.qrofertas.com/criar-jornal/builder-v2/) e deve replicar todas as funcionalidades.

---

## Stack Técnica

- **Framework**: Next.js 16+ (App Router) + React 19 + TypeScript
- **CSS**: Tailwind CSS 4 + shadcn/ui (Radix UI)
- **State**: Zustand com Immer
- **Banco**: PostgreSQL (conexão direta com `pg`, SEM Prisma)
- **Storage**: Wasabi S3 (compatível com API S3, usa o pacote `minio` como client)
- **Auth**: NextAuth v5 (Credentials provider, JWT strategy)
- **Drag & Drop**: @dnd-kit
- **Image Crop**: react-image-crop
- **Renderização**: html2canvas-pro (client-side PNG export)

---

## Estrutura de Diretórios

```
src/
├── app/
│   ├── (auth)/login/page.tsx           # Tela de login
│   ├── (auth)/register/page.tsx        # Tela de registro
│   ├── (dashboard)/page.tsx            # Lista de encartes
│   ├── (dashboard)/products/page.tsx   # CRUD de produtos
│   ├── (dashboard)/settings/page.tsx   # Configurações da empresa
│   ├── builder/[flyerId]/page.tsx      # Editor de encartes (SERVER COMPONENT)
│   ├── builder/[flyerId]/render/page.tsx # Renderização para export
│   ├── api/auth/[...nextauth]/route.ts
│   ├── api/auth/register/route.ts
│   ├── api/products/route.ts           # CRUD produtos
│   ├── api/products/search/route.ts    # Busca rápida
│   ├── api/products/image-search/route.ts # Busca de imagens
│   ├── api/flyers/route.ts             # CRUD encartes
│   ├── api/flyers/[id]/route.ts        # GET/PUT/DELETE encarte
│   ├── api/flyers/[id]/products/route.ts # Produtos do encarte
│   ├── api/flyers/[id]/products/reorder/route.ts
│   ├── api/themes/route.ts
│   ├── api/models/route.ts
│   ├── api/layouts/route.ts
│   ├── api/badges/route.ts
│   ├── api/price-tags/route.ts
│   ├── api/fonts/route.ts
│   ├── api/tenant/route.ts
│   ├── api/upload/route.ts
│   ├── api/upload/logo/route.ts
│   └── api/upload/product-image/route.ts
├── components/
│   ├── builder/
│   │   ├── BuilderLayout.tsx           # Layout principal do editor
│   │   ├── BuilderProvider.tsx         # Provider com zustand
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx             # Menu lateral com ícones + painéis
│   │   │   ├── SidebarTab.tsx
│   │   │   ├── panels/
│   │   │   │   ├── ProductsPanel.tsx   # Buscar + Colar Lista
│   │   │   │   ├── ThemesPanel.tsx
│   │   │   │   ├── LayoutsPanel.tsx
│   │   │   │   ├── StylesPanel.tsx
│   │   │   │   ├── FontsPanel.tsx
│   │   │   │   ├── CompanyPanel.tsx    # Toggles empresa
│   │   │   │   ├── DatesPanel.tsx      # Toggles datas/regras
│   │   │   │   ├── PostarPanel.tsx     # Texto redes sociais
│   │   │   │   ├── EncartePanel.tsx    # Nome/categoria
│   │   │   │   ├── PortalPanel.tsx     # Config portal
│   │   │   │   └── SettingsPanel.tsx   # Config avançadas
│   │   │   └── product-list/
│   │   │       ├── ProductSearch.tsx
│   │   │       ├── ProductListItem.tsx # Edição inline do produto
│   │   │       └── SortableProductList.tsx
│   │   ├── toolbar/
│   │   │   ├── Toolbar.tsx             # Barra superior de controles
│   │   │   ├── ZoomControl.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── DownloadButton.tsx
│   │   └── canvas/
│   │       ├── CanvasArea.tsx          # Container com zoom/scroll
│   │       ├── FlyerPage.tsx           # Página do encarte
│   │       ├── FlyerHeader.tsx         # Cabeçalho com tema/logo/título
│   │       ├── FlyerFooter.tsx         # Rodapé com dados empresa
│   │       ├── ProductGrid.tsx         # Grid CSS dos produtos
│   │       ├── ProductCard.tsx         # Card visual do produto
│   │       ├── PriceTag.tsx            # Selo de preço (5 modos)
│   │       ├── Badge.tsx               # Badge promoção/oferta
│   │       ├── AutoFitText.tsx         # Texto auto-ajustável
│   │       ├── DraggableLogo.tsx       # Logo arrastável
│   │       ├── ThemeBackground.tsx     # Fundo do tema
│   │       └── RenderView.tsx          # View para export
│   ├── shared/
│   │   ├── ImageCropper.tsx            # Editor de imagem (crop)
│   │   ├── ColorPicker.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── LoadingOverlay.tsx
│   └── ui/ (shadcn components)
├── store/
│   ├── builder-store.ts               # Zustand store combinando slices
│   └── slices/
│       ├── flyer-slice.ts             # Estado do encarte
│       ├── products-slice.ts          # Lista de produtos
│       └── ui-slice.ts                # Estado da UI
├── lib/
│   ├── db.ts                          # Pool PostgreSQL direto (pg)
│   ├── storage.ts                     # Client S3 Wasabi
│   ├── auth.ts                        # NextAuth config
│   ├── auth-helpers.ts
│   ├── validators.ts                  # Schemas Zod
│   ├── constants.ts                   # Constantes do sistema
│   ├── utils.ts
│   ├── text-fitting.ts
│   └── render-engine.ts
├── hooks/
│   ├── use-builder.ts
│   ├── use-auto-save.ts
│   ├── use-debounce.ts
│   ├── use-text-fit.ts
│   ├── use-download.ts
│   └── use-media-query.ts
└── types/
    ├── builder.ts
    ├── flyer.ts
    ├── product.ts
    ├── theme.ts
    └── next-auth.d.ts
```

---

## Interface do Builder

### Layout Principal

```
┌─────────────────────────────────────────────────────────────┐
│ [≡] │ Modelo ▼ │ Grade ▼ │ Boxes ▼ │ Texto ▼ │ Cores ▼ │  │  ← TOOLBAR
│     │ Capa [○] │ Rodapé ▼ │ Zoom ▼ │ ◄ 1/2 ► │ Download │
├──┬──┴──────────────────────────────────────────────────────┤
│  │                                                          │
│I │  PAINEL                    CANVAS (preview do encarte)   │
│C │  LATERAL                                                 │
│O │  (conteúdo                 ┌─────────────────────┐       │
│N │   do painel                │     HEADER          │       │
│E │   selecionado)             │  Logo  Título  Data │       │
│S │                            ├─────────────────────┤       │
│  │                            │  ┌──┐ ┌──┐ ┌──┐   │       │
│72│     403px                  │  │P1│ │P2│ │P3│   │       │
│px│                            │  └──┘ └──┘ └──┘   │       │
│  │                            │  ┌──┐ ┌──┐ ┌──┐   │       │
│  │                            │  │P4│ │P5│ │P6│   │       │
│  │                            │  └──┘ └──┘ └──┘   │       │
│  │                            ├─────────────────────┤       │
│  │                            │     FOOTER          │       │
│  │                            └─────────────────────┘       │
└──┴──────────────────────────────────────────────────────────┘
```

### Sidebar - 10 Painéis

Os ícones ficam numa coluna de 72px. Ao clicar, abre um painel de 403px ao lado.

```typescript
const SIDEBAR_TABS = [
  { id: "products", label: "Produtos", icon: "ShoppingCart" },
  { id: "themes", label: "Temas", icon: "Palette" },
  { id: "layouts", label: "Grades", icon: "LayoutGrid" },
  { id: "styles", label: "Estilos", icon: "Sparkles" },
  { id: "fonts", label: "Fontes", icon: "Type" },
  { id: "company", label: "Empresa", icon: "Building2" },
  { id: "dates", label: "Datas", icon: "Calendar" },
  { id: "postar", label: "Postar", icon: "Share2" },
  { id: "encarte", label: "Encarte", icon: "FileEdit" },
  { id: "portal", label: "Portal", icon: "Globe" },
];
```

---

## Painel Produtos (ProductsPanel)

### Duas abas: "Buscar" e "Colar Lista"

**Aba Buscar**: Campo de busca que consulta API `/api/products/search?q=TERMO`. Mostra resultados com imagem, nome e botão "+ Adicionar".

**Aba Colar Lista**: Textarea onde o usuário cola uma lista de produtos com preços. Parser automático:

```typescript
// Parser de linha de produto - aceita estes formatos:
// "ARROZ TIO URBANO 5KG 19.99"
// "ARROZ TIO URBANO 5KG - 19.99"
// "ARROZ TIO URBANO 5KG R$19.99"
// "ARROZ TIO URBANO 5KG – 19.99" (em-dash)

const parseProductLine = (line: string): { name: string; price: number } | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const formats = [
    /^(.+?)\s+([0-9]+[.,][0-9]{2})$/,          // NAME PRICE
    /^(.+?)\s*-\s*([0-9]+[.,][0-9]{2})$/,       // NAME - PRICE
    /^(.+?)\s*R\$\s*([0-9]+[.,][0-9]{2})$/,     // NAME R$PRICE
    /^(.+?)\s*–\s*([0-9]+[.,][0-9]{2})$/,       // NAME – PRICE
  ];

  for (const format of formats) {
    const match = trimmed.match(format);
    if (match) {
      const name = match[1].trim();
      const price = parseFloat(match[2].replace(",", "."));
      if (name && !isNaN(price)) return { name, price };
    }
  }
  return null;
};
```

Após parsear, mostra lista com botão "Adicionar tudo" e "+" individual. Cada produto é criado via POST `/api/flyers/{flyerId}/products` com `customName` e `offerPrice`.

---

## Toolbar (Barra Superior)

### Controles:

| Controle | Tipo | Opções |
|----------|------|--------|
| **Modelo** | Select | Feed Facebook 1080x1080, Stories 1080x1920, Feed/Reels 1080x1350, A4 vertical 794x1123, A4 horizontal 1123x794, Grande 1200x1600, TV horizontal 1920x1080, TV vertical 1080x1920 |
| **Grade** | Select | Automático + grades fixas (1x1, 2x1, 2x2, 3x2, 3x3, 4x3, 4x4, 5x4, etc.) |
| **Boxes de Produtos** | Select | Inteligente, Padrão |
| **Texto** | Select | Texto Maior Possível, Texto Mínimo, Texto Médio |
| **Cores** | Select | Inteligente (adapta ao tema), Padrão |
| **Gerar Capa** | Switch | on/off |
| **Rodapé** | Select | Redondo Grande, Quadrado Grande, Quadrado Compacto |
| **Zoom** | Select | Auto, 30%-100% |

---

## Grid Automático - Lógica Completa

O grid automático é a funcionalidade mais importante. Baseado na análise do QR Ofertas:

### Estrutura CSS

O container de produtos usa **`display: flex; flex-wrap: wrap`**. Cada produto tem `width: calc(100% / COLUNAS - margin)` e `height: calc(100% / LINHAS - margin)`. O `--margin-layout` é uma CSS variable (~5px).

### Mapeamento automático (quantidade → grade):

```typescript
function getAutoGrid(productCount: number): { columns: number; rows: number } {
  if (productCount <= 0) return { columns: 1, rows: 1 };
  if (productCount === 1) return { columns: 1, rows: 1 };
  if (productCount === 2) return { columns: 2, rows: 1 };
  if (productCount === 3) return { columns: 3, rows: 1 };
  if (productCount === 4) return { columns: 2, rows: 2 };
  if (productCount <= 6) return { columns: 3, rows: 2 };
  if (productCount <= 8) return { columns: 4, rows: 2 };
  if (productCount === 9) return { columns: 3, rows: 3 };
  if (productCount <= 12) return { columns: 4, rows: 3 };
  if (productCount <= 15) return { columns: 5, rows: 3 };
  if (productCount <= 16) return { columns: 4, rows: 4 };
  if (productCount <= 20) return { columns: 5, rows: 4 };
  if (productCount <= 24) return { columns: 6, rows: 4 };
  if (productCount <= 25) return { columns: 5, rows: 5 };
  if (productCount <= 30) return { columns: 6, rows: 5 };
  // Fallback: roughly square
  const cols = Math.ceil(Math.sqrt(productCount * 1.2));
  const rows = Math.ceil(productCount / cols);
  return { columns: cols, rows };
}
```

### Implementação no CSS (como o QR Ofertas faz):

```css
/* Container: flex-wrap para os produtos fluírem */
.product-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  --margin-layout: 5px;
}

/* Exemplo: layout 4x3 (12 produtos) */
.product-grid .product-box {
  width: calc(100% / 4 - var(--margin-layout));
  height: calc(100% / 3 - var(--margin-layout));
  margin-right: var(--margin-layout);
  margin-bottom: var(--margin-layout);
}
```

### Alternativa com CSS Grid (mais simples):

```tsx
<div style={{
  display: "grid",
  gridTemplateColumns: `repeat(${columns}, 1fr)`,
  gridTemplateRows: `repeat(${rows}, 1fr)`,
  gap: 4,
  width: "100%",
  height: "100%",
}}>
  {products.map(product => <ProductCard key={product.id} ... />)}
</div>
```

### Layouts especiais com destaques (QR Ofertas tem 30+ variações):

O QR Ofertas suporta layouts com produtos em destaque (maiores). Exemplos:
- "5 Produtos - 4 produtos + 1 destaque Esquerdo" → 1 produto ocupa 2 linhas à esquerda, 4 produtos normais à direita
- "7 Produtos - 3 Destaques no topo e 4 produtos" → 3 produtos maiores no topo, 4 normais embaixo
- "8 Produtos - 3x2 + 3 destaques no topo" → 3 destaques grandes + 5 normais

Para implementar, use `grid-template-areas`:

```css
/* Layout: 1 destaque esquerdo + 4 produtos (5 total) */
.layout-5-destaque-esq {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    "destaque p1 p2"
    "destaque p3 p4";
}
```

---

## Composição Visual do Encarte

### FlyerPage (cada página)

```
┌────────────────────────────────────┐
│ ThemeBackground (imagem ou cor)    │ ← z-index: 0, opacity baseada em inkEconomy
├────────────────────────────────────┤
│ FlyerHeader                       │ ← z-index: 10
│  ├─ headerConfig.backgroundImage  │    Se o tema tem imagem de header
│  ├─ DraggableLogo (arrastável)    │    Logo do tenant, posição salva em %
│  ├─ Título do encarte             │    fontSize: max(16, height * 0.25)
│  ├─ Datas (se showDates=true)     │    "Válido de DD/MM até DD/MM"
│  └─ customMessage                 │    Mensagem personalizada
├────────────────────────────────────┤
│ ProductGrid                       │ ← height = total - header - footer
│  ├─ CSS Grid (cols x rows)        │
│  └─ ProductCard (para cada slot)  │
│      ├─ Badge (PROMOÇÃO, OFERTA)  │    Posição: top-right ou top-left
│      ├─ 18+ indicator             │    Se isAdult=true
│      ├─ Imagem do produto         │    object-contain, centralizada
│      ├─ Nome (AutoFitText)        │    Texto auto-ajustável
│      ├─ Observação                │    Ex: "próximo ao vencimento"
│      ├─ PriceTag (selo de preço)  │    5 modos diferentes
│      └─ Limite                    │    Ex: "5 por cliente"
├────────────────────────────────────┤
│ FlyerFooter                       │ ← z-index: 10
│  ├─ Nome empresa (se toggle ON)   │
│  ├─ Slogan (se toggle ON)         │
│  ├─ Telefone/WhatsApp (se ON)     │
│  ├─ Endereço (se toggle ON)       │
│  ├─ Instagram/Facebook/Site (ON)  │
│  ├─ Formas pagamento (se ON)      │
│  ├─ Frase promocional (se ON)     │
│  ├─ Disclaimers automáticos:      │
│  │   "*Imagens ilustrativas"      │    Se showIllustrativeNote=true
│  │   "Enquanto durarem estoques"  │    Se showStockWarning=true
│  │   "Advertência medicamento"    │    Se showMedicineWarning=true
│  │   "Válido de X até Y"          │    Se showDates=true
│  └─ Watermark "Feito com..."      │
└────────────────────────────────────┘
```

### FlyerHeader com imagem de fundo do tema

```tsx
// O header pode ter uma imagem de fundo definida no tema
// Exemplo: o tema "Ofertão do DIA" tem uma imagem com o texto estilizado
<div className="relative z-10 flex items-center overflow-hidden" style={{ height }}>
  {/* Imagem de fundo do header do tema */}
  {headerConfig?.backgroundImage && (
    <img
      src={headerConfig.backgroundImage}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      style={{ zIndex: 0 }}
    />
  )}
  {/* Logo arrastável */}
  {showLogo && <DraggableLogo logoUrl={tenant.logo} ... />}
  {/* Título e datas por cima da imagem */}
  <div className="relative z-[1] flex flex-1 flex-col items-center justify-center px-4">
    <h1>{title}</h1>
    {showDates && <p>Válido de {startDate} até {endDate}</p>}
  </div>
</div>
```

---

## PriceTag - 5 Modos de Preço

### Estrutura visual:

```
   De R$ 25,99          ← originalPrice riscado (modo from_to)
      Por               ← label (modo from_to)
┌─────────────────┐
│ R$ 19,99  /kg   │    ← selo com cor de fundo
└─────────────────┘
   cada kg              ← label (modo per_unit)
```

### Modos:

```typescript
type PriceMode = "simple" | "from_to" | "take_pay" | "starting_at" | "per_unit";
```

1. **simple** - Apenas o preço: `R$ 19,99 /un`
2. **from_to** - "De R$25,99" (riscado) + "Por" + `R$ 19,99`
3. **take_pay** - Badge "Leve 3 Pague 2" acima do preço
4. **starting_at** - "A partir de" acima do preço
5. **per_unit** - Preço + "cada kg/un/L" abaixo

### Estilos do selo (PriceTagStyle):

```json
{
  "bgColor": "#e53e3e",   // vermelho, azul, verde, amarelo, laranja, preto
  "textColor": "#ffffff",
  "shape": "rounded"       // rounded, square, pill, circle
}
```

### Formato visual do preço no selo:

```
R$ | 19 | ,99
         | /kg
```

- "R$" em fonte 10px bold
- Parte inteira em fonte 22px extrabold
- Decimais em 12px bold
- Unidade em 7px

---

## Edição de Produto (ProductListItem)

Cada produto na sidebar tem uma linha compacta + seção expandida:

### Linha principal:
```
[≡] [img] [nome_input] [preço_oferta] [preço_original] [⭐] [📌] [✕] [▼]
```

### Seção expandida (ao clicar ▼):

```
Modo Preço:  [Preço Simples ▼]     ← Select com 5 opções
Leve:        [3]                    ← Só aparece se mode=take_pay
Pague:       [2]                    ← Só aparece se mode=take_pay

─────────────────────────────
Enviar Imagem  |  Editar Imagem  |  Buscar Imagem
[grid de resultados de busca de imagem se aberta]
─────────────────────────────
Unidade:     [Quilograma (kg) ▼]
Obs.:        [_________________]
Limite:      [_________________]
☐ Produto para maiores de 18 anos
☐ Remover fundo ao enviar imagem
```

### Funcionalidades de imagem:
- **Enviar Imagem**: Upload de arquivo, salva no Wasabi S3
- **Editar Imagem**: Abre ImageCropper (react-image-crop) com o crop do produto atual
- **Buscar Imagem**: Consulta API `/api/products/image-search?q=NOME` e mostra grid 4 colunas de thumbnails clicáveis

---

## Painel Datas/Regras

```
Data de Início: [dd/mm/aaaa]
Data Final:     [dd/mm/aaaa]

[toggle] Mostrar datas                    (default: ON)
[toggle] Enquanto durarem os estoques     (default: OFF)
[toggle] Imagens Meramente Ilustrativas   (default: ON)
[toggle] Advertência Medicamento          (default: OFF)
[toggle] Mostrar Frase Promocional        (default: OFF)

Frase Promocional: [textarea, max 300 chars]
  ← Só aparece se toggle ON

[toggle] Publicar este encarte no portal? (default: OFF)

Atalhos Rápidos:
  [Esta Semana] [Este Mês] [Próximos 7 dias] [Próximos 15 dias]
```

---

## Painel Empresa

Lista de toggles com botão de edição inline (lápis):

```
[toggle] [✏] Mostrar Telefone           → campo: phone
[toggle] [✏] Mostrar Whatsapp           → campo: whatsapp
[toggle] [✏] Legenda dos telefones      → adiciona "Tel:" / "WhatsApp:" no rodapé
[toggle] [✏] Mostrar Nome da Empresa    → campo: name
[toggle] [✏] Mostrar Slogan             → campo: slogan
[toggle] [✏] Mostrar Formas pagamento   → (sem campo)
[toggle] [✏] Mostrar obs. pagamento     → campo: paymentNotes
[toggle] [✏] Mostrar endereço           → campo: address
[toggle] [✏] Mostrar Instagram          → campo: instagram (com @)
[toggle] [✏] Mostrar Facebook           → campo: facebook
[toggle] [✏] Mostrar Website            → campo: website
```

Ao clicar no lápis, abre um input inline embaixo do toggle para editar o campo. Salva via PUT `/api/tenant`.

---

## Painel Postar (Texto para Redes Sociais)

Gera automaticamente baseado nos produtos do encarte:

```
🎉 {título do encarte} 🎉

Confira:
✅ Arroz Tio Urbano 5Kg - R$19,99
✅ Leite Condensado Italac 395G - R$4,99
✅ Café Vasconcelos Extraforte 250G - R$13,99
...

📅 Válido de DD/MM até DD/MM

#Ofertas #Encartes #Promoções #Economia
```

**Texto de acessibilidade (#PraCegoVer):**
```
#PraCegoVer
Encarte de ofertas "{título}" com {N} produtos em promoção.

Produtos em oferta:
1. Arroz Tio Urbano 5Kg - R$19,99
2. Leite Condensado Italac 395G - de R$6,99 por R$4,99
...

Ofertas válidas de DD/MM até DD/MM.
```

Botões "Copiar" para clipboard.

---

## Modelos de Dados (SQL)

### Tabela Tenant
```sql
CREATE TABLE "Tenant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo TEXT,
  "logoPosition" JSONB,
  slogan TEXT,
  phone TEXT,
  phone2 TEXT,
  whatsapp TEXT,
  instagram TEXT,
  facebook TEXT,
  website TEXT,
  address TEXT,
  "paymentNotes" TEXT,
  cep TEXT,
  segment1 TEXT,
  segment2 TEXT,
  segment3 TEXT,
  "showOnPortal" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### Tabela User
```sql
CREATE TABLE "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  role TEXT DEFAULT 'EDITOR', -- SUPER_ADMIN, ADMIN, EDITOR, VIEWER
  avatar TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "tenantId" TEXT REFERENCES "Tenant"(id),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### Tabela Model (formatos de encarte)
```sql
CREATE TABLE "Model" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- SOCIAL, PRINT, TV
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  "aspectRatio" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0
);
```

### Tabela Layout (grades)
```sql
CREATE TABLE "Layout" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "productsPerPage" INTEGER NOT NULL,
  columns INTEGER NOT NULL,
  rows INTEGER NOT NULL,
  "gridConfig" JSONB NOT NULL, -- { areas, gaps, sizes }
  "highlightPositions" INTEGER[] DEFAULT '{}',
  "isActive" BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  "modelId" TEXT REFERENCES "Model"(id)
);
```

### Tabela Theme
```sql
CREATE TABLE "Theme" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  thumbnail TEXT,
  "backgroundImage" TEXT,
  "isPremium" BOOLEAN DEFAULT false,
  "isPublic" BOOLEAN DEFAULT true,
  "isActive" BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  "cssConfig" JSONB NOT NULL,
  "headerConfig" JSONB,     -- { layout, showLogo, showDates, showTitle, height, backgroundImage }
  "bodyConfig" JSONB,       -- { padding, gap, productCardStyle }
  "footerConfig" JSONB,     -- { text, showWatermark, style, height }
  "categoryName" TEXT,
  tags TEXT[] DEFAULT '{}',
  "createdById" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### Tabela Flyer (encarte)
```sql
CREATE TABLE "Flyer" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT DEFAULT 'Novo Encarte',
  status TEXT DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, ARCHIVED
  "startDate" TIMESTAMP,
  "endDate" TIMESTAMP,
  "customMessage" TEXT,
  "textSizeMode" TEXT DEFAULT 'MEDIUM', -- MAXIMUM, MINIMUM, MEDIUM
  observations TEXT,
  category TEXT,

  -- Toggles de exibição (painel Datas)
  "showDates" BOOLEAN DEFAULT true,
  "showStockWarning" BOOLEAN DEFAULT false,
  "showIllustrativeNote" BOOLEAN DEFAULT true,
  "showMedicineWarning" BOOLEAN DEFAULT false,
  "showPromoPhrase" BOOLEAN DEFAULT false,
  "promoPhrase" TEXT,
  "publishToPortal" BOOLEAN DEFAULT false,

  -- Toggles de visibilidade da empresa
  "showPhone" BOOLEAN DEFAULT true,
  "showWhatsapp" BOOLEAN DEFAULT false,
  "showPhoneLabel" BOOLEAN DEFAULT false,
  "showCompanyName" BOOLEAN DEFAULT true,
  "showSlogan" BOOLEAN DEFAULT true,
  "showPaymentMethods" BOOLEAN DEFAULT false,
  "showPaymentNotes" BOOLEAN DEFAULT false,
  "showAddress" BOOLEAN DEFAULT true,
  "showInstagram" BOOLEAN DEFAULT true,
  "showFacebook" BOOLEAN DEFAULT false,
  "showWebsite" BOOLEAN DEFAULT false,

  -- Toolbar
  "productBoxStyle" TEXT DEFAULT 'smart',
  "colorMode" TEXT DEFAULT 'smart',

  "fontConfig" JSONB,
  "logoPosition" JSONB,
  "colorPalette" JSONB,
  "footerStyle" TEXT,
  "inkEconomy" INTEGER DEFAULT 0,
  "showCover" BOOLEAN DEFAULT false,
  "snapshotUrl" TEXT,

  "tenantId" TEXT REFERENCES "Tenant"(id),
  "themeId" TEXT REFERENCES "Theme"(id),
  "modelId" TEXT REFERENCES "Model"(id),
  "layoutId" TEXT REFERENCES "Layout"(id),
  "createdById" TEXT REFERENCES "User"(id),
  "priceTagStyleId" TEXT REFERENCES "PriceTagStyle"(id),
  "badgeStyleId" TEXT REFERENCES "BadgeStyle"(id),

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### Tabela FlyerProduct (produto no encarte)
```sql
CREATE TABLE "FlyerProduct" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "flyerId" TEXT REFERENCES "Flyer"(id) ON DELETE CASCADE,
  "productId" TEXT REFERENCES "Product"(id),
  position INTEGER NOT NULL,
  "offerPrice" DECIMAL,
  "originalPrice" DECIMAL,
  unit TEXT DEFAULT 'UN',
  "customName" TEXT,
  "customImage" TEXT,
  observation TEXT,
  "limit" TEXT,
  "isHighlight" BOOLEAN DEFAULT false,
  "isAdult" BOOLEAN DEFAULT false,
  "isPinned" BOOLEAN DEFAULT false,
  "isPricePinned" BOOLEAN DEFAULT false,
  "customLines" JSONB,
  "bgOpacity" DECIMAL DEFAULT 1,
  "priceTagStyleId" TEXT REFERENCES "PriceTagStyle"(id),
  "badgeStyleId" TEXT REFERENCES "BadgeStyle"(id),
  "priceMode" TEXT DEFAULT 'simple', -- simple, from_to, take_pay, starting_at, per_unit
  "takeQuantity" INTEGER,
  "payQuantity" INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

### Tabela PriceTagStyle
```sql
CREATE TABLE "PriceTagStyle" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail TEXT,
  "cssConfig" JSONB NOT NULL, -- { bgColor, textColor, shape }
  "isGlobal" BOOLEAN DEFAULT true,
  "isActive" BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  "tenantId" TEXT REFERENCES "Tenant"(id),
  "createdAt" TIMESTAMP DEFAULT NOW()
);
```

### Tabela BadgeStyle
```sql
CREATE TABLE "BadgeStyle" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  thumbnail TEXT,
  type TEXT NOT NULL, -- PROMO, OFFER, NEW, FEATURED
  "cssConfig" JSONB NOT NULL, -- { bgColor, textColor, text, position }
  "isGlobal" BOOLEAN DEFAULT true,
  "isActive" BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 0,
  "tenantId" TEXT REFERENCES "Tenant"(id)
);
```

---

## Conexão com Banco (lib/db.ts)

```typescript
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

export async function queryOne(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result.rows[0] ?? null;
}

export async function queryMany(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function queryCount(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function execute(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

// Helpers para UPDATE e INSERT dinâmicos
export function buildUpdate(table: string, data: Record<string, unknown>, where: Record<string, unknown>) { ... }
export function buildInsert(table: string, data: Record<string, unknown>) { ... }
```

---

## Storage (lib/storage.ts)

```typescript
import { Client } from "minio";

const storageClient = new Client({
  endPoint: process.env.WASABI_ENDPOINT || "s3.wasabisys.com",
  port: 443,
  useSSL: true,
  accessKey: process.env.WASABI_ACCESS_KEY,
  secretKey: process.env.WASABI_SECRET_KEY,
  region: process.env.WASABI_REGION || "us-east-1",
});

const BUCKET = process.env.WASABI_BUCKET;
const PUBLIC_URL = `https://${BUCKET}.s3.${REGION}.wasabisys.com`;

export async function uploadFile(file: Buffer, fileName: string, contentType: string): Promise<string> {
  const objectName = `${Date.now()}-${fileName}`;
  await storageClient.putObject(BUCKET, objectName, file, file.length, { "Content-Type": contentType });
  return `${PUBLIC_URL}/${objectName}`;
}
```

---

## Constantes Importantes

```typescript
export const PRODUCT_UNITS = [
  { value: "UN", label: "Unidade", abbr: "un" },
  { value: "KG", label: "Quilograma", abbr: "kg" },
  { value: "G", label: "Grama", abbr: "g" },
  { value: "L", label: "Litro", abbr: "L" },
  { value: "ML", label: "Mililitro", abbr: "ml" },
  { value: "PCT", label: "Pacote", abbr: "pct" },
  { value: "CX", label: "Caixa", abbr: "cx" },
  { value: "DZ", label: "Dúzia", abbr: "dz" },
  { value: "BD", label: "Bandeja", abbr: "bd" },
  { value: "FD", label: "Fardo", abbr: "fd" },
  { value: "SC", label: "Saco", abbr: "sc" },
];

export const TEXT_SIZE_MODES = [
  { value: "MAXIMUM", label: "Texto Maior Possível" },
  { value: "MINIMUM", label: "Texto Mínimo" },
  { value: "MEDIUM", label: "Texto Médio" },
];

export const PRODUCT_BOX_STYLES = [
  { value: "smart", label: "Inteligente" },
  { value: "standard", label: "Padrão" },
];

export const COLOR_MODES = [
  { value: "smart", label: "Inteligente" },
  { value: "standard", label: "Padrão" },
];

export const FOOTER_SHAPE_STYLES = [
  { value: "rounded-large", label: "Redondo Grande" },
  { value: "square-large", label: "Quadrado Grande" },
  { value: "square-compact", label: "Quadrado Compacto" },
];

export const ZOOM_OPTIONS = [
  { value: -1, label: "Auto" },
  { value: 30, label: "30%" }, { value: 40, label: "40%" },
  { value: 50, label: "50%" }, { value: 60, label: "60%" },
  { value: 70, label: "70%" }, { value: 80, label: "80%" },
  { value: 90, label: "90%" }, { value: 100, label: "100%" },
];

export const FLYER_CATEGORIES = [
  { value: "", label: "Sem Categoria" },
  { value: "supermercado", label: "Supermercado" },
  { value: "acougue", label: "Açougue" },
  { value: "padaria", label: "Padaria" },
  { value: "hortifruti", label: "Hortifrúti" },
  { value: "farmacia", label: "Farmácia" },
  { value: "bebidas", label: "Bebidas" },
  { value: "pet-shop", label: "Pet Shop" },
  { value: "material-construcao", label: "Material de Construção" },
  { value: "eletronicos", label: "Eletrônicos" },
  { value: "cosmeticos", label: "Cosméticos" },
  { value: "restaurante", label: "Restaurante" },
];
```

---

## Fluxo do Usuário

1. **Login/Registro** → Cria tenant + user admin
2. **Dashboard** → Lista de encartes com cards (título, tema, qtd produtos, snapshot)
3. **Novo Encarte** → Dialog para escolher tema, modelo e layout → redireciona para builder
4. **Builder** → Editor completo com sidebar + toolbar + canvas
5. **Adicionar Produtos** → Buscar no banco OU colar lista de texto
6. **Personalizar** → Tema, grade, cores, texto, logo, datas
7. **Editar Produtos** → Preço, imagem, modo de preço, observação
8. **Download** → Gera PNG via html2canvas com escala configurável
9. **Postar** → Copia texto para redes sociais com #PraCegoVer
