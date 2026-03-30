<script setup lang="ts">
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  Loader2,
  Eye,
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
  preview: []
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

const FOOTER_MODE_OPTIONS = [
  { value: 'premium', label: 'Premium' },
  { value: 'simples', label: 'Simples' },
  { value: 'nenhum', label: 'Nenhum' },
]

const TEXT_TRANSFORM_OPTIONS = [
  { value: 'uppercase', label: 'ABC' },
  { value: 'capitalize', label: 'Abc' },
  { value: 'lowercase', label: 'abc' },
  { value: 'none', label: 'Aa' },
]

const FONT_FAMILY_OPTIONS = [
  { value: 'inherit', label: 'Padrao' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: "'Bebas Neue', sans-serif", label: 'Bebas Neue' },
  { value: "'Oswald', sans-serif", label: 'Oswald' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "'Poppins', sans-serif", label: 'Poppins' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Barlow Condensed', sans-serif", label: 'Barlow Condensed' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
]

// Font config helpers
const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)

// Helper para atualizar font_config sem perder dados existentes
const setFc = (changes: Record<string, any>) => {
  updateFlyer({ font_config: { ...fontConfig.value, ...changes } })
}

const handleFontFamilyChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  setFc({ name_font_family: val })
  // Carregar Google Font se necessário
  const family = val.replace(/'.+?'/g, m => m.slice(1, -1)).split(',')[0]?.trim()
  if (family && family !== 'inherit' && family !== 'Arial' && family !== 'Impact') {
    loadGoogleFont(family)
  }
}

const handleTextTransformChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  setFc({ name_text_transform: val })
}

const loadGoogleFont = (family: string) => {
  const id = `gfont-${family.replace(/\s+/g, '-')}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700;800;900&display=swap`
  document.head.appendChild(link)
}

