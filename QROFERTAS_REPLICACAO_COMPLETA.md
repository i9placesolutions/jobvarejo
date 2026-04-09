# QROfertas Builder V2 — Documentação Técnica Completa para Replicação

## 1. ARQUITETURA GERAL

### Estrutura HTML Principal
```
.builder
├── #MENU_VIEW (sidebar esquerda)
│   ├── .menu-control (ícones do menu lateral)
│   ├── .menu-tabs (abas: Pesquisar / Meus Produtos)
│   └── .menu-contents
│       └── .content-result
│           └── .block-search.tabsProdutos
│               ├── .menu-metas.header-search-produtos (textarea de entrada)
│               ├── .search.box-search-menu (botão Buscar)
│               └── .resultados.list-cards (resultados da busca)
│
└── #RENDER_VIEW (área de preview)
    └── .render-content
        ├── .render-template
        │   ├── .render-tools (toolbar com dropdowns)
        │   ├── .render-template-content-box
        │   │   └── .render-template-content.TEMA_*
        │   │       └── .tema-item.MODO_FREE.FOOTER_MODELO_*
        │   │           └── .tema-uploader.tema-jornal.tema-modelo-{N}
        │   │               ├── img.img-tema-full (imagem de fundo do tema)
        │   │               ├── .tema-header-box-area (CAPA)
        │   │               │   └── .tema-header-{N} (conteúdo da capa)
        │   │               └── .modelo-body-{N}.layout-body-{grade}
        │   │                   └── .place-holder-tema-{N}
        │   │                       ├── .drag-row.lista-de-produtos-sort (GRID DE PRODUTOS)
        │   │                       ├── style (CSS dinâmico das etiquetas)
        │   │                       ├── .TEXTO_RODAPE.bar-boxes-{N} (RODAPÉ - ícones)
        │   │                       └── .TEXTO_RODAPE.bar-end-{N} (RODAPÉ - "Feito com ❤️")
        │   └── .render-pagination-tools (paginação + download)
        ├── .menu-metas "Editar Produtos"
        ├── .bar-fast-inputs (contador de produtos)
        └── .lista.list-cards.ui-sortable (lista de edição dos produtos)
```

---

## 2. SISTEMA DE IMAGENS

### Algoritmo de Dimensionamento (NÃO usa object-fit: contain + scale)
O QROfertas calcula dimensões inline em pixels via JavaScript:

```javascript
function calcImageSize(natW, natH, containerW, containerH) {
  const natRatio = natW / natH;
  const containerRatio = containerW / containerH;
  if (natRatio > containerRatio) {
    // Imagem mais larga que container → width = 100%, height proporcional
    return { width: containerW, height: containerW / natRatio };
  } else {
    // Imagem mais alta que container → height = 100%, width proporcional
    return { width: containerH * natRatio, height: containerH };
  }
}
```

### CSS do Container de Imagem
```css
.v3-image {
  grid-area: IMAGE;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.v3-image img {
  object-fit: fill; /* NÃO contain */
  max-width: 100%;
  max-height: 100%;
  /* width e height definidos inline em px pelo JavaScript */
}
```

### Galeria de Imagens (Seleção)
```
.pem_auto_suggest_image_for_create
├── .criado-com-sucesso-box (mensagem de sucesso)
├── .menu-metas "Criar usando uma imagem da internet sem fundo"
└── .select-images-for-create.HASH_ID_s_{hash}
    └── .card.card-selectable.select-image-item-for-create (×38 aprox.)
        ├── .img-top.img-placeholder > img.card-img-top
        ├── span.selected-bubble.selected-bubble-select → "Criar"
        ├── span.selected-bubble.selected-bubble-selected → "Selecionado"
        └── span.selected-bubble.selected-bubble-unselect → "Remover"
```

**Data attributes da imagem:**
- `data-is_png`: "1" (se tem fundo transparente)
- `data-img_id`: hash MD5 da imagem
- `data-hash_id_s`: hash do produto para buscar variações

**URL pattern das imagens:**
```
https://qrofertas.s3.us-west-2.amazonaws.com/imagens-produtos-v2/{pem_url}/{img_id}.webp
```

---

## 3. SISTEMA DE GRADES (GRID)

### Container Principal
```css
.drag-row.lista-de-produtos-sort {
  display: flex;
  flex-wrap: wrap;
  /* flex-direction varia por layout */
}
```

### Flex Direction por Layout
| flex-direction | Layouts (grade IDs) |
|---|---|
| `row` | 31, 32, 33, 35, 37-47, 50 |
| `column` | 29, 28, 30, 34, 48, 49, 51 |
| `column` + `wrap` | 53, 55, 62, 63, 86 |

### Todas as 19 Grades Disponíveis

| Grade ID | Nome | Layout | Dimensões de cada box |
|---|---|---|---|
| -1 | Automático | — | Sistema escolhe baseado na qtd |
| 14 | 1 Produto - 1x1 | 1×1 | 100% × 100% |
| 15 | 2 Produtos - 2x1 | 2×1 | 50% × 100% |
| 17 | 2 Produtos - 1x2 | 1×2 | 100% × 50% |
| 36 | 3 Produtos - 1x3 | 1×3 | 100% × 33.3% |
| 16 | 3 Produtos - 3x1 | 3×1 | 33.3% × 100% |
| 12 | 4 Produtos - 2x2 | 2×2 | 50% × 50% |
| 30 | 5 Produtos - 4+1 dest. Direito | mix | 32.5% × 50% (normais) / 35% × 100% (destaque) |
| 29 | 5 Produtos - 4+1 dest. Esquerdo | mix | 30% × 50% (normais) / 40% × 100% (destaque row-0) |
| 33 | 6 Produtos - 4+2 dest. verticais | mix | 33% × 50% (normais) / destaques verticais |
| 25 | 6 Produtos - 2x3 | 2×3 | 50% × 33.3% |
| 31 | 7 Produtos - 1 dest. topo + 6 | mix | 33.3% × 30% (normais) / 100% × 40% (destaque row-0) |
| 11 | 8 Produtos - 4x2 | 4×2 | 25% × 50% |
| 13 | 9 Produtos - 3x3 | 3×3 | 33.3% × 33.3% |
| 35 | 11 Produtos - 3 dest. topo + 8 | mix | 25% × ~22% (normais) / 33.3% × 28% (destaques row 0-2) |
| 37 | 17 Produtos - 1 dest. topo + 4x4 | mix | 25% × 18% (normais) / 100% × 28% (destaque row-0) |
| 86 | 10 Produtos - TABELA de 10 | tabela | column+wrap |
| 89 | 20 Produtos - TABELA de 20 | tabela | column+wrap |
| 90 | 30 Produtos - TABELA de 30 | tabela | column+wrap |

