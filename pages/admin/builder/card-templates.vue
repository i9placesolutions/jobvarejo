<script setup lang="ts">
import type { CardTemplateElement } from '~/types/builder'
import { useElementDragResize, type ResizeHandle } from '~/composables/useElementDragResize'

definePageMeta({ layout: false, middleware: ['auth', 'admin'], ssr: false })

const {
  items, isLoading, error,
  editingId, formName, formCategory, formIsActive,
  elements, cardStyle,
  selectedElementId, selectedElement,
  liveTemplate,
  fetchTemplates, saveTemplate, deleteTemplate,
  openEditor, addElement, removeElement, duplicateElement,
  updateElement, updateSelectedElement, selectElement,
  applyPreset, presets, mockProducts,
} = useCardTemplateEditor()

// ── Modo: lista ou editor ──
const mode = ref<'list' | 'editor'>('list')
const previewMode = ref<'1' | '2x2' | '3x3'>('2x2')
const showPreview = ref(true)

// ── Canvas drag/resize ──
const canvasRef = ref<HTMLElement | null>(null)
const { startDrag, startResize, isDragging, isResizing } = useElementDragResize(
  canvasRef, elements, selectedElementId
)

// ── Helpers ──
const pct = (v: string | undefined) => parseInt(v || '0') || 0
const categories = ['geral', 'basico', 'compacto', 'destaque', 'moderno', 'tradicional', 'premium']
const elMeta: Record<string, { icon: string; label: string; color: string; border: string }> = {
  text:        { icon: 'T',  label: 'Nome',    color: '#3b82f6', border: '#93c5fd' },
  image:       { icon: '◻', label: 'Imagem',  color: '#10b981', border: '#6ee7b7' },
  price:       { icon: '$',  label: 'Preco',   color: '#ef4444', border: '#fca5a5' },
  badge:       { icon: '★',  label: 'Selo',    color: '#f59e0b', border: '#fcd34d' },
  unit:        { icon: 'g',  label: 'Unidade', color: '#8b5cf6', border: '#c4b5fd' },
  observation: { icon: '…',  label: 'Obs',     color: '#6366f1', border: '#a5b4fc' },
  shape:       { icon: '◆',  label: 'Forma',   color: '#ec4899', border: '#f9a8d4' },
}
// ── Formatos de card (aspect ratio) ──
const CARD_FORMATS = [
  { id: 'feed',     label: 'Feed',     w: 340, h: 340, desc: '1:1' },
  { id: 'story',    label: 'Story',    w: 260, h: 460, desc: '9:16' },
  { id: 'reels',    label: 'Reels',    w: 260, h: 460, desc: '9:16' },
  { id: 'vertical', label: 'Vertical', w: 340, h: 460, desc: '3:4' },
  { id: 'tv-h',     label: 'TV Horiz', w: 460, h: 260, desc: '16:9' },
  { id: 'tv-v',     label: 'TV Vert',  w: 260, h: 460, desc: '9:16' },
  { id: 'a4',       label: 'A4',       w: 320, h: 450, desc: '210x297' },
  { id: 'a4-h',     label: 'A4 Horiz', w: 450, h: 320, desc: '297x210' },
  { id: 'cartaz',   label: 'Cartaz',   w: 340, h: 480, desc: 'Poster' },
  { id: 'livre',    label: 'Livre',    w: 340, h: 460, desc: 'Custom' },
]
const activeFormat = ref(CARD_FORMATS[3]!) // Vertical como padrao
const canvasWidth = computed(() => activeFormat.value.w)
const canvasHeight = computed(() => activeFormat.value.h)

