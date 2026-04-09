<script setup lang="ts">
import {
  GripVertical,
  X,
  ImagePlus,
  Loader2,
  Settings2,
  Eraser,
  Search,
  Upload,
  ZoomIn,
  Move,
  RotateCcw,
  Maximize2,
} from 'lucide-vue-next'
import type { BuilderFlyerProduct, BuilderPriceMode, BuilderProductUnit } from '~/types/builder'

const props = defineProps<{
  product: BuilderFlyerProduct
  index: number
}>()

const { updateProduct, removeProduct } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const fileInput = ref<HTMLInputElement | null>(null)
const extraFileInput = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const isUploadingExtra = ref(false)
const isRemovingBg = ref(false)
const isSearching = ref(false)
const showPriceModal = ref(false)
const showImageEditor = ref(false)
const showDetails = ref(false)
const searchQuery = ref('')
const searchResults = ref<Array<{ key: string; url: string; name?: string }>>([])
const showSearchPanel = ref(false)

// Price mode options (all 9)
const priceModes: { value: BuilderPriceMode; label: string }[] = [
  { value: 'simple', label: 'Preco Simples' },
  { value: 'from_to', label: 'De / Por' },
  { value: 'x_per_y', label: 'X por Y (Qtd)' },
  { value: 'take_pay', label: 'Leve / Pague' },
  { value: 'installment', label: 'Parcelado' },
  { value: 'symbolic', label: 'Simbolico' },
  { value: 'club_price', label: 'Preco Clube' },
  { value: 'anticipation', label: 'Antecipacao' },
  { value: 'none', label: 'Sem Etiqueta' },
]

// Unit options (49 opcoes — compativel com QROfertas)
const unitOptions: { value: BuilderProductUnit; label: string }[] = [
  { value: 'UN', label: 'Escolha... (sem unidade)' },
  { value: 'BARRA', label: 'Barra' },
  { value: 'BOLA', label: 'Bola' },
  { value: 'CX', label: 'Caixa' },
  { value: 'CM', label: 'Centimetro' },
  { value: 'CUBO', label: 'Cubo' },
  { value: 'DZ', label: 'Duzia' },
  { value: 'FD', label: 'Fardo' },
  { value: 'FATIA', label: 'Fatia' },
  { value: 'SC', label: 'Saco' },
  { value: 'G', label: 'Grama' },
  { value: '100G', label: '100 Gramas' },
  { value: 'GALAO', label: 'Galao' },
  { value: 'GARRAFA', label: 'Garrafa' },
  { value: 'JARRA', label: 'Jarra' },
  { value: 'KG', label: 'Kilo' },
  { value: 'L', label: 'Litro' },
  { value: 'MACO', label: 'Maco' },
  { value: 'METRO', label: 'Metro' },
  { value: 'PCT', label: 'Pacote' },
  { value: 'TAMBOR', label: 'Tambor' },
  { value: 'PARES', label: 'Pares' },
  { value: 'PECA', label: 'Peca' },
  { value: 'PORCAO', label: 'Porcao' },
  { value: 'KIT', label: 'Kit' },
  { value: 'PRATO', label: 'Prato' },
  { value: 'KG', label: 'Quilo' },
  { value: 'UN', label: 'Unidade' },
  { value: 'ML', label: 'Ml' },
  { value: 'M2', label: 'M2' },
  { value: 'TELA', label: 'Tela' },
  { value: 'LATA', label: 'Lata' },
  { value: 'VASO', label: 'Vaso' },
  { value: 'BD', label: 'Bandeja' },
  { value: 'SACHE', label: 'Sache' },
  { value: 'MILHEIRO', label: 'Milheiro' },
  { value: 'ROLO', label: 'Rolo' },
  { value: 'CENTO', label: 'Cento' },
  { value: 'CADA', label: 'Cada' },
  { value: 'LIBRA', label: 'Libra' },
  { value: 'DISPLAY', label: 'Display' },
  { value: 'COMBO', label: 'Combo' },
  { value: 'CARTELA', label: 'Cartela' },
  { value: 'TONELADA', label: 'Tonelada' },
  { value: 'BALDE', label: 'Balde' },
  { value: 'POTE', label: 'Pote' },
  { value: 'POLEGADA', label: 'Polegada' },
  { value: 'PE', label: 'Pe' },
  { value: 'JARDA', label: 'Jarda' },
  { value: '500G', label: '500 Gramas' },
]

// Common price label options
const priceLabelOptions = [
  '', 'APENAS', 'OFERTA', 'SUPER OFERTA', 'PROMOCAO', 'SO HOJE', 'IMPERDIVEL',
  'QUEIMA', 'LIQUIDACAO', 'ECONOMIZE', 'ESPECIAL', 'EXCLUSIVO', 'DESTAQUE',
  'BAIXOU', 'APROVEITE', 'CONFIRA', 'NOVIDADE', 'LIMITADO',
]