### CSS de Cada Layout Box
```css
/* Todas usam calc(X% - var(--margin-layout)) */
/* --margin-layout default: 10px */

.layout-box-11 { width: calc(25% - var(--margin-layout)); height: calc(50% - var(--margin-layout)); }
.layout-box-12 { width: calc(50% - var(--margin-layout)); height: calc(50% - var(--margin-layout)); }
.layout-box-13 { width: calc(33.3% - var(--margin-layout)); height: calc(33.3% - var(--margin-layout)); }
.layout-box-14 { width: calc(100% - var(--margin-layout)); height: calc(100% - var(--margin-layout)); }
.layout-box-15 { width: calc(50% - var(--margin-layout)); height: calc(100% - var(--margin-layout)); }
.layout-box-16 { width: calc(33.3% - var(--margin-layout)); height: calc(100% - var(--margin-layout)); }
.layout-box-17 { width: calc(100% - var(--margin-layout)); height: calc(50% - var(--margin-layout)); }
.layout-box-25 { width: calc(50% - var(--margin-layout)); height: calc(33.3% - var(--margin-layout)); }
.layout-box-29 { width: calc(30% - var(--margin-layout)); height: calc(50% - var(--margin-layout)); }
.layout-box-30 { width: calc(32.5% - var(--margin-layout)); height: calc(50% - var(--margin-layout)); }
.layout-box-31 { width: calc(33.3% - var(--margin-layout)); height: calc(30% - var(--margin-layout)); }
.layout-box-35 { width: calc(25% - var(--margin-layout)); height: calc(22% - var(--margin-layout)); }
.layout-box-37 { width: calc(25% - var(--margin-layout)); height: calc(18% - var(--margin-layout)); }
```

### Destaques (Overrides por Row)
```css
/* Grade 29: Destaque esquerdo */
.layout-box-29.layout-box-row-0 {
  width: calc(40% - var(--margin-layout));
  height: calc(100% - var(--margin-layout));
}

/* Grade 30: Destaque direito */
.layout-box-30.layout-box-row-4 {
  width: calc(35% - var(--margin-layout));
  height: calc(100% - var(--margin-layout));
}

/* Grade 31: Destaque topo */
.layout-box-31.layout-box-row-0 {
  width: calc(100% - var(--margin-layout));
  height: calc(40% - var(--margin-layout));
}

/* Grade 35: 3 Destaques topo */
.layout-box-35.layout-box-row-0,
.layout-box-35.layout-box-row-1,
.layout-box-35.layout-box-row-2 {
  width: calc(33.3% - var(--margin-layout));
  height: calc(28% - var(--margin-layout));
}

/* Grade 37: Destaque topo */
.layout-box-37.layout-box-row-0 {
  width: calc(100% - var(--margin-layout));
  height: calc(28% - var(--margin-layout));
}
```

---

## 4. CARD DO PRODUTO (Layout Interno)

### Estrutura HTML do Card
```html
<div class="produto-layout-v3 produto-box-{N} layout-box-{grade} layout-box-row-{N}
            IS_DESTAQUE|NOT_IS_DESTAQUE
            PRECO-OP-PRECO_SIMPLES
            CONTENT_LINE|CONTENT_ROW_BOTTOM
            ORDEM_TITULO_PRECO_IMAGEM|ORDEM_IMAGEM_TITULO_PRECO|...
            X_50-50|X_60-40|X_40-60|X_70-30|X_80-20
            Y_50-50|Y_60-40|Y_80-20|Y_20-80
            ETIQUETA_ORIENTACAO_HORIZONTAL|ETIQUETA_ORIENTACAO_VERTICAL
            INVADIR-INVADIR-NAO_INVADIR|INVADIR-INVADIR-INVADIR_20|...">

  <div class="produtos-contents-v3">
    <div class="v3-image" style="grid-area: IMAGE;">
      <!-- imagem do produto com dimensões inline -->
    </div>
    <div class="v3-titulo" style="grid-area: TITULO;">
      <!-- nome do produto -->
    </div>
    <div class="v3-etiqueta" style="grid-area: ETIQUETA;">
      <div class="etiqueta-v2">
        <div class="content-prices">
          <div class="etiqueta-v2-content">
            <div class="price-box">
              <div class="price-content">
                <div class="unidade-v2">kg</div>
                <div class="price-etiqueta-v2">
                  <div class="cifrao">R$</div>
                  <div class="real">49</div>
                  <div class="sep">,</div>
                  <div class="cents">90</div>
                </div>
              </div>
            </div>
            <img class="etiqueta-bg" /> <!-- imagem de fundo da etiqueta -->
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### CSS Grid do Card (produtos-contents-v3)
```css
/* Modo CONTENT_LINE (stack vertical) */
.CONTENT_LINE .produtos-contents-v3 {
  display: grid;
  grid-template-areas: "TITULO" "IMAGE" "ETIQUETA";
  grid-template-columns: 100%;
  grid-template-rows: var(--peso-3) var(--peso-1) var(--peso-2);
}

/* Modo CONTENT_ROW_BOTTOM (imagem + etiqueta lado a lado) */
.CONTENT_ROW_BOTTOM .produtos-contents-v3 {
  display: grid;
  grid-template-areas: "TITULO TITULO" "IMAGE ETIQUETA";
  grid-template-columns: var(--peso-x-primary) var(--peso-x-sec);
  grid-template-rows: var(--peso-y-primary) var(--peso-y-sec);
}
```

### 7 Classes Combináveis do Card

#### 1. CONTENT Type (layout geral)
- `CONTENT_LINE` → stack vertical (TITULO → IMAGE → ETIQUETA)
- `CONTENT_ROW_BOTTOM` → título em cima, imagem+etiqueta embaixo

#### 2. ORDEM (ordem dos elementos)
- `ORDEM_TITULO_PRECO_IMAGEM`
- `ORDEM_IMAGEM_TITULO_PRECO`
- `ORDEM_PRECO_TITULO_IMAGEM`
- (e outras combinações)

#### 3. X Weight (proporção horizontal imagem vs etiqueta)
```css
.X_50-50 { --peso-x-primary: 50%; --peso-x-sec: 50%; --peso-1: 33.3%; --peso-2: 33.3%; --peso-3: 33.3%; }
.X_60-40 { --peso-x-primary: 60%; --peso-x-sec: 40%; --peso-1: 60%; --peso-2: 20%; --peso-3: 20%; }
.X_40-60 { --peso-x-primary: 40%; --peso-x-sec: 60%; --peso-1: 40%; --peso-2: 30%; --peso-3: 30%; }
.X_70-30 { --peso-x-primary: 30%; --peso-x-sec: 70%; --peso-1: 70%; --peso-2: 15%; --peso-3: 15%; }
.X_80-20 { --peso-x-primary: 80%; --peso-x-sec: 20%; --peso-1: 80%; --peso-2: 10%; --peso-3: 10%; }
```

#### 4. Y Weight (proporção vertical título vs conteúdo)
```css
.Y_50-50 { --peso-y-primary: 50%; --peso-y-sec: 50%; }
.Y_60-40 { --peso-y-primary: 60%; --peso-y-sec: 40%; }
.Y_80-20 { --peso-y-primary: 70%; --peso-y-sec: 30%; }
.Y_20-80 { --peso-y-primary: 30%; --peso-y-sec: 70%; }
```

#### 5. ETIQUETA Orientação
- `ETIQUETA_ORIENTACAO_HORIZONTAL`
- `ETIQUETA_ORIENTACAO_VERTICAL`

#### 6. INVADIR (sobreposição da etiqueta sobre a imagem)
```css
.INVADIR-INVADIR-NAO_INVADIR   { --etiqueta-invadir: 0%; }
.INVADIR-INVADIR-INVADIR_20    { --etiqueta-invadir: 20%; }
.INVADIR-INVADIR-INVADIR_50    { --etiqueta-invadir: 50%; }
.INVADIR-INVADIR-INVADIR_100   { --etiqueta-invadir: 100%; }
.INVADIR-INVADIR-INVADIR_200   { --etiqueta-invadir: 200%; }
```

#### 7. IS_DESTAQUE
- `IS_DESTAQUE` → produto em posição de destaque (maior)
- `NOT_IS_DESTAQUE` → produto normal

---

## 5. TIPOS DE PREÇO (Etiquetas)

### 9 Tipos de Preço (pop_id → classe CSS)

| pop_id | Nome | Classe CSS | Descrição |
|---|---|---|---|
| 1 | Preço Simples | `PRECO-OP-PRECO_SIMPLES` | Apenas preço de oferta (PADRÃO) |
| 2 | Preço normal e Preço de oferta | `PRECO-OP-PRECO_DE_POR` | De/Por com desconto % |
| 3 | Preço X por Y | `PRECO-OP-PRECO_X_POR_Y` | Ex: "3 Kilos Por R$ 15,88" |
| 4 | Leve X pague Y | `PRECO-OP-PRECO_LEVE_PAGUE` | Ex: "Leve 3 Pague 2" |
| 5 | À vista e Parcelado | `PRECO-OP-PRECO_PARCELADO` | Preço à vista + parcelas |
| 7 | Preço Simbólico | `PRECO-OP-PRECO_SIMBOLICO` | Moedas/notas (< R$5) |
| 8 | Preço Clube | `PRECO-OP-PRECO_CLUBE` | Preço clube/programa fidelidade |
| 9 | Antecipação de Ofertas | `PRECO-OP-PRECO_ANTECIPACAO` | "Oferta Especial", "Venha Conferir" |
| 11 | Sem Etiqueta | `PRECO-OP-SEM_ETIQUETA` | Não mostra preço |

### Estrutura da Etiqueta (PRECO_SIMPLES)
```html
<div class="v3-etiqueta">
  <div class="etiqueta-v2">
    <div class="content-prices">
      <div class="etiqueta-v2-content">
        <div class="price-box">
          <div class="price-content">
            <div class="unidade-v2">kg</div>
            <div class="price-etiqueta-v2">
              <div class="cifrao">R$</div>
              <div class="real">49</div>
              <div class="sep">,</div>
              <div class="cents">90</div>
            </div>
          </div>
        </div>
        <img class="etiqueta-bg" /> <!-- fundo colorido da etiqueta -->
      </div>
    </div>
  </div>
