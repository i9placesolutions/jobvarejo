sim# Guia Completo de Portabilidade — Product Zone (explicado ponto a ponto)

Este documento reúne, ponto a ponto, toda a lógica necessária para portar a Zona de Produtos (ProductZone), os cards de produto, o splash (etiqueta de preço) e as ferramentas de edição do editor atual para outro sistema. Está em português e pensado para um time de engenharia copiar a lógica sem depender do resto do projeto.

---

## Sumário

- Visão Geral
- Arquivos-chave e onde procurar no projeto
- Interfaces e shapes de estado (modelos prontos para copiar)
- Estado e funções de atualização essenciais
- Renderização do produto (CanvasProduct) — decomposição passo a passo
- Cálculo do tamanho ótimo da imagem (`calculateOptimalImageSize`) com código
- Splash / etiqueta de preço — API e comportamento esperado
- `ProductZoneSettings` — presets e regras de sincronização (Espaçamento etc.)
- Helpers e migração (product-helpers.ts / product-zone-helpers.ts)
- Fluxo de interação: selecionar, arrastar, redimensionar, rotacionar
- Checklist de portabilidade e exemplos JSON
- Minimal runnable snippet (React) e próximos passos

---

## 1) Visão Geral

A Zona de Produtos (ProductZone) é um contêiner lógico que contém produtos renderizados em um grid (ou free-mode). Cada produto é um "card" composto por: nome, limite (badge), imagem(s) e splash (etiqueta de preço) — o splash é renderizado fora do contêiner do card para não ser cortado.

Para portar, você precisa transportar:
- O modelo de dados (interfaces) — `Product`, `ProductImage`, `Splash`, `ProductZone`, `GlobalStyles`.
- O estado reativo (add/remove/update) e funções utilitárias `updateItemProperty`, `updateProductImageProperty`.
- A lógica de layout/resize para o card e imagem (`calculateOptimalImageSize`).
- O renderer do `SplashRenderer` (ou equivalente) com a API usada no projeto.
- Os helpers de compatibilidade/migração para dados antigos.
- A UI de edição (`ProductZoneSettings`) ou endpoints que permitam ajustar os mesmos props.

---

## 2) Arquivos-chave no projeto (origem)

- Painel de propriedades da zona: `src/components/editor/ProductZoneSettings.tsx`
- Canvas / render: `src/components/editor/EditorCanvas.tsx` (contém `CanvasProduct`, `calculateOptimalImageSize`, render do `SplashRenderer`, handlers de seleção/resize)
- Hook de estado: `src/hooks/useEditorState.ts` (contém `products`, `splashes`, `productZone`, `updateItemProperty`, etc.)
- Helpers: `src/utils/product-zone-helpers.ts`, `src/utils/product-helpers.ts`
- Modelos/Tipos: `src/domain/entities/Product.ts`
- Guia de integração: `PRODUCTZONE_GUIDE.md`

> No repositório original esses arquivos já existem; copie as partes lógicas aqui descritas.

---

## 3) Interfaces / Shapes (copiar tal qual)

Abaixo estão as interfaces essenciais — crie equivalentes na sua linguagem (TypeScript/JSON/POJO):

### `ProductImage` (uma imagem dentro do card)
```ts
export interface ProductImage {
  id: string;
  src: string;
  x: number; // offset dentro do container da imagem
  y: number;
  scale: number;
  rotation?: number;
  imgWidth?: number; // dimensão natural ou fixada
  imgHeight?: number;
  // crop em porcentagem (0-100)
  imgCropTop?: number;
  imgCropRight?: number;
  imgCropBottom?: number;
  imgCropLeft?: number;
  // efeitos
  imgEffect?: string;
}
```

### `Product`
```ts
export interface Product {
  id: number;
  name: string;
  images: ProductImage[];
  emoji?: string;
  x: number; // posição no canvas
  y: number;
  width: number; // dimensões do card
  height: number;
  price: number | string; // pode ser string em dados antigos
  unit?: string;
  showPrice?: boolean; // se mostra preço
  isFreeMode?: boolean; // se posição/size são "free"
  freeX?: number; freeY?: number; freeWidth?: number; freeHeight?: number;
  colIndex?: number; rowIndex?: number; // posição no grid
  // styling
  backgroundColor?: string;
  borderRadius?: number;
  type?: 'yellow'|'red'|'none';
  // nome/label positioning
  nameX?: number; nameY?: number; nameScale?: number;
  limitText?: string; limitX?: number; // etc.
  // z-index
  zIndex?: number;
}
```