// Quantity unit options for x_per_y
const quantityUnitOptions = [
  'Kilos', 'Unidades', 'Litros', 'Pacotes', 'Caixas', 'Duzias',
]

const update = (fields: Partial<BuilderFlyerProduct>) => {
  updateProduct(props.index, fields)
}

// ── Image URL resolution ──
const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/')) return img
  const wasabiMatch = img.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+)$/)
  if (wasabiMatch) return `/api/storage/p?key=${encodeURIComponent(wasabiMatch[1]!)}`
  if (img.startsWith('http://') || img.startsWith('https://')) return img
  if (img.startsWith('builder/') || img.startsWith('products/') || img.startsWith('imagens/') || img.includes('.')) {
    return `/api/storage/p?key=${encodeURIComponent(img)}`
  }
  return img
}

const imagePreviewUrl = computed(() => resolveImageUrl(props.product.custom_image))

// ── Upload handler ──
const handleImageClick = () => {
  fileInput.value?.click()
}

const handleFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !tenant.value) return

  isUploading.value = true
  try {
    const tenantId = tenant.value.id
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const key = `builder/${tenantId}/products/${filename}`
    const contentType = file.type || 'image/jpeg'

    const body = await file.arrayBuffer()

    await $fetch('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType },
      body: new Uint8Array(body),
      headers: { 'Content-Type': 'application/octet-stream' },
    })

    // Save just the key — components resolve via proxy
    update({ custom_image: key })
  } catch (err) {
    console.error('[BuilderProductEditorCard] Upload error:', err)
  } finally {
    isUploading.value = false
    if (input) input.value = ''
  }
}

const resolveExtraUrl = (img: string) => {
  if (!img) return ''
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

const duplicateMainImage = () => {
  const img = props.product.custom_image
  if (!img) return
  const current = props.product.extra_images || []
  update({ extra_images: [...current, img] })
}

// ── Extra images ──
const handleExtraImageUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !tenant.value) return

  isUploadingExtra.value = true
  try {
    const tenantId = tenant.value.id
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const key = `builder/${tenantId}/products/${filename}`
    const contentType = file.type || 'image/jpeg'
    const body = await file.arrayBuffer()

    await $fetch('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType },
      body: new Uint8Array(body),
      headers: { 'Content-Type': 'application/octet-stream' },
    })

    const current = props.product.extra_images || []
    update({ extra_images: [...current, key] })
  } catch (err) {
    console.error('[BuilderProductEditorCard] Extra image upload error:', err)
  } finally {
    isUploadingExtra.value = false
    if (input) input.value = ''
  }
}

const removeExtraImage = (idx: number) => {
  const current = [...(props.product.extra_images || [])]
  current.splice(idx, 1)
  update({ extra_images: current })
}

// ── Remove background ──
const handleRemoveBg = async () => {
  const img = props.product.custom_image
  if (!img || isRemovingBg.value) return

  isRemovingBg.value = true
  try {
    // Resolve the key for the API
    let sourceKey = img
    const wasabiMatch = img.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+)$/)
    if (wasabiMatch) sourceKey = wasabiMatch[1]!

    const result = await $fetch<{ url: string; key?: string }>('/api/remove-image-bg', {
      method: 'POST',
      body: { sourceKey },
    })

    if (result.key) {
      update({ custom_image: result.key })
    } else if (result.url) {
      // Extract key from URL if possible
      const urlMatch = result.url.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+?)(\?.*)?$/)
      update({ custom_image: urlMatch ? urlMatch[1] : result.url })
    }
  } catch (err) {
    console.error('[BuilderProductEditorCard] RemoveBg error:', err)
  } finally {
    isRemovingBg.value = false
  }
}

