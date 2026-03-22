# Implementação: Container de Imagem com Crop Visual (Estilo QR Ofertas)

## Contexto

Precisamos implementar um sistema de edição/enquadramento de imagem de produto dentro de um container fixo, similar ao que o QR Ofertas usa no builder de encartes. O sistema deve permitir que o usuário faça upload de uma imagem e ela fique enquadrada corretamente dentro de um container com dimensões fixas (ex: 1920x1080), podendo ajustar zoom e posição.

## Stack

- **Framework:** Nuxt 4
- **Componente Vue 3** com Composition API (`<script setup>`)
- **CSS puro** (sem libs externas de crop)

---

## Arquitetura de Camadas (como o QR Ofertas faz)

O sistema é baseado em **3 divs aninhadas**:

```
.image-builder          → Container externo (overflow: hidden) - faz o "recorte" visual
  .image-place-builder  → Container de referência (position: relative)
    .img-item           → A imagem (background-image, position: absolute, draggable)
```

### Camada 1: `.image-builder` (Container Visível / "Moldura")
- Dimensões fixas (ex: 1920x1080 ou proporção escalada para preview)
- `overflow: hidden` — **este é o segredo do crop visual**. Tudo que ultrapassar esse container é cortado visualmente
- `position: relative` — referência para posicionamento absoluto dos filhos

### Camada 2: `.image-place-builder` (Área de Posicionamento)
- Mesmo tamanho ou ligeiramente menor que o container externo
- `position: relative`
- `display: flex`
- Serve como área de referência para o drag

### Camada 3: `.img-item` (A Imagem)
- **NÃO usar tag `<img>`** — usar uma `<div>` com `background-image`
- `position: absolute`
- `background-size: contain` — garante que a imagem caiba sem distorcer
- `background-position: center center` (50% 50%)
- `background-repeat: no-repeat`
- Tamanho inicial igual ao container pai
- O tamanho pode ser aumentado via slider (zoom), fazendo a imagem ultrapassar o container (e o overflow:hidden corta o excesso)
- `left` e `top` controlados via drag do mouse

---

## Funcionalidades a Implementar

### 1. Container com Overflow Hidden (Crop Visual)
```vue
<template>
  <div class="image-builder" :style="builderStyle">
    <div class="image-place-builder" :style="placeStyle">
      <div
        class="img-item"
        :style="imgItemStyle"
        @mousedown="startDrag"
        @touchstart="startDrag"
      />
    </div>
  </div>
</template>
```

```css
.image-builder {
  width: 100%;           /* ou dimensão fixa */
  aspect-ratio: 16/9;    /* para manter 1920x1080 proporcional */
  max-width: 960px;      /* preview escalado */
  overflow: hidden;       /* <-- ISSO FAZ O CROP VISUAL */
  position: relative;
  background: #f0f0f0;   /* fundo para quando a imagem não preenche tudo */
  border-radius: 8px;
}

.image-place-builder {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.img-item {
  position: absolute;
  width: 100%;
  height: 100%;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  cursor: grab;
  user-select: none;
}

.img-item:active {
  cursor: grabbing;
}
```

### 2. Upload de Imagem
- Input file que aceita imagens
- Ao fazer upload, converter para URL (URL.createObjectURL ou base64)
- Aplicar como `background-image` da `.img-item`

### 3. Slider de Zoom ("Ampliar e Sobrepor")
- Um `<input type="range">` que controla a escala da `.img-item`
- Valor mínimo: 100% (imagem cabe no container)
- Valor máximo: 300% (imagem 3x maior que o container)
- Ao aumentar o zoom, a largura e altura da `.img-item` aumentam proporcionalmente
- Exemplo: zoom 150% → `width: 150%; height: 150%;`
- A imagem fica maior que o container, e o `overflow: hidden` corta o excesso

### 4. Drag para Reposicionar ("Clique e Arraste")
- Ao clicar e arrastar na `.img-item`, mudar `left` e `top` via CSS
- Implementar com mousedown/mousemove/mouseup (e touch equivalentes)
- Limitar o drag para que a imagem não saia completamente do container
- Quando o zoom é 100%, o drag fica desabilitado (não faz sentido mover)

### 5. Toggle "Ampliar para o Centro"
- Quando ativo: ao mudar o zoom, a imagem se expande a partir do centro
- Quando inativo: a imagem se expande a partir do canto superior esquerdo
- Implementar com `transform-origin: center center` vs `transform-origin: top left`

### 6. Botão "Salvar e Aplicar"
- Salvar os valores atuais de: imageUrl, zoom, offsetX, offsetY
- Emitir evento com esses dados para o componente pai

---

## Composable Sugerido: `useImageCrop`

```ts
// composables/useImageCrop.ts
export function useImageCrop(containerRef: Ref<HTMLElement | null>) {
  const imageUrl = ref('')
  const zoom = ref(100)          // percentual: 100 = sem zoom
  const offsetX = ref(0)         // posição X em pixels
  const offsetY = ref(0)         // posição Y em pixels
  const isDragging = ref(false)
  const centerZoom = ref(true)   // ampliar para o centro

  // Estilo computado da imagem
  const imgItemStyle = computed(() => ({
    backgroundImage: imageUrl.value ? `url('${imageUrl.value}')` : 'none',
    width: `${zoom.value}%`,
    height: `${zoom.value}%`,
    left: `${offsetX.value}px`,
    top: `${offsetY.value}px`,
    backgroundSize: 'contain',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    position: 'absolute' as const,
    cursor: zoom.value > 100 ? 'grab' : 'default',
    userSelect: 'none' as const,
  }))

  // Drag handlers
  let startX = 0
  let startY = 0
  let startOffsetX = 0
  let startOffsetY = 0

  function startDrag(e: MouseEvent | TouchEvent) {
    if (zoom.value <= 100) return  // sem zoom = sem drag
    isDragging.value = true
    const point = 'touches' in e ? e.touches[0] : e
    startX = point.clientX
    startY = point.clientY
    startOffsetX = offsetX.value
    startOffsetY = offsetY.value

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
    document.addEventListener('touchmove', onDrag)
    document.addEventListener('touchend', stopDrag)
  }

  function onDrag(e: MouseEvent | TouchEvent) {
    if (!isDragging.value) return
    const point = 'touches' in e ? e.touches[0] : e
    const dx = point.clientX - startX
    const dy = point.clientY - startY
    offsetX.value = startOffsetX + dx
    offsetY.value = startOffsetY + dy
  }

  function stopDrag() {
    isDragging.value = false
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    document.removeEventListener('touchmove', onDrag)
    document.removeEventListener('touchend', stopDrag)
  }

  // Upload handler
  function handleUpload(file: File) {
    imageUrl.value = URL.createObjectURL(file)
    zoom.value = 100
    offsetX.value = 0
    offsetY.value = 0
  }

  // Reset para centralizado
  function resetPosition() {
    offsetX.value = 0
    offsetY.value = 0
    zoom.value = 100
  }

  // Quando zoom muda e centerZoom está ativo, recalcular offset para manter centro
  watch(zoom, (newZoom, oldZoom) => {
    if (centerZoom.value && containerRef.value) {
      const container = containerRef.value
      const cw = container.offsetWidth
      const ch = container.offsetHeight
      const scale = (newZoom - oldZoom) / 100
      offsetX.value -= (cw * scale) / 2
      offsetY.value -= (ch * scale) / 2
    }
  })

  return {
    imageUrl,
    zoom,
    offsetX,
    offsetY,
    isDragging,
    centerZoom,
    imgItemStyle,
    startDrag,
    handleUpload,
    resetPosition,
  }
}
```