### `Splash` (etiqueta de preço vinculada ao produto)
```ts
export interface Splash {
  id: string;
  parentId: number; // product.id
  price?: string; // aceita string formatada
  x: number; // offset relativo ao centro do produto (left: 50% triggered)
  y: number; // vertical offset (positive = move up if placed bottom)
  scale?: number;
  style?: string; // 'classic', 'bubble', etc.
  color?: string; textColor?: string;
}
```

### `ProductZone`
```ts
export interface ProductZone {
  x: number; y: number; width: number; height: number;
  padding: number; // espaçamento base
  gapHorizontal?: number; gapVertical?: number; // overrides opcionais
  columns?: number; rows?: number; // 0 = auto
  layoutDirection?: 'horizontal' | 'vertical';
  cardAspectRatio?: string; // 'auto' | 'square' | ...
  lastRowBehavior?: 'fill'|'center'|'stretch';
  highlightCount?: number; highlightPos?: string; highlightHeight?: number;
  isLocked?: boolean;
}
```

### `GlobalStyles` (resumo)
```ts
export interface GlobalStyles {
  cardColor?: string; accentColor?: string;
  prodNameFont?: string; prodNameColor?: string; prodNameSize?: number;
  splashOffsetY?: number; // offset global para splashes
  isProdBgTransparent?: boolean;
  // etc. — reproduza as props que você usar no renderer
}
```

---

## 4) Estado e funções de atualização essenciais

Você precisa de um estado central (ou store) que ofereça pelo menos:
- `products: Product[]`
- `splashes: Splash[]`
- `productZone: ProductZone`
- `globalStyles: GlobalStyles`
- funcoes: `setProducts`, `setSplashes`, `setProductZone`, `setGlobalStyles`

Função utilitária usada em muitos painéis:

### `updateItemProperty(prop, value)` — regra principal
- Se a seleção atual for um produto (ou subparte do produto), aplica a mudança ao produto correspondente.
- Se for `splash`, aplica ao splash.
- Se for `zone`, aplica ao `productZone`.

Pseudocódigo (TypeScript):
```ts
function updateItemProperty(prop: string, value: any) {
  if (selectedType === 'product' || selectedType === 'product-img' || selectedType === 'product-name') {
    setProducts(prev => prev.map(p => p.id === selectedId ? { ...p, [prop]: value } : p));
  } else if (selectedType === 'splash') {
    setSplashes(prev => prev.map(s => s.id === selectedId ? { ...s, [prop]: value } : s));
  } else if (selectedType === 'zone') {
    setProductZone(prev => ({ ...prev, [prop]: value }));
  }
}
```

Também importante:
- `updateProductImageProperty(prop, value)` para atualizar imagens específicas dentro do array `images` de um produto.

---

## 5) Renderização do produto — `CanvasProduct` decomposição

O `CanvasProduct` no projeto original implementa este fluxo:

1. Container absoluto posicionado em `p.x`, `p.y` com `p.width`, `p.height`.
2. Camada de background (pode ser clipPath para formas) com `backgroundColor` ou `bgImage`.
3. Content Layer com `display: grid` (quando não em `isFreeMode`) e 3 áreas:
   - `gridRow: 1` — Nome (top)
   - `gridRow: 2` — Limite / badge (opcional)
   - `gridRow: 3` — Imagem(s) (ocupa espaço restante; splash é renderizada fora)
4. Imagens: cada `ProductImage` é posicionado com transform `translate` + `scale` + `rotation`. Se houver crop, o container corta a imagem com `overflow: hidden`.
5. Splash: recuperado via `splashes.find(s => s.parentId === p.id)` e renderizado em posição absoluta abaixo do produto; o `translate` final inclui offsets globais e offsets por coluna/linha.

Comportamento visual importante a reproduzir:
- Reserva fixa no topo para o nome (topReserve) — garante alinhamento vertical entre cards
- Splash não é cortado pelo clipPath do card
- Se `p.isFreeMode` → o produto não usa grid interno e respeita `freeX/freeY/freeWidth/freeHeight`
- Z-indexes: o produto tem zIndex ajustável e quando selecionado recebe um boost visual/z-index maior