</div>
```

### Modal de Opções de Preço
```html
<div class="modal-select-options" style="position: fixed; z-index: > 100">
  <div class="content-modal-select">
    <div class="close">✕</div>
    <div class="content-xhr">
      <div class="header-with-options">
        <input type="checkbox" /> Aplicar em todos produtos do encarte
        <input type="checkbox" /> Definir como Padrão da conta
      </div>
      <div class="row-options.row-options-produto.card" data-pop_id="{N}">
        <div class="fake-radio">○/●</div>
        <div class="text-option">
          <h4>Título do tipo</h4>
          <p>Descrição</p>
        </div>
        <div class="image-sample"><!-- preview da etiqueta --></div>
      </div>
      <!-- repete para cada tipo -->
    </div>
  </div>
</div>
```
**Comportamento:** Clicar em um `row-options-produto` seleciona o tipo E fecha o modal automaticamente.

---

## 6. FORMULÁRIO DE EDIÇÃO DO PRODUTO

### Estrutura HTML do Card de Edição
```html
<div class="produto-compacto-editavel produto-box produto-{pem_id}"
     data-target=".produto-{pem_id}"
     data-pem_id="{id}"
     data-pem_url="{slug}"
     data-pem_preco_oferta="{preco_cents}"
     data-pop_id="{tipo_preco}"
     data-hash_id_s="{hash}"
     data-produto_fixado="0"
     data-produto_fixar_posicao=""
     data-produto_fixar_preco="0"
     data-pro_id="0"
     data-posicao="">

  <div class="drag hide-in-results">Arraste</div>
  <div class="get-view hide-in-results">Ver</div>
  
  <div class="col-12 col-sm-dados">
    <div class="fields form-PRECO_SIMPLES">
      <div class="row">
        <!-- Coluna da Imagem (col-8 col-sm-2) -->
        <div class="col-8 col-sm-2">
          <div class="img-placeholder IMAGE image-choice-btn"><!-- thumb --></div>
          <a class="search-image uploader">Enviar Imagem</a>
          <a class="search-image editar-imagens">Editar Imagem</a>
        </div>
        
        <!-- Coluna do Formulário (col-12 col-sm-9) -->
        <div class="col-12 col-sm-9">
          <!-- Nome do produto -->
          <input class="editar-pem_nome" type="text" placeholder="Nome do produto" />
          
          <!-- Opções de Preço (abre modal) -->
          <div class="modo-de-precos">
            <svg>⚙️</svg> Opções de Preço
          </div>
          
          <!-- Preço -->
          <span class="preco-label">Preço Oferta</span>
          <span class="input-group-text">R$</span>
          <input class="editar-pem_preco_oferta" type="text" value="3,99" />
          
          <!-- Unidade -->
          <select class="editar-pem_unidade">
            <option>Escolha...</option>
            <!-- 49 opções (ver lista abaixo) -->
          </select>
          
          <!-- Observação -->
          <input class="editar-pem_limite" type="text" placeholder="Ex: próximo ao vencimento" />
          
          <!-- Selo +18 -->
          <input class="editar-pem_maioridade" type="checkbox" />
          <label>Apenas Maiores de 18 → + 18</label>
        </div>
        
        <!-- Coluna de Ações (col-12 col-sm-1) -->
        <div class="col-12 col-sm-1">
          <a class="REMOVER btn-danger">Remover</a>
          <a class="DISABLE get-view btn-secondary">Já inserido</a>
          <a class="EDITAR btn-warning hide">EDITAR PRODUTO</a>
          <a class="ADICIONAR btn-success">Adicionar</a>
          <a class="EDICAO-OK btn-primary">Ok</a>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Opções de Unidade (49 opções)
```
Escolha..., Barra, Bola, Caixa, Centimetro, Cubo, Duzia, Fardo, Fatia, Saco,
Grama, 100 Gramas, Galão, Garrafa, Jarra, Kilo, Litro, Maço, Metro, Pacote,
Tambor, Pares, Peça, Porção, Kit, Prato, Quilo, Unidade, Ml, M², Tela, Lata,
Vaso, Bandeja, Sachê, Milheiro, Rolo, Cento, Cada, Libra, Display, Combo,
Cartela, Tonelada, Balde, Pote, Polegada, Pe, Jarda
```

---

## 7. MODELOS DE FORMATO (Modelo Dropdown)

### 13 Formatos Disponíveis

| # | Nome | Classe Tema | Modelo | Dimensões |
|---|---|---|---|---|
| 1 | Encarte feed facebook quadrado | `TEMA_VERTICAL` | `tema-modelo-1` | 1200×1200 |
| 2 | Formato para status e stories | `TEMA_STORIES_INDIVIDUAL` | `tema-modelo-3` | 1080×1920 |
| 3 | Formato feed/reels instagram | `TEMA_STORIES_INDIVIDUAL` | `tema-modelo-3` | 1080×1350 |
| 4 | Vídeo tabela rede social | — | — | — |
| 5 | Encarte grande para impressão | — | — | grande |
| 6 | Encarte a4 para impressão | — | — | A4 vertical |
| 7 | Encarte a4 horizontal para impressão | — | — | A4 horizontal |
| 8 | Cartaz a4 vertical para impressão | — | — | A4 vertical |
| 9 | Cartaz a4 horizontal para impressão | — | — | A4 horizontal |
| 10 | Formato para tv horizontal | — | — | 16:9 |
| 11 | Formato para tv vertical | — | — | 9:16 |
| 12 | Vídeo tabela tv horizontal | — | — | 16:9 |
| 13 | Vídeo tabela tv vertical | — | — | 9:16 |

