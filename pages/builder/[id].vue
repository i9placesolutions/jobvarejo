<script setup lang="ts">
import {
  ArrowLeft,
  Loader2,
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: 'builder-auth',
  ssr: false,
})

const route = useRoute()
const flyerId = computed(() => String(route.params.id || ''))

const {
  flyer,
  model,
  isLoading,
  currentPage,
  totalPages,
  loadFlyer,
  loadCatalog,
  setCurrentPage,
  setZoom,
  cleanup,
} = useBuilderFlyer()

const canvasComponent = ref<{ canvasRef: HTMLElement | null } | null>(null)
const showExportDialog = ref(false)
const showPreview = ref(false)
const canvasElement = computed(() => canvasComponent.value?.canvasRef ?? null)
const canvasAreaRef = ref<HTMLElement | null>(null)

// Preview scale — encaixar encarte na tela
const previewScale = computed(() => {
  const w = model.value?.width ?? 1080
  const h = model.value?.height ?? 1080
  const maxW = (typeof window !== 'undefined' ? window.innerWidth : 1920) * 0.9
  const maxH = (typeof window !== 'undefined' ? window.innerHeight : 1080) * 0.9
  return Math.min(maxW / w, maxH / h, 1)
})

const previewModalRef = ref<HTMLElement | null>(null)

watch(showPreview, (v) => {
  if (v) nextTick(() => previewModalRef.value?.focus())
})

const handlePrint = () => {
  const el = document.getElementById('preview-canvas')
  if (!el) return
  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) return
  // Copiar estilos
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(s => s.outerHTML).join('\n')
  win.document.write(`<!DOCTYPE html><html><head>${styles}<style>body{margin:0;display:flex;justify-content:center;background:#fff}@media print{body{margin:0}}</style></head><body>${el.innerHTML}</body></html>`)
  win.document.close()
  setTimeout(() => { win.print(); win.close() }, 500)
}

// Auto-fit zoom to available space
const fitCanvasToView = () => {
  const area = canvasAreaRef.value
  if (!area) return
  const w = model.value?.width ?? 1080
  const h = model.value?.height ?? 1080
  const areaW = area.clientWidth - 48 // padding
  const areaH = area.clientHeight - 48
  if (areaW <= 0 || areaH <= 0) return
  const scaleX = areaW / w
  const scaleY = areaH / h
  const fitZoom = Math.min(scaleX, scaleY, 1) // never exceed 100%
  setZoom(Math.round(fitZoom * 100) / 100)
}

let resizeObserver: ResizeObserver | null = null

// Load data on mount
onMounted(async () => {
  await loadCatalog()
  if (flyerId.value) {
    try {
      await loadFlyer(flyerId.value)
    } catch {
      await navigateTo('/builder')
    }
  }
  // Auto-fit after data loads
  nextTick(() => {
    fitCanvasToView()
    // Re-fit on resize
    if (canvasAreaRef.value) {
      resizeObserver = new ResizeObserver(() => fitCanvasToView())
      resizeObserver.observe(canvasAreaRef.value)
    }
  })
})

// Re-fit when model changes
watch(model, () => nextTick(fitCanvasToView))

onUnmounted(() => {
  resizeObserver?.disconnect()
  cleanup()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-white overflow-hidden">
    <!-- Top bar: back + title -->
    <header class="h-10 shrink-0 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-3">
      <button
        @click="navigateTo('/builder')"
        class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900 shrink-0"
        title="Voltar"
      >
        <ArrowLeft class="w-4 h-4" />
      </button>
      <span v-if="flyer" class="text-sm font-medium text-gray-900 truncate">
        {{ flyer.title || 'Sem titulo' }}
      </span>
    </header>

    <!-- Toolbar (Modelo, Grade, Texto, Capa, Rodape, Zoom, Paginacao, Salvar, Exportar) -->
    <BuilderToolbar @export="showExportDialog = true" @preview="showPreview = true" />

    <!-- Body: Sidebar + Canvas + Product Editor -->
    <div class="flex-1 flex min-h-0 overflow-hidden">
      <!-- Left Sidebar (72px icons + 360px panel) -->
      <BuilderSidebar />

      <!-- Main area -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Canvas area — centered both axes -->
        <div
          ref="canvasAreaRef"
          class="flex-1 overflow-auto flex bg-gray-100 p-6"
        >
          <template v-if="isLoading">
            <div class="flex flex-col items-center gap-3">
              <Loader2 class="w-8 h-8 text-emerald-500 animate-spin" />
              <span class="text-sm text-gray-500">Carregando encarte...</span>
            </div>
          </template>
          <template v-else-if="flyer">
            <BuilderCanvas ref="canvasComponent" />
          </template>
        </div>

        <!-- Bottom: Pagination + Product editor -->
        <div class="shrink-0 border-t border-gray-200 bg-gray-50">
          <!-- Pagination (QROfertas spec: Anterior / Pagina X de Y / Proximo) -->
          <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 py-2 border-b border-gray-200">
            <button
              @click="setCurrentPage(currentPage - 1)"
              :disabled="currentPage <= 1"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <div class="flex items-center gap-1.5">
              <button
                v-for="page in totalPages"
                :key="page"
                @click="setCurrentPage(page)"
                :class="[
                  'w-7 h-7 rounded-lg text-xs font-medium transition-all',
                  page === currentPage
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                ]"
              >
                {{ page }}
              </button>
            </div>
            <span class="text-xs text-gray-500 font-medium">
              Pagina {{ currentPage }} de {{ totalPages }}
            </span>
            <button
              @click="setCurrentPage(currentPage + 1)"
              :disabled="currentPage >= totalPages"
              class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Proximo
            </button>
          </div>

          <!-- Product editor cards below canvas -->
          <BuilderProductEditor />
        </div>
      </main>
    </div>

    <!-- Export Dialog -->
    <BuilderExportDialog
      :open="showExportDialog"
      :canvas-element="canvasElement"
      @close="showExportDialog = false"
    />

    <!-- Preview Modal — encarte em tela cheia sem interface -->
    <Teleport to="body">
      <div
        v-if="showPreview"
        class="fixed inset-0 z-9999 bg-black/95 flex items-center justify-center"
        @click.self="showPreview = false"
        @keydown.escape="showPreview = false"
        tabindex="0"
        ref="previewModalRef"
      >
        <!-- Botao fechar -->
        <button
          @click="showPreview = false"
          class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          title="Fechar (ESC)"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <!-- Botao imprimir -->
        <button
          @click="handlePrint"
          class="absolute top-4 right-16 z-10 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-white text-sm transition-colors"
          title="Imprimir"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Imprimir
        </button>

        <!-- Encarte puro — sem toolbar/sidebar, tamanho real escalado para caber na tela -->
        <div
          class="overflow-auto max-h-[95vh] max-w-[95vw]"
          :style="{
            width: `${(model?.width ?? 1080) * previewScale}px`,
            height: `${(model?.height ?? 1080) * previewScale}px`,
          }"
        >
          <div
            id="preview-canvas"
            :style="{
              width: `${model?.width ?? 1080}px`,
              height: `${model?.height ?? 1080}px`,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
            }"
          >
            <BuilderCanvas />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