---

## Componente Vue Completo Sugerido

Criar o componente `ImageCropEditor.vue` que usa o composable acima e renderiza:

1. O container com as 3 camadas
2. Input de upload de imagem
3. Slider de zoom (range input)
4. Toggle de "Ampliar para o Centro"
5. Botão de reset
6. Botão "Salvar e Aplicar" que emite os dados

### Props do componente:
- `width`: largura do container (default: '100%')
- `aspectRatio`: aspect ratio do container (default: '16/9' para 1920x1080)
- `maxZoom`: zoom máximo permitido (default: 300)
- `initialImage`: URL da imagem inicial (opcional)

### Emits:
- `save`: emite `{ imageUrl, zoom, offsetX, offsetY }`
- `change`: emite a cada mudança de posição/zoom

---

## Para a Geração Final da Arte (Export)

Quando for gerar a imagem final em 1920x1080 para download/impressão, usar um `<canvas>` offscreen:

```ts
function exportImage(imageUrl: string, zoom: number, offsetX: number, offsetY: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 1920
  canvas.height = 1080
  const ctx = canvas.getContext('2d')!

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    // Calcular dimensões com contain
    const imgRatio = img.width / img.height
    const containerRatio = 1920 / 1080

    let drawW, drawH
    if (imgRatio > containerRatio) {
      drawW = 1920 * (zoom / 100)
      drawH = drawW / imgRatio
    } else {
      drawH = 1080 * (zoom / 100)
      drawW = drawH * imgRatio
    }

    // Centralizar + offset
    const x = (1920 - drawW) / 2 + offsetX
    const y = (1080 - drawH) / 2 + offsetY

    ctx.drawImage(img, x, y, drawW, drawH)

    // Exportar
    const dataUrl = canvas.toDataURL('image/png')
    // Usar dataUrl para download ou enviar ao backend
  }
  img.src = imageUrl
}
```

---

## Resumo da Técnica

| Conceito | Implementação |
|----------|--------------|
| Crop visual | `overflow: hidden` no container pai |
| Imagem | `div` com `background-image` (não `<img>`) |
| Fit sem distorção | `background-size: contain` |
| Centralização | `background-position: center` |
| Zoom | Alterar `width/height` da div da imagem (%) |
| Reposicionar | Alterar `left/top` via drag (mousedown/mousemove) |
| Zoom pelo centro | Recalcular offset ao mudar zoom |
| Export final | Canvas offscreen em 1920x1080 |

---

## Observações Importantes

- O QR Ofertas usa **jQuery UI Draggable** para o drag. No Nuxt 4 com Vue 3, implementar nativamente com eventos de mouse/touch (como mostrado acima) ou usar `@vueuse/core` que tem `useDraggable`.
- A imagem é sempre uma `div` com `background-image`, nunca uma tag `<img>`. Isso facilita o controle de posicionamento e zoom.
- O container externo com `overflow: hidden` é o que faz todo o "crop" funcionar — não existe recorte real do arquivo, é apenas visual.
- Para salvar o estado, guardar apenas: `imageUrl`, `zoom`, `offsetX`, `offsetY`. Com esses 4 valores é possível reconstruir o enquadramento exato.

---

## Sistema de Grades com Destaques (Layout do Encarte/Cartaz)

O QR Ofertas usa um sistema de **grades pré-definidas** que definem quantos produtos aparecem e quais são "destaques" (boxes maiores). A grade controla o layout da arte inteira.

### Arquitetura da Grade

```
.render-content                           → Container geral de todo o encarte
  .render-template                        → Template do tema (cabeçalho/fundo)
  .drag-row.modelo-itens.layout-{ID}      → A GRADE de produtos (flex container)
    .layout-box-row-0  (destaque)         → Box do produto destaque (maior)
    .layout-box-row-1  (normal)           → Box do produto normal (menor)
    .layout-box-row-2  (normal)           → ...
    ...
```

### Como a grade funciona (CSS)

A grade é um **flex container** com `flex-wrap: wrap` e `flex-direction: column`:

```css
.drag-row.modelo-itens {
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;  /* empilha verticalmente e depois quebra para coluna seguinte */
  width: 1190px;           /* largura total do encarte */
  height: 815px;           /* altura da área de produtos */
}
```

Cada box de produto é um item flex com tamanho fixo. O **destaque** simplesmente tem dimensões maiores:

```css
/* Box destaque (ocupa mais espaço) */
.layout-box-row-0 {  /* layout-29: destaque esquerdo */
  width: 466px;   /* ~39% da largura */
  height: 805px;  /* altura total */
  flex: 0 1 auto;
}

/* Box normal (menor) */
.layout-box-row-1,
.layout-box-row-2,
.layout-box-row-3,
.layout-box-row-4 {
  width: 347px;   /* ~29% da largura */
  height: 398px;  /* metade da altura */
  flex: 0 1 auto;
}
```

### Classes de Configuração do Box

Cada box tem classes CSS que controlam a proporção interna entre imagem, texto e preço:

| Classe | Significado |
|--------|------------|
| `IS_DESTAQUE` | Marca o box como destaque (pode ter estilo especial) |
| `X_70-30` | 70% da largura para imagem, 30% para preço (horizontal) |
| `X_60-40` | 60% da largura para imagem, 40% para preço |
| `Y_80-20` | 80% da altura para imagem+nome, 20% para etiqueta/preço (vertical) |
| `INVADIR-INVADIR-INVADIR_50` | Imagem pode "invadir" (sobrepor) 50% além do box |
| `INVADIR-INVADIR-INVADIR_20` | Imagem pode "invadir" 20% além do box |
| `ETIQUETA-HORIZONTAL` | Etiqueta de preço na orientação horizontal |
| `CONTENT_LINE` | Layout do conteúdo em linha |
| `ordem-TITULO-IMAGEM-ETIQUETA` | Ordem de renderização: título → imagem → etiqueta de preço |