### Comportamento na Mudança de Formato
- Ao mudar o modelo, a grade é recalculada automaticamente
- O sistema ajusta `layout-body-{grade}` e `modelo-body-{N}`
- Se produtos não cabem na nova grade, cria paginação automática
- Exemplo: Stories (7 prods/página) → Feed 1x1 (1 prod/página) = 4 páginas para 4 produtos

---

## 8. RODAPÉ (Footer)

### 3 Modelos de Rodapé

| Modelo | Classe | CSS | Visual |
|---|---|---|---|
| V1 | `FOOTER_MODELO_V1` | Flexbox | Quadrado Compacto |
| V2 | `FOOTER_MODELO_V2` | CSS Grid | Redondo Grande |
| V3 | `FOOTER_MODELO_V3` | CSS Grid | Quadrado Grande |

### Footer V2/V3 (CSS Grid)
```css
.line-pag-validade {
  display: grid;
  grid-template-areas: "C R" "C R" "F F";
  grid-template-columns: 30% 70%;
  max-height: calc(var(--footer-line-height) * 3);
  border-radius: calc(var(--footer-line-height) / 2); /* V2=arredondado, V3=0 */
  background: rgb(253, 210, 1);
}

/* Adaptações quando faltam seções */
.footer-no-has-left  { grid-template-areas: "R R" "R R" "F F"; }
.footer-no-has-right { grid-template-areas: "C F" "C F" "C F"; }
.footer-no-has-right.footer-no-has-bottom { grid-template-areas: "C C" "C C" "C C"; }
```

### Footer Chip (ícone + texto)
```css
.item-chip {
  display: grid;
  grid-template-areas: "ICONE ITEM-1" "ICONE ITEM-2";
  grid-template-columns: auto 1fr;
  height: var(--chip-height); /* 100px */
}
```

### CSS Variables do Footer
```css
--footer-line-height: 100px;
--chip-height: 100px;
```

---

## 9. PAGINAÇÃO

### Estrutura
```html
<div class="render-pagination-tools">
  <button>Anterior</button>
  <span>Página {X} de {Y}</span>
  <button>Próximo</button>
  
  <input type="checkbox" /> Só esta página
  <input type="checkbox" /> Modo Leve
  
  <div class="dropdown">
    Download ▼
    <option>1.0x Mínimo</option>
    <option>2.0x Normal</option>
    <option>3.0x Grande</option>
    <option>4.0x Muito Grande</option>
    <option>Formato PDF</option>
    <option>5.0x - 8.0x</option>
  </div>
  
  <button>Publicar na TV</button>
  <button>Publicação Turbo</button>
</div>
```

### Lógica de Paginação
- Calculada automaticamente: `ceil(totalProdutos / produtosPorGrade)`
- Ao mudar grade/modelo, recalcula número de páginas
- "Só esta página" → exporta apenas a página atual
- Navegação: Anterior/Próximo com indicador "Página X de Y"

---

## 10. TOOLBAR COMPLETA

### Dropdowns da Toolbar

| Dropdown | Classe CSS | Opções |
|---|---|---|
| Modelo | `.modelo-select-form` | 13 formatos (ver seção 7) |
| Grade | `.grade-itens-select` | 19 grades (ver seção 3) |
| Boxes de Produtos | `.option_estrutura-type` | Inteligente, Manual |
| Texto | `.text-type` | Texto médio, Texto grande, Texto pequeno |
| Cores | `.option_palleta-type` | Inteligente, Manual |
| Gerar Capa | toggle switch | On/Off |
| Rodapé | `.option_footer-type` | 3 modelos (ver seção 8) |
| Zoom | select | Auto, 30%-100% (em 10%) |

---

## 11. FLUXO DE INSERÇÃO DE PRODUTOS

### Passo a Passo
1. **Entrada de texto**: Usuário digita no textarea: `"Cerveja Brahma Lata 350ml R$ 3,99"`
2. **Clica "Buscar Produtos"**: Sistema faz GET para API
3. **API de busca**: `GET /services/api-produtos/?query={texto}&noCorrection=true`
4. **Resultado**: Mostra card com imagem, nome, preço e botão "+ ADICIONAR"
5. **Galeria de imagens**: Mostra ~38 variações de imagem do produto
6. **Seleção de imagem**: Clique no card seleciona (borda azul + "CRIAR")
7. **Adicionar ao encarte**: Clique em "ADICIONAR" ou "Criar Novo produto"
8. **Edição**: Produto aparece na lista de edição com todos os campos editáveis
9. **Preview**: Produto renderizado no encarte em tempo real

### Data Attributes do Produto
```
data-pem_id: "25925947"          (ID do produto)
data-pem_url: "cerveja-brahma-lata-350ml"  (slug para URL da imagem)
data-hash_id_s: "a171a146b594..."  (hash para buscar variações de imagem)
data-image_orientation: "quadrado" | "vertical_1"  (classificação do aspecto)
data-row: "produto-box-0"        (posição no layout)
data-rp: "0"                     (índice da posição)
data-produto_fixado: "0"         (fixar posição)
data-produto_fixar_preco: "0"    (fixar preço)
data-pop_id: "1"                 (tipo de preço)
data-pem_preco_oferta: "399"     (preço em centavos)
```

### Classes de Estado do Produto
```
IS_DESTAQUE | NOT_IS_DESTAQUE       (posição destaque)
PRECO-OP-PRECO_SIMPLES | etc.      (tipo de preço)
no-bg | no-proibido | no-aviso     (flags visuais)
request-png-{N} | is-png-{N}      (estado da imagem PNG)
```

---

## 12. CSS VARIABLES GLOBAIS

```css
:root {
  --margin-layout: 10px;        /* margem entre boxes */
  --peso-1: 50%;                /* peso imagem (CONTENT_LINE) */
  --peso-2: 25%;                /* peso etiqueta (CONTENT_LINE) */
  --peso-3: 25%;                /* peso título (CONTENT_LINE) */
  --peso-x-primary: 50%;        /* largura imagem (CONTENT_ROW) */
  --peso-x-sec: 50%;            /* largura etiqueta (CONTENT_ROW) */
  --peso-y-primary: 65%;        /* altura título+conteúdo (CONTENT_ROW) */
  --peso-y-sec: 35%;            /* altura título (CONTENT_ROW) */
  --footer-line-height: 100px;  /* altura da linha do rodapé */
  --chip-height: 100px;         /* altura do chip do rodapé */
  --etiqueta-invadir: 0%;       /* sobreposição da etiqueta */
}
```

---

## 13. HIERARQUIA DE CLASSES CSS (Resumo)

### No Encarte (Preview)
```
.render-template-content.TEMA_{formato}
  └── .tema-item.MODO_FREE.FOOTER_MODELO_{V1|V2|V3}
      └── .tema-uploader.tema-modelo-{N}.zoom-{N}
          ├── img.img-tema-full (background)
          ├── .tema-header-box-area > .tema-header-{N}
          └── .modelo-body-{N}.layout-body-{grade}
              └── .drag-row.layout-{grade}.lista-de-produtos-sort
                  └── .produto-layout-v3.layout-box-{grade}.layout-box-row-{N}
                      └── .produtos-contents-v3
                          ├── .v3-image (grid-area: IMAGE)
                          ├── .v3-titulo (grid-area: TITULO)
                          └── .v3-etiqueta (grid-area: ETIQUETA)
```

