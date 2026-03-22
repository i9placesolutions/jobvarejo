<script setup lang="ts">
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  Loader2,
} from 'lucide-vue-next'

const {
  flyer,
  model,
  layout,
  models,
  layouts,
  zoom,
  currentPage,
  totalPages,
  isDirty,
  isSaving,
  setModel,
  setLayout,
  setZoom,
  setCurrentPage,
  updateFlyer,
  saveFlyer,
} = useBuilderFlyer()

const { isAuto } = useBuilderLayout()

const emit = defineEmits<{
  export: []
}>()

// Zoom controls
const zoomIn = () => setZoom(zoom.value + 0.1)
const zoomOut = () => setZoom(zoom.value - 0.1)
const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)

const ZOOM_OPTIONS = [
  { value: -1, label: 'Auto' },
  { value: 0.3, label: '30%' },
  { value: 0.4, label: '40%' },
  { value: 0.5, label: '50%' },
  { value: 0.6, label: '60%' },
  { value: 0.7, label: '70%' },
  { value: 0.8, label: '80%' },
  { value: 0.9, label: '90%' },
  { value: 1, label: '100%' },
]

const TEXT_SIZE_MODES = [
  { value: 'MAXIMUM', label: 'Texto Maior' },
  { value: 'MINIMUM', label: 'Texto Menor' },
  { value: 'MEDIUM', label: 'Texto Medio' },
]

const FOOTER_STYLES = [
  { value: 'rounded-large', label: 'Redondo Grande' },
  { value: 'square-large', label: 'Quadrado Grande' },
  { value: 'square-compact', label: 'Quadrado Compacto' },
]

const handleModelChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (val) setModel(val)
}

const handleLayoutChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (val === '__auto__') {
    // Clear layout → auto mode
    updateFlyer({ layout_id: null })
  } else if (val) {
    setLayout(val)
  }
}

const handleZoomChange = (e: Event) => {
  const val = parseFloat((e.target as HTMLSelectElement).value)
  if (val === -1) {
    // Auto zoom — fit canvas to viewport
    setZoom(0.5)
  } else {
    setZoom(val)
  }
}

const handleTextModeChange = (e: Event) => {
  updateFlyer({ text_size_mode: (e.target as HTMLSelectElement).value as any })
}

const handleFooterStyleChange = (e: Event) => {
  updateFlyer({ footer_style: (e.target as HTMLSelectElement).value })
}

const prevPage = () => setCurrentPage(currentPage.value - 1)
const nextPage = () => setCurrentPage(currentPage.value + 1)

const handleSave = async () => {
  try { await saveFlyer() } catch {}
}
</script>

<template>
  <div class="h-10 shrink-0 bg-[#1a1a1a] border-b border-white/5 flex items-center px-2 gap-1 overflow-x-auto">
    <!-- Modelo -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Modelo</label>
      <select
        :value="model?.id || ''"
        @change="handleModelChange"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option v-for="m in models" :key="m.id" :value="m.id">
          {{ m.name }}
        </option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Grade -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Grade</label>
      <select
        :value="isAuto ? '__auto__' : (layout?.id || '__auto__')"
        @change="handleLayoutChange"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option value="__auto__">Automatica</option>
        <option v-for="l in layouts" :key="l.id" :value="l.id">
          {{ l.name }}
        </option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Produtos por pagina -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Qtd/Pag</label>
      <select
        :value="(flyer as any)?.custom_products_per_page || 0"
        @change="updateFlyer({ custom_products_per_page: Number(($event.target as HTMLSelectElement).value) } as any)"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50 w-16"
      >
        <option :value="0">Auto</option>
        <option v-for="n in [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 20, 24, 25, 30, 36, 40, 48, 50]" :key="n" :value="n">{{ n }}</option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Texto -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Texto</label>
      <select
        :value="flyer?.text_size_mode || 'MEDIUM'"
        @change="handleTextModeChange"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option v-for="t in TEXT_SIZE_MODES" :key="t.value" :value="t.value">
          {{ t.label }}
        </option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Capa toggle -->
    <label class="flex items-center gap-1 shrink-0 cursor-pointer">
      <span class="text-[10px] text-zinc-500 font-medium">Capa</span>
      <button
        type="button"
        role="switch"
        :aria-checked="flyer?.show_cover ?? false"
        @click="updateFlyer({ show_cover: !(flyer?.show_cover ?? false) })"
        :class="[
          'relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors',
          flyer?.show_cover ? 'bg-emerald-600' : 'bg-white/10'
        ]"
      >
        <span
          :class="[
            'pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-0.5',
            flyer?.show_cover ? 'translate-x-3.5 ml-px' : 'translate-x-0.5'
          ]"
        />
      </button>
    </label>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Rodape -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Rodape</label>
      <select
        :value="flyer?.footer_style || 'rounded-large'"
        @change="handleFooterStyleChange"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option v-for="f in FOOTER_STYLES" :key="f.value" :value="f.value">
          {{ f.label }}
        </option>
      </select>
    </div>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Zoom -->
    <div class="flex items-center gap-1 shrink-0">
      <button
        @click="zoomOut"
        class="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors"
      >
        <ZoomOut class="w-3.5 h-3.5" />
      </button>
      <select
        :value="zoom"
        @change="handleZoomChange"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-1 py-1 border border-white/5 outline-none w-14 text-center"
      >
        <option v-for="z in ZOOM_OPTIONS" :key="z.value" :value="z.value">
          {{ z.label }}
        </option>
      </select>
      <button
        @click="zoomIn"
        class="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white transition-colors"
      >
        <ZoomIn class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center gap-1 shrink-0">
      <button
        @click="prevPage"
        :disabled="currentPage <= 1"
        class="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
      >
        <ChevronLeft class="w-3.5 h-3.5" />
      </button>
      <span class="text-[11px] text-zinc-400 min-w-8 text-center">
        {{ currentPage }}/{{ totalPages }}
      </span>
      <button
        @click="nextPage"
        :disabled="currentPage >= totalPages"
        class="p-1 hover:bg-white/5 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
      >
        <ChevronRight class="w-3.5 h-3.5" />
      </button>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Actions -->
    <div class="flex items-center gap-1.5 shrink-0">
      <span v-if="isDirty && !isSaving" class="text-[9px] text-amber-400">Nao salvo</span>
      <span v-if="isSaving" class="text-[9px] text-blue-400 flex items-center gap-1">
        <Loader2 class="w-3 h-3 animate-spin" />
      </span>

      <button
        @click="emit('export')"
        class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-colors"
      >
        <Download class="w-3 h-3" />
        Exportar
      </button>

      <button
        @click="handleSave"
        :disabled="isSaving || !isDirty"
        class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors"
      >
        <Save class="w-3 h-3" />
        Salvar
      </button>
    </div>
  </div>
</template>