// ── Search product images from Wasabi ──
const handleSearch = async () => {
  const term = searchQuery.value.trim() || props.product.custom_name
  if (!term || isSearching.value) return

  isSearching.value = true
  try {
    const result = await $fetch<{ candidates?: Array<{ key: string; url: string; name: string }> }>('/api/builder/search-image', {
      method: 'POST',
      body: { term },
    })

    searchResults.value = (result.candidates || []).map(c => ({
      key: c.key,
      url: c.url,
      name: c.name,
    }))
  } catch (err) {
    console.error('[BuilderProductEditorCard] Search error:', err)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const selectSearchResult = (key: string) => {
  update({ custom_image: key })
  showSearchPanel.value = false
  searchResults.value = []
}

const removeImage = () => {
  update({ custom_image: null, image_zoom: 100, image_x: 0, image_y: 0 })
}

// ── Image crop / zoom / drag ──
const showCropControls = ref(false)
const imageContainerRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragStartOffsetX = 0
let dragStartOffsetY = 0

const currentZoom = computed(() => props.product.image_zoom ?? 100)
const currentX = computed(() => props.product.image_x ?? 0)
const currentY = computed(() => props.product.image_y ?? 0)

const cropImgStyle = computed(() => {
  const img = imagePreviewUrl.value
  if (!img) return {}
  return {
    backgroundImage: `url('${img}')`,
    width: `${currentZoom.value}%`,
    height: `${currentZoom.value}%`,
    left: `${currentX.value}px`,
    top: `${currentY.value}px`,
    backgroundSize: 'contain',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    position: 'absolute' as const,
    cursor: currentZoom.value > 100 ? 'grab' : 'default',
    userSelect: 'none' as const,
  }
})

const handleZoomInput = (e: Event) => {
  const newZoom = Number((e.target as HTMLInputElement).value)
  const oldZoom = currentZoom.value
  const container = imageContainerRef.value
  if (container) {
    const cw = container.offsetWidth
    const ch = container.offsetHeight
    const scale = (newZoom - oldZoom) / 100
    update({
      image_zoom: newZoom,
      image_x: currentX.value - (cw * scale) / 2,
      image_y: currentY.value - (ch * scale) / 2,
    })
  } else {
    update({ image_zoom: newZoom })
  }
}

const resetCrop = () => {
  update({ image_zoom: 100, image_x: 0, image_y: 0 })
}

const startImageDrag = (e: MouseEvent | TouchEvent) => {
  if (currentZoom.value <= 100) return
  e.preventDefault()
  isDragging.value = true
  const point = 'touches' in e ? (e as TouchEvent).touches[0]! : (e as MouseEvent)
  dragStartX = point.clientX
  dragStartY = point.clientY
  dragStartOffsetX = currentX.value
  dragStartOffsetY = currentY.value

  document.addEventListener('mousemove', onImageDrag)
  document.addEventListener('mouseup', stopImageDrag)
  document.addEventListener('touchmove', onImageDrag, { passive: false })
  document.addEventListener('touchend', stopImageDrag)
}

const onImageDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  e.preventDefault()
  const point = 'touches' in e ? (e as TouchEvent).touches[0]! : (e as MouseEvent)
  const dx = point.clientX - dragStartX
  const dy = point.clientY - dragStartY
  update({
    image_x: dragStartOffsetX + dx,
    image_y: dragStartOffsetY + dy,
  })
}

const stopImageDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onImageDrag)
  document.removeEventListener('mouseup', stopImageDrag)
  document.removeEventListener('touchmove', onImageDrag)
  document.removeEventListener('touchend', stopImageDrag)
}

// ── Other handlers ──
const handlePriceModeChange = (e: Event) => {
  const mode = (e.target as HTMLSelectElement).value as BuilderPriceMode
  update({ price_mode: mode })
}

const handleUnitChange = (e: Event) => {
  const unit = (e.target as HTMLSelectElement).value as BuilderProductUnit
  update({ unit })
}

const handleNameInput = (e: Event) => {
  update({ custom_name: (e.target as HTMLInputElement).value || null })
}

const handleOfferPriceInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ offer_price: val ? Number(val) : null })
}

const handleOriginalPriceInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ original_price: val ? Number(val) : null })
}

const handleTakeQuantityInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ take_quantity: val ? Number(val) : null })
}

const handlePayQuantityInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ pay_quantity: val ? Number(val) : null })
}

const handleInstallmentCountInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ installment_count: val ? Number(val) : null })
}

const handleInstallmentPriceInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  update({ installment_price: val ? Number(val) : null })
}

const handleClubNameInput = (e: Event) => {
  update({ club_name: (e.target as HTMLInputElement).value || null })
}

const handleAnticipationTextInput = (e: Event) => {
  update({ anticipation_text: (e.target as HTMLInputElement).value || null })
}

const handlePriceLabelChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  update({ price_label: val || null })
}

const handleQuantityUnitChange = (e: Event) => {
  update({ quantity_unit: (e.target as HTMLSelectElement).value || null })
}

const handleObservationInput = (e: Event) => {
  update({ observation: (e.target as HTMLTextAreaElement).value || null })
}

const handleHighlightToggle = () => {
  update({ is_highlight: !props.product.is_highlight })
}

const handleAdultToggle = () => {
  update({ is_adult: !props.product.is_adult })
}

const handleNoInterestToggle = () => {
  update({ no_interest: !props.product.no_interest })
}

const handleShowDiscountToggle = () => {
  update({ show_discount: !props.product.show_discount })
}

const handleRemove = () => {
  removeProduct(props.index)
}

const handlePriceModeSelected = (mode: BuilderPriceMode, applyAll: boolean) => {
  update({ price_mode: mode })
  showPriceModal.value = false
}