### Todas as Grades Disponíveis (Referência)

```ts
// grades.ts - Definição de todas as grades disponíveis
export const GRADES = [
  // Grades simples (sem destaque)
  { id: 14, label: '1 Produto - 1x1', cols: 1, rows: 1, total: 1, destaques: 0 },
  { id: 15, label: '2 Produtos - 2x1', cols: 2, rows: 1, total: 2, destaques: 0 },
  { id: 16, label: '3 Produtos - 3x1', cols: 3, rows: 1, total: 3, destaques: 0 },
  { id: 12, label: '4 Produtos - 2x2', cols: 2, rows: 2, total: 4, destaques: 0 },
  { id: 18, label: '6 Produtos - 3x2', cols: 3, rows: 2, total: 6, destaques: 0 },
  { id: 11, label: '8 Produtos - 4x2', cols: 4, rows: 2, total: 8, destaques: 0 },
  { id: 13, label: '9 Produtos - 3x3', cols: 3, rows: 3, total: 9, destaques: 0 },
  { id: 26, label: '12 Produtos - 4x3', cols: 4, rows: 3, total: 12, destaques: 0 },

  // Grades COM destaque
  { id: 29, label: '5 Produtos - 4 + 1 destaque Esquerdo', total: 5, destaques: 1, destaquePos: 'left' },
  { id: 30, label: '5 Produtos - 4 + 1 destaque Direito', total: 5, destaques: 1, destaquePos: 'right' },
  { id: 28, label: '6 Produtos - 4 + 2 destaques laterais', total: 6, destaques: 2, destaquePos: 'sides' },
  { id: 56, label: '7 Produtos - 3 destaques topo + 4 produtos', total: 7, destaques: 3, destaquePos: 'top' },
  { id: 57, label: '7 Produtos - 4 produtos + 3 destaques baixo', total: 7, destaques: 3, destaquePos: 'bottom' },
  { id: 51, label: '7 Produtos - 1 destaque lateral + 6 produtos', total: 7, destaques: 1, destaquePos: 'left' },
  { id: 59, label: '8 Produtos - 3 destaques topo + 5 produtos', total: 8, destaques: 3, destaquePos: 'top' },
  { id: 58, label: '8 Produtos - 5 produtos + 3 destaques baixo', total: 8, destaques: 3, destaquePos: 'bottom' },
  { id: 34, label: '10 Produtos - 1 destaque lateral + 9 produtos', total: 10, destaques: 1, destaquePos: 'left' },
  { id: 53, label: '11 Produtos - 3x4 com destaque central', total: 11, destaques: 1, destaquePos: 'center' },
  { id: 35, label: '11 Produtos - 3 destaque topo + 8 produtos', total: 11, destaques: 3, destaquePos: 'top' },
  { id: 64, label: '12 Produtos - 8 + 4 destaques topo', total: 12, destaques: 4, destaquePos: 'top' },
  { id: 65, label: '12 Produtos - 8 + 4 destaques baixo', total: 12, destaques: 4, destaquePos: 'bottom' },
  { id: 48, label: '13 Produtos - 1 destaque + 4x3', total: 13, destaques: 1, destaquePos: 'left' },
  { id: 49, label: '14 Produtos - 2 destaques + 4x3', total: 14, destaques: 2, destaquePos: 'left' },
  { id: 63, label: '14 Produtos - 13 + 1 destaque baixo centro', total: 14, destaques: 1, destaquePos: 'bottom-center' },
  { id: 62, label: '14 Produtos - 13 + 1 destaque cima centro', total: 14, destaques: 1, destaquePos: 'top-center' },
  { id: 61, label: '18 Produtos - 14 + 4 destaques baixo', total: 18, destaques: 4, destaquePos: 'bottom' },
  { id: 60, label: '18 Produtos - 4 destaques topo + 14', total: 18, destaques: 4, destaquePos: 'top' },

  // Formato tabela
  { id: 86, label: '10 Produtos - TABELA', total: 10, tipo: 'tabela' },
  { id: 89, label: '20 Produtos - TABELA', total: 20, tipo: 'tabela' },
]
```

### Exemplo de Implementação da Grade com Destaque (layout-29)

```vue
<!-- GradeEncarte.vue -->
<template>
  <div class="grade-container" :class="`layout-${gradeId}`">
    <!-- Box Destaque (esquerda, maior) -->
    <div
      v-for="(produto, index) in produtos"
      :key="produto.id"
      class="produto-box"
      :class="{
        'is-destaque': isDestaque(index),
        [`box-row-${index}`]: true
      }"
      :style="getBoxStyle(index)"
    >
      <!-- Título do produto -->
      <div class="produto-titulo">{{ produto.nome }}</div>

      <!-- Container da imagem (usa o sistema de crop visual!) -->
      <div class="produto-image-container">
        <div class="produto-image-place">
          <div
            class="produto-image-item"
            :style="{
              backgroundImage: `url('${produto.imageUrl}')`,
              width: `${produto.imageZoom || 100}%`,
              height: `${produto.imageZoom || 100}%`,
              left: `${produto.imageOffsetX || 0}px`,
              top: `${produto.imageOffsetY || 0}px`,
            }"
          />
        </div>
      </div>

      <!-- Etiqueta de preço -->
      <div class="produto-etiqueta" :class="{ 'etiqueta-grande': isDestaque(index) }">
        <span class="cifrao">R$</span>
        <span class="preco-inteiro">{{ precoInteiro(produto.preco) }}</span>
        <span class="preco-centavos">,{{ precoCentavos(produto.preco) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Props
const props = defineProps<{
  gradeId: number
  produtos: Produto[]
}>()

// Definição das grades
const gradeConfig = computed(() => {
  // Exemplo para layout-29 (5 produtos, 1 destaque esquerdo)
  if (props.gradeId === 29) {
    return {
      direction: 'column',
      boxes: [
        { width: '39%', height: '100%', destaque: true },   // row-0: destaque
        { width: '30%', height: '50%', destaque: false },    // row-1
        { width: '30%', height: '50%', destaque: false },    // row-2
        { width: '30%', height: '50%', destaque: false },    // row-3
        { width: '30%', height: '50%', destaque: false },    // row-4
      ]
    }
  }
  // ... outras grades
})

function isDestaque(index: number) {
  return gradeConfig.value?.boxes[index]?.destaque ?? false
}

function getBoxStyle(index: number) {
  const box = gradeConfig.value?.boxes[index]
  if (!box) return {}
  return {
    width: box.width,
    height: box.height,
  }
}
</script>

<style scoped>
.grade-container {
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
  width: 100%;
  aspect-ratio: 1/1;  /* ou 16/9 dependendo do modelo */
}

.produto-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  border: 2px solid #ffd700;
  background: white;
  overflow: hidden;
}

.produto-box.is-destaque {
  /* Destaque tem estilo diferenciado */
}

.produto-box.is-destaque .produto-titulo {
  font-size: 1.8em;
  font-weight: 900;
}

.produto-box:not(.is-destaque) .produto-titulo {
  font-size: 0.9em;
  font-weight: 700;
}

/* Container da imagem com crop visual */
.produto-image-container {
  width: 100%;
  flex: 1;
  overflow: hidden;       /* CROP VISUAL */
  position: relative;
}

.produto-image-place {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.produto-image-item {
  position: absolute;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
}

/* Etiqueta de preço */
.produto-etiqueta {
  padding: 8px 16px;
  text-align: center;
}

.produto-etiqueta .cifrao {
  font-size: 0.6em;
  vertical-align: super;
}

.produto-etiqueta .preco-inteiro {
  font-size: 2.5em;
  font-weight: 900;
}

.produto-etiqueta .preco-centavos {
  font-size: 1.2em;
  vertical-align: super;
}

/* Destaque: preço ainda maior */
.etiqueta-grande .preco-inteiro {
  font-size: 4em;
}
</style>
```