### No Formulário (Sidebar)
```
.produto-compacto-editavel.produto-{pem_id}
  ├── .drag (arrastar para reordenar)
  ├── .get-view (ver no encarte)
  └── .fields.form-{PRECO_TYPE}
      └── .row
          ├── .col-sm-2 (imagem + upload + editar)
          ├── .col-sm-9 (campos do formulário)
          └── .col-sm-1 (botões de ação)
```

---

## 14. REDIMENSIONAMENTO DINÂMICO

### Ao Mudar Formato (Modelo)
1. Sistema muda `TEMA_{formato}` no `.render-template-content`
2. Muda `tema-modelo-{N}` no `.tema-uploader`
3. Dimensões do `tema-uploader` mudam (ex: 1080×1920 → 1200×1200)
4. Grade é recalculada automaticamente
5. `layout-body-{grade}` e `modelo-body-{N}` são atualizados
6. Se qtd produtos > capacidade da grade → cria páginas adicionais

### Ao Adicionar/Remover Produto
1. Produto é adicionado/removido do `.drag-row`
2. Se excede capacidade da grade → nova página criada
3. Se sobram espaços → produtos redistribuídos
4. Atualiza contador "X Produtos Selecionados"
5. Atualiza paginação "Página X de Y"

### Dimensões por Formato
| Formato | Largura | Altura | Ratio |
|---|---|---|---|
| Feed Facebook | 1200px | 1200px | 1:1 |
| Stories | 1080px | 1920px | 9:16 |
| Feed/Reels Instagram | 1080px | 1350px | 4:5 |
| TV Horizontal | ~1920px | ~1080px | 16:9 |
| A4 Vertical | ~794px | ~1123px | A4 |

---

## 15. DRAG & DROP (Reordenação)

### Implementação
- Usa jQuery UI Sortable (`.ui-sortable`)
- Container: `.lista.list-cards.ui-sortable` (lista de edição)
- Handle: `.drag` (botão "Arraste")
- Ao soltar, atualiza `data-row` e `layout-box-row-{N}` de todos os produtos
- Preview no encarte atualiza em tempo real

---

## 16. SISTEMA DE TEMAS E CORES

### Estrutura do Tema no DOM
```
.render-template-content.TEMA_VERTICAL
  └── .tema-item.MODO_FREE.FOOTER_MODELO_V1.NO_HAS_MENSAGEM
      └── .tema-uploader.tema-jornal.tema-modelo-1.no-footer.zoom-{N}
          ├── img.img-tema-full (imagem de fundo, position: absolute, z-index: auto)
          ├── .tema-header-box-area (CAPA, z-index: 22, 1200×345px)
          │   └── .place-holder-tema-1.tema-header-1
          ├── .modelo-body-1.layout-body-12 (CORPO, contém grid de produtos)
          │   └── .place-holder-tema-1 (wrapper dos produtos + rodapé)
          └── [footer se ativo]
```

### jQuery Data do `.tema-item`
```javascript
{
  mod_id: 1,              // ID do modelo (1=Feed, 3=Stories, etc.)
  lay_id: 12,             // ID do layout/grade
  has_modelo_tv: 1,       // Suporta TV Indoor
  haspublicacoes: 0,      // Tem publicações vinculadas
  car_id: 0,              // ID do carrinho
  tem_color: "#000000",   // Cor principal do tema
  user_free: 1,           // Usuário é free
  tem_premium: 1,         // Tema é premium
  tem_id: 5219,           // ID do tema atual
  mod_alias_id: 0,        // Alias do modelo
  target_file: "encarte-feed-facebook-e-whatsappquadrado",
  art_version: 1,         // Versão do art
  art_id: 12787324,       // ID do encarte
  pagina_total: 1,        // Total de páginas
  pagina: 1               // Página atual
}
```

### Classes do `.tema-uploader`
```
tema-uploader          → container principal
tema-jornal            → tipo de encarte (jornal/tabloide)
medio-normalizar-normalizar-texto → normalização de texto
tema-modelo-1          → modelo visual (1=Feed 1:1, 3=Stories 9:16)
no-footer              → sem rodapé ativo
zoom--1                → modo de zoom ativo
zoom-41.3              → nível de zoom calculado
```

### Seleção de Temas (Sidebar)

**Estrutura do card de tema:**
```html
<div class="item-list-element card card-selectable card-selectable-2 tema-item-select"
     data-pos="0"
     data-gerador_modo="ENCARTES"
     data-tem_id="15618">
  <div class="img-top">
    <img class="card-img-top" /> <!-- thumbnail do tema -->
  </div>
  <span class="tags new">NOVO</span>
  <span class="tags premium">PREMIUM</span>
  <div class="card-body">
    <h3 class="card-title">Nome do Tema</h3>
  </div>
  <span class="previa">Prévia</span>  <!-- botão de preview -->
</div>
```

**Categorias de temas:**
- Organizadas em `.pacote.temas.lists-elements`
- Cada pacote contém 4+ temas por categoria
- Categorias são carregadas sob demanda via API
- Exemplos: Abril, Dia Das Mães, Outono, Eventos Regionais, Dia do Trabalho

**API de listagem:** `GET /services/api-list-temas?categoriaStart=CAM_{N}&GERADOR_MODO=ENCARTES`
- Retorna HTML com cards organizados por categoria
- Thumbnails: `storage.qrofertas.com/temas/imagens-thumbs/{uuid}.webp?w=258`

---

## 17. MODAL "TROCAR COR DE FUNDO"

### Estrutura
```
.modal-select-options (position: fixed, z-index: 9999)
  └── .content-xhr
      └── .produto-pallet-editor
          ├── data-lay_id="12"
          ├── data-rp="0"
          ├── data-mod_id="1"
          └── data-art_id="12787324"
```

### Seção "Aplicar em:"
4 checkboxes (value="1", unchecked por padrão):
- **Aplicar aos destaques** → aplica apenas nos produtos destaque
- **Aplicar à posição** → aplica à posição no grid (row-N)
- **Aplicar ao produto** → aplica ao produto específico
- **Aplicar ao encarte** → aplica ao encarte inteiro (+ botão "Resetar")

### Seção "Cor de Fundo:"
Grade de `.cor-item` com data attributes:
```html
<div class="cor-item"
     style="background-color: #1f5812; color: #ffffff;"
     data-bg="#1f5812"
     data-color="#ffffff"
     data-set_opacity="100">
  Texto
</div>
```

**Opções especiais:**
| Nome | data-bg | data-color | data-set_opacity |
|---|---|---|---|
| Padrão (branco) | #fff | #000 | 100 |
| Padrão (preto) | #000 | #fff | 30 |
| Sem Fundo | "" (vazio) | #000000 | 1 |

**1629 opções de cor disponíveis** incluindo:
- Verdes: #1f5812, #00600f, etc.
- Vermelhos: #bc1c1a, #870000, #840c0c, etc.
- Amarelos: #ffff00, #ffea00, #ffe300, #ffd88d, etc.
- E centenas de variações

### Seção "Transparência:"
```html
<input type="range" class="form-range" min="0" max="100" value="100" />
```

### Aplicação no DOM
A cor é aplicada no `.layer-decoration` do produto:
```html
<div class="layer-decoration"
     style="background-color: #050a30; color: #ffffff; opacity: 0.85;">
</div>
```

---