---

## 6) Cálculo do tamanho ótimo da imagem (exato — copie este código)

Este método é usado para definir o `maxWidth` e `maxHeight` da imagem central do produto, baseado no tamanho do card, quantidade de produtos, e se há nome/limite.

Código (TypeScript) — copie tal qual:

```ts
const calculateOptimalImageSize = (
  productZone, // pode ser usado para decisões futuras
  productCount,
  hasName,
  hasLimit,
  productWidth,
  productHeight
) => {
  const cellWidth = productWidth;
  const cellHeight = productHeight;

  // Reserva fixa no topo para o nome
  const topReserve = Math.min(cellHeight * 0.15, 50);
  const bottomReserve = 0;
  const sidePadding = Math.max(2, cellWidth * 0.01);

  const availableWidth = cellWidth - (sidePadding * 2);
  const availableHeight = cellHeight - topReserve - bottomReserve;

  let imageFillRatio;
  if (productCount <= 2) imageFillRatio = 0.98;
  else if (productCount <= 4) imageFillRatio = 0.95;
  else if (productCount <= 6) imageFillRatio = 0.92;
  else if (productCount <= 9) imageFillRatio = 0.88;
  else if (productCount <= 12) imageFillRatio = 0.85;
  else if (productCount <= 16) imageFillRatio = 0.80;
  else imageFillRatio = 0.75;

  const imageWidth = availableWidth * imageFillRatio;
  const imageHeight = availableHeight * imageFillRatio;

  const MIN_SIZE = Math.max(60, Math.min(cellWidth * 0.4, cellHeight * 0.3));

  return {
    maxWidth: Math.max(MIN_SIZE, imageWidth),
    maxHeight: Math.max(MIN_SIZE, imageHeight)
  };
};
```

Por que este código é importante: garante consistência visual e que imagens não ocupem o local reservado ao nome/limite. Mantenha os mesmos parâmetros para reproduzir o mesmo comportamento.

---

## 7) Splash (etiqueta de preço) — API e recomendações

No código original o `SplashRenderer` é um componente separado que aceita muitas props. Para portar, implemente um renderer com a API mínima abaixo:

Props recomendadas:
- `price` (string) — texto formatado (ex: "19,90")
- `unit` (string) — ex: "kg" ou "un"
- `scale` (number)
- `color` (background)
- `textColor`
- `style` (string)
- `fontFamily`, `fontSize`, ajustes por partes (integer/cents positions)
- `effect`, `effectThickness`, `effectColor` (opcional)

Posicionamento:
- O splash é posicionado com `left: 50%`, `bottom: 0`, transform `translateX(-50%) translate(x,y) rotate(rotation)`.
- Aplica offsets globais: `globalStyles.splashOffsetY` e offsets por coluna/linha (`productZone.splashOffsetByCol`, `productZone.splashOffsetByRow`).

Formatos de preço:
- Internamente o editor tenta normalizar preço numeric/string (ex: "R$ 2,99" => "2,99"). Use helper `parsePrice`/`formatPriceBR` (a seguir).

---

## 8) `ProductZoneSettings` — regras e presets

O painel original fornece:
- Presets: automático, grid 2/3/4 colunas, lista
- Layout Avançado: colunas, linhas, direção, proporção, alinhamento vertical
- Espaçamento: controle único (`padding`) que sincroniza `gapHorizontal` e `gapVertical` quando ajustado no slider principal. Também permite ajuste separado.
- Destaques: `highlightCount`, `highlightPos`, `highlightHeight`
- Estilos: `isProdBgTransparent`, `cardColor`, `accentColor`, lock position

Regra importante: quando o usuário move o slider principal `padding`, o painel chama `updateItemProperty('padding', newVal)` e também atualiza `gapHorizontal` e `gapVertical` para o mesmo valor — isso evita sobreposição/confusão de valores.

Copie a lista de presets e a função `applyPreset` (mapeamento `settings` → `updateItemProperty`).

---

## 9) Helpers críticos (migrar/usar)

Copie/importe estes helpers para evitar problemas com dados antigos:

- `product-zone-helpers.ts` funções: `getZonePadding`, `getLastRowBehavior`, `getSplashOffsetByCol`, `getSplashOffsetByRow`, `migrateProductZone`, `createDefaultProductZone`.
- `product-helpers.ts` funções: `parsePrice`, `formatPriceBR`, `getPackPrice`, `getPromoPrice`, `migrateProduct`, `createDefaultProduct`, `validateProduct`, `calculateTotalPrice`.

Esses helpers cuidam de compatibilidade, parsing de preço e defaults.

---

## 10) Fluxo de interação (seleção, drag, resize, rotate)

O editor original usa:
- `onMouseDown` em elementos para `handleMouseDown(e, id, type, subId?)` que seta seleção
- `ResizeHandles` com eventos `onResizeStart` que iniciam o resize do item (produto, imagem, name, splash)
- Rotation handler com botão acima do item chama `handleRotateStart`.

Portar essas operações exige que você implemente:
- Um estado de seleção: `selectedId`, `selectedType`, `selectedSubId` (para imagens)
- Funções para iniciar arraste/redimensionamento/rotação e aplicar transformações ao estado (x,y,width,height,rotation)
- `zIndex` management: elevar zIndex durante seleção para facilitar interação

---

## 11) Checklist de portabilidade

- [ ] Criar modelos `Product`, `ProductImage`, `Splash`, `ProductZone`, `GlobalStyles` no novo sistema.
- [ ] Implementar store/estado com `products`, `splashes`, `productZone` e setters.
- [ ] Implementar `updateItemProperty` e `updateProductImageProperty` conforme pseudocódigo.
- [ ] Portar `calculateOptimalImageSize` exatamente.
- [ ] Implementar renderer do card seguindo a decomposição (nome, limite, imagem, splash fora).
- [ ] Portar `ProductZoneSettings` ou reimplementar UI com os mesmos controles (presets e sincronização do padding).
- [ ] Portar helpers de `product-helpers.ts` e `product-zone-helpers.ts`.
- [ ] Implementar `SplashRenderer` (API compatível).
- [ ] Testar com designs antigos usando `migrateProduct` / `migrateProductZone`.

---

## 12) Exemplo JSON mínimo de estado (para testar)

```json
{
  "productZone": {
    "x": 50,
    "y": 150,
    "width": 900,
    "height": 500,
    "padding": 15,
    "columns": 3
  },
  "products": [
    {
      "id": 1,
      "name": "Arroz",
      "x": 60,
      "y": 170,
      "width": 260,
      "height": 300,
      "price": 19.9,
      "unit": "kg",
      "images": [
         { "id": "img-1", "src": "https://.../arroz.jpg", "x": 0, "y": 0, "scale": 1, "imgWidth": 400, "imgHeight": 400 }
      ]
    }
  ],
  "splashes": [
    { "id": "s-1", "parentId": 1, "price": "19,90", "x": 0, "y": -10, "scale": 1 }
  ]
}
```

---

## 13) Minimal runnable snippet (React) — estrutura sugerida

- `ProductZonePort/index.tsx` — componente de integração que monta `products`, `splashes`, `productZone` no state e renderiza um `Canvas` simples.
- `ProductZonePort/CanvasProduct.tsx` — implementa a estrutura do card (nome, limite, imagem, e se houver splash renderiza `SplashRenderer`).
- `ProductZonePort/SplashRenderer.tsx` — componente simplificado que recebe `price`, `unit`, `scale`, `color`, `textColor`.
- `ProductZonePort/helpers.ts` — `calculateOptimalImageSize`, `parsePrice`, `migrateProduct`.

Se quiser, eu gero esses arquivos reduzidos prontos para copiar.

---

## 14) Próximos passos que eu posso fazer por você

- Gerar um pacote reduzido (arquivos React/TS) com: `CanvasProduct.tsx`, `SplashRenderer.tsx`, `helpers.ts`, `types.ts`, `simple-Canvas-demo.tsx` — prontos para copiar.
- Ou apenas gerar um `README.md` passo-a-passo menor focado em backend/JS sem UI.

Indique qual opção prefere: `1` = gerar pacote reduzido com arquivos (pronto para copiar), `2` = gerar README/step-by-step apenas, `3` = nada — só queria o documento (pronto).

---

Documento gerado automaticamente a partir do código fonte do projeto.