### Proporções Internas do Box (classes X_ e Y_)

O QR Ofertas usa classes CSS para definir como o espaço interno de cada box é dividido:

```
X_70-30 → Destaque: 70% largura para imagem | 30% para preço
X_60-40 → Normal:   60% largura para imagem | 40% para preço
Y_80-20 → Ambos:    80% altura para imagem+nome | 20% para etiqueta
```

Para implementar no Nuxt 4, essas proporções viram CSS:

```css
/* Proporção interna X (imagem vs preço horizontal) */
.box-x-70-30 .produto-image-container { width: 70%; }
.box-x-70-30 .produto-etiqueta { width: 30%; }

.box-x-60-40 .produto-image-container { width: 60%; }
.box-x-60-40 .produto-etiqueta { width: 40%; }

/* Proporção interna Y (conteúdo vs etiqueta vertical) */
.box-y-80-20 .produto-content { height: 80%; }
.box-y-80-20 .produto-etiqueta { height: 20%; }
```

### Classe INVADIR (Imagem "Sobrepondo" o Box)

A classe `INVADIR_50` ou `INVADIR_20` permite que a imagem do produto "invada" além dos limites do box (efeito visual onde o produto parece sair da moldura):

```css
/* Imagem pode sobrepor 50% além do box */
.invadir-50 .produto-image-item {
  width: 150%;   /* 100% + 50% de invasão */
  height: 150%;
  left: -25%;    /* centralizar a invasão */
  top: -25%;
}

/* Imagem pode sobrepor 20% além do box */
.invadir-20 .produto-image-item {
  width: 120%;
  height: 120%;
  left: -10%;
  top: -10%;
}
```

> **IMPORTANTE:** Quando `INVADIR` está ativo, o `overflow` do box pai muda para `visible` para permitir que a imagem apareça fora do box. Apenas o container mais externo da arte mantém `overflow: hidden`.

---

## Formatos de Modelo (Dimensões Finais)

| Modelo | Dimensão (px) | Aspect Ratio | Uso |
|--------|---------------|-------------|-----|
| Encarte feed facebook quadrado | 1200x1200 | 1:1 | Instagram/Facebook feed |
| Formato status/stories | 1080x1920 | 9:16 | Instagram/WhatsApp stories |
| Formato feed/reels instagram | 1080x1350 | 4:5 | Instagram feed/reels |
| Cartaz A4 vertical | 2480x3508 | ~1:1.41 (A4) | Impressão A4 retrato |
| Cartaz A4 horizontal | 3508x2480 | ~1.41:1 (A4) | Impressão A4 paisagem |
| Encarte A4 impressão | 2480x3508 | ~1:1.41 | Folheto A4 |
| Encarte grande impressão | 4960x7016 | ~1:1.41 | Cartaz grande |
| Formato TV horizontal | 1920x1080 | 16:9 | TV/Monitor horizontal |
| Formato TV vertical | 1080x1920 | 9:16 | TV/Monitor vertical |

### Estrutura de um Modelo Completo

Cada modelo define: dimensão final, layout do cabeçalho (tema), grade de produtos, e rodapé:

```
┌──────────────────────────────┐
│  CABEÇALHO / TEMA            │  ← .render-template (imagem de fundo do tema)
│  "Sexta da Carne"            │
├──────────────────────────────┤
│ ┌─────────┬────────┬───────┐ │
│ │DESTAQUE │ Prod 2 │Prod 3 │ │  ← .drag-row.layout-{ID} (grade flex)
│ │(grande) │        │       │ │
│ │         ├────────┼───────┤ │
│ │  Prod 1 │ Prod 4 │Prod 5 │ │
│ │  R$19   │        │       │ │
│ └─────────┴────────┴───────┘ │
├──────────────────────────────┤
│  RODAPÉ                      │  ← informações da empresa, validade, etc
│  Logo | Endereço | Validade  │
└──────────────────────────────┘
```

---

## Catálogo Completo: Variações de Layout Nome/Imagem/Etiqueta

O QR Ofertas usa um sistema de classes CSS que define como o **nome do produto**, **imagem** e **etiqueta de preço** se organizam dentro de cada box. O modo "Inteligente" gera variações automáticas entre os boxes de uma mesma grade.

### Classes de Controle

| Classe | Descrição |
|--------|-----------|
| `ordem-*` | Define a **ordem de renderização** dos 3 elementos (TITULO, IMAGEM, ETIQUETA) |
| `CONTENT_*` | Define o **modo de fluxo/layout** (direção dos elementos) |
| `ETIQUETA-*` | Define a **orientação da etiqueta** de preço (HORIZONTAL ou VERTICAL) |
| `X_*` | Define a **proporção horizontal** entre imagem e etiqueta (ex: 60% imagem / 40% etiqueta) |
| `Y_*` | Define a **proporção vertical** entre título+imagem e etiqueta (ex: 80% cima / 20% baixo) |
| `INVADIR_*` / `NAO_INVADIR` | Define se a imagem pode **sobrepor/ultrapassar** os limites do box e em quanto (%) |

### Valores Descobertos para Cada Classe