## 18. MODAL "ETIQUETA" (Personalização Visual)

### Estrutura
```
.modal-select-options (position: fixed, z-index: 9999)
  └── .content-xhr
      ├── "Aplicar em:" (mesmos 4 checkboxes)
      ├── "Tamanho da Fonte de Preço"
      │   └── toggle "Fontes no mesmo tamanho" (Centavos = Real)
      └── "Etiquetas:" (grade de modelos)
          └── .etiqueta-v2-select-item (×3534)
              data-eti_id="{id}"
```

### Modelos de Etiqueta
- **3534 modelos disponíveis** (cada um com imagem de fundo única)
- Cada modelo = imagem `.etiqueta-bg` + cor do texto inline
- Classe base: `.etiqueta-v2-select-item`
- Escala de preview: `transform: scale(0.217131)`

### Estrutura de cada modelo
```html
<div class="etiqueta-v2-select-item" data-eti_id="5882">
  <div class="v3-etiqueta">
    <div class="etiqueta-v2" style="transform: scale(0.217131);">
      <div class="content-prices">
        <div class="etiqueta-v2-content" style="color: #f77f00;">
          <div class="price-box">
            <div class="price-content">
              <div class="unidade-v2">KG</div>
              <div class="price-etiqueta-v2" style="font-size: 79.5px;">
                <span class="cifrao-preco-etiqueta-v2">R$</span>
                <span class="real-preco-etiqueta-v2">49</span>
                <span class="sep-preco-etiqueta-v2">,</span>
                <span class="centavos-etiqueta-v2">90</span>
              </div>
            </div>
          </div>
          <img class="etiqueta-bg" /> <!-- imagem de fundo -->
        </div>
      </div>
    </div>
  </div>
</div>
```

### Amostra de Etiquetas (eti_id → cor do texto)
| eti_id | Cor do texto | Descrição visual |
|---|---|---|
| 5882 | #f77f00 | Laranja sobre fundo escuro |
| 5881 | #faf33e | Amarelo sobre fundo |
| 5880 | #ffffff | Branco sobre fundo escuro |
| 5879 | #000000 | Preto sobre fundo claro |
| 5878 | #ffffff | Branco sobre fundo colorido |
| 5877 | #ff2d3d | Vermelho |
| 5876 | #f4ddbb | Bege claro |
| 5875 | #ffff00 | Amarelo vivo |

---

## 19. ETIQUETAS POR TIPO DE PREÇO (Estrutura HTML Completa)

### PRECO_SIMPLES (pop_id=1)
```
v3-etiqueta
  └── etiqueta-v2 (SEM HAS_TOP)
      └── content-prices
          └── etiqueta-v2-content (color: #ffffff)
              └── price-box
                  └── price-content
                      ├── unidade-v2 → "kg"
                      ├── price-etiqueta-v2 (font-size: ~80px)
                      │   ├── cifrao → "R$"
                      │   ├── real → "49"
                      │   ├── sep → ","
                      │   └── cents → "90"
                      └── img.etiqueta-bg
```

### PRECO_NORMAL_E_PRECO_OFERTA (pop_id=2)
```
v3-etiqueta
  └── etiqueta-v2.HAS_TOP
      └── content-prices
          ├── etiqueta-part-top-v2.text-box
          │   style: "background-color: #000000; color: #8fbb44; border-color: #8fbb44;"
          │   └── text-box-h → "Por" (texto configurável via campo "Texto Por")
          └── etiqueta-v2-content (color: #000000)
              └── price-box
                  └── price-content
                      ├── unidade-v2
                      ├── price-etiqueta-v2
                      └── img.etiqueta-bg
```

### PRECO_X_POR_Y (pop_id=3)
```
v3-etiqueta
  └── etiqueta-v2.HAS_TOP
      └── content-prices
          ├── etiqueta-part-top-v2.text-box
          │   style: "background-color: #ffffff; color: #7200ca; border-color: #7200ca;"
          │   └── text-box-h → "De" + quantidade (texto via "Texto Preço")
          └── etiqueta-v2-content
              └── price-box > price-content > [preço]
```

### PRECO_LEVE_X_POR_Y (pop_id=4)
```
v3-etiqueta
  └── etiqueta-v2.HAS_TOP
      └── content-prices
          ├── etiqueta-part-top-v2.text-box
          │   style: "background-color: #000000; color: #8fbb44; border-color: #8fbb44;"
          │   └── text-box-h
          │       ├── span.leve → "Leve "
          │       ├── span.leve → "1" (quantidade leve)
          │       ├── span.leve → " Pague "
          │       └── span.leve → "1" (quantidade pague)
          └── etiqueta-v2-content
              └── price-box > price-content > [preço]
```

### PRECO_COM_PARCELAMENTO (pop_id=5)
```
v3-etiqueta
  └── etiqueta-v2.HAS_TOP
      └── content-prices
          ├── etiqueta-part-top-v2.text-box
          │   style: "background-color: #ffffff; color: #7200ca; border-color: #7200ca;"
          │   └── text-box-h
          │       └── span.leve → "1X" (parcelas)
          └── etiqueta-v2-content
              └── price-box > price-content > [preço à vista]
```

### PRECO_SIMBOLICO (pop_id=7)
```
v3-etiqueta
  └── etiqueta-v2 (SEM HAS_TOP)
      └── preco-content.preco-simbolico
          └── etiqueta-v2-content.simbolic-price
              style: "padding-left: calc(250px - calc(100% / 20));"
              └── .coin.coin-quad (×N, repetido por valor)
                  style: "width: calc(100% / 19)"
                  └── img (imagem da moeda)
```
**Nota:** Não usa etiqueta-bg de imagem. Mostra moedas reais como imagens. Cada moeda configurável: 1¢, 5¢, 10¢, 25¢, 50¢, R$1, R$2, R$5+.

### PRECO_NORMAL_E_PRECO_CLUBE (pop_id=8)
```
v3-etiqueta
  └── etiqueta-v2.HAS_TOP
      └── content-prices
          ├── etiqueta-part-top-v2.text-box
          │   style: "background-color: #ffffff; color: #870000; border-color: #870000;"
          │   └── text-box-h → "Preço Clube" (configurável)
          └── etiqueta-v2-content
              └── price-box > price-content > [preço]
```

### ANTECIPACAO_DE_OFERTAS (pop_id=9)
```
v3-etiqueta
  └── etiqueta-v2.HAS_TOP
      └── content-prices
          ├── etiqueta-part-top-v2.text-box
          │   style: "background-color: #ffffff; color: #840c0c; border-color: #840c0c;"
          │   └── text-box-h → "Preço" (texto do campo "Texto Preço")
          └── etiqueta-v2-content
              └── price-box > price-content > [preço ou "Especial"]
```

### SEM_ETIQUETA (pop_id=11)
```
v3-etiqueta (vazio, sem filhos)
```
Grid muda para: `"IMAGE TITULO" / "IMAGE TITULO"` (sem área ETIQUETA)

---

## 20. TIPOS DE PREÇO — FORMULÁRIOS COMPLETOS

### pop_id=1 → form-PRECO_SIMPLES
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | Nome do produto |
| Preço Oferta | .editar-pem_preco_oferta | input text | "R$ 0,00" |
| Unidade | .editar-pem_unidade | select | 49 opções |
| Observação | .editar-pem_limite | input text | "Ex: próximo ao vencimento" |
| Maior de 18 | .editar-pem_maioridade | checkbox | "Apenas Maiores de 18" |

