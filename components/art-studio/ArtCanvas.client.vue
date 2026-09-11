<script setup lang="ts">
import {
  Canvas,
  Gradient,
  Textbox,
  Rect,
  Ellipse,
  Path,
  FabricImage,
  type FabricObject
} from 'fabric'
import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import { artLayerImageSrc } from '~/utils/art-studio/logo'
import { ART_ICONS } from '~/types/art-studio'
import { loadArtFonts } from '~/utils/art-studio/fonts'
import { artImageCrop, cloneArt } from '~/utils/art-studio/composition'
const artGradient=(g: NonNullable<ArtLayer['gradient']>)=>{
 const colorStops=[{offset:0,color:g.from+Math.round(g.startOpacity*255).toString(16).padStart(2,'0')},{offset:1,color:g.to+Math.round(g.endOpacity*255).toString(16).padStart(2,'0')}]
 if(g.type==='radial')return new Gradient<'radial'>({type:'radial',gradientUnits:'percentage',coords:{x1:.5,y1:.5,r1:0,x2:.5,y2:.5,r2:.5},colorStops})
 const dx=Math.cos(g.angle*Math.PI/180)/2,dy=Math.sin(g.angle*Math.PI/180)/2
 return new Gradient<'linear'>({type:'linear',gradientUnits:'percentage',coords:{x1:.5-dx,y1:.5-dy,x2:.5+dx,y2:.5+dy},colorStops})
}
const props = defineProps<{
  composition: ArtComposition
  selectedId: string | null
  authoring?: boolean
}>()
const emit = defineEmits<{
  change: [value: ArtComposition]
  select: [id: string | null]
  error: [message: string]
}>()
const host = ref<HTMLElement>(),
  element = ref<HTMLCanvasElement>()
let canvas: Canvas | undefined,
  observer: ResizeObserver | undefined,
  generation = 0,
  stopped = false,
  lastEmission = '',
  rendering = false
const decodedImages = new Map<string, Promise<HTMLImageElement>>()
const imageResource = (src: string) => {
  let pending = decodedImages.get(src)
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Falha ao carregar imagem'));image.src=src})
    decodedImages.set(src,pending)
    pending.catch(()=>decodedImages.delete(src))
    if(decodedImages.size>64)decodedImages.delete(decodedImages.keys().next().value!)
  }
  return pending
}
let meta = new WeakMap<
  FabricObject,
  { layer: ArtLayer; sx: number; sy: number; dx: number; dy: number }
>()
let failedImages = false,
  failedLayout = false,
  renderedFingerprint = ''