**ordem- (3 variações)**
| Valor | Significado Visual |
|-------|-------------------|
| `ordem-TITULO-IMAGEM-ETIQUETA` | Nome em cima → Imagem no meio → Preço embaixo |
| `ordem-IMAGEM-TITULO-ETIQUETA` | Imagem em cima → Nome embaixo → Preço na base |
| `ordem-IMAGEM-ETIQUETA-TITULO` | Imagem em cima → Preço no meio → Nome embaixo |

**CONTENT_ (4 variações)**
| Valor | Significado Visual |
|-------|-------------------|
| `CONTENT_LINE` | Elementos empilhados em coluna simples (título → imagem → etiqueta vertical) |
| `CONTENT_COL_ETIQUETA_TITULO` | Etiqueta e título ficam **ao lado** da imagem (layout em colunas) |
| `CONTENT_ROW_ETIQUETA_TITULO` | Etiqueta e título ficam em **linha/row** abaixo da imagem |
| `CONTENT_ROW_ETIQUETA_IMAGEM` | Etiqueta fica ao lado da imagem em row, título separado |

**ETIQUETA- (2 variações)**
| Valor | Significado Visual |
|-------|-------------------|
| `ETIQUETA-HORIZONTAL` | Etiqueta de preço na orientação horizontal (largura > altura) |
| `ETIQUETA-VERTICAL` | Etiqueta de preço na orientação vertical (altura > largura) |

**X_ (Proporção Horizontal - 5 variações)**
| Valor | Significado |
|-------|------------|
| `X_30-70` | 30% imagem / 70% etiqueta+título |
| `X_40-60` | 40% imagem / 60% etiqueta+título |
| `X_50-50` | 50% imagem / 50% etiqueta+título |
| `X_60-40` | 60% imagem / 40% etiqueta+título |
| `X_70-30` | 70% imagem / 30% etiqueta+título |

**Y_ (Proporção Vertical - 5 variações)**
| Valor | Significado |
|-------|------------|
| `Y_20-80` | 20% topo (título) / 80% imagem+etiqueta |
| `Y_30-70` | 30% topo / 70% imagem+etiqueta |
| `Y_50-50` | 50% topo / 50% imagem+etiqueta |
| `Y_60-40` | 60% topo / 40% etiqueta |
| `Y_70-30` | 70% topo / 30% etiqueta |
| `Y_80-20` | 80% topo (imagem+nome) / 20% etiqueta |

**INVADIR (4 variações)**
| Valor | Significado |
|-------|------------|
| `NAO_INVADIR` | Imagem fica contida dentro do box |
| `INVADIR_20` | Imagem pode ultrapassar 20% do box |
| `INVADIR_50` | Imagem pode ultrapassar 50% do box |
| `INVADIR_100` | Imagem pode ultrapassar 100% do box (sobrepõe completamente) |

### Todas as Combinações Únicas Encontradas (16 variações)

| # | ordem | content | etiqueta | X | Y | invadir | Descrição Visual |
|---|-------|---------|----------|---|---|---------|-----------------|
| 1 | TITULO-IMAGEM-ETIQUETA | CONTENT_LINE | ETIQUETA-HORIZONTAL | X_70-30 | Y_80-20 | INVADIR_20 | Nome em cima, imagem grande, preço horizontal embaixo. Invasão leve. |
| 2 | TITULO-IMAGEM-ETIQUETA | CONTENT_LINE | ETIQUETA-HORIZONTAL | X_60-40 | Y_80-20 | INVADIR_20 | Nome em cima, imagem média, preço horizontal embaixo. Invasão leve. |
| 3 | TITULO-IMAGEM-ETIQUETA | CONTENT_LINE | ETIQUETA-HORIZONTAL | X_70-30 | Y_80-20 | INVADIR_50 | Nome em cima, imagem grande com invasão média, preço horizontal embaixo. |
| 4 | TITULO-IMAGEM-ETIQUETA | CONTENT_LINE | ETIQUETA-VERTICAL | X_40-60 | Y_20-80 | NAO_INVADIR | Nome em cima (pequeno), imagem e preço vertical ocupam 80%. Sem invasão. |
| 5 | TITULO-IMAGEM-ETIQUETA | CONTENT_LINE | ETIQUETA-VERTICAL | X_60-40 | Y_80-20 | INVADIR_20 | Nome em cima, imagem 60%, preço vertical 40%. Invasão leve. |
| 6 | TITULO-IMAGEM-ETIQUETA | CONTENT_LINE | ETIQUETA-VERTICAL | X_70-30 | Y_80-20 | INVADIR_50 | Nome em cima, imagem 70%, preço vertical estreito. Invasão média. |
| 7 | TITULO-IMAGEM-ETIQUETA | CONTENT_ROW_BOTTOM | ETIQUETA-VERTICAL | X_60-40 | Y_30-70 | NAO_INVADIR | Nome em cima (30%), imagem e preço vertical em row embaixo (70%). |
| 8 | TITULO-IMAGEM-ETIQUETA | CONTENT_ROW_ETIQUETA_IMAGEM | ETIQUETA-VERTICAL | X_60-40 | Y_20-80 | NAO_INVADIR | Nome em cima (20%), etiqueta ao lado da imagem em row. |
| 9 | IMAGEM-TITULO-ETIQUETA | CONTENT_COL_ETIQUETA_TITULO | ETIQUETA-VERTICAL | X_30-70 | Y_60-40 | NAO_INVADIR | Imagem à esquerda (30%), nome+preço vertical ao lado (70%). |
| 10 | IMAGEM-TITULO-ETIQUETA | CONTENT_COL_ETIQUETA_TITULO | ETIQUETA-HORIZONTAL | X_40-60 | Y_50-50 | NAO_INVADIR | Imagem à esquerda (40%), nome+preço horizontal ao lado. 50/50 vertical. |
| 11 | IMAGEM-TITULO-ETIQUETA | CONTENT_COL_ETIQUETA_TITULO | ETIQUETA-HORIZONTAL | X_50-50 | Y_30-70 | NAO_INVADIR | Imagem e nome+preço metade-metade. Preço horizontal ao lado. |
| 12 | IMAGEM-TITULO-ETIQUETA | CONTENT_COL_ETIQUETA_TITULO | ETIQUETA-HORIZONTAL | X_50-50 | Y_50-50 | NAO_INVADIR | Imagem e nome+preço metade-metade. Distribuição equilibrada. |
| 13 | IMAGEM-TITULO-ETIQUETA | CONTENT_COL_ETIQUETA_TITULO | ETIQUETA-HORIZONTAL | X_60-40 | Y_50-50 | NAO_INVADIR | Imagem 60%, nome+preço horizontal 40%. |
| 14 | IMAGEM-TITULO-ETIQUETA | CONTENT_COL_ETIQUETA_TITULO | ETIQUETA-VERTICAL | X_60-40 | Y_50-50 | NAO_INVADIR | Imagem 60%, nome+preço vertical 40%. |
| 15 | IMAGEM-ETIQUETA-TITULO | CONTENT_ROW_ETIQUETA_TITULO | ETIQUETA-VERTICAL | X_40-60 | Y_70-30 | INVADIR_100 | Imagem com invasão total, preço no meio, nome na base. |
| 16 | IMAGEM-ETIQUETA-TITULO | CONTENT_ROW_ETIQUETA_TITULO | ETIQUETA-VERTICAL | X_40-60 | Y_80-20 | INVADIR_100 | Imagem com invasão total (80%), preço no meio, nome na base. |