### pop_id=2 → form-PRECO_NORMAL_E_PRECO_OFERTA
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | Nome do produto |
| Texto De | .editar-text (label "Texto de") | input text | Default: "De" |
| Preço Normal | .editar-pem_preco | input text | "R$ 0,00" |
| Riscar Preço | .editar-pem_preco_cortado | toggle switch | Riscar preço normal |
| Texto Por | .editar-text (label "Texto Por") | input text | Default: "Por" |
| Preço Oferta | .editar-pem_preco_oferta | input text | "R$ 0,00" |
| Mostrar Desconto | .editar-pem_mostrar_desconto | toggle switch | Mostrar % desconto |
| Unidade | .editar-pem_unidade | select | 49 opções |
| Observação | .editar-pem_limite | input text | |
| Maior de 18 | .editar-pem_maioridade | checkbox | |

### pop_id=3 → form-PRECO_X_POR_Y
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | |
| Texto Preço | .editar-text | input text | "De" |
| Quantidade | (campo numérico) | input number | "1" |
| Preço Normal | .editar-pem_preco | input text | |
| Riscar Preço | .editar-pem_preco_cortado | toggle switch | |
| Texto Por | .editar-text | input text | "Por" |
| Preço Oferta | .editar-pem_preco_oferta | input text | |
| Unidade | .editar-pem_unidade | select | |
| Observação | .editar-pem_limite | input text | |
| Maior de 18 | .editar-pem_maioridade | checkbox | |

### pop_id=4 → form-PRECO_LEVE_X_POR_Y
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | |
| Texto Preço | .editar-text | input text | |
| Preço Normal | .editar-pem_preco | input text | |
| Riscar Preço | .editar-pem_preco_cortado | toggle switch | |
| Preço Oferta | .editar-pem_preco_oferta | input text | |
| Unidade | .editar-pem_unidade | select | |
| Observação | .editar-pem_limite | input text | |
| Maior de 18 | .editar-pem_maioridade | checkbox | |

### pop_id=5 → form-PRECO_COM_PARCELAMENTO
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | |
| Preço À Vista | .editar-pem_preco | input text | |
| Texto Apenas | .editar-text | input text | |
| Riscar Preço | .editar-pem_preco_cortado | toggle switch | |
| Parcelas Sem Juros | .editar-pem_parcelas_sem_juros | toggle switch | |
| Observação | .editar-pem_limite | input text | |

### pop_id=7 → form-PRECO_SIMBOLICO
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | |
| Preço Oferta | .editar-pem_preco_oferta | input text | |
| Unidade | .editar-pem_unidade | select | |
| Observação | .editar-pem_limite | input text | |
| Maior de 18 | .editar-pem_maioridade | checkbox | |
| Arredondar Centavos | .editar-pem_arredondar_centavos | toggle | |
| Inverter Ordem Moedas | .editar-pem_moedas_inverter_ordem | toggle | |
| Moeda 1¢ | .editar-pem_usar_moeda_1 | checkbox | |
| Moeda 5¢ | .editar-pem_usar_moeda_5 | checkbox | |
| Moeda 10¢ | .editar-pem_usar_moeda_10 | checkbox | |
| Moeda 25¢ | .editar-pem_usar_moeda_25 | checkbox | |
| Moeda 50¢ | .editar-pem_usar_moeda_50 | checkbox | |
| Moeda R$1 | .editar-pem_usar_moeda_100 | checkbox | |
| Moeda R$2 | .editar-pem_usar_moeda_200 | checkbox | |
| Moeda R$5+ | .editar-pem_usar_moeda_500 | checkbox | |

### pop_id=8 → form-PRECO_NORMAL_E_PRECO_CLUBE
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | |
| Texto Preço | .editar-text | input text | "Preço Clube" |
| Preço Normal | .editar-pem_preco | input text | |
| Riscar Preço | .editar-pem_preco_cortado | toggle switch | |
| Preço Oferta | .editar-pem_preco_oferta | input text | |
| Mostrar Desconto | .editar-pem_mostrar_desconto | toggle switch | |
| Unidade | .editar-pem_unidade | select | |
| Observação | .editar-pem_limite | input text | |
| Maior de 18 | .editar-pem_maioridade | checkbox | |

### pop_id=9 → form-ANTECIPACAO_DE_OFERTAS
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | |
| Texto Preço | .editar-text | input text | |
| Texto Oferta | (campo texto) | input text | "Especial" |
| Observação | .editar-pem_limite | input text | |
| Maior de 18 | .editar-pem_maioridade | checkbox | |

### pop_id=11 → form-SEM_ETIQUETA
| Campo | Classe CSS | Tipo | Descrição |
|---|---|---|---|
| Nome | .editar-pem_nome | input text | |
| Observação | .editar-pem_limite | input text | |
| Maior de 18 | .editar-pem_maioridade | checkbox | |

### Opções de Unidade (49 opções do select)
```
Escolha..., Barra, Bola, Caixa, Centimetro, Cubo, Duzia, Fardo, Fatia, Saco,
Grama, 100 Gramas, Galão, Garrafa, Jarra, Kilo, Litro, Maço, Metro, Pacote,
Tambor, Pares, Peça, Porção, Kit, Prato, Quilo, Unidade, Ml, M², Tela, Lata,
Vaso, Bandeja, Sachê, Milheiro, Rolo, Cento, Cada, Libra, Display, Combo,
Cartela, Tonelada, Balde, Pote, Polegada, Pe, Jarda
```

---

## 21. EDITAR IMAGEM (Modal Completo)

### Estrutura do Modal
```
.help-article-overlay (position: fixed)
  └── .article-box
      ├── .close (×)
      └── .article-content
          └── .image-builder-editor
              ├── .palco (área de edição)
              │   ├── .image-builder-canva (canvas da imagem)
              │   │   └── .image-builder
              │   │       └── .image-place-builder.image-i-{N} (imagem arrastável)
              │   ├── .box-tool-editor-canva (controles)
              │   │   ├── .input-editor → "Ampliar e Sobrepor"
              │   │   │   ├── label "Ampliar e Sobrepor"
              │   │   │   ├── input[type=range] (min=100, max=400, value=100)
              │   │   │   └── .arrow-controls "← CLIQUE E ARRASTE →"
              │   │   └── .input-editor1 → "Ampliar para o Centro"
              │   │       └── input[type=checkbox] (toggle switch, checked=true)
              │   └── .download-action
              │       └── a#DOWNLOAD_AND_UPLOAD_IMAGE_BUILDER "Salvar e Aplicar"
              └── .resources (templates de composição)
                  └── .options-templates
                      ├── .containerPreviewImage
                      │   ├── .containerHeaderEditImage "Editar Imagem"
                      │   └── .card.template-card "Imagem Original / ← Voltar ao Padrão Inicial"
                      ├── .filter-tools (hidden)
                      │   └── select "Número de Imagens" (1-9)
                      └── .containerGrid (121 templates de composição)
                          └── .previa-image-builder.image-builder (×121)
                              data-align: "Y_center" | ""
                              data-imagens: "1"-"10"
                              data-sizes: "START_END_ASC_DESC" | "START_END_DESC_ASC" |
                                          "START_END_ASC_DESC_ASC" | "START_END_DESC_ASC_DESC" |
                                          "START_END_LINEAR" | ""
```

---

## 22. CARD DE EDIÇÃO DO PRODUTO (Layout Imagem/Dados)

