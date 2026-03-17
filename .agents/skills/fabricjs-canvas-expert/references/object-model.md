# Modelo de Objetos Fabric.js

## Tipos Fabric usados

| Tipo | Uso |
|------|-----|
| `fabric.Canvas` | Canvas interativo principal |
| `fabric.StaticCanvas` | Thumbnails offline |
| `fabric.Rect` | Frames, backgrounds, cards, placeholders, clipPaths |
| `fabric.Text` | Precos, badges, titulos de zona |
| `fabric.Textbox` | Nomes de produto (auto-wrap) |
| `fabric.IText` | Edicao rica (convertido de Text em runtime) |
| `fabric.Image` | Fotos de produto, assets, backgrounds |
| `fabric.Group` | Product cards, zones, price splash |
| `fabric.ActiveSelection` | Selecao multipla |
| `fabric.Path` | Vetores, SVG, clipPaths com cantos arredondados |
| `fabric.Circle` | Controles pen tool |
| `fabric.Line` | Guias, snap guides |
| `fabric.Ellipse` | Splash de preco |
| `fabric.PencilBrush` | Desenho livre |
| `fabric.Shadow` | Sombras |
| `fabric.Gradient` | Gradientes |
| `fabric.Pattern` | Fills com pattern |
| `fabric.filters.*` | Blur, Brightness, Contrast, Saturation, HueRotation, Grayscale, Sepia, Invert |

## Custom Props (CANVAS_CUSTOM_PROPS)

~100+ propriedades custom persistidas via `toObject(CANVAS_CUSTOM_PROPS)`:

### Identidade
- `id`, `_customId`, `name`, `layerName`, `excludeFromExport`

### Frames
- `isFrame`, `clipContent`, `parentFrameId`, `_frameClipOwner`
- `objectMaskEnabled`, `objectMaskSourceId`

### Grid Cells
- `isGridCell`, `gridGroupId`, `gridCol`, `gridRow`

### Smart Objects / Product Cards
- `isSmartObject`, `isProductCard`, `smartGridId`, `parentZoneId`
- `_zoneOrder`, `_cardWidth`, `_cardHeight`, `_productData`

### Product Zones
- `isGridZone`, `isProductZone`, `zoneName`, `role`
- `contentSource`, `contentStatus`, `columns`, `rows`
- `gapHorizontal`, `gapVertical`, `layoutDirection`

### Vetores
- `isVectorPath`, `isClosedPath`, `penPathData`

### Sticker Outline
- `__stickerOutlineEnabled`, `__stickerOutlineWidth`
- `__stickerOutlineColor`, `__stickerOutlineMode`

### Locks
- `lockMovementX/Y`, `lockScalingX/Y`, `lockRotation`

## Flags de tipo (runtime)

Nao existem classes custom. Objetos sao diferenciados por flags booleanas:

- **Frame**: `isFrame === true`, `layerName === "FRAMER"`
- **Product Zone**: `isGridZone === true && isProductZone === true`
- **Product Card**: `isSmartObject === true && isProductCard === true`
- **Vector Path**: `isVectorPath === true`
- **Grid Cell**: `isGridCell === true`
- **User Guide**: `isUserGuide === true`, `guideAxis`

## Product Card (fabric.Group)

Estrutura interna de um card de produto:
```
Group (isSmartObject, isProductCard)
  Rect (background, border-radius)
  Textbox (nome do produto, topo)
  Text (badge de limite)
  Image (foto do produto, centro)
  Group (price splash)
    Ellipse (splash background)
    Text (R$)
    Text (inteiro)
    Text (decimal)
    Text (unidade)
```
- Filhos: `selectable:false, evented:false` (grupo move como unidade)
- Tag: `data.smartType` identifica cada filho

## Product Zone (fabric.Group)

```
Group (isGridZone, isProductZone)
  Rect (borda tracejada)
  Text (titulo "Zona de Produtos")
```
- ClipPath em runtime (removido na serializacao)
- Scaling normalizado para width/height real

## Frames

- `Rect` ou `Path` com `isFrame === true`
- Filhos referenciam via `parentFrameId`
- ClipPath gerado em runtime (Rect ou Path com cantos arredondados)
- `clipContent === true` ativa o clipping

## Cloning

- Alt-drag usa `fabric.util.enlivenObjects([json])` (preferido para groups)
- Fallback: `obj.clone(CLONE_PROPS)`
- `fabric.util.parsePath()` para manipulacao de paths
- `fabric.util.transformPoint()` e `invertTransform()` para coordenadas

## Sticker Outline

Sistema EDT (Euclidean Distance Transform):
1. `generateStickerOutline()` - calcula campo de distancia supersampled
2. `applyStickerOutlinePatch(obj)` - substitui `drawObject` para desenhar contorno
3. Desabilita `objectCaching` enquanto ativo (impacto em performance)