### Diagramas Visuais das 5 Categorias Principais de Layout

```
═══════════════════════════════════════════════════════════
CATEGORIA 1: CONTENT_LINE (Empilhado vertical - mais comum)
═══════════════════════════════════════════════════════════

  ordem-TITULO-IMAGEM-ETIQUETA + ETIQUETA-HORIZONTAL
  ┌──────────────────┐
  │  NOME DO PRODUTO │  ← título em cima
  ├──────────────────┤
  │                  │
  │    [IMAGEM]      │  ← imagem no centro
  │                  │
  ├──────────────────┤
  │ R$ 4,99          │  ← etiqueta horizontal embaixo
  └──────────────────┘

  ordem-TITULO-IMAGEM-ETIQUETA + ETIQUETA-VERTICAL
  ┌──────────────────┐
  │  NOME DO PRODUTO │
  ├─────────┬────────┤
  │         │  R$    │
  │ [IMAGEM]│ 4,99   │  ← etiqueta vertical ao lado
  │         │        │
  └─────────┴────────┘

═══════════════════════════════════════════════════════════
CATEGORIA 2: CONTENT_COL_ETIQUETA_TITULO (Colunas - nome e preço ao lado)
═══════════════════════════════════════════════════════════

  ordem-IMAGEM-TITULO-ETIQUETA + ETIQUETA-HORIZONTAL
  ┌─────────┬────────────┐
  │         │ NOME PROD  │
  │         ├────────────┤
  │ [IMAGEM]│            │  ← imagem à esquerda, info à direita
  │         │ R$ 4,99    │
  │         │            │
  └─────────┴────────────┘

  ordem-IMAGEM-TITULO-ETIQUETA + ETIQUETA-VERTICAL
  ┌─────────┬────────────┐
  │         │ NOME PROD  │
  │         │            │
  │ [IMAGEM]│   R$       │  ← preço vertical ao lado
  │         │  4,99      │
  │         │            │
  └─────────┴────────────┘

═══════════════════════════════════════════════════════════
CATEGORIA 3: CONTENT_ROW_ETIQUETA_TITULO (Row - imagem grande, preço+nome embaixo)
═══════════════════════════════════════════════════════════

  ordem-IMAGEM-ETIQUETA-TITULO
  ┌──────────────────┐
  │                  │
  │    [IMAGEM]      │  ← imagem grande em cima (INVADIR_100)
  │   (invasão!)     │
  ├────────┬─────────┤
  │  R$    │  NOME   │  ← preço e nome lado a lado embaixo
  │ 4,99   │ PRODUTO │
  └────────┴─────────┘

═══════════════════════════════════════════════════════════
CATEGORIA 4: CONTENT_ROW_BOTTOM (Row bottom)
═══════════════════════════════════════════════════════════

  ordem-TITULO-IMAGEM-ETIQUETA
  ┌──────────────────┐
  │  NOME DO PRODUTO │  ← 30% topo
  ├─────────┬────────┤
  │         │  R$    │
  │ [IMAGEM]│ 4,99   │  ← 70% imagem + preço vertical em row
  │         │        │
  └─────────┴────────┘

═══════════════════════════════════════════════════════════
CATEGORIA 5: CONTENT_ROW_ETIQUETA_IMAGEM (Etiqueta ao lado da imagem)
═══════════════════════════════════════════════════════════

  ordem-TITULO-IMAGEM-ETIQUETA
  ┌──────────────────┐
  │  NOME DO PRODUTO │  ← 20% topo
  ├─────────┬────────┤
  │         │  R$    │
  │ [IMAGEM]│ 4,99   │  ← etiqueta ao lado da imagem em row
  │         │        │
  └─────────┴────────┘
```

### Formato TABELA (Grades 86 e 89)

As grades "TABELA de 10 produtos" e "TABELA de 20 produtos" usam um layout completamente diferente baseado em `<table>` HTML em vez do sistema flex com classes `ordem-`/`CONTENT_`/`ETIQUETA-`. Neste formato:
- Produtos são listados em linhas de tabela
- Cada linha tem: imagem (pequena) | nome | preço
- Não há variação de layout por box - todos seguem o mesmo padrão tabular
- Não usa as classes `INVADIR`, `X_`, `Y_`, `ordem-`, `CONTENT_`, `ETIQUETA-`

### Implementação em Nuxt 4 - Componente de Layout de Produto