const handleImageEditorSave = (data: { zoom: number; x: number; y: number; extraImagesLayout: 'auto' | 'horizontal' | 'vertical' | null }) => {
  update({
    image_zoom: data.zoom,
    image_x: data.x,
    image_y: data.y,
    extra_images_layout: data.extraImagesLayout,
  })
}

// ── Auto-search image when product name changes ──
let autoSearchTimer: ReturnType<typeof setTimeout> | null = null
const isAutoSearching = ref(false)

const autoSearchImage = async (name: string) => {
  if (!name || name.length < 3) return
  // Don't auto-search if product already has an image
  if (props.product.custom_image) return

  isAutoSearching.value = true
  try {
    const result = await $fetch<{ candidates?: Array<{ key: string; url: string; name: string }> }>('/api/builder/search-image', {
      method: 'POST',
      body: { term: name },
    })

    const best = result.candidates?.[0]
    if (best) {
      update({ custom_image: best.key })
    }
  } catch (err) {
    console.error('[BuilderProductEditorCard] Auto-search error:', err)
  } finally {
    isAutoSearching.value = false
  }
}

watch(() => props.product.custom_name, (newName) => {
  if (autoSearchTimer) clearTimeout(autoSearchTimer)
  if (!newName || newName.length < 3 || props.product.custom_image) return

  autoSearchTimer = setTimeout(() => {
    autoSearchImage(newName)
  }, 800)
})

// Auto-search on mount if product has name but no image
onMounted(() => {
  if (props.product.custom_name && props.product.custom_name.length >= 3 && !props.product.custom_image) {
    autoSearchImage(props.product.custom_name)
  }
})

onUnmounted(() => {
  if (autoSearchTimer) clearTimeout(autoSearchTimer)
})
</script>