const fit = () => {
  if (!canvas || !host.value) return
  const scale = Math.min(
    (host.value.clientWidth - 48) / props.composition.width,
    (host.value.clientHeight - 48) / props.composition.height,
    1
  )
  const zoom = Math.max(0.08, scale)
  canvas.setDimensions({
    width: props.composition.width * zoom,
    height: props.composition.height * zoom
  })
  canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0])
  canvas.requestRenderAll()
}
const selection = () => {
  if (!rendering)
    emit(
      'select',
      meta.get(canvas?.getActiveObject() as FabricObject)?.layer.id || null
    )
}
const changed = (object?: FabricObject) => {
  if (rendering || !object) return
  const entry = meta.get(object)
  if (!entry) return
  const output = cloneArt(props.composition),
    layer = output.layers.find((l) => l.id === entry.layer.id)
  if (!layer) return
  const fx = Math.abs(object.scaleX) / entry.sx,
    fy = Math.abs(object.scaleY) / entry.sy
  const radians = (object.angle * Math.PI) / 180
  const offsetX = entry.dx * fx,
    offsetY = entry.dy * fy
  layer.x =
    object.left - (Math.cos(radians) * offsetX - Math.sin(radians) * offsetY)
  layer.y =
    object.top - (Math.sin(radians) * offsetX + Math.cos(radians) * offsetY)
  layer.width = Math.max(1, entry.layer.width * fx)
  layer.height = Math.max(1, entry.layer.height * fy)
  layer.rotation = object.angle
  if (layer.kind === 'text' && object instanceof Textbox) {
    if (layer.text !== object.text) layer.binding = ''
    layer.text = object.text
    layer.width = Math.max(1, object.width * object.scaleX)
    layer.fontSize = Math.max(6, object.fontSize * Math.abs(object.scaleY))
    layer.height = Math.max(
      layer.height,
      object.height * Math.abs(object.scaleY)
    )
  }
  lastEmission = JSON.stringify(output)
  emit('change', output)
  // Rebuild após transformações; edição de texto mantém o caret até sair do campo.
  if (!(object instanceof Textbox && object.isEditing)) void render(output)
}
async function render(doc: ArtComposition) {
  if (!canvas || stopped) return
  const ticket = ++generation
  rendering = true
  const nextMeta = new WeakMap<
    FabricObject,
    { layer: ArtLayer; sx: number; sy: number; dx: number; dy: number }
  >()
  const objects: FabricObject[] = []
  let imageError = false,
    layoutError = false
  try {
    await loadArtFonts(doc)
    for (const layer of doc.layers) {
      if (
        !layer.visible ||
        (layer.kind === 'image' &&
          layer.binding === 'logo' &&
          !layer.src &&
          !props.authoring)
      )
        continue
      let obj: FabricObject,
        dx = 0,
        dy = 0
      const options = {
        left: layer.x,
        top: layer.y,
        originX: 'left' as const,
        originY: 'top' as const,
        angle: layer.rotation,
        opacity: layer.opacity,
        fill: layer.gradient ? artGradient(layer.gradient) : layer.fill,
        selectable: !layer.locked,
        evented: !layer.locked,
        lockScalingFlip: true,
        cornerColor: '#27624c',
        borderColor: '#27624c',
        transparentCorners: false,
        cornerSize: 10,
        touchCornerSize: 28
      }
      if (layer.kind === 'text') {
        const text = new Textbox(layer.text || '', {
          ...options,
          width: layer.width / (layer.fontScaleX || 1),
          scaleX: layer.fontScaleX || 1,
          fontSize: layer.fontSize || 48,
          fontFamily: `Art ${layer.fontFamily || 'Barlow'}`,
          fontWeight: layer.fontWeight || 400,
          textAlign: layer.align || 'left',
          lineHeight: layer.lineHeight ?? 1.16,
          splitByGrapheme: false
        })
        // A área do modelo limita a altura; o tamanho efetivo é recalculado em toda montagem.
        while (
          (text.height > layer.height || text.width * text.scaleX > layer.width) &&
          text.fontSize > 6
        ) {
          text.set('fontSize', text.fontSize - 1)
          text.initDimensions()
        }
        if (text.height > layer.height || text.width * text.scaleX > layer.width)
          layoutError = true
        obj = text
      } else if (layer.kind === 'image' && layer.src) {
        try {
          const img = new FabricImage(await imageResource(artLayerImageSrc(layer)))
          const crop = artImageCrop(img.width, img.height, layer)
          dx = (layer.width - crop.width * crop.scale) / 2
          dy = (layer.height - crop.height * crop.scale) / 2
          const rad = (layer.rotation * Math.PI) / 180
          img.set({
            ...options,
            left: layer.x + Math.cos(rad) * dx - Math.sin(rad) * dy,
            top: layer.y + Math.sin(rad) * dx + Math.cos(rad) * dy,
            width: crop.width,
            height: crop.height,
            cropX: crop.cropX,
            cropY: crop.cropY,
            scaleX: crop.scale,
            scaleY: crop.scale
          })
          obj = img
        } catch {
          imageError = true
          obj = new Rect({
            ...options,
            width: layer.width,
            height: layer.height,
            fill: '#f3ddd7',
            stroke: '#b34b36',
            strokeWidth: 3
          })
        }
      } else if (layer.kind === 'shape' && layer.shape === 'path' && layer.pathData) {
        const path = new Path(layer.pathData,options)
        path.set({scaleX:layer.width/path.width,scaleY:layer.height/path.height})
        obj=path
      } else if (layer.kind === 'icon') {
        const path = new Path(ART_ICONS[layer.icon || 'heart'], options)
        path.set({
          scaleX: layer.width / path.width,
          scaleY: layer.height / path.height
        })
        obj = path
      } else if (layer.kind === 'shape' && layer.shape === 'ellipse')
        obj = new Ellipse({
          ...options,
          rx: layer.width / 2,
          ry: layer.height / 2
        })
      else
        obj = new Rect({
          ...options,
          width: layer.width,
          height: layer.height,
          rx: layer.cornerRadius || 0, ry: layer.cornerRadius || 0,
          fill: layer.kind === 'image' ? 'transparent' : options.fill,
          stroke: layer.kind === 'image' ? layer.fill : undefined,
          strokeDashArray: layer.kind === 'image' ? [8, 8] : undefined
        })
      if ((layer.blur || 0) > 0 && ['shape', 'icon'].includes(layer.kind)) {
        // Raster intermediário apenas para desenhar o filtro; a camada editável
        // conserva forma, cor, geometria e desfoque no documento.
        obj.set({ left: 0, top: 0, angle: 0, opacity: 1 })
        const pad = Math.ceil(layer.blur! * 3)
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layer.width+pad*2}" height="${layer.height+pad*2}" viewBox="${-pad} ${-pad} ${layer.width+pad*2} ${layer.height+pad*2}"><defs><filter id="art-blur" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${layer.blur}"/></filter></defs><g filter="url(#art-blur)">${obj.toSVG()}</g></svg>`
        const blurred = await FabricImage.fromURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
        obj.dispose()
        const angle=layer.rotation*Math.PI/180
        dx=-pad;dy=-pad
        blurred.set({ ...options, left:layer.x+Math.cos(angle)*dx-Math.sin(angle)*dy, top:layer.y+Math.sin(angle)*dx+Math.cos(angle)*dy })
        obj = blurred
      }
      nextMeta.set(obj, {
        layer: cloneArt(layer),
        sx: obj.scaleX,
        sy: obj.scaleY,
        dx,
        dy
      })
      objects.push(obj)
    }
    if (ticket !== generation || stopped || !canvas) {
      objects.forEach((o) => o.dispose())
      return
    }
    canvas.discardActiveObject()
    canvas.clear()
    canvas.backgroundColor = doc.background
    meta = nextMeta
    objects.forEach((o) => canvas!.add(o))
    failedImages = imageError
    failedLayout = layoutError
    const active = objects.find(
      (o) => nextMeta.get(o)?.layer.id === props.selectedId && o.selectable
    )
    if (active) canvas.setActiveObject(active)
    fit()
    renderedFingerprint = JSON.stringify(doc)
    if (layoutError)
      emit(
        'error',
        'Um texto não cabe na caixa. Aumente a largura/altura ou reduza o conteúdo antes de exportar.'
      )
    if (imageError)
      emit(
        'error',
        'Uma imagem não carregou. Substitua-a ou tente reabrir a arte antes de exportar.'
      )
  } catch {
    emit('error', 'Não foi possível montar a prévia. Tente reabrir a arte.')
  } finally {
    if (ticket === generation) rendering = false
  }
}
watch(
  () => props.composition,
  (value) => {
    if (JSON.stringify(value) === lastEmission) {
      lastEmission = ''
      return
    }
    void render(value)
  },
  { deep: true }
)
watch(
  () => props.selectedId,
  (id) => {
    if (!canvas || rendering) return
    const obj = canvas.getObjects().find((o) => meta.get(o)?.layer.id === id)
    if (obj?.selectable) canvas.setActiveObject(obj)
    else canvas.discardActiveObject()
    canvas.requestRenderAll()
  }
)
const exportPng = async () => {
  if (canvas?.getActiveObject() instanceof Textbox)
    (canvas.getActiveObject() as Textbox).exitEditing()
  await render(props.composition)
  if (
    !canvas ||
    rendering ||
    renderedFingerprint !== JSON.stringify(props.composition)
  )
    throw new Error('Aguarde a montagem da arte antes de exportar.')
  if (failedLayout)
    throw new Error(
      'Há textos que não cabem nas caixas. Ajuste antes de exportar.'
    )
  if (failedImages)
    throw new Error('Há imagens que não carregaram. Corrija antes de exportar.')
  const active = canvas.getActiveObject(),
    viewport = [...canvas.viewportTransform] as [
      number,
      number,
      number,
      number,
      number,
      number
    ]
  const placeholders = canvas
    .getObjects()
    .filter(
      (o) => meta.get(o)?.layer.kind === 'image' && !meta.get(o)?.layer.src
    )
  const w = canvas.width,
    h = canvas.height
  try {
    placeholders.forEach((o) => o.set('visible', false))
    canvas.discardActiveObject()
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    canvas.setDimensions({
      width: props.composition.width,
      height: props.composition.height
    })
    return canvas.toDataURL({
      format: 'png',
      multiplier: 1,
      enableRetinaScaling: false
    })
  } finally {
    placeholders.forEach((o) => o.set('visible', true))
    canvas.setDimensions({ width: w, height: h })
    canvas.setViewportTransform(viewport)
    if (active) canvas.setActiveObject(active)
    canvas.requestRenderAll()
  }
}
defineExpose({ exportPng, refreshImages: async () => { decodedImages.clear(); await render(props.composition) } })
onMounted(async () => {
  canvas = new Canvas(element.value!, {
    preserveObjectStacking: true,
    selection: false,
    enableRetinaScaling: true
  })
  canvas.on('selection:created', selection)
  canvas.on('selection:updated', selection)
  canvas.on('selection:cleared', selection)
  canvas.on('object:modified', (e) => changed(e.target))
  canvas.on('text:changed', (e) => changed(e.target))
  canvas.on('text:editing:exited', () => void render(props.composition))
  observer = new ResizeObserver(fit)
  observer.observe(host.value!)
  await render(props.composition)
})
onBeforeUnmount(() => {
  stopped = true
  generation++
  observer?.disconnect()
  decodedImages.clear()
  if (canvas) void canvas.dispose()
  canvas = undefined
})
</script>
<template>
  <div ref="host" class="art-canvas-host" aria-label="Área de edição da arte">
    <canvas ref="element" />
  </div>
</template>
<style scoped>
.art-canvas-host {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 360px;
  background-color: #e9ece7;
  background-image: radial-gradient(#cad1c9 1px, transparent 1px);
  background-size: 18px 18px;
}
.art-canvas-host :deep(.canvas-container) {
  box-shadow: 0 12px 50px #18362920;
}
</style>