// Preview: tamanho proporcional ao formato ativo, cabe na sidebar de 320px
const pvMaxW = 280
const pvMaxH = 500
const pvSingle = computed(() => {
  const ratio = activeFormat.value.w / activeFormat.value.h
  let w: number, h: number
  if (ratio >= 1) {
    // Horizontal ou quadrado
    w = Math.min(pvMaxW, activeFormat.value.w * 0.6)
    h = w / ratio
  } else {
    // Vertical (story, reels, etc)
    h = Math.min(pvMaxH, activeFormat.value.h * 0.7)
    w = h * ratio
  }
  // Garantir que cabe
  if (w > pvMaxW) { w = pvMaxW; h = w / ratio }
  if (h > pvMaxH) { h = pvMaxH; w = h * ratio }
  return { w: Math.round(w), h: Math.round(h) }
})
const pvGrid = computed(() => {
  // Grid usa mesma proporcao mas um pouco maior
  const ratio = activeFormat.value.w / activeFormat.value.h
  let w: number, h: number
  if (ratio >= 1) {
    w = Math.min(pvMaxW, activeFormat.value.w * 0.7)
    h = w / ratio
  } else {
    h = Math.min(pvMaxH, activeFormat.value.h * 0.78)
    w = h * ratio
  }
  if (w > pvMaxW) { w = pvMaxW; h = w / ratio }
  if (h > pvMaxH) { h = pvMaxH; w = h * ratio }
  return { w: Math.round(w), h: Math.round(h) }
})

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const handleCursor: Record<ResizeHandle, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
}
const handlePos: Record<ResizeHandle, string> = {
  nw: 'top: -4px; left: -4px;',
  n:  'top: -4px; left: 50%; transform: translateX(-50%);',
  ne: 'top: -4px; right: -4px;',
  e:  'top: 50%; right: -4px; transform: translateY(-50%);',
  se: 'bottom: -4px; right: -4px;',
  s:  'bottom: -4px; left: 50%; transform: translateX(-50%);',
  sw: 'bottom: -4px; left: -4px;',
  w:  'top: 50%; left: -4px; transform: translateY(-50%);',
}

// ── Acoes ──
const goEdit = (item?: any) => { openEditor(item); mode.value = 'editor' }
const goList = () => { mode.value = 'list' }
const handleSave = async () => {
  try { await saveTemplate(); goList() }
  catch {}
}
const handleDelete = async (id: string) => {
  if (!confirm('Excluir este template?')) return
  try { await deleteTemplate(id) } catch {}
}

// ── Keyboard shortcuts ──
const onKeyDown = (e: KeyboardEvent) => {
  if (mode.value !== 'editor') return
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedElementId.value && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) {
      removeElement(selectedElementId.value)
    }
  }
  if (e.key === 'Escape') selectElement(null)
  // Setas para nudge 1%
  if (selectedElement.value && !isDragging.value && !isResizing.value) {
    const el = selectedElement.value
    if (e.key === 'ArrowLeft')  { updateSelectedElement({ x: `${Math.max(0, pct(el.x) - 1)}%` }); e.preventDefault() }
    if (e.key === 'ArrowRight') { updateSelectedElement({ x: `${Math.min(100 - pct(el.w), pct(el.x) + 1)}%` }); e.preventDefault() }
    if (e.key === 'ArrowUp')    { updateSelectedElement({ y: `${Math.max(0, pct(el.y) - 1)}%` }); e.preventDefault() }
    if (e.key === 'ArrowDown')  { updateSelectedElement({ y: `${Math.min(100 - pct(el.h), pct(el.y) + 1)}%` }); e.preventDefault() }
  }
}
onMounted(() => { fetchTemplates(); document.addEventListener('keydown', onKeyDown) })
onUnmounted(() => { document.removeEventListener('keydown', onKeyDown) })