### Estrutura Completa
```html
<div class="produto-compacto-editavel produto-{pem_id}">
  <div class="drag">Arraste</div>
  <div class="get-view">Ver</div>
  <div class="col-12 col-sm-dados">
    <div class="fields form-{PRECO_TYPE}">
      <div class="row">

        <!-- COLUNA ESQUERDA: Imagem (col-8 col-sm-2) -->
        <div class="col-8 col-sm-2">
          <div class="img-placeholder IMAGE image-choice-btn">
            <!-- thumbnail da imagem do produto -->
          </div>
          <a class="search-image uploader">Enviar Imagem</a>
          <a class="search-image editar-imagens">Editar Imagem</a>
        </div>

        <!-- COLUNA CENTRAL: Formulário (col-12 col-sm-9 pl-0) -->
        <div class="col-12 col-sm-9 pl-0">
          <div class="TITULO titulo">
            <input class="editar-pem_nome" />
          </div>
          <div class="modo-de-precos">Opções de Preço</div>
          <!-- campos dinâmicos conforme form-{PRECO_TYPE} -->
        </div>

        <!-- COLUNA DIREITA: Ações (col-12 col-sm-1 pl-0) -->
        <div class="col-12 col-sm-1 pl-0">
          <a class="REMOVER btn-danger">Remover</a>
          <a class="DISABLE get-view btn-secondary">Já inserido</a>
          <a class="EDITAR btn-warning hide">EDITAR PRODUTO</a>
          <a class="ADICIONAR btn-success">Adicionar</a>
          <a class="EDICAO-OK btn-primary">Ok</a>
        </div>

      </div>
    </div>
  </div>
</div>
```

### Dimensões da Etiqueta no Encarte
(Feed 1200×1200, grade 2×2, produto 585×330px)
```
Grid Template: "IMAGE TITULO" / "IMAGE ETIQUETA"
Columns: 282.5px  282.5px
Rows:    124px    186px

→ Etiqueta: 282.5px × 186px
→ Imagem:   282.5px × 310px
→ Título:   262.5px × 104px (com padding)
```

---

## 23. BARRA DE PERSONALIZAÇÃO POR PRODUTO

### Estrutura (`.personalizar-bar`)
Cada produto no encarte tem 4 botões flutuantes:

```html
<ul class="personalizar-bar">
  <li>
    <div class="btn btn-lg btn-produto destacar-produto">
      <span class="shover">Trocar Cor de fundo</span>
    </div>
  </li>
  <li>
    <div class="btn btn-lg btn-produto modo-de-precos">
      <span class="shover">Opções de Preço</span>
    </div>
  </li>
  <li>
    <div class="btn btn-lg btn-produto destacar-produto-etiqueta">
      <span class="shover">Etiqueta</span>
    </div>
  </li>
  <li>
    <div class="btn btn-lg btn-produto destacar-produto-bubble">
      <span class="shover">Balão de desconto</span>
    </div>
  </li>
</ul>
```

---

## 24. APIs DO SISTEMA

### GET /services/api-produtos/
**Busca de produtos por nome**
```
Params:
  query=string (nome do produto, ex: "Arroz")
  noCorrection=boolean (ex: "true")
  _=timestamp (cache bust)

Retorno: HTML com lista de produtos encontrados
```

### POST /services/api-produtos-field/
**Atualiza um campo específico de um produto no encarte**
```
Body (FormData):
  field=string    (nome do campo: pem_nome, pem_preco_oferta, pem_unidade, etc.)
  value=string    (valor novo)
  pem_id=int      (ID do produto no encarte)
  pro_id=int      (ID do produto base, 0 se customizado)

Retorno: HTML atualizado do produto no encarte
```

### POST /services/api-temas-fields/
**Atualiza campos do tema/encarte**
```
Body: FormData com campos do tema (requer autenticação)
Retorno: Confirmação ou HTML
```

### GET /services/api-list-temas
**Lista temas disponíveis por categoria**
```
Params:
  categoriaStart=string (ex: "CAM_51")
  GERADOR_MODO=string   (ex: "ENCARTES")
  _=timestamp

Retorno: HTML com cards de temas organizados por categorias (.pacote)
```

### GET /services/api-events/
**Tracking de eventos do usuário (analytics)**
```
Params:
  eve_tag=string     (ex: "TROCOU_MODO_DE_PRECOS")
  eve_ads_tag=string (Google Ads tag)
  eve_valor=int      (valor do evento)
  op=string          ("events")
  _=timestamp

Retorno: Acknowledgement
```

### GET /criar-jornal/builder-v2/?view={nome}
**Carrega views parciais do builder**
```
Views conhecidas:
  - editar-produtos  → lista de edição de produtos
  - escolher-tema    → painel de seleção de temas

Retorno: HTML parcial para injetar no painel
```

### URLs de Recursos
```
Imagens de produtos:
  https://qrofertas.s3.us-west-2.amazonaws.com/imagens-produtos-v2/{pem_url}/{img_id}.webp

Thumbnails de temas:
  https://storage.qrofertas.com/temas/imagens-thumbs/{uuid}.webp?w=258

Imagens de temas (fundo):
  https://qrofertas.s3.us-west-2.amazonaws.com/temas/imagens-produtos/{hash}.webp

CDN via Wordpress proxy:
  https://i1.wp.com/storage.qrofertas.com/temas/imagens-thumbs/{uuid}.webp?w=258
```

---

## 25. CSS VARIABLES COMPLETAS DO TEMA

```css
/* Variáveis customizadas (não Bootstrap) encontradas no .tema-uploader */
:root {
  /* Layout */
  --margin-layout: 10px;
  --padding-layout: 5px;

  /* Pesos do grid interno do produto */
  --peso-1: 50%;           /* peso da imagem (CONTENT_LINE) */
  --peso-2: 25%;           /* peso da etiqueta (CONTENT_LINE) */
  --peso-3: 25%;           /* peso do título (CONTENT_LINE) */
  --peso-x-primary: aliceblue; /* largura da coluna primária (CONTENT_ROW) */
  --peso-x-sec: 20%;       /* largura da coluna secundária */
  --peso-y-primary: 65%;   /* altura da row principal */
  --peso-y-sec: 35%;       /* altura da row de conteúdo */

  /* Etiqueta */
  --etiqueta-invadir: 0%;  /* sobreposição da etiqueta sobre a imagem */

  /* Rodapé */
  --footer-height: 200px;
  --footer-line-height: 100px;
  --footer-font-size: 50px;
  --footer-base-margin: 15px;

  /* Observação */
  --observacao-fs: 20px;
  --observacao-h: 10%;

  /* Mensagem customizada */
  --mensagem-customizada-fontsize: 75px;
  --mensagem-customizada-height: 200px;

  /* Chip / Selo */
  --chip-height: 100px;

  /* Balão de desconto */
  --bubble-font-size: 35px;
  --bubble-desconto-size: 139px;

  /* Cores do tema */
  --mm-yellow: #f5c300;
  --mm-yellow-2: #ffd84a;
  --mm-bg: rgba(0, 0, 0, .62);
  --mm-card: #15161a;
  --mm-card-2: #0f1013;
  --mm-radius: 22px;

  /* Animações */
  --animate-duration: 1s;
  --animate-delay: 1s;
  --animate-repeat: 1;
}
```

---

*Documento gerado por engenharia reversa do QROfertas Builder V2 (https://www.qrofertas.com/criar-jornal/builder-v2/) para fins de replicação técnica. Atualizado com dados completos de temas, cores, etiquetas, formulários e APIs.*