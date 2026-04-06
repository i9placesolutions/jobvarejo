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
  cardTemplates,
  headerTemplates,
  footerTemplates,
} = useBuilderFlyer()

const { isAuto } = useBuilderLayout()

const emit = defineEmits<{
  export: []
  preview: []
}>()

const zoomIn = () => setZoom(zoom.value + 0.1)
const zoomOut = () => setZoom(zoom.value - 0.1)

const ZOOM_OPTIONS = [
  { value: -1, label: 'Auto' },
  { value: 0.3, label: '30%' }, { value: 0.5, label: '50%' },
  { value: 0.7, label: '70%' }, { value: 1, label: '100%' },
]

const TEXT_SIZE_MODES = [
  { value: 'MAXIMUM', label: 'Maior' },
  { value: 'MINIMUM', label: 'Menor' },
  { value: 'MEDIUM', label: 'Medio' },
]

const FOOTER_MODE_OPTIONS = [
  { value: 'premium', label: 'Premium' },
  { value: 'simples', label: 'Simples' },
  { value: 'nenhum', label: 'Nenhum' },
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
  { value: "'Barlow Condensed', sans-serif", label: 'Barlow' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
]

const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const setFc = (changes: Record<string, any>) => {
  updateFlyer({ font_config: { ...fontConfig.value, ...changes } })
}

const handleFontFamilyChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  setFc({ name_font_family: val })
  const family = val.replace(/'.+?'/g, m => m.slice(1, -1)).split(',')[0]?.trim()
  if (family && family !== 'inherit' && family !== 'Arial' && family !== 'Impact') {
    const id = `gfont-${family.replace(/\s+/g, '-')}`
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id; link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700;800;900&display=swap`
      document.head.appendChild(link)
    }
  }
}

onMounted(() => {
  const family = fontConfig.value.name_font_family
  if (family && family !== 'inherit') {
    const name = family.replace(/'.+?'/g, (m: string) => m.slice(1, -1)).split(',')[0]?.trim()
    if (name && name !== 'Arial' && name !== 'Impact') handleFontFamilyChange({ target: { value: family } } as any)
  }
})

const handleCardTemplateChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (!val) {
    updateFlyer({ card_template_id: null })
    return
  }
  const isUuid = val.length === 36 && val.includes('-')
  if (isUuid) { updateFlyer({ card_template_id: val } as any); setFc({ card_layout: null }) }
  else { updateFlyer({ card_template_id: null } as any); setFc({ card_layout: val }) }
}

const handleFooterTemplateChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (!val) return
  const isUuid = val.length === 36 && val.includes('-')
  if (isUuid) { updateFlyer({ footer_template_id: val } as any); setFc({ footer_mode: null }) }
  else { updateFlyer({ footer_template_id: null } as any); setFc({ footer_mode: val }) }
}

const handleModelChange = (e: Event) => { const v = (e.target as HTMLSelectElement).value; if (v) setModel(v) }
const handleLayoutChange = (e: Event) => { const v = (e.target as HTMLSelectElement).value; if (v === '__auto__') updateFlyer({ layout_id: null }); else if (v) setLayout(v) }
const handleZoomChange = (e: Event) => { const v = parseFloat((e.target as HTMLSelectElement).value); if (v === -1) setZoom(0.5); else setZoom(v) }
const handleTextModeChange = (e: Event) => { updateFlyer({ text_size_mode: (e.target as HTMLSelectElement).value as any }) }
const prevPage = () => setCurrentPage(currentPage.value - 1)
const nextPage = () => setCurrentPage(currentPage.value + 1)
const handleSave = async () => { try { await saveFlyer() } catch {} }

// Classes reutilizaveis
const S = 'bg-gray-100 text-[11px] text-gray-700 rounded px-1.5 py-0.5 border border-gray-200 outline-none focus:border-emerald-500/50'
const L = 'text-[9px] text-gray-400 font-medium'
const D = 'w-px h-4 bg-gray-200 mx-0.5'
</script>

<template>
  <div class="shrink-0 bg-gray-50 border-b border-gray-200">
    <!-- LINHA 1: Layout + Acoes -->
    <div class="h-9 flex items-center px-2 gap-1 flex-wrap">
      <!-- Modelo -->
      <label :class="L">Modelo</label>
      <select :value="model?.id || ''" @change="handleModelChange" :class="S">
        <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
      <div :class="D" />

      <!-- Grade -->
      <label :class="L">Grade</label>
      <select :value="isAuto ? '__auto__' : (layout?.id || '__auto__')" @change="handleLayoutChange" :class="S">
        <option value="__auto__">Auto</option>
        <option v-for="l in layouts" :key="l.id" :value="l.id">{{ l.name }}</option>
      </select>
      <div :class="D" />

      <!-- Qtd/Pag -->
      <label :class="L">Qtd</label>
      <select :value="(flyer as any)?.custom_products_per_page || 0" @change="updateFlyer({ custom_products_per_page: Number(($event.target as HTMLSelectElement).value) } as any)" :class="S + ' w-14'">
        <option :value="0">Auto</option>
        <option v-for="n in [1,2,3,4,5,6,8,9,10,12,15,16,20,24,30]" :key="n" :value="n">{{ n }}</option>
      </select>
      <div :class="D" />

      <!-- Texto -->
      <label :class="L">Texto</label>
      <select :value="flyer?.text_size_mode || 'MEDIUM'" @change="handleTextModeChange" :class="S">
        <option v-for="t in TEXT_SIZE_MODES" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <div :class="D" />

      <!-- Card (so aparece se tiver templates no banco) -->
      <template v-if="cardTemplates.length">
        <label :class="L">Card</label>
        <select :value="(flyer as any)?.card_template_id || ''" @change="handleCardTemplateChange" :class="S">
          <option value="">Padrao</option>
          <option v-for="tpl in cardTemplates" :key="tpl.id" :value="tpl.id">{{ tpl.name }}</option>
        </select>
        <div :class="D" />
      </template>

      <!-- Rodape -->
      <label :class="L">Rodape</label>
      <select :value="(flyer as any)?.footer_template_id || fontConfig.footer_mode || 'premium'" @change="handleFooterTemplateChange" :class="S">
        <optgroup v-if="footerTemplates.length" label="Templates">
          <option v-for="t in footerTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
        </optgroup>
        <option v-for="f in FOOTER_MODE_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>

      <!-- Header (se tiver templates) -->
      <template v-if="headerTemplates.length">
        <div :class="D" />
        <label :class="L">Header</label>
        <select :value="(flyer as any)?.header_template_id || ''" @change="updateFlyer({ header_template_id: ($event.target as HTMLSelectElement).value || null } as any)" :class="S">
          <option value="">Padrao</option>
          <option v-for="t in headerTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </template>

      <!-- Spacer -->
      <div class="flex-1 min-w-2" />

      <!-- Zoom -->
      <button @click="zoomOut" class="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700"><ZoomOut class="w-3.5 h-3.5" /></button>
      <select :value="zoom" @change="handleZoomChange" :class="S + ' w-12 text-center'">
        <option v-for="z in ZOOM_OPTIONS" :key="z.value" :value="z.value">{{ z.label }}</option>
      </select>
      <button @click="zoomIn" class="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700"><ZoomIn class="w-3.5 h-3.5" /></button>

      <!-- Pagination -->
      <template v-if="totalPages > 1">
        <div :class="D" />
        <button @click="prevPage" :disabled="currentPage <= 1" class="p-0.5 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-30"><ChevronLeft class="w-3.5 h-3.5" /></button>
        <span class="text-[10px] text-gray-500 min-w-6 text-center">{{ currentPage }}/{{ totalPages }}</span>
        <button @click="nextPage" :disabled="currentPage >= totalPages" class="p-0.5 hover:bg-gray-100 rounded text-gray-400 disabled:opacity-30"><ChevronRight class="w-3.5 h-3.5" /></button>
      </template>

      <div :class="D" />

      <!-- Status + Actions -->
      <span v-if="isDirty && !isSaving" class="text-[9px] text-amber-500">*</span>
      <Loader2 v-if="isSaving" class="w-3 h-3 text-blue-400 animate-spin" />
      <button @click="emit('preview')" class="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"><Eye class="w-3 h-3 inline mr-0.5" />Preview</button>
      <button @click="emit('export')" class="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"><Download class="w-3 h-3 inline mr-0.5" />Exportar</button>
      <button @click="handleSave" :disabled="isSaving || !isDirty" class="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"><Save class="w-3 h-3 inline mr-0.5" />Salvar</button>
    </div>

    <!-- LINHA 2: Ajustes finos -->
    <div class="h-7 flex items-center px-2 gap-1 overflow-x-auto border-t border-gray-100">
      <!-- Fonte -->
      <label :class="L">Fonte</label>
      <select :value="fontConfig.name_font_family || 'inherit'" @change="handleFontFamilyChange" :class="S">
        <option v-for="f in FONT_FAMILY_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
      <div :class="D" />

      <!-- Caixa -->
      <label :class="L">Caixa</label>
      <select :value="fontConfig.name_text_transform || 'uppercase'" @change="setFc({ name_text_transform: ($event.target as HTMLSelectElement).value })" :class="S + ' w-12'">
        <option value="uppercase">ABC</option>
        <option value="capitalize">Abc</option>
        <option value="lowercase">abc</option>
        <option value="none">Aa</option>
      </select>
      <div :class="D" />

      <!-- Imagem -->
      <label :class="L">Img</label>
      <select :value="Math.min(Number(fontConfig.image_scale || 1), 1)" @change="setFc({ image_scale: Math.min(parseFloat(($event.target as HTMLSelectElement).value), 1) })" :class="S + ' w-14'">
        <option v-for="v in [0.7,0.8,0.9,1]" :key="v" :value="v">{{ v * 100 }}%</option>
      </select>
      <div :class="D" />

      <!-- Etiqueta escala -->
      <label :class="L">Etiq</label>
      <select :value="fontConfig.price_scale || 1" @change="setFc({ price_scale: parseFloat(($event.target as HTMLSelectElement).value) })" :class="S + ' w-14'">
        <option v-for="v in [0.7,0.8,0.9,1,1.2,1.5,2]" :key="v" :value="v">{{ v * 100 }}%</option>
      </select>
      <div :class="D" />

      <!-- Estilo etiqueta -->
      <label :class="L">Estilo</label>
      <select :value="fontConfig.price_visual_style || 'padrao'" @change="setFc({ price_visual_style: ($event.target as HTMLSelectElement).value })" :class="S">
        <option value="padrao">Padrao</option>
        <option value="bandeira">Bandeira</option>
        <option value="explodir">Explosao</option>
        <option value="circulo">Circulo</option>
        <option value="minimal">Minimal</option>
        <option value="pill">Pilula</option>
        <option value="neon">Neon</option>
        <option value="oferta">Oferta</option>
        <option value="gold">Dourado</option>
      </select>
      <div :class="D" />

      <!-- Cor Card -->
      <label :class="L">Cor</label>
      <input type="color" :value="fontConfig.card_bg_color || '#ffffff'" @input="setFc({ card_bg_color: ($event.target as HTMLInputElement).value })" class="w-5 h-5 rounded cursor-pointer border border-gray-200 bg-transparent" />
      <div :class="D" />

      <!-- Borda -->
      <label :class="L">Borda</label>
      <select :value="fontConfig.card_border_radius || '8px'" @change="setFc({ card_border_radius: ($event.target as HTMLSelectElement).value })" :class="S + ' w-16'">
        <option value="0px">Sem</option>
        <option value="8px">Suave</option>
        <option value="16px">Redondo</option>
      </select>
      <div :class="D" />

      <!-- Gap -->
      <label :class="L">Gap</label>
      <select :value="fontConfig.card_gap ?? 8" @change="setFc({ card_gap: parseInt(($event.target as HTMLSelectElement).value) })" :class="S + ' w-14'">
        <option :value="0">0</option>
        <option :value="2">2</option>
        <option :value="4">4</option>
        <option :value="8">8</option>
      </select>

      <!-- Pad -->
      <label :class="L">Pad</label>
      <select :value="fontConfig.card_padding ?? 12" @change="setFc({ card_padding: parseInt(($event.target as HTMLSelectElement).value) })" :class="S + ' w-14'">
        <option :value="0">0</option>
        <option :value="4">4</option>
        <option :value="8">8</option>
        <option :value="12">12</option>
      </select>
      <div :class="D" />

      <!-- QR -->
      <label :class="L">QR</label>
      <button type="button" @click="setFc({ show_qr_code: !(fontConfig.show_qr_code ?? false) })" :class="['w-6 h-4 rounded-full transition-colors', fontConfig.show_qr_code ? 'bg-emerald-500' : 'bg-gray-300']">
        <span :class="['block w-3 h-3 rounded-full bg-white shadow transition-transform', fontConfig.show_qr_code ? 'translate-x-2.5' : 'translate-x-0.5']" />
      </button>

      <!-- Capa -->
      <label :class="L">Capa</label>
      <button type="button" @click="updateFlyer({ show_cover: !(flyer?.show_cover ?? false) })" :class="['w-6 h-4 rounded-full transition-colors', flyer?.show_cover ? 'bg-emerald-500' : 'bg-gray-300']">
        <span :class="['block w-3 h-3 rounded-full bg-white shadow transition-transform', flyer?.show_cover ? 'translate-x-2.5' : 'translate-x-0.5']" />
      </button>
    </div>
  </div>
</template>
