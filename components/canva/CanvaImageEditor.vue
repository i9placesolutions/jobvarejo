<script setup lang="ts">
import {
  Search,
  Upload,
  Loader2,
  X,
  Eraser,
  ZoomIn,
  Check,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  currentImage: string | null
  productName: string
  tenantId: string
}>()

const emit = defineEmits<{
  close: []
  save: [imageKey: string]
}>()

// Estado interno
const selectedKey = ref<string | null>(null)
const searchQuery = ref('')
const searchResults = ref<Array<{ key: string; url: string; name?: string }>>([])
const isSearching = ref(false)
const isUploading = ref(false)
const isRemovingBg = ref(false)
const zoom = ref(1)
const fileInput = ref<HTMLInputElement | null>(null)

// Drag para reposicionar
const imageContainerRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const offsetX = ref(0)
const offsetY = ref(0)
let dragStartX = 0
let dragStartY = 0
let dragStartOffsetX = 0
let dragStartOffsetY = 0

// Resolucao de URLs de imagem
const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

// URL da imagem selecionada para preview
const previewUrl = computed(() => resolveImageUrl(selectedKey.value))

// Busca automatica ao abrir
const searchImages = async (term?: string) => {
  const query = term ?? (searchQuery.value.trim() || props.productName)
  if (!query || isSearching.value) return

  isSearching.value = true
  try {
    const result = await $fetch<{ candidates?: Array<{ key: string; url: string; name: string }> }>(
      '/api/builder/search-image',
      {
        method: 'POST',
        body: { term: query },
      },
    )
    searchResults.value = (result.candidates || []).map(c => ({
      key: c.key,
      url: c.url,
      name: c.name,
    }))
  } catch (err) {
    console.error('[CanvaImageEditor] Erro na busca:', err)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

// Selecionar imagem do grid de busca
const selectCandidate = (key: string) => {
  selectedKey.value = key
  zoom.value = 1
  offsetX.value = 0
  offsetY.value = 0
}

// Upload de nova imagem
const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Validacao de tipo
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    alert('Formato nao suportado. Use JPG, PNG ou WebP.')
    return
  }

  // Validacao de tamanho (5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('Imagem muito grande. Maximo 5MB.')
    return
  }

  isUploading.value = true
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const key = `builder/${props.tenantId}/products/${filename}`
    const contentType = file.type || 'image/jpeg'
    const body = await file.arrayBuffer()

    await $fetch('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType },
      body: new Uint8Array(body),
      headers: { 'Content-Type': 'application/octet-stream' },
    })

    selectedKey.value = key
    zoom.value = 1
    offsetX.value = 0
    offsetY.value = 0
  } catch (err) {
    console.error('[CanvaImageEditor] Erro no upload:', err)
    alert('Erro ao enviar imagem. Tente novamente.')
  } finally {
    isUploading.value = false
    if (input) input.value = ''
  }
}

// Remover fundo
const handleRemoveBg = async () => {
  if (!selectedKey.value || isRemovingBg.value) return

  isRemovingBg.value = true
  try {
    const result = await $fetch<{ url: string; key?: string }>('/api/builder/remove-bg', {
      method: 'POST',
      body: { s3Key: selectedKey.value },
    })

    if (result.key) {
      selectedKey.value = result.key
    } else if (result.url) {
      const urlMatch = result.url.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+?)(\?.*)?$/)
      selectedKey.value = urlMatch ? urlMatch[1]! : result.url
    }
  } catch (err) {
    console.error('[CanvaImageEditor] Erro ao remover fundo:', err)
    alert('Erro ao remover fundo. Tente novamente.')
  } finally {
    isRemovingBg.value = false
  }
}

// Drag para reposicionar imagem
const onDragStart = (e: MouseEvent) => {
  if (zoom.value <= 1) return
  isDragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragStartOffsetX = offsetX.value
  dragStartOffsetY = offsetY.value
  e.preventDefault()
}

const onDragMove = (e: MouseEvent) => {
  if (!isDragging.value) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  const maxOffset = ((zoom.value - 1) / zoom.value) * 50
  offsetX.value = Math.max(-maxOffset, Math.min(maxOffset, dragStartOffsetX + (dx / zoom.value) * 0.5))
  offsetY.value = Math.max(-maxOffset, Math.min(maxOffset, dragStartOffsetY + (dy / zoom.value) * 0.5))
}

const onDragEnd = () => {
  isDragging.value = false
}

// Resetar posicao
const resetPosition = () => {
  zoom.value = 1
  offsetX.value = 0
  offsetY.value = 0
}

// Estilo de transformacao da imagem
const imageTransform = computed(() => {
  return `scale(${zoom.value}) translate(${offsetX.value}px, ${offsetY.value}px)`
})

// Salvar
const handleSave = () => {
  if (selectedKey.value) {
    emit('save', selectedKey.value)
    emit('close')
  }
}

// Cancelar
const handleCancel = () => {
  emit('close')
}

// Debounce para busca
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const onSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchImages()
  }, 400)
}

// Watch para abrir/fechar
watch(
  () => props.open,
  (val) => {
    if (val) {
      // Inicializar com imagem atual
      selectedKey.value = props.currentImage
      searchQuery.value = ''
      searchResults.value = []
      zoom.value = 1
      offsetX.value = 0
      offsetY.value = 0
      // Busca automatica pelo nome do produto
      nextTick(() => {
        searchImages(props.productName)
      })
    }
  },
)