// Carregar fonte ao iniciar se já tiver uma configurada
onMounted(() => {
  const family = fontConfig.value.name_font_family
  if (family && family !== 'inherit') {
    const name = family.replace(/'.+?'/g, (m: string) => m.slice(1, -1)).split(',')[0]?.trim()
    if (name && name !== 'Arial' && name !== 'Impact') loadGoogleFont(name)
  }
})

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

    <!-- Layout do Card -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Card</label>
      <select
        :value="fontConfig.card_layout || 'classico'"
        @change="setFc({ card_layout: ($event.target as HTMLSelectElement).value })"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <optgroup label="Basicos">
          <option value="classico">Classico</option>
          <option value="lateral">Lateral</option>
          <option value="premium">Premium</option>
        </optgroup>
        <optgroup label="Compactos">
          <option value="compacto">Compacto</option>
          <option value="mini">Mini Lista</option>
          <option value="grade">Grade/Atacadao</option>
        </optgroup>
        <optgroup label="Destaque">
          <option value="vitrine">Vitrine</option>
          <option value="splash">Splash</option>
        </optgroup>
        <optgroup label="Modernos">
          <option value="minimalista">Minimalista</option>
          <option value="flat">Flat Design</option>
          <option value="card3d">Card 3D</option>
          <option value="glassmorphism">Vidro/Glass</option>
        </optgroup>
        <optgroup label="Tradicionais">
          <option value="tabloide">Tabloide</option>
          <option value="etiqueta">Etiqueta</option>
        </optgroup>
        <optgroup label="Elegantes">
          <option value="elegante">Elegante/Gourmet</option>
          <option value="dark">Dark/Noturno</option>
        </optgroup>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Fonte -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Fonte</label>
      <select
        :value="fontConfig.name_font_family || 'inherit'"
        @change="handleFontFamilyChange"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option v-for="f in FONT_FAMILY_OPTIONS" :key="f.value" :value="f.value">
          {{ f.label }}
        </option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Caixa (text-transform) -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Caixa</label>
      <select
        :value="fontConfig.name_text_transform || 'uppercase'"
        @change="handleTextTransformChange"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option v-for="t in TEXT_TRANSFORM_OPTIONS" :key="t.value" :value="t.value">
          {{ t.label }}
        </option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Imagem (escala - so reduz, 100% é o maximo que cabe no card) -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Imagem</label>
      <select
        :value="fontConfig.image_scale || 1"
        @change="setFc({ image_scale: parseFloat(($event.target as HTMLSelectElement).value) })"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option :value="0.5">50%</option>
        <option :value="0.6">60%</option>
        <option :value="0.7">70%</option>
        <option :value="0.8">80%</option>
        <option :value="0.9">90%</option>
        <option :value="1">100%</option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Etiqueta (escala do preco) -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Etiqueta</label>
      <select
        :value="fontConfig.price_scale || 1"
        @change="setFc({ price_scale: parseFloat(($event.target as HTMLSelectElement).value) })"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option :value="0.7">70%</option>
        <option :value="0.8">80%</option>
        <option :value="0.9">90%</option>
        <option :value="1">100%</option>
        <option :value="1.1">110%</option>
        <option :value="1.2">120%</option>
        <option :value="1.3">130%</option>
        <option :value="1.5">150%</option>
        <option :value="1.8">180%</option>
        <option :value="2">200%</option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Estilo da Etiqueta -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Etiq.</label>
      <select
        :value="fontConfig.price_visual_style || 'padrao'"
        @change="setFc({ price_visual_style: ($event.target as HTMLSelectElement).value })"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <optgroup label="Classicas">
          <option value="padrao">Padrao</option>
          <option value="bandeira">Bandeira</option>
          <option value="explodir">Explosao</option>
          <option value="circulo">Circulo</option>
          <option value="oval">Oval</option>
          <option value="selo">Selo/Carimbo</option>
        </optgroup>
        <optgroup label="Modernas">
          <option value="minimal">Minimalista</option>
          <option value="tag">Tag</option>
          <option value="pill">Pilula</option>
          <option value="neon">Neon</option>
          <option value="glass">Vidro</option>
          <option value="gradient">Gradiente</option>
        </optgroup>
        <optgroup label="Promocionais">
          <option value="oferta">Mega Oferta</option>
          <option value="queima">Queima</option>
          <option value="flash">Flash</option>
        </optgroup>
        <optgroup label="Premium">
          <option value="gold">Dourado</option>
          <option value="darkprice">Dark</option>
          <option value="outline">Contorno</option>
        </optgroup>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Cor do Card -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Card</label>
      <input
        type="color"
        :value="fontConfig.card_bg_color || '#ffffff'"
        @input="setFc({ card_bg_color: ($event.target as HTMLInputElement).value })"
        class="w-5 h-5 rounded cursor-pointer border border-white/10 bg-transparent"
      />
    </div>

    <!-- Borda do Card -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Borda</label>
      <select
        :value="fontConfig.card_border_radius || '8px'"
        @change="setFc({ card_border_radius: ($event.target as HTMLSelectElement).value })"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option value="0px">Nenhum</option>
        <option value="8px">Suave</option>
        <option value="16px">Arredondado</option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- Gap entre cards -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Gap</label>
      <select
        :value="fontConfig.card_gap ?? 8"
        @change="setFc({ card_gap: parseInt(($event.target as HTMLSelectElement).value) })"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option :value="0">Nenhum</option>
        <option :value="2">Fino</option>
        <option :value="4">Medio</option>
        <option :value="8">Grande</option>
      </select>
    </div>

    <!-- Padding do grid -->
    <div class="flex items-center gap-1 shrink-0">
      <label class="text-[10px] text-zinc-500 font-medium">Pad</label>
      <select
        :value="fontConfig.card_padding ?? 12"
        @change="setFc({ card_padding: parseInt(($event.target as HTMLSelectElement).value) })"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option :value="0">Nenhum</option>
        <option :value="4">Fino</option>
        <option :value="8">Medio</option>
        <option :value="12">Grande</option>
      </select>
    </div>

    <div class="w-px h-5 bg-white/5 mx-1" />

    <!-- QR Code toggle -->
    <label class="flex items-center gap-1 shrink-0 cursor-pointer">
      <span class="text-[10px] text-zinc-500 font-medium">QR</span>
      <button
        type="button"
        role="switch"
        :aria-checked="fontConfig.show_qr_code ?? false"
        @click="setFc({ show_qr_code: !(fontConfig.show_qr_code ?? false) })"
        :class="[
          'relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors',
          fontConfig.show_qr_code ? 'bg-emerald-600' : 'bg-white/10'
        ]"
      >
        <span
          :class="[
            'pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform mt-0.5',
            fontConfig.show_qr_code ? 'translate-x-3.5 ml-px' : 'translate-x-0.5'
          ]"
        />
      </button>
    </label>

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
        :value="fontConfig.footer_mode || 'premium'"
        @change="setFc({ footer_mode: ($event.target as HTMLSelectElement).value })"
        class="bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1 border border-white/5 outline-none focus:border-emerald-500/50"
      >
        <option v-for="f in FOOTER_MODE_OPTIONS" :key="f.value" :value="f.value">
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
        @click="emit('preview')"
        class="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-colors"
      >
        <Eye class="w-3 h-3" />
        Preview
      </button>

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