```vue
<!-- BoxProduto.vue -->
<template>
  <div
    class="box-produto"
    :class="[
      layoutConfig.ordem,
      layoutConfig.content,
      layoutConfig.etiqueta,
      layoutConfig.x,
      layoutConfig.y,
      layoutConfig.invadir,
      { 'IS_DESTAQUE': isDestaque }
    ]"
  >
    <!-- Os 3 elementos são renderizados na ordem definida por ordem-* -->
    <template v-for="item in renderOrder" :key="item">
      <!-- TITULO -->
      <div v-if="item === 'TITULO'" class="produto-titulo">
        {{ produto.nome }}
      </div>

      <!-- IMAGEM -->
      <div v-if="item === 'IMAGEM'" class="produto-imagem-wrapper">
        <div class="image-builder">
          <div class="image-place-builder">
            <div
              class="img-item"
              :style="{
                backgroundImage: `url('${produto.imageUrl}')`,
                width: `${produto.imageZoom || 100}%`,
                height: `${produto.imageZoom || 100}%`,
                left: `${produto.imageOffsetX || 0}px`,
                top: `${produto.imageOffsetY || 0}px`,
              }"
            />
          </div>
        </div>
      </div>

      <!-- ETIQUETA -->
      <div v-if="item === 'ETIQUETA'" class="produto-etiqueta">
        <span class="cifrao">R$</span>
        <span class="preco-inteiro">{{ precoInteiro }}</span>
        <span class="preco-centavos">,{{ precoCentavos }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Produto {
  id: number
  nome: string
  preco: number
  imageUrl: string
  imageZoom?: number
  imageOffsetX?: number
  imageOffsetY?: number
}

interface LayoutConfig {
  ordem: string        // 'ordem-TITULO-IMAGEM-ETIQUETA' | 'ordem-IMAGEM-TITULO-ETIQUETA' | 'ordem-IMAGEM-ETIQUETA-TITULO'
  content: string      // 'CONTENT_LINE' | 'CONTENT_COL_ETIQUETA_TITULO' | 'CONTENT_ROW_ETIQUETA_TITULO' | 'CONTENT_ROW_BOTTOM' | 'CONTENT_ROW_ETIQUETA_IMAGEM'
  etiqueta: string     // 'ETIQUETA-HORIZONTAL' | 'ETIQUETA-VERTICAL'
  x: string            // 'X_30-70' | 'X_40-60' | 'X_50-50' | 'X_60-40' | 'X_70-30'
  y: string            // 'Y_20-80' | 'Y_30-70' | 'Y_50-50' | 'Y_60-40' | 'Y_70-30' | 'Y_80-20'
  invadir: string      // 'NAO_INVADIR' | 'INVADIR_20' | 'INVADIR_50' | 'INVADIR_100'
}

const props = defineProps<{
  produto: Produto
  layoutConfig: LayoutConfig
  isDestaque?: boolean
}>()

// Extrai a ordem de renderização a partir da classe ordem-*
const renderOrder = computed(() => {
  const ordem = props.layoutConfig.ordem.replace('ordem-', '')
  return ordem.split('-') // ['TITULO', 'IMAGEM', 'ETIQUETA'] etc
})

const precoInteiro = computed(() => Math.floor(props.produto.preco))
const precoCentavos = computed(() => {
  const cents = Math.round((props.produto.preco % 1) * 100)
  return cents.toString().padStart(2, '0')
})
</script>
```

### CSS Base para os Layouts

```css
/* ============================================
   SISTEMA DE LAYOUT - CONTENT MODES
   ============================================ */

/* CONTENT_LINE: empilhamento vertical simples */
.box-produto.CONTENT_LINE {
  display: flex;
  flex-direction: column;
}

/* CONTENT_COL_ETIQUETA_TITULO: imagem e info em colunas lado a lado */
.box-produto.CONTENT_COL_ETIQUETA_TITULO {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
.box-produto.CONTENT_COL_ETIQUETA_TITULO .produto-imagem-wrapper {
  /* largura controlada por X_ */
}
.box-produto.CONTENT_COL_ETIQUETA_TITULO .produto-titulo,
.box-produto.CONTENT_COL_ETIQUETA_TITULO .produto-etiqueta {
  /* ocupam o restante ao lado da imagem */
}

/* CONTENT_ROW_ETIQUETA_TITULO: imagem em cima, preço+nome em row embaixo */
.box-produto.CONTENT_ROW_ETIQUETA_TITULO {
  display: flex;
  flex-direction: column;
}
.box-produto.CONTENT_ROW_ETIQUETA_TITULO .produto-etiqueta,
.box-produto.CONTENT_ROW_ETIQUETA_TITULO .produto-titulo {
  display: inline-flex;
  /* ficam lado a lado na parte inferior */
}

/* CONTENT_ROW_BOTTOM: título em cima, imagem+etiqueta em row embaixo */
.box-produto.CONTENT_ROW_BOTTOM {
  display: flex;
  flex-direction: column;
}

/* CONTENT_ROW_ETIQUETA_IMAGEM: título em cima, etiqueta ao lado da imagem */
.box-produto.CONTENT_ROW_ETIQUETA_IMAGEM {
  display: flex;
  flex-direction: column;
}

/* ============================================
   PROPORÇÕES HORIZONTAIS (X_)
   ============================================ */
.box-produto.X_30-70 .produto-imagem-wrapper { width: 30%; }
.box-produto.X_30-70 .produto-etiqueta { width: 70%; }

.box-produto.X_40-60 .produto-imagem-wrapper { width: 40%; }
.box-produto.X_40-60 .produto-etiqueta { width: 60%; }

.box-produto.X_50-50 .produto-imagem-wrapper { width: 50%; }
.box-produto.X_50-50 .produto-etiqueta { width: 50%; }

.box-produto.X_60-40 .produto-imagem-wrapper { width: 60%; }
.box-produto.X_60-40 .produto-etiqueta { width: 40%; }

.box-produto.X_70-30 .produto-imagem-wrapper { width: 70%; }
.box-produto.X_70-30 .produto-etiqueta { width: 30%; }

/* ============================================
   PROPORÇÕES VERTICAIS (Y_)
   ============================================ */
.box-produto.Y_20-80 .produto-titulo { height: 20%; }
.box-produto.Y_20-80 .produto-imagem-wrapper { height: 80%; }

.box-produto.Y_30-70 .produto-titulo { height: 30%; }
.box-produto.Y_30-70 .produto-imagem-wrapper { height: 70%; }

.box-produto.Y_50-50 .produto-titulo { height: 50%; }
.box-produto.Y_50-50 .produto-imagem-wrapper { height: 50%; }

.box-produto.Y_60-40 .produto-imagem-wrapper { height: 60%; }
.box-produto.Y_60-40 .produto-etiqueta { height: 40%; }

.box-produto.Y_70-30 .produto-imagem-wrapper { height: 70%; }
.box-produto.Y_70-30 .produto-etiqueta { height: 30%; }

.box-produto.Y_80-20 .produto-imagem-wrapper { height: 80%; }
.box-produto.Y_80-20 .produto-etiqueta { height: 20%; }

/* ============================================
   ETIQUETA ORIENTAÇÃO
   ============================================ */
.box-produto .produto-etiqueta.ETIQUETA-HORIZONTAL {
  flex-direction: row;
  align-items: baseline;
}
.box-produto .produto-etiqueta.ETIQUETA-VERTICAL {
  flex-direction: column;
  align-items: center;
}

/* ============================================
   INVASÃO DE IMAGEM (INVADIR)
   ============================================ */
.box-produto.NAO_INVADIR .image-builder {
  overflow: hidden;  /* imagem contida */
}
.box-produto.INVADIR_20 .produto-imagem-wrapper {
  overflow: visible;
  z-index: 2;
}
.box-produto.INVADIR_20 .img-item {
  transform: scale(1.2);  /* 20% maior que o container */
}
.box-produto.INVADIR_50 .produto-imagem-wrapper {
  overflow: visible;
  z-index: 2;
}
.box-produto.INVADIR_50 .img-item {
  transform: scale(1.5);  /* 50% maior */
}
.box-produto.INVADIR_100 .produto-imagem-wrapper {
  overflow: visible;
  z-index: 2;
}
.box-produto.INVADIR_100 .img-item {
  transform: scale(2.0);  /* 100% maior (dobro do tamanho) */
}
```