// Cleanup do drag no unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        @mousemove="onDragMove"
        @mouseup="onDragEnd"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="handleCancel" />

        <!-- Modal -->
        <div class="relative bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <h2 class="text-base font-semibold text-white">Imagem do Produto</h2>
              <p class="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[300px]">{{ productName }}</p>
            </div>
            <button
              @click="handleCancel"
              class="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Conteudo principal -->
          <div class="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            <div class="flex gap-5 flex-col md:flex-row">
              <!-- Coluna esquerda: Preview -->
              <div class="flex-shrink-0 w-full md:w-[280px]">
                <!-- Container de preview quadrado -->
                <div
                  ref="imageContainerRef"
                  class="aspect-square w-full bg-white/5 border border-white/10 rounded-xl overflow-hidden flex items-center justify-center relative"
                  :class="{ 'cursor-grab': zoom > 1 && !isDragging, 'cursor-grabbing': isDragging }"
                  @mousedown="onDragStart"
                >
                  <template v-if="previewUrl">
                    <img
                      :src="previewUrl"
                      :alt="productName"
                      class="w-full h-full object-contain transition-transform duration-100 select-none pointer-events-none"
                      :style="{ transform: imageTransform }"
                      draggable="false"
                    />
                  </template>
                  <template v-else>
                    <div class="flex flex-col items-center gap-2 text-zinc-600">
                      <ImageIcon class="w-10 h-10" />
                      <span class="text-xs">Nenhuma imagem</span>
                    </div>
                  </template>
                </div>

                <!-- Controles abaixo do preview -->
                <div class="mt-3 space-y-3">
                  <!-- Botoes de acao -->
                  <div class="flex gap-2">
                    <button
                      @click="handleRemoveBg"
                      :disabled="!selectedKey || isRemovingBg"
                      class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-zinc-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="isRemovingBg" class="w-3.5 h-3.5 animate-spin" />
                      <Eraser v-else class="w-3.5 h-3.5" />
                      Remover Fundo
                    </button>

                    <button
                      @click="triggerUpload"
                      :disabled="isUploading"
                      class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-zinc-300 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="isUploading" class="w-3.5 h-3.5 animate-spin" />
                      <Upload v-else class="w-3.5 h-3.5" />
                      Upload Nova
                    </button>
                  </div>

                  <!-- Zoom -->
                  <div class="flex items-center gap-2">
                    <ZoomIn class="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      v-model.number="zoom"
                      class="flex-1 h-1 accent-violet-500 bg-white/10 rounded-full appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                             [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                    />
                    <span class="text-[10px] text-zinc-500 w-7 text-right shrink-0">{{ zoom.toFixed(1) }}x</span>
                    <button
                      v-if="zoom > 1 || offsetX !== 0 || offsetY !== 0"
                      @click="resetPosition"
                      class="p-1 text-zinc-500 hover:text-white transition-colors"
                      title="Resetar posicao"
                    >
                      <RefreshCw class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Coluna direita: Busca no acervo -->
              <div class="flex-1 min-w-0">
                <div class="mb-3">
                  <label class="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-1.5 block">
                    Buscar no acervo
                  </label>
                  <div class="relative">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      v-model="searchQuery"
                      @input="onSearchInput"
                      @keydown.enter="searchImages()"
                      :placeholder="`Buscar '${productName}'...`"
                      class="w-full h-10 pl-10 pr-4 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
                    />
                  </div>
                </div>

                <!-- Grid de resultados -->
                <div class="min-h-[200px] max-h-[340px] overflow-y-auto rounded-xl">
                  <!-- Loading -->
                  <div v-if="isSearching" class="flex items-center justify-center py-12">
                    <Loader2 class="w-6 h-6 text-violet-500 animate-spin" />
                  </div>

                  <!-- Sem resultados -->
                  <div
                    v-else-if="searchResults.length === 0"
                    class="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <ImageIcon class="w-8 h-8 text-zinc-700 mb-2" />
                    <p class="text-xs text-zinc-500">
                      {{ searchQuery ? 'Nenhuma imagem encontrada' : 'Digite para buscar ou use o upload' }}
                    </p>
                  </div>

                  <!-- Grid de thumbnails -->
                  <div v-else class="grid grid-cols-4 gap-2">
                    <button
                      v-for="item in searchResults"
                      :key="item.key"
                      @click="selectCandidate(item.key)"
                      class="relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:opacity-90 group"
                      :class="
                        selectedKey === item.key
                          ? 'border-violet-500 ring-2 ring-violet-500/30'
                          : 'border-white/5 hover:border-white/20'
                      "
                    >
                      <img
                        :src="resolveImageUrl(item.key)!"
                        :alt="item.name || ''"
                        class="w-full h-full object-contain bg-white/5"
                        loading="lazy"
                      />
                      <!-- Badge de selecionado -->
                      <div
                        v-if="selectedKey === item.key"
                        class="absolute top-1 right-1 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center"
                      >
                        <Check class="w-3 h-3 text-white" />
                      </div>
                      <!-- Nome no hover -->
                      <div
                        v-if="item.name"
                        class="absolute bottom-0 inset-x-0 bg-black/70 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <p class="text-[9px] text-white truncate">{{ item.name }}</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 border-t border-white/5 flex items-center justify-end gap-3">
            <button
              @click="handleCancel"
              class="px-5 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 text-sm font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="handleSave"
              :disabled="!selectedKey"
              class="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Salvar
            </button>
          </div>
        </div>

        <!-- Input file oculto -->
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          @change="handleFileChange"
        />
      </div>
    </Transition>
  </Teleport>
</template>