<template>
  <div class="w-48 bg-[#1a1a1a] border border-white/5 rounded-xl overflow-hidden relative group">
    <!-- Delete button (top-right) -->
    <button
      @click="handleRemove"
      class="absolute top-1.5 right-1.5 z-10 p-0.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300
        opacity-0 group-hover:opacity-100 transition-all"
      title="Remover produto"
    >
      <X class="w-3 h-3" />
    </button>

    <!-- Drag handle + position -->
    <div class="flex items-center justify-between px-2 py-1 cursor-grab active:cursor-grabbing">
      <GripVertical class="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 transition-colors" />
      <span class="text-[9px] text-zinc-600 font-medium">#{{ index + 1 }}</span>
    </div>

    <!-- Image area with crop container -->
    <div ref="imageContainerRef" class="relative w-full h-20 bg-[#09090b]/50 border-y border-white/5 overflow-hidden">
      <!-- Image with crop (background-image pattern) -->
      <template v-if="imagePreviewUrl">
        <div class="w-full h-full relative">
          <div
            :style="cropImgStyle"
            @mousedown="startImageDrag"
            @touchstart="startImageDrag"
            :class="isDragging ? 'cursor-grabbing' : ''"
          />
        </div>

        <!-- Image action buttons -->
        <div class="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-0.5 bg-black/70 z-10
          opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button @click.stop="handleImageClick" class="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors" title="Trocar imagem">
            <Upload class="w-3 h-3" />
          </button>
          <button @click.stop="handleRemoveBg" :disabled="isRemovingBg" class="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-white/10 transition-colors disabled:opacity-30" title="Remover fundo">
            <Loader2 v-if="isRemovingBg" class="w-3 h-3 animate-spin" />
            <Eraser v-else class="w-3 h-3" />
          </button>
          <button @click.stop="showCropControls = !showCropControls" class="p-1 rounded transition-colors" :class="showCropControls ? 'text-emerald-400 bg-white/10' : 'text-zinc-400 hover:text-emerald-400 hover:bg-white/10'" title="Zoom e posicao">
            <ZoomIn class="w-3 h-3" />
          </button>
          <button @click.stop="showImageEditor = true" class="p-1 rounded text-zinc-400 hover:text-purple-400 hover:bg-white/10 transition-colors" title="Editar imagem">
            <Maximize2 class="w-3 h-3" />
          </button>
          <button @click.stop="showSearchPanel = !showSearchPanel" class="p-1 rounded text-zinc-400 hover:text-blue-400 hover:bg-white/10 transition-colors" title="Buscar no banco">
            <Search class="w-3 h-3" />
          </button>
          <button @click.stop="removeImage" class="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-white/10 transition-colors" title="Remover imagem">
            <X class="w-3 h-3" />
          </button>
          <button @click.stop="extraFileInput?.click()" :disabled="isUploadingExtra" class="p-1 rounded text-zinc-400 hover:text-yellow-400 hover:bg-white/10 transition-colors disabled:opacity-30" title="Adicionar mais imagem">
            <Loader2 v-if="isUploadingExtra" class="w-3 h-3 animate-spin" />
            <ImagePlus v-else class="w-3 h-3" />
          </button>
        </div>

        <!-- Extra images thumbnails -->
        <div v-if="product.extra_images?.length" class="absolute top-0 right-0 z-10 flex flex-col gap-0.5 p-0.5">
          <div v-for="(exImg, exIdx) in product.extra_images" :key="exIdx" class="relative group/ex">
            <img :src="resolveExtraUrl(exImg)" class="w-6 h-6 object-contain rounded bg-black/60 border border-white/10" alt="" />
            <button @click.stop="removeExtraImage(exIdx)" class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/ex:opacity-100 transition-opacity">
              <X class="w-2 h-2 text-white" />
            </button>
          </div>
        </div>
      </template>

      <!-- No image state -->
      <template v-else>
        <button @click="handleImageClick" class="w-full h-full flex items-center justify-center hover:bg-[#09090b]/70 transition-colors">
          <div v-if="isUploading || isAutoSearching" class="flex flex-col items-center gap-1 text-zinc-500">
            <Loader2 class="w-4 h-4 animate-spin" />
            <span v-if="isAutoSearching" class="text-[7px] text-blue-400">Buscando...</span>
          </div>
          <div v-else class="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-emerald-400 transition-colors">
            <ImagePlus class="w-5 h-5" />
            <span class="text-[8px]">Enviar imagem</span>
          </div>
        </button>
      </template>

      <!-- Loading overlay for bg removal -->
      <div v-if="isRemovingBg" class="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
        <div class="flex flex-col items-center gap-1">
          <Loader2 class="w-5 h-5 text-emerald-400 animate-spin" />
          <span class="text-[8px] text-emerald-400">Removendo fundo...</span>
        </div>
      </div>
    </div>

    <!-- Extra images: botao + miniaturas -->
    <div v-if="imagePreviewUrl" class="bg-[#111] border-b border-white/5 px-2 py-1">
      <div class="flex items-center gap-1 flex-wrap">
        <div v-for="(exImg, exIdx) in (product.extra_images || [])" :key="exIdx" class="relative group/ex">
          <img :src="resolveExtraUrl(exImg)" class="w-7 h-7 object-contain rounded bg-white/5 border border-white/10" alt="" />
          <button @click.stop="removeExtraImage(exIdx)" class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/ex:opacity-100 transition-opacity">
            <X class="w-2 h-2 text-white" />
          </button>
        </div>
        <button @click.stop="duplicateMainImage" class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-zinc-400 hover:text-emerald-400 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 transition-colors" title="Duplicar imagem principal">
          <span>Duplicar</span>
        </button>
        <!-- Layout das duplicatas -->
        <select
          v-if="(product.extra_images || []).length > 0"
          :value="product.extra_images_layout || 'auto'"
          @change="update({ extra_images_layout: ($event.target as HTMLSelectElement).value as 'auto' | 'horizontal' | 'vertical' })"
          class="px-1 py-0.5 rounded text-[8px] text-zinc-400 bg-white/5 border border-white/10 outline-none"
        >
          <option value="auto">Auto</option>
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
        <label class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-zinc-400 hover:text-yellow-400 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 cursor-pointer transition-colors">
          <Loader2 v-if="isUploadingExtra" class="w-2.5 h-2.5 animate-spin" />
          <ImagePlus v-else class="w-2.5 h-2.5" />
          <span>+ Imagem</span>
          <input type="file" accept="image/*" class="hidden" :disabled="isUploadingExtra" @change="handleExtraImageUpload" />
        </label>
      </div>
    </div>

    <!-- Crop controls (zoom slider + reset) -->
    <div v-if="showCropControls && imagePreviewUrl" class="bg-[#111] border-b border-white/5 px-2 py-1.5">
      <div class="flex items-center gap-1.5 mb-1">
        <ZoomIn class="w-3 h-3 text-zinc-500 shrink-0" />
        <input
          type="range"
          min="50"
          max="300"
          step="5"
          :value="currentZoom"
          @input="handleZoomInput"
          class="flex-1 accent-emerald-500 h-1"
        />
        <span class="text-[9px] text-zinc-400 tabular-nums w-8 text-right">{{ currentZoom }}%</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[8px] text-zinc-600">
          <Move class="w-2.5 h-2.5 inline mr-0.5" />Arraste a imagem para ajustar
        </span>
        <button @click="resetCrop" class="text-[8px] text-zinc-500 hover:text-zinc-300 flex items-center gap-0.5 transition-colors">
          <RotateCcw class="w-2.5 h-2.5" />
          Reset
        </button>
      </div>
    </div>

    <!-- Image action bar (when no image) -->
    <div v-if="!imagePreviewUrl && !isUploading" class="flex items-center justify-center gap-1 px-1 py-0.5 border-b border-white/5">
      <button
        @click="showSearchPanel = !showSearchPanel"
        class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] text-zinc-500 hover:text-blue-400 hover:bg-white/5 transition-colors"
      >
        <Search class="w-2.5 h-2.5" />
        Buscar
      </button>
      <button
        @click="handleImageClick"
        class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] text-zinc-500 hover:text-emerald-400 hover:bg-white/5 transition-colors"
      >
        <Upload class="w-2.5 h-2.5" />
        Enviar
      </button>
    </div>

    <!-- Search panel -->
    <div v-if="showSearchPanel" class="border-b border-white/5 bg-[#111] p-1.5">
      <div class="flex gap-1 mb-1">
        <input
          v-model="searchQuery"
          :placeholder="product.custom_name || 'Buscar imagem...'"
          class="flex-1 bg-white/5 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 focus:border-blue-500/50 rounded px-1.5 py-1"
          @keydown.enter="handleSearch"
        />
        <button
          @click="handleSearch"
          :disabled="isSearching"
          class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-medium disabled:opacity-50 transition-colors"
        >
          <Loader2 v-if="isSearching" class="w-3 h-3 animate-spin" />
          <Search v-else class="w-3 h-3" />
        </button>
      </div>
      <div v-if="searchResults.length" class="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
        <button
          v-for="r in searchResults"
          :key="r.key"
          @click="selectSearchResult(r.key)"
          class="flex flex-col items-center bg-white/5 rounded overflow-hidden hover:ring-1 hover:ring-emerald-500/50 transition-all"
        >
          <img :src="r.url" class="w-full h-10 object-contain" />
          <span v-if="r.name" class="text-[7px] text-zinc-500 leading-tight px-0.5 py-0.5 truncate w-full text-center">{{ r.name }}</span>
        </button>
      </div>
      <p v-else-if="isSearching" class="text-[9px] text-zinc-500 text-center py-2">Buscando...</p>
      <p v-else class="text-[9px] text-zinc-600 text-center py-1">Digite o nome e clique buscar</p>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileChange"
    />
    <input
      ref="extraFileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleExtraImageUpload"
    />

    <!-- Compact form: name + price always visible -->
    <div class="p-2 space-y-1.5">
      <!-- Product name -->
      <input
        :value="product.custom_name || ''"
        @input="handleNameInput"
        placeholder="Nome do produto"
        class="w-full bg-[#09090b]/50 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 focus:border-emerald-500/50 rounded px-1.5 py-1 transition-colors"
      />

      <!-- Quick price (simple mode) -->
      <div v-if="product.price_mode === 'simple' || !product.price_mode" class="flex gap-1">
        <input
          :value="product.offer_price ?? ''"
          @input="handleOfferPriceInput"
          placeholder="R$ 0,00"
          type="number"
          step="0.01"
          min="0"
          class="flex-1 bg-[#09090b]/50 text-[10px] text-emerald-400 placeholder-zinc-600 outline-none border border-white/5 focus:border-emerald-500/50 rounded px-1.5 py-1 transition-colors"
        />
      </div>

      <!-- From/To quick fields -->
      <div v-else-if="product.price_mode === 'from_to'" class="space-y-1">
        <input
          :value="product.original_price ?? ''"
          @input="handleOriginalPriceInput"
          placeholder="De R$"
          type="number"
          step="0.01"
          class="w-full bg-[#09090b]/50 text-[10px] text-zinc-400 placeholder-zinc-600 outline-none border border-white/5 focus:border-emerald-500/50 rounded px-1.5 py-1 transition-colors line-through"
        />
        <input
          :value="product.offer_price ?? ''"
          @input="handleOfferPriceInput"
          placeholder="Por R$"
          type="number"
          step="0.01"
          class="w-full bg-[#09090b]/50 text-[10px] text-emerald-400 placeholder-zinc-600 outline-none border border-white/5 focus:border-emerald-500/50 rounded px-1.5 py-1 transition-colors"
        />
      </div>

      <!-- Other modes: just show price -->
      <div v-else class="flex gap-1">
        <input
          :value="product.offer_price ?? ''"
          @input="handleOfferPriceInput"
          placeholder="R$ 0,00"
          type="number"
          step="0.01"
          min="0"
          class="flex-1 bg-[#09090b]/50 text-[10px] text-emerald-400 placeholder-zinc-600 outline-none border border-white/5 focus:border-emerald-500/50 rounded px-1.5 py-1 transition-colors"
        />
      </div>

      <!-- Expand details toggle -->
      <button
        @click="showDetails = !showDetails"
        class="w-full flex items-center justify-center gap-1 py-0.5 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Settings2 class="w-3 h-3" />
        {{ showDetails ? 'Menos' : 'Mais opcoes' }}
      </button>

      <!-- Expandable details -->
      <div v-if="showDetails" class="space-y-1.5 pt-1 border-t border-white/5">
        <!-- Price mode selector -->
        <div class="flex gap-1">
          <select
            :value="product.price_mode"
            @change="handlePriceModeChange"
            class="flex-1 bg-[#09090b]/50 text-[10px] text-white outline-none
              border border-white/5 focus:border-emerald-500/50 rounded px-1.5 py-1 transition-colors
              appearance-none cursor-pointer"
          >
            <option
              v-for="mode in priceModes"
              :key="mode.value"
              :value="mode.value"
              class="bg-[#1a1a1a] text-white"
            >
              {{ mode.label }}
            </option>
          </select>
        </div>

        <!-- Mode-specific extra fields -->
        <template v-if="product.price_mode === 'x_per_y'">
          <div class="flex gap-1">
            <input :value="product.take_quantity ?? ''" @input="handleTakeQuantityInput" placeholder="Qtd" type="number" min="1" class="w-1/2 bg-[#09090b]/50 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
            <select :value="product.quantity_unit || 'Kilos'" @change="handleQuantityUnitChange" class="w-1/2 bg-[#09090b]/50 text-[10px] text-white outline-none border border-white/5 rounded px-1.5 py-1 appearance-none">
              <option v-for="qu in quantityUnitOptions" :key="qu" :value="qu" class="bg-[#1a1a1a]">{{ qu }}</option>
            </select>
          </div>
          <input :value="product.original_price ?? ''" @input="handleOriginalPriceInput" placeholder="Preco unit." type="number" step="0.01" class="w-full bg-[#09090b]/50 text-[10px] text-zinc-400 placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
        </template>

        <template v-if="product.price_mode === 'take_pay'">
          <div class="flex gap-1">
            <input :value="product.take_quantity ?? ''" @input="handleTakeQuantityInput" placeholder="Leve" type="number" min="1" class="w-1/2 bg-[#09090b]/50 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
            <input :value="product.pay_quantity ?? ''" @input="handlePayQuantityInput" placeholder="Pague" type="number" min="1" class="w-1/2 bg-[#09090b]/50 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
          </div>
          <input :value="product.original_price ?? ''" @input="handleOriginalPriceInput" placeholder="Preco unit." type="number" step="0.01" class="w-full bg-[#09090b]/50 text-[10px] text-zinc-400 placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
        </template>

        <template v-if="product.price_mode === 'installment'">
          <div class="flex gap-1">
            <input :value="product.installment_count ?? ''" @input="handleInstallmentCountInput" placeholder="Parcelas" type="number" min="1" max="48" class="w-1/2 bg-[#09090b]/50 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
            <input :value="product.installment_price ?? ''" @input="handleInstallmentPriceInput" placeholder="Valor" type="number" step="0.01" class="w-1/2 bg-[#09090b]/50 text-[10px] text-emerald-400 placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
          </div>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" :checked="product.no_interest" @change="handleNoInterestToggle" class="w-3 h-3 rounded accent-emerald-500" />
            <span class="text-[9px] text-zinc-400">Sem Juros</span>
          </label>
        </template>

        <template v-if="product.price_mode === 'club_price'">
          <input :value="product.club_name || ''" @input="handleClubNameInput" placeholder="Nome clube" class="w-full bg-[#09090b]/50 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
          <input :value="product.original_price ?? ''" @input="handleOriginalPriceInput" placeholder="Preco normal" type="number" step="0.01" class="w-full bg-[#09090b]/50 text-[10px] text-zinc-400 placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1 line-through" />
        </template>

        <template v-if="product.price_mode === 'anticipation'">
          <input :value="product.anticipation_text || ''" @input="handleAnticipationTextInput" placeholder="Texto selo" class="w-full bg-[#09090b]/50 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1" />
        </template>

        <template v-if="product.price_mode === 'symbolic'">
          <p class="text-[8px] text-zinc-600 leading-tight mb-1">Moedas/notas baseadas no valor.</p>
          <div class="flex items-center gap-2 mb-1">
            <label class="text-[9px] text-zinc-500 flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                :checked="(product as any).symbolic_round_cents"
                @change="update({ symbolic_round_cents: ($event.target as HTMLInputElement).checked } as any)"
                class="w-3 h-3"
              />
              Arredondar centavos
            </label>
          </div>
          <div class="flex items-center gap-2 mb-1">
            <label class="text-[9px] text-zinc-500 flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                :checked="(product as any).symbolic_reverse_order"
                @change="update({ symbolic_reverse_order: ($event.target as HTMLInputElement).checked } as any)"
                class="w-3 h-3"
              />
              Inverter ordem moedas
            </label>
          </div>
          <div class="text-[8px] text-zinc-500 mb-0.5">Moedas permitidas:</div>
          <div class="flex flex-wrap gap-1">
            <label v-for="coin in [
              { key: 'coin_1c', label: '1¢' },
              { key: 'coin_5c', label: '5¢' },
              { key: 'coin_10c', label: '10¢' },
              { key: 'coin_25c', label: '25¢' },
              { key: 'coin_50c', label: '50¢' },
              { key: 'coin_1r', label: 'R$1' },
              { key: 'coin_2r', label: 'R$2' },
              { key: 'coin_5r', label: 'R$5+' },
            ]" :key="coin.key" class="text-[8px] text-zinc-400 flex items-center gap-0.5 cursor-pointer">
              <input
                type="checkbox"
                :checked="(product as any)[`symbolic_${coin.key}`] !== false"
                @change="update({ [`symbolic_${coin.key}`]: ($event.target as HTMLInputElement).checked } as any)"
                class="w-2.5 h-2.5"
              />
              {{ coin.label }}
            </label>
          </div>
        </template>

        <!-- Price label -->
        <div v-if="!['none'].includes(product.price_mode)">
          <label class="text-[9px] text-zinc-500 block mb-0.5">Texto acima do preco</label>
          <select
            :value="product.price_label || ''"
            @change="handlePriceLabelChange"
            class="w-full bg-[#09090b]/50 text-[10px] text-white outline-none border border-white/5 rounded px-1.5 py-1 appearance-none cursor-pointer"
          >
            <option value="" class="bg-[#1a1a1a]">Nenhum</option>
            <option v-for="lbl in priceLabelOptions.filter(l => l)" :key="lbl" :value="lbl" class="bg-[#1a1a1a]">{{ lbl }}</option>
          </select>
        </div>

        <!-- Unit -->
        <div v-if="!['anticipation', 'none', 'symbolic', 'installment'].includes(product.price_mode)">
          <label class="text-[9px] text-zinc-500 block mb-0.5">Unidade</label>
          <select :value="product.unit" @change="handleUnitChange" class="w-full bg-[#09090b]/50 text-[10px] text-white outline-none border border-white/5 rounded px-1.5 py-1 appearance-none cursor-pointer">
            <option v-for="u in unitOptions" :key="u.value" :value="u.value" class="bg-[#1a1a1a]">{{ u.label }}</option>
          </select>
        </div>

        <!-- Observation -->
        <div>
          <label class="text-[9px] text-zinc-500 block mb-0.5">Observacao</label>
          <textarea :value="product.observation || ''" @input="handleObservationInput" placeholder="Ex: Valido ate 30/03" rows="2" class="w-full bg-[#09090b]/50 text-[10px] text-white placeholder-zinc-600 outline-none border border-white/5 rounded px-1.5 py-1 resize-none" />
        </div>

        <!-- Badge/Selo -->
        <div>
          <label class="text-[9px] text-zinc-500 font-medium">Selo</label>
          <select
            :value="product.badge_style_id || ''"
            @change="update({ badge_style_id: ($event.target as HTMLSelectElement).value || null })"
            class="w-full bg-[#09090b]/50 text-[9px] text-white outline-none border border-white/5 rounded px-1.5 py-0.5 mt-0.5"
          >
            <option value="">Nenhum</option>
            <option value="OFERTA">OFERTA</option>
            <option value="PROMOCAO">PROMOCAO</option>
            <option value="NOVIDADE">NOVIDADE</option>
            <option value="MAIS VENDIDO">MAIS VENDIDO</option>
            <option value="IMPERDIVEL">IMPERDIVEL</option>
            <option value="DESTAQUE">DESTAQUE</option>
            <option value="LIMITADO">LIMITADO</option>
          </select>
        </div>

        <!-- Toggles -->
        <div class="flex items-center justify-between gap-1">
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" :checked="product.is_highlight" @change="handleHighlightToggle" class="w-3 h-3 rounded accent-emerald-500" />
            <span class="text-[9px] text-zinc-400">Destaque</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" :checked="product.is_adult" @change="handleAdultToggle" class="w-3 h-3 rounded accent-emerald-500" />
            <span class="text-[9px] text-zinc-400">+18</span>
          </label>
          <label v-if="product.price_mode === 'from_to' || product.price_mode === 'club_price'" class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" :checked="product.show_discount" @change="handleShowDiscountToggle" class="w-3 h-3 rounded accent-emerald-500" />
            <span class="text-[9px] text-zinc-400">%</span>
          </label>
        </div>
      </div>
    </div>

    <!-- Price Options Modal -->
    <BuilderPriceOptionsModal
      v-if="showPriceModal"
      :current-mode="product.price_mode"
      @select="handlePriceModeSelected"
      @close="showPriceModal = false"
    />

    <!-- Image Editor Modal -->
    <BuilderImageEditorModal
      v-model="showImageEditor"
      :image-url="imagePreviewUrl"
      :image-zoom="product.image_zoom ?? 100"
      :image-x="product.image_x ?? 0"
      :image-y="product.image_y ?? 0"
      :extra-images="product.extra_images || []"
      :extra-images-layout="product.extra_images_layout"
      @save="handleImageEditorSave"
    />
  </div>
</template>
