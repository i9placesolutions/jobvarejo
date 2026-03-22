<script setup lang="ts">
import {
  ArrowLeft,
  Loader2,
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: 'builder-auth',
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
const canvasElement = computed(() => canvasComponent.value?.canvasRef ?? null)
const canvasAreaRef = ref<HTMLElement | null>(null)

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
  <div class="h-screen flex flex-col bg-[#0f0f0f] overflow-hidden">
    <!-- Top bar: back + title -->
    <header class="h-10 shrink-0 bg-[#1a1a1a] border-b border-white/5 flex items-center px-3 gap-3">
      <button
        @click="navigateTo('/builder')"
        class="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white shrink-0"
        title="Voltar"
      >
        <ArrowLeft class="w-4 h-4" />
      </button>
      <span v-if="flyer" class="text-sm font-medium text-white truncate">
        {{ flyer.title || 'Sem titulo' }}
      </span>
    </header>

    <!-- Toolbar (Modelo, Grade, Texto, Capa, Rodape, Zoom, Paginacao, Salvar, Exportar) -->
    <BuilderToolbar @export="showExportDialog = true" />

    <!-- Body: Sidebar + Canvas + Product Editor -->
    <div class="flex-1 flex min-h-0 overflow-hidden">
      <!-- Left Sidebar (72px icons + 360px panel) -->
      <BuilderSidebar />

      <!-- Main area -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Canvas area — centered both axes -->
        <div
          ref="canvasAreaRef"
          class="flex-1 overflow-auto flex bg-[#0a0a0a] p-6"
        >
          <template v-if="isLoading">
            <div class="flex flex-col items-center gap-3">
              <Loader2 class="w-8 h-8 text-emerald-500 animate-spin" />
              <span class="text-sm text-zinc-400">Carregando encarte...</span>
            </div>
          </template>
          <template v-else-if="flyer">
            <BuilderCanvas ref="canvasComponent" />
          </template>
        </div>

        <!-- Bottom: Pagination + Product editor -->
        <div class="shrink-0 border-t border-white/5 bg-[#141414]">
          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 py-2 border-b border-white/5">
            <button
              v-for="page in totalPages"
              :key="page"
              @click="setCurrentPage(page)"
              :class="[
                'w-8 h-8 rounded-lg text-xs font-medium transition-all',
                page === currentPage
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              ]"
            >
              {{ page }}
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
  </div>
</template>