### TypeScript: Configurações de Layout por Tipo

```ts
// layoutConfigs.ts - Todas as 16 combinações únicas encontradas no QR Ofertas

export type OrdemType = 'ordem-TITULO-IMAGEM-ETIQUETA' | 'ordem-IMAGEM-TITULO-ETIQUETA' | 'ordem-IMAGEM-ETIQUETA-TITULO'
export type ContentType = 'CONTENT_LINE' | 'CONTENT_COL_ETIQUETA_TITULO' | 'CONTENT_ROW_ETIQUETA_TITULO' | 'CONTENT_ROW_BOTTOM' | 'CONTENT_ROW_ETIQUETA_IMAGEM'
export type EtiquetaType = 'ETIQUETA-HORIZONTAL' | 'ETIQUETA-VERTICAL'
export type XType = 'X_30-70' | 'X_40-60' | 'X_50-50' | 'X_60-40' | 'X_70-30'
export type YType = 'Y_20-80' | 'Y_30-70' | 'Y_50-50' | 'Y_60-40' | 'Y_70-30' | 'Y_80-20'
export type InvadirType = 'NAO_INVADIR' | 'INVADIR_20' | 'INVADIR_50' | 'INVADIR_100'

export interface LayoutConfig {
  id: number
  ordem: OrdemType
  content: ContentType
  etiqueta: EtiquetaType
  x: XType
  y: YType
  invadir: InvadirType
  descricao: string
}

export const LAYOUT_CONFIGS: LayoutConfig[] = [
  // --- CONTENT_LINE (empilhado vertical) ---
  { id: 1,  ordem: 'ordem-TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_70-30', y: 'Y_80-20', invadir: 'INVADIR_20',   descricao: 'Nome cima, imagem grande, preço horizontal embaixo' },
  { id: 2,  ordem: 'ordem-TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_60-40', y: 'Y_80-20', invadir: 'INVADIR_20',   descricao: 'Nome cima, imagem média, preço horizontal embaixo' },
  { id: 3,  ordem: 'ordem-TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_70-30', y: 'Y_80-20', invadir: 'INVADIR_50',   descricao: 'Nome cima, imagem grande invasão média, preço horizontal' },
  { id: 4,  ordem: 'ordem-TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-VERTICAL',   x: 'X_40-60', y: 'Y_20-80', invadir: 'NAO_INVADIR',  descricao: 'Nome cima pequeno, imagem+preço vertical ocupam 80%' },
  { id: 5,  ordem: 'ordem-TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-VERTICAL',   x: 'X_60-40', y: 'Y_80-20', invadir: 'INVADIR_20',   descricao: 'Nome cima, imagem 60%, preço vertical 40%' },
  { id: 6,  ordem: 'ordem-TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_LINE', etiqueta: 'ETIQUETA-VERTICAL',   x: 'X_70-30', y: 'Y_80-20', invadir: 'INVADIR_50',   descricao: 'Nome cima, imagem 70%, preço vertical estreito' },

  // --- CONTENT_ROW_BOTTOM ---
  { id: 7,  ordem: 'ordem-TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_ROW_BOTTOM', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_60-40', y: 'Y_30-70', invadir: 'NAO_INVADIR', descricao: 'Nome 30% topo, imagem+preço vertical em row embaixo' },

  // --- CONTENT_ROW_ETIQUETA_IMAGEM ---
  { id: 8,  ordem: 'ordem-TITULO-IMAGEM-ETIQUETA', content: 'CONTENT_ROW_ETIQUETA_IMAGEM', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_60-40', y: 'Y_20-80', invadir: 'NAO_INVADIR', descricao: 'Nome 20% topo, etiqueta ao lado da imagem' },

  // --- CONTENT_COL_ETIQUETA_TITULO (colunas lado a lado) ---
  { id: 9,  ordem: 'ordem-IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-VERTICAL',   x: 'X_30-70', y: 'Y_60-40', invadir: 'NAO_INVADIR', descricao: 'Imagem 30% esquerda, nome+preço vertical 70% direita' },
  { id: 10, ordem: 'ordem-IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_40-60', y: 'Y_50-50', invadir: 'NAO_INVADIR', descricao: 'Imagem 40% esquerda, nome+preço horizontal 60% direita' },
  { id: 11, ordem: 'ordem-IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_50-50', y: 'Y_30-70', invadir: 'NAO_INVADIR', descricao: 'Imagem metade, nome+preço horizontal metade' },
  { id: 12, ordem: 'ordem-IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_50-50', y: 'Y_50-50', invadir: 'NAO_INVADIR', descricao: 'Metade-metade equilibrado com preço horizontal' },
  { id: 13, ordem: 'ordem-IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-HORIZONTAL', x: 'X_60-40', y: 'Y_50-50', invadir: 'NAO_INVADIR', descricao: 'Imagem 60%, nome+preço horizontal 40%' },
  { id: 14, ordem: 'ordem-IMAGEM-TITULO-ETIQUETA', content: 'CONTENT_COL_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-VERTICAL',   x: 'X_60-40', y: 'Y_50-50', invadir: 'NAO_INVADIR', descricao: 'Imagem 60%, nome+preço vertical 40%' },

  // --- CONTENT_ROW_ETIQUETA_TITULO (imagem grande, preço+nome em row) ---
  { id: 15, ordem: 'ordem-IMAGEM-ETIQUETA-TITULO', content: 'CONTENT_ROW_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_40-60', y: 'Y_70-30', invadir: 'INVADIR_100', descricao: 'Imagem invasão total, preço+nome em row embaixo (30%)' },
  { id: 16, ordem: 'ordem-IMAGEM-ETIQUETA-TITULO', content: 'CONTENT_ROW_ETIQUETA_TITULO', etiqueta: 'ETIQUETA-VERTICAL', x: 'X_40-60', y: 'Y_80-20', invadir: 'INVADIR_100', descricao: 'Imagem invasão total (80%), preço+nome row embaixo (20%)' },
]

/**
 * Seleciona um layout aleatório baseado no modo
 * @param modo 'inteligente' varia por box | 'padrao' usa o mesmo para todos
 */
export function getLayoutForBox(boxIndex: number, totalBoxes: number, modo: 'inteligente' | 'padrao'): LayoutConfig {
  if (modo === 'padrao') {
    // Modo padrão: usar layout #2 (mais comum) para todos
    return LAYOUT_CONFIGS[1]
  }
  // Modo inteligente: distribuir variações entre os boxes
  const layoutIndex = boxIndex % LAYOUT_CONFIGS.length
  return LAYOUT_CONFIGS[layoutIndex]
}
```