// Mock para preview do BuilderDynamicCard
const buildMockProduct = (m: typeof mockProducts[0]) => ({
  id: m.id, flyer_id: '', product_id: null, custom_name: m.name,
  custom_image: m.image || '/img/placeholder-product.svg',
  offer_price: m.offer_price, original_price: m.original_price, price_mode: 'simple' as const,
  unit: m.unit as any, observation: m.observation || '', badge_style_id: '', is_highlight: false,
  is_adult: false, sort_order: Number(m.id), colspan: 1, image_zoom: 100, image_x: 50, image_y: 50,
  extra_images: [] as string[], extra_images_layout: null, position: Number(m.id),
  purchase_limit: null, take_quantity: null, pay_quantity: null, installment_count: null,
  installment_price: null, no_interest: false, club_name: null, anticipation_text: null,
  show_discount: false, quantity_unit: null, price_label: null, tag_style_id: null, highlight_color: null,
} as any)
const previewProducts = computed(() => mockProducts.slice(0, 9).map(buildMockProduct))
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">

    <!-- ═══ LISTA ═══ -->
    <template v-if="mode === 'list'">
      <div class="p-6 max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-bold text-gray-800">Card Templates</h1>
            <p class="text-sm text-gray-500 mt-0.5">Crie layouts visuais para os cards de produto do encarte</p>
          </div>
          <div class="flex gap-2">
            <NuxtLink to="/admin/builder" class="px-4 py-2 rounded-lg text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">Voltar</NuxtLink>
            <button @click="goEdit()" class="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm">+ Novo Template</button>
          </div>
        </div>
        <div v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">{{ error }}</div>
        <div v-if="isLoading" class="text-center py-16 text-gray-400">Carregando...</div>
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div v-for="item in items" :key="item.id" @click="goEdit(item)" class="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group">
            <div class="bg-gray-100 p-4 flex items-center justify-center" style="aspect-ratio: 3/4">
              <div class="w-full h-full rounded flex flex-col items-center justify-center p-2" :style="{ background: item.card_style?.bg || '#fff', borderRadius: item.card_style?.borderRadius || '8px', border: item.card_style?.border || '1px solid #eee' }">
                <div class="w-10 h-10 bg-gray-200 rounded mb-1.5" />
                <div class="w-14 h-1.5 bg-gray-300 rounded mb-1" />
                <div class="w-10 h-2.5 bg-red-200 rounded" />
              </div>
            </div>
            <div class="p-3">
              <span class="font-medium text-sm truncate block text-gray-800">{{ item.name }}</span>
              <div class="flex items-center gap-2 mt-1 text-[10px]">
                <span class="text-gray-400">{{ item.category }}</span>
                <span :class="item.is_active ? 'text-emerald-600' : 'text-gray-400'">{{ item.is_active ? 'Ativo' : 'Inativo' }}</span>
              </div>
              <div class="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                <button @click="goEdit(item)" class="text-xs text-blue-600 hover:underline">Editar</button>
                <button @click="handleDelete(item.id)" class="text-xs text-red-500 hover:underline">Excluir</button>
              </div>
            </div>
          </div>
          <button @click="goEdit()" class="rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-blue-500 transition-colors" style="aspect-ratio: 3/5">
            <span class="text-3xl font-light">+</span><span class="text-xs">Novo</span>
          </button>
        </div>
      </div>
    </template>

    <!-- ═══ EDITOR ═══ -->
    <template v-else>
      <div class="h-screen flex flex-col overflow-hidden bg-white">

        <!-- Toolbar -->
        <header class="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 shadow-sm">
          <button @click="goList" class="text-sm text-gray-500 hover:text-gray-800 font-medium">← Voltar</button>
          <div class="w-px h-6 bg-gray-200" />

          <!-- Nome -->
          <input v-model="formName" placeholder="Nome do template..." class="text-sm font-semibold bg-transparent outline-none text-gray-800 placeholder-gray-400 w-44" />

          <!-- Categoria -->
          <select v-model="formCategory" class="text-xs bg-gray-50 rounded-md px-2 py-1.5 border border-gray-200 text-gray-600 outline-none">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>

          <!-- Ativo -->
          <label class="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
            <input v-model="formIsActive" type="checkbox" class="rounded accent-blue-600" /> Ativo
          </label>

          <div class="w-px h-6 bg-gray-200" />

          <!-- Formato do card -->
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-gray-400 font-medium">Formato:</span>
            <div class="flex gap-0.5">
              <button
                v-for="f in CARD_FORMATS" :key="f.id"
                @click="activeFormat = f"
                :title="f.desc"
                :class="['px-2 py-1 rounded text-[10px] font-medium border transition-all',
                  activeFormat.id === f.id
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300']"
              >{{ f.label }}</button>
            </div>
          </div>

          <div class="flex-1" />

          <!-- Presets -->
          <div class="relative group">
            <button class="px-3 py-1.5 rounded-md text-xs bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100">Presets</button>
            <div class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 hidden group-hover:block z-50 w-44">
              <button v-for="(p, key) in presets" :key="key" @click="applyPreset(String(key))" class="w-full text-left px-3 py-1.5 rounded text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                {{ p.name }}
              </button>
            </div>
          </div>

          <!-- Adicionar -->
          <div class="relative group">
            <button class="px-3 py-1.5 rounded-md text-xs bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100">+ Elemento</button>
            <div class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 hidden group-hover:block z-50 w-40">
              <button @click="addElement('text')" class="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-gray-50"><span class="text-blue-500 font-bold mr-1.5">T</span> Nome</button>
              <button @click="addElement('image')" class="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-gray-50"><span class="text-emerald-500 font-bold mr-1.5">◻</span> Imagem</button>
              <button @click="addElement('price')" class="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-gray-50"><span class="text-red-500 font-bold mr-1.5">$</span> Preco</button>
              <button @click="addElement('badge')" class="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-gray-50"><span class="text-amber-500 font-bold mr-1.5">★</span> Selo</button>
              <button @click="addElement('unit')" class="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-gray-50"><span class="text-violet-500 font-bold mr-1.5">g</span> Unidade</button>
              <button @click="addElement('observation')" class="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-gray-50"><span class="text-indigo-500 font-bold mr-1.5">…</span> Obs</button>
              <button @click="addElement('shape')" class="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-gray-50"><span class="text-pink-500 font-bold mr-1.5">◆</span> Forma</button>
            </div>
          </div>

          <!-- Preview toggle -->
          <button @click="showPreview = !showPreview" :class="['px-3 py-1.5 rounded-md text-xs border', showPreview ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500']">
            Preview
          </button>

          <div v-if="error" class="text-xs text-red-500 max-w-32 truncate">{{ error }}</div>

          <button @click="handleSave" :disabled="isLoading || !formName" class="px-5 py-1.5 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm disabled:opacity-40">
            Salvar
          </button>
        </header>

        <!-- Conteudo principal -->
        <div class="flex-1 flex min-h-0 overflow-hidden">

          <!-- ══ CANVAS DE EDICAO (centro) ══ -->
          <div class="flex-1 bg-gray-100 flex items-center justify-center p-8 overflow-auto" @click="selectElement(null)">
            <div class="flex flex-col items-center gap-3">
              <span class="text-[10px] text-gray-400 font-medium tracking-wide uppercase">Arraste e redimensione os elementos</span>

              <!-- Card canvas -->
              <div
                ref="canvasRef"
                class="relative shadow-xl transition-all duration-200"
                :style="{
                  width: canvasWidth + 'px',
                  height: canvasHeight + 'px',
                  background: cardStyle.bg || '#ffffff',
                  borderRadius: cardStyle.borderRadius || '8px',
                  border: cardStyle.border || '1px solid #e5e7eb',
                  boxShadow: cardStyle.boxShadow || '0 4px 24px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                }"
                @click.stop="selectElement(null)"
              >
                <!-- Grid de referencia sutil -->
                <div class="absolute inset-0 pointer-events-none opacity-[0.04]" style="background-image: linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px); background-size: 10% 10%;" />

                <!-- Elementos arrastáveis -->
                <div
                  v-for="el in elements" :key="el.id"
                  class="absolute select-none"
                  :class="[
                    isDragging || isResizing ? '' : 'transition-[left,top,width,height] duration-75',
                  ]"
                  :style="{
                    left: el.x || '0%',
                    top: el.y || '0%',
                    width: el.w || '100%',
                    height: el.h || '20%',
                    zIndex: el.zIndex || (el.type === 'image' ? 1 : el.type === 'shape' ? 0 : 3),
                    cursor: isDragging ? 'grabbing' : 'grab',
                  }"
                  @pointerdown="startDrag(el.id, $event)"
                  @click.stop="selectElement(el.id)"
                >
                  <!-- Conteudo visual do elemento -->
                  <div
                    class="w-full h-full flex items-center justify-center overflow-hidden text-[10px] font-medium"
                    :style="{
                      background: el.bg || (el.type === 'shape' ? '#e5e7eb' : 'transparent'),
                      borderRadius: el.borderRadius || '0',
                      opacity: el.opacity ?? 1,
                      border: selectedElementId === el.id
                        ? `2px solid ${elMeta[el.type]?.color || '#3b82f6'}`
                        : `1px dashed ${elMeta[el.type]?.border || '#d1d5db'}`,
                    }"
                  >
                    <!-- Preview do tipo -->
                    <div v-if="el.type === 'text'" class="text-center px-1" :style="{ fontWeight: el.fontWeight || 800, textTransform: (el.textTransform || 'uppercase') as any, color: el.color || '#1f2937', textAlign: (el.textAlign || 'center') as any }">
                      NOME PRODUTO
                    </div>
                    <div v-else-if="el.type === 'image'" class="flex flex-col items-center justify-center text-gray-300 gap-0.5">
                      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span class="text-[8px]">Imagem</span>
                    </div>
                    <div v-else-if="el.type === 'price'" class="text-red-500 font-black text-sm">
                      R$ 49,90
                    </div>
                    <div v-else-if="el.type === 'badge'" class="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                      OFERTA
                    </div>
                    <div v-else-if="el.type === 'unit'" class="text-gray-400 text-[8px]">KG</div>
                    <div v-else-if="el.type === 'observation'" class="text-gray-400 text-[8px]">Obs texto</div>
                    <div v-else class="w-full h-full" :style="{ background: el.bg || '#e5e7eb' }" />
                  </div>

                  <!-- Label do tipo -->
                  <span
                    v-if="selectedElementId === el.id"
                    class="absolute -top-4 left-0 text-[8px] font-bold px-1 rounded-sm"
                    :style="{ background: elMeta[el.type]?.color, color: '#fff' }"
                  >
                    {{ elMeta[el.type]?.label }}
                  </span>

                  <!-- Resize handles -->
                  <template v-if="selectedElementId === el.id">
                    <div
                      v-for="h in HANDLES" :key="h"
                      class="absolute w-2 h-2 bg-white border-2 rounded-full z-10"
                      :style="`${handlePos[h]} cursor: ${handleCursor[h]}; border-color: ${elMeta[el.type]?.color || '#3b82f6'};`"
                      @pointerdown.stop="startResize(el.id, h, $event)"
                    />
                  </template>
                </div>
              </div>

              <!-- Info -->
              <div class="text-[10px] text-gray-400 flex gap-4">
                <span>Setas: mover 1%</span>
                <span>Delete: remover</span>
                <span>Esc: deselecionar</span>
              </div>
            </div>
          </div>

          <!-- ══ PAINEL DIREITO ══ -->
          <div class="w-64 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">

            <!-- Nada selecionado: card style -->
            <template v-if="!selectedElement">
              <div class="p-4 border-b border-gray-100">
                <p class="text-xs font-bold text-gray-800 mb-3">Aparencia do Card</p>
                <div class="space-y-2.5">
                  <label class="flex items-center gap-2">
                    <span class="text-[11px] text-gray-500 w-14">Fundo</span>
                    <input type="color" :value="cardStyle.bg || '#ffffff'" @input="cardStyle.bg = ($event.target as HTMLInputElement).value" class="w-6 h-6 rounded cursor-pointer border border-gray-200" />
                    <input :value="cardStyle.bg || '#ffffff'" @input="cardStyle.bg = ($event.target as HTMLInputElement).value" class="flex-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                  </label>
                  <label class="flex items-center gap-2">
                    <span class="text-[11px] text-gray-500 w-14">Borda</span>
                    <input :value="cardStyle.border || 'none'" @input="cardStyle.border = ($event.target as HTMLInputElement).value" class="flex-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                  </label>
                  <label class="flex items-center gap-2">
                    <span class="text-[11px] text-gray-500 w-14">Raio</span>
                    <input :value="cardStyle.borderRadius || '8px'" @input="cardStyle.borderRadius = ($event.target as HTMLInputElement).value" class="flex-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                  </label>
                </div>
              </div>

              <!-- Lista de camadas -->
              <div class="p-4">
                <p class="text-xs font-bold text-gray-800 mb-2">Camadas</p>
                <div class="space-y-1">
                  <div
                    v-for="el in elements" :key="el.id"
                    @click="selectElement(el.id)"
                    class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                  >
                    <span class="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white" :style="{ background: elMeta[el.type]?.color }">{{ elMeta[el.type]?.icon }}</span>
                    <span class="flex-1 text-gray-700">{{ elMeta[el.type]?.label }}</span>
                    <span class="text-[9px] text-gray-400">{{ el.w }} x {{ el.h }}</span>
                    <button @click.stop="removeElement(el.id)" class="text-gray-300 hover:text-red-500 text-sm leading-none">&times;</button>
                  </div>
                  <p v-if="!elements.length" class="text-xs text-gray-400 text-center py-4">Adicione elementos pelo botao + Elemento</p>
                </div>
              </div>
            </template>

            <!-- Elemento selecionado -->
            <template v-else>
              <div class="p-4 border-b border-gray-100">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white" :style="{ background: elMeta[selectedElement.type]?.color }">{{ elMeta[selectedElement.type]?.icon }}</span>
                    <span class="text-sm font-bold text-gray-800">{{ elMeta[selectedElement.type]?.label }}</span>
                  </div>
                  <button @click="selectElement(null)" class="text-xs text-gray-400 hover:text-gray-600">&times; Fechar</button>
                </div>

                <!-- Posicao e tamanho -->
                <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Posicao e Tamanho</p>
                <div class="grid grid-cols-2 gap-2 mb-3">
                  <label>
                    <span class="text-[10px] text-gray-500">X</span>
                    <div class="flex items-center gap-1">
                      <input type="number" :value="pct(selectedElement.x)" @input="updateSelectedElement({ x: ($event.target as HTMLInputElement).value + '%' })" class="w-full text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" min="0" max="100" />
                      <span class="text-[10px] text-gray-400">%</span>
                    </div>
                  </label>
                  <label>
                    <span class="text-[10px] text-gray-500">Y</span>
                    <div class="flex items-center gap-1">
                      <input type="number" :value="pct(selectedElement.y)" @input="updateSelectedElement({ y: ($event.target as HTMLInputElement).value + '%' })" class="w-full text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" min="0" max="100" />
                      <span class="text-[10px] text-gray-400">%</span>
                    </div>
                  </label>
                  <label>
                    <span class="text-[10px] text-gray-500">Largura</span>
                    <div class="flex items-center gap-1">
                      <input type="number" :value="pct(selectedElement.w)" @input="updateSelectedElement({ w: ($event.target as HTMLInputElement).value + '%' })" class="w-full text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" min="2" max="100" />
                      <span class="text-[10px] text-gray-400">%</span>
                    </div>
                  </label>
                  <label>
                    <span class="text-[10px] text-gray-500">Altura</span>
                    <div class="flex items-center gap-1">
                      <input type="number" :value="pct(selectedElement.h)" @input="updateSelectedElement({ h: ($event.target as HTMLInputElement).value + '%' })" class="w-full text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" min="2" max="100" />
                      <span class="text-[10px] text-gray-400">%</span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Propriedades por tipo -->
              <div class="p-4 space-y-3">

                <!-- TEXTO -->
                <template v-if="selectedElement.type === 'text'">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase">Texto</p>

                  <!-- Tamanho da fonte -->
                  <label class="block">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-gray-500">Tamanho da fonte</span>
                      <span class="text-[10px] text-blue-500 font-medium">{{ selectedElement.fontSize || 'Auto' }}</span>
                    </div>
                    <div class="flex gap-1 mt-0.5">
                      <input
                        type="range" min="0" max="60" step="1"
                        :value="parseInt(selectedElement.fontSize || '0')"
                        @input="updateSelectedElement({ fontSize: parseInt(($event.target as HTMLInputElement).value) > 0 ? ($event.target as HTMLInputElement).value + 'px' : undefined })"
                        class="flex-1 accent-blue-500"
                      />
                      <button @click="updateSelectedElement({ fontSize: undefined })" class="text-[9px] text-gray-400 hover:text-red-500 px-1">Auto</button>
                    </div>
                    <p class="text-[9px] text-gray-400 mt-0.5">0 = automatico (ajusta por qtd de produtos)</p>
                  </label>

                  <label class="block">
                    <span class="text-[10px] text-gray-500">Peso da fonte</span>
                    <select :value="selectedElement.fontWeight || 800" @change="updateSelectedElement({ fontWeight: parseInt(($event.target as HTMLSelectElement).value) })" class="w-full text-xs bg-gray-50 rounded px-2 py-1.5 border border-gray-200 outline-none mt-0.5">
                      <option :value="400">Normal</option><option :value="600">Semibold</option><option :value="700">Bold</option><option :value="800">Extra Bold</option><option :value="900">Black</option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="text-[10px] text-gray-500">Alinhamento</span>
                    <div class="flex gap-1 mt-0.5">
                      <button v-for="a in ['left','center','right']" :key="a" @click="updateSelectedElement({ textAlign: a })" :class="['flex-1 py-1 rounded text-xs border', selectedElement.textAlign === a ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500']">
                        {{ a === 'left' ? '←' : a === 'right' ? '→' : '↔' }}
                      </button>
                    </div>
                  </label>
                  <label class="block">
                    <span class="text-[10px] text-gray-500">Transformacao</span>
                    <select :value="selectedElement.textTransform || 'uppercase'" @change="updateSelectedElement({ textTransform: ($event.target as HTMLSelectElement).value })" class="w-full text-xs bg-gray-50 rounded px-2 py-1.5 border border-gray-200 outline-none mt-0.5">
                      <option value="uppercase">MAIUSCULAS</option><option value="capitalize">Capitalizar</option><option value="none">Normal</option>
                    </select>
                  </label>
                  <label class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500">Cor</span>
                    <input type="color" :value="selectedElement.color || '#000000'" @input="updateSelectedElement({ color: ($event.target as HTMLInputElement).value })" class="w-5 h-5 rounded cursor-pointer border border-gray-200" />
                  </label>
                  <label class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500">Fundo</span>
                    <input :value="selectedElement.bg || ''" @input="updateSelectedElement({ bg: ($event.target as HTMLInputElement).value || undefined })" placeholder="transparente" class="flex-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                  </label>
                </template>

                <!-- IMAGEM -->
                <template v-if="selectedElement.type === 'image'">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase">Imagem</p>
                  <label class="block">
                    <span class="text-[10px] text-gray-500">Ajuste</span>
                    <select :value="selectedElement.objectFit || 'contain'" @change="updateSelectedElement({ objectFit: ($event.target as HTMLSelectElement).value })" class="w-full text-xs bg-gray-50 rounded px-2 py-1.5 border border-gray-200 outline-none mt-0.5">
                      <option value="contain">Contain (inteira)</option><option value="cover">Cover (preenche)</option>
                    </select>
                  </label>
                  <label class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500">Borda arredondada</span>
                    <input :value="selectedElement.borderRadius || ''" @input="updateSelectedElement({ borderRadius: ($event.target as HTMLInputElement).value || undefined })" placeholder="0 ou 50%" class="flex-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                  </label>
                </template>

                <!-- PRECO -->
                <template v-if="selectedElement.type === 'price'">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase">Etiqueta de Preco</p>

                  <!-- Escala da etiqueta -->
                  <label class="block">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] text-gray-500">Tamanho da etiqueta</span>
                      <span class="text-[10px] text-red-500 font-medium">{{ (selectedElement.fontScale || 1).toFixed(1) }}x</span>
                    </div>
                    <input
                      type="range" min="0.3" max="3" step="0.1"
                      :value="selectedElement.fontScale || 1"
                      @input="updateSelectedElement({ fontScale: parseFloat(($event.target as HTMLInputElement).value) })"
                      class="w-full accent-red-500 mt-0.5"
                    />
                    <div class="flex justify-between text-[8px] text-gray-400 mt-0.5">
                      <span>Pequena</span><span>Normal</span><span>Grande</span>
                    </div>
                  </label>

                  <label class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500">Fundo</span>
                    <input :value="selectedElement.bg || ''" @input="updateSelectedElement({ bg: ($event.target as HTMLInputElement).value || undefined })" placeholder="transparente" class="flex-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                  </label>
                  <label class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500">Borda</span>
                    <input :value="selectedElement.borderRadius || ''" @input="updateSelectedElement({ borderRadius: ($event.target as HTMLInputElement).value || undefined })" placeholder="8px" class="flex-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                  </label>
                </template>

                <!-- SHAPE -->
                <template v-if="selectedElement.type === 'shape'">
                  <p class="text-[10px] font-semibold text-gray-400 uppercase">Forma Decorativa</p>
                  <label class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500">Cor/Gradient</span>
                    <input :value="selectedElement.bg || ''" @input="updateSelectedElement({ bg: ($event.target as HTMLInputElement).value || undefined })" placeholder="#ccc ou gradient" class="flex-1 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                  </label>
                  <label class="flex items-center gap-2">
                    <span class="text-[10px] text-gray-500">Opacidade</span>
                    <input type="range" min="0" max="1" step="0.1" :value="selectedElement.opacity ?? 1" @input="updateSelectedElement({ opacity: parseFloat(($event.target as HTMLInputElement).value) })" class="flex-1 accent-pink-500" />
                    <span class="text-[10px] text-gray-400 w-6">{{ selectedElement.opacity ?? 1 }}</span>
                  </label>
                </template>

                <!-- Z-Index (todos) -->
                <label class="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <span class="text-[10px] text-gray-500">z-Index</span>
                  <input type="number" :value="selectedElement.zIndex || 2" @input="updateSelectedElement({ zIndex: parseInt(($event.target as HTMLInputElement).value) || 2 })" class="w-16 text-xs bg-gray-50 rounded px-2 py-1 border border-gray-200 outline-none" />
                </label>

                <!-- Acoes -->
                <div class="flex gap-2 pt-2 border-t border-gray-100">
                  <button @click="duplicateElement(selectedElement.id)" class="flex-1 text-xs py-1.5 rounded bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100">Duplicar</button>
                  <button @click="removeElement(selectedElement.id)" class="flex-1 text-xs py-1.5 rounded bg-red-50 border border-red-200 text-red-600 hover:bg-red-100">Remover</button>
                </div>
              </div>
            </template>
          </div>

          <!-- ══ PREVIEW AO VIVO — formato real ══ -->
          <div v-if="showPreview" class="w-80 shrink-0 bg-gray-50 border-l border-gray-200 flex flex-col overflow-hidden">
            <div class="h-9 flex items-center justify-between px-3 border-b border-gray-200 shrink-0">
              <span class="text-[10px] text-gray-400 font-medium">{{ activeFormat.label }} {{ activeFormat.desc }}</span>
              <div class="flex gap-1">
                <button v-for="m in ['1', '2x2', '3x3']" :key="m" @click="previewMode = m as any" :class="['px-2.5 py-0.5 rounded text-[10px] font-medium', previewMode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']">{{ m }}</button>
              </div>
            </div>
            <div class="flex-1 flex items-center justify-center p-3 overflow-auto">
              <!-- 1 produto — proporcao real do formato -->
              <div v-if="previewMode === '1'" class="rounded-lg overflow-hidden shadow-lg" :style="{ width: pvSingle.w + 'px', height: pvSingle.h + 'px' }">
                <BuilderDynamicCard :product="previewProducts[0]" :template="liveTemplate" :columns="1" :page-product-count="1" />
              </div>
              <!-- 2x2 — proporcao real do formato -->
              <div v-else-if="previewMode === '2x2'" class="shadow-lg" :style="{ width: pvGrid.w + 'px', height: pvGrid.h + 'px', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '2px', background: '#e5e7eb', borderRadius: '8px', padding: '2px' }">
                <div v-for="i in 4" :key="i" style="overflow: hidden; border-radius: 4px">
                  <BuilderDynamicCard :product="previewProducts[i - 1]" :template="liveTemplate" :columns="2" :page-product-count="4" />
                </div>
              </div>
              <!-- 3x3 — proporcao real do formato -->
              <div v-else class="shadow-lg" :style="{ width: pvGrid.w + 'px', height: pvGrid.h + 'px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', gap: '2px', background: '#e5e7eb', borderRadius: '8px', padding: '2px' }">
                <div v-for="i in 9" :key="i" style="overflow: hidden; border-radius: 3px">
                  <BuilderDynamicCard :product="previewProducts[i - 1]" :template="liveTemplate" :columns="3" :page-product-count="9" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </template>
  </div>
</template>
