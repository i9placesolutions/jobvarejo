<script setup lang="ts">
import type { CardTemplateElement, CardTemplateStyle } from '~/types/builder'

definePageMeta({ layout: false, middleware: ['auth', 'admin'], ssr: false })
const { getApiAuthHeaders } = useApiAuth()

type CardTemplate = {
  id: string; name: string; thumbnail: string | null; category: string
  elements: CardTemplateElement[]; card_style: CardTemplateStyle
  is_active: boolean; sort_order: number
}

const items = ref<CardTemplate[]>([])
const isLoading = ref(false)
const error = ref('')
const editingId = ref<string | null>(null)
const mode = ref<'list' | 'editor'>('list')

// ── Form ──
const formName = ref('')
const formCategory = ref('geral')
const formIsActive = ref(true)
const formSortOrder = ref(0)

// ── Card style ──
const cardStyle = ref<CardTemplateStyle>({
  bg: '#ffffff', borderRadius: '8px', overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: 'none', padding: '4%',
  direction: 'column', imagePosition: 'top', imageSize: '55%', gap: '2px',
})

// ── Elementos ──
const elements = ref<CardTemplateElement[]>([])
const showJsonEditor = ref(false)
const jsonText = ref('')

const categories = ['geral', 'basico', 'compacto', 'destaque', 'moderno', 'tradicional', 'premium']

// ── Presets rapidos ──
const PRESETS: Record<string, { style: Partial<CardTemplateStyle>; elements: Partial<CardTemplateElement>[] }> = {
  'Classico (Nome/Imagem/Preco)': {
    style: { direction: 'column', imagePosition: 'top', imageSize: '55%', padding: '4%' },
    elements: [
      { id: 'name', type: 'text', slot: 'product_name', order: 0, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase' },
      { id: 'img', type: 'image', slot: 'product_image', order: 1, objectFit: 'contain' },
      { id: 'price', type: 'price', slot: 'offer_price', order: 2 },
      { id: 'unit', type: 'unit', slot: 'unit', order: 3, showIf: 'has_value' },
    ],
  },
  'Lateral (Imagem Esquerda)': {
    style: { direction: 'row', imagePosition: 'left', imageSize: '40%', padding: '3%' },
    elements: [
      { id: 'img', type: 'image', slot: 'product_image', order: 0, objectFit: 'contain' },
      { id: 'name', type: 'text', slot: 'product_name', order: 1, fontWeight: 700, textAlign: 'left', textTransform: 'uppercase' },
      { id: 'price', type: 'price', slot: 'offer_price', order: 2 },
      { id: 'obs', type: 'observation', slot: 'observation', order: 3, showIf: 'has_value' },
    ],
  },
  'Premium (Imagem Grande)': {
    style: { direction: 'column', imagePosition: 'top', imageSize: '65%', padding: '3%', gap: '0' },
    elements: [
      { id: 'img', type: 'image', slot: 'product_image', order: 0, objectFit: 'cover' },
      { id: 'name', type: 'text', slot: 'product_name', order: 1, fontWeight: 800, textAlign: 'left' },
      { id: 'price', type: 'price', slot: 'offer_price', order: 2 },
    ],
  },
  'Vitrine (Imagem + Overlay Escuro)': {
    style: { direction: 'column', imagePosition: 'top', imageSize: '70%', padding: '0', bg: '#111', gap: '0' },
    elements: [
      { id: 'img', type: 'image', slot: 'product_image', order: 0, objectFit: 'cover' },
      { id: 'gradient', type: 'shape', slot: '', x: '0%', y: '45%', w: '100%', h: '25%', bg: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.9))' },
      { id: 'name', type: 'text', slot: 'product_name', order: 1, fontWeight: 800, textAlign: 'center', color: '#ffffff' },
      { id: 'price', type: 'price', slot: 'offer_price', order: 2, bg: 'rgba(0,0,0,0.5)' },
    ],
  },
  'Etiqueta (Horizontal Compacta)': {
    style: { direction: 'row', imagePosition: 'left', imageSize: '22%', padding: '2%', border: '2px solid #E53935' },
    elements: [
      { id: 'img', type: 'image', slot: 'product_image', order: 0, objectFit: 'contain' },
      { id: 'name', type: 'text', slot: 'product_name', order: 1, fontWeight: 700, textAlign: 'left', textTransform: 'uppercase' },
      { id: 'obs', type: 'observation', slot: 'observation', order: 2, showIf: 'has_value' },
      { id: 'price', type: 'price', slot: 'offer_price', order: 3 },
      { id: 'unit', type: 'unit', slot: 'unit', order: 4, showIf: 'has_value' },
    ],
  },
  'Dark (Fundo Escuro + Neon)': {
    style: { direction: 'column', imagePosition: 'top', imageSize: '55%', padding: '4%', bg: '#1a1a2e', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },
    elements: [
      { id: 'img', type: 'image', slot: 'product_image', order: 0, objectFit: 'contain' },
      { id: 'name', type: 'text', slot: 'product_name', order: 1, fontWeight: 800, textAlign: 'center', color: '#ffffff' },
      { id: 'price', type: 'price', slot: 'offer_price', order: 2, color: '#00E5FF' },
    ],
  },
  'Minimalista': {
    style: { direction: 'column', imagePosition: 'top', imageSize: '50%', padding: '8%', bg: '#fafafa', borderRadius: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: 'none' },
    elements: [
      { id: 'img', type: 'image', slot: 'product_image', order: 0, objectFit: 'contain' },
      { id: 'name', type: 'text', slot: 'product_name', order: 1, fontWeight: 600, textAlign: 'center' },
      { id: 'price', type: 'price', slot: 'offer_price', order: 2 },
    ],
  },
  'Splash Promocional': {
    style: { direction: 'column', imagePosition: 'top', imageSize: '50%', padding: '4%', bg: '#E53935', borderRadius: '12px', boxShadow: '0 4px 12px rgba(229,57,53,0.3)' },
    elements: [
      { id: 'badge', type: 'badge', slot: 'badge', showIf: 'has_value', x: '60%', y: '0%' },
      { id: 'name', type: 'text', slot: 'product_name', order: 0, fontWeight: 900, textAlign: 'center', color: '#ffffff' },
      { id: 'img', type: 'image', slot: 'product_image', order: 1, objectFit: 'contain' },
      { id: 'price', type: 'price', slot: 'offer_price', order: 2 },
    ],
  },
}

const applyPreset = (name: string) => {
  const p = PRESETS[name]
  if (!p) return
  cardStyle.value = { ...cardStyle.value, ...p.style }
  elements.value = p.elements.map(e => ({
    x: '0%', y: '0%', w: '100%', h: 'auto',
    ...e,
  } as CardTemplateElement))
  if (!formName.value) formName.value = name
}

const buildDefaultElements = (style: CardTemplateStyle): CardTemplateElement[] => {
  const direction = style.direction || 'column'
  const imagePosition = style.imagePosition || (direction === 'row' ? 'left' : 'top')

  if (direction === 'row') {
    if (imagePosition === 'right') {
      return [
        { id: 'name', type: 'text', slot: 'product_name', x: '0%', y: '0%', w: '100%', h: 'auto', order: 0, fontWeight: 800, textAlign: 'left', textTransform: 'uppercase' },
        { id: 'price', type: 'price', slot: 'offer_price', x: '0%', y: '0%', w: '100%', h: 'auto', order: 1 },
        { id: 'unit', type: 'unit', slot: 'unit', x: '0%', y: '0%', w: '100%', h: 'auto', order: 2, showIf: 'has_value' },
        { id: 'observation', type: 'observation', slot: 'observation', x: '0%', y: '0%', w: '100%', h: 'auto', order: 3, showIf: 'has_value' },
        { id: 'image', type: 'image', slot: 'product_image', x: '0%', y: '0%', w: '100%', h: 'auto', order: 4, objectFit: 'contain' },
      ] as CardTemplateElement[]
    }
    return [
      { id: 'image', type: 'image', slot: 'product_image', x: '0%', y: '0%', w: '100%', h: 'auto', order: 0, objectFit: 'contain' },
      { id: 'name', type: 'text', slot: 'product_name', x: '0%', y: '0%', w: '100%', h: 'auto', order: 1, fontWeight: 800, textAlign: 'left', textTransform: 'uppercase' },
      { id: 'price', type: 'price', slot: 'offer_price', x: '0%', y: '0%', w: '100%', h: 'auto', order: 2 },
      { id: 'unit', type: 'unit', slot: 'unit', x: '0%', y: '0%', w: '100%', h: 'auto', order: 3, showIf: 'has_value' },
      { id: 'observation', type: 'observation', slot: 'observation', x: '0%', y: '0%', w: '100%', h: 'auto', order: 4, showIf: 'has_value' },
    ] as CardTemplateElement[]
  }

  if (imagePosition === 'bottom') {
    return [
      { id: 'name', type: 'text', slot: 'product_name', x: '0%', y: '0%', w: '100%', h: 'auto', order: 0, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase' },
      { id: 'price', type: 'price', slot: 'offer_price', x: '0%', y: '0%', w: '100%', h: 'auto', order: 1 },
      { id: 'unit', type: 'unit', slot: 'unit', x: '0%', y: '0%', w: '100%', h: 'auto', order: 2, showIf: 'has_value' },
      { id: 'observation', type: 'observation', slot: 'observation', x: '0%', y: '0%', w: '100%', h: 'auto', order: 3, showIf: 'has_value' },
      { id: 'image', type: 'image', slot: 'product_image', x: '0%', y: '0%', w: '100%', h: 'auto', order: 4, objectFit: 'contain' },
    ] as CardTemplateElement[]
  }

  return [
    { id: 'name', type: 'text', slot: 'product_name', x: '0%', y: '0%', w: '100%', h: 'auto', order: 0, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase' },
    { id: 'image', type: 'image', slot: 'product_image', x: '0%', y: '0%', w: '100%', h: 'auto', order: 1, objectFit: 'contain' },
    { id: 'price', type: 'price', slot: 'offer_price', x: '0%', y: '0%', w: '100%', h: 'auto', order: 2 },
    { id: 'unit', type: 'unit', slot: 'unit', x: '0%', y: '0%', w: '100%', h: 'auto', order: 3, showIf: 'has_value' },
    { id: 'observation', type: 'observation', slot: 'observation', x: '0%', y: '0%', w: '100%', h: 'auto', order: 4, showIf: 'has_value' },
  ] as CardTemplateElement[]
}

// ── CRUD ──
const fetchData = async () => {
  isLoading.value = true; error.value = ''
  try {
    const data = await $fetch<any>('/api/admin/builder/card-templates', { headers: await getApiAuthHeaders() })
    items.value = (Array.isArray(data) ? data : data?.cardTemplates ?? [])
  } catch (err: any) { error.value = err.message || 'Erro ao carregar' }
  finally { isLoading.value = false }
}

const saveItem = async () => {
  error.value = ''
  try {
    const normalizedElements = elements.value.length
      ? elements.value
      : buildDefaultElements(cardStyle.value)
    const payload = {
      name: formName.value.trim(), category: formCategory.value,
      elements: normalizedElements, card_style: cardStyle.value,
      is_active: formIsActive.value, sort_order: formSortOrder.value,
    }
    if (!payload.name) throw new Error('Nome e obrigatorio')
    if (editingId.value) {
      await $fetch(`/api/admin/builder/card-templates/${editingId.value}`, { method: 'PUT', body: payload, headers: await getApiAuthHeaders() })
    } else {
      await $fetch('/api/admin/builder/card-templates', { method: 'POST', body: payload, headers: await getApiAuthHeaders() })
    }
    mode.value = 'list'; await fetchData()
  } catch (err: any) { error.value = err.message || 'Erro ao salvar' }
}

const deleteItem = async (id: string) => {
  if (!confirm('Excluir este template?')) return
  try { await $fetch(`/api/admin/builder/card-templates/${id}`, { method: 'DELETE', headers: await getApiAuthHeaders() }); await fetchData() }
  catch (err: any) { error.value = err.message || 'Erro ao excluir' }
}

const openEditor = (item?: CardTemplate) => {
  if (item) {
    editingId.value = item.id; formName.value = item.name; formCategory.value = item.category || 'geral'
    formSortOrder.value = item.sort_order; formIsActive.value = item.is_active
    cardStyle.value = { direction: 'column', imagePosition: 'top', imageSize: '55%', gap: '2px', padding: '4%', bg: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: 'none', ...item.card_style }
    elements.value = (item.elements || []).map(e => ({ ...e }))
  } else {
    editingId.value = null; formName.value = ''; formCategory.value = 'geral'
    formSortOrder.value = 0; formIsActive.value = true
    cardStyle.value = { bg: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: 'none', padding: '4%', direction: 'column', imagePosition: 'top', imageSize: '55%', gap: '2px' }
    elements.value = []
  }
  mode.value = 'editor'; showJsonEditor.value = false
}

const openJson = () => {
  jsonText.value = JSON.stringify({ card_style: cardStyle.value, elements: elements.value }, null, 2)
  showJsonEditor.value = true
}

const applyJson = () => {
  try {
    const parsed = JSON.parse(jsonText.value)
    if (parsed.card_style) cardStyle.value = { ...cardStyle.value, ...parsed.card_style }
    if (parsed.elements) elements.value = parsed.elements
    showJsonEditor.value = false
  } catch { error.value = 'JSON invalido' }
}

// ── Elementos ──
const addElement = (type: string, slot: string) => {
  elements.value.push({
    id: crypto.randomUUID().slice(0, 8), type: type as any, slot,
    x: '0%', y: '0%', w: '100%', h: 'auto',
    order: elements.value.length,
    fontWeight: type === 'text' ? 800 : undefined,
    textAlign: 'center',
    textTransform: type === 'text' ? 'uppercase' : undefined,
    showIf: slot ? 'has_value' : 'always',
  } as CardTemplateElement)
}
const removeElement = (id: string) => { elements.value = elements.value.filter(e => e.id !== id) }
const moveEl = (idx: number, dir: number) => {
  const n = idx + dir; if (n < 0 || n >= elements.value.length) return
  const c = [...elements.value]; [c[idx], c[n]] = [c[n]!, c[idx]!]; elements.value = c
}

// Produtos mock para preview real com BuilderDynamicCard
const mockImg = '/img/placeholder-product.svg'
const mkProduct = (id: string, name: string, price: number, unit = 'UN', obs = '', badge = '') => ({
  id, flyer_id: '', product_id: null, custom_name: name, custom_image: mockImg,
  offer_price: price, original_price: null, price_mode: 'simple' as const, unit, observation: obs,
  badge_style_id: badge, is_highlight: false, is_adult: false, sort_order: Number(id),
  colspan: 1, image_zoom: 100, image_x: 50, image_y: 50, extra_images: [] as string[], extra_images_layout: null,
  position: Number(id), purchase_limit: null, take_quantity: null, pay_quantity: null,
  installment_count: null, installment_price: null, no_interest: false, club_name: null,
  anticipation_text: null, show_discount: false, quantity_unit: null, price_label: null,
  tag_style_id: null, highlight_color: null,
} as any)
const MOCK_PRODUCTS = [
  mkProduct('1', 'PICANHA BOVINA KG', 49.90, 'KG', '', 'OFERTA'),
  mkProduct('2', 'ARROZ CRISTAL 5KG', 22.99),
  mkProduct('3', 'FEIJAO CARIOCA 1KG', 8.49),
  mkProduct('4', 'OLEO SOJA 900ML', 6.99),
  mkProduct('5', 'LEITE INTEGRAL 1LT', 5.49),
  mkProduct('6', 'CAFE MELITTA 500G', 18.90),
  mkProduct('7', 'ACUCAR CRISTAL 1KG', 4.99),
  mkProduct('8', 'FARINHA DE TRIGO 1KG', 3.99),
  mkProduct('9', 'SAL REFINADO 1KG', 2.49),
]

// Controle do preview
const previewMode = ref<'single' | '2x2' | '3x3'>('2x2')

// Template reativo para preview
const liveTemplate = computed<import('~/types/builder').BuilderCardTemplate>(() => ({
  id: editingId.value || 'preview',
  name: formName.value || 'Preview',
  thumbnail: null,
  category: formCategory.value,
  elements: elements.value.length ? elements.value : buildDefaultElements(cardStyle.value),
  card_style: cardStyle.value,
  is_active: true,
  sort_order: 0,
}))

onMounted(fetchData)
</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <!-- LISTA -->
    <template v-if="mode === 'list'">
      <div class="p-6 max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Card Templates</h1>
            <p class="text-sm text-gray-500 mt-1">Templates visuais de produto. Crie layouts, o cliente apenas escolhe.</p>
          </div>
          <div class="flex gap-2">
            <NuxtLink to="/admin/builder" class="px-4 py-2 rounded-lg text-sm bg-gray-200 text-gray-700 hover:bg-gray-300">Voltar</NuxtLink>
            <button @click="openEditor()" class="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 font-medium">+ Novo Template</button>
          </div>
        </div>

        <div v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{{ error }}</div>
        <div v-if="isLoading" class="text-center py-12 text-gray-400">Carregando...</div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <div v-for="item in items" :key="item.id" class="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all group cursor-pointer" @click="openEditor(item)">
            <!-- Preview mini -->
            <div class="bg-gray-100 p-4 flex items-center justify-center" style="aspect-ratio: 3/4">
              <div class="w-full h-full rounded-lg flex flex-col items-center justify-center text-center p-2" :style="{ background: item.card_style?.bg || '#fff', borderRadius: item.card_style?.borderRadius || '8px', border: item.card_style?.border || 'none' }">
                <div class="w-12 h-12 bg-gray-200 rounded mb-2" />
                <div class="w-16 h-2 bg-gray-300 rounded mb-1" />
                <div class="w-10 h-3 bg-red-200 rounded" />
              </div>
            </div>
            <div class="p-3">
              <span class="font-medium text-sm text-gray-900 truncate block">{{ item.name }}</span>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[10px] text-gray-400">{{ item.category }}</span>
                <span :class="item.is_active ? 'text-emerald-600' : 'text-gray-400'" class="text-[10px]">{{ item.is_active ? 'Ativo' : 'Off' }}</span>
              </div>
              <div class="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                <button @click="openEditor(item)" class="text-[10px] text-blue-600">Editar</button>
                <button @click="deleteItem(item.id)" class="text-[10px] text-red-500">Excluir</button>
              </div>
            </div>
          </div>
          <button @click="openEditor()" class="rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-emerald-500" style="aspect-ratio: 3/5">
            <span class="text-3xl">+</span><span class="text-xs">Novo</span>
          </button>
        </div>
      </div>
    </template>

    <!-- EDITOR -->
    <template v-else>
      <div class="h-screen flex flex-col overflow-hidden">
        <!-- Top bar -->
        <header class="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
          <button @click="mode = 'list'" class="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
          <div class="w-px h-6 bg-gray-200" />
          <input v-model="formName" placeholder="Nome do template" class="text-sm font-medium text-gray-900 bg-transparent outline-none flex-1" />
          <select v-model="formCategory" class="text-xs bg-gray-100 rounded px-2 py-1 border border-gray-200">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <label class="flex items-center gap-1.5 text-xs text-gray-500">
            <input v-model="formIsActive" type="checkbox" class="rounded accent-emerald-500" /> Ativo
          </label>
          <button @click="openJson" class="px-3 py-1 rounded text-xs bg-gray-100 hover:bg-gray-200 text-gray-600">JSON</button>
          <div v-if="error" class="text-xs text-red-500 truncate max-w-40">{{ error }}</div>
          <button @click="saveItem" class="px-4 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 font-medium">Salvar</button>
        </header>

        <div class="flex-1 flex min-h-0 overflow-hidden">
          <!-- SIDEBAR ESQUERDA -->
          <div class="w-60 shrink-0 bg-white border-r border-gray-200 overflow-y-auto">
            <!-- Presets -->
            <div class="p-3 border-b border-gray-100">
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Presets (ponto de partida)</p>
              <div class="space-y-1">
                <button v-for="(_, name) in PRESETS" :key="name" @click="applyPreset(name)" class="w-full text-left px-2 py-1.5 rounded text-[10px] bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 border border-gray-100 hover:border-emerald-200 transition-all truncate">
                  {{ name }}
                </button>
              </div>
            </div>

            <!-- Adicionar elemento -->
            <div class="p-3 border-b border-gray-100">
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Adicionar</p>
              <div class="grid grid-cols-2 gap-1">
                <button @click="addElement('text', 'product_name')" class="px-2 py-1 rounded text-[10px] bg-gray-50 hover:bg-blue-50 text-gray-600 border border-gray-100">📝 Nome</button>
                <button @click="addElement('image', 'product_image')" class="px-2 py-1 rounded text-[10px] bg-gray-50 hover:bg-blue-50 text-gray-600 border border-gray-100">🖼️ Imagem</button>
                <button @click="addElement('price', 'offer_price')" class="px-2 py-1 rounded text-[10px] bg-gray-50 hover:bg-blue-50 text-gray-600 border border-gray-100">💰 Preco</button>
                <button @click="addElement('badge', 'badge')" class="px-2 py-1 rounded text-[10px] bg-gray-50 hover:bg-blue-50 text-gray-600 border border-gray-100">🏷️ Selo</button>
                <button @click="addElement('unit', 'unit')" class="px-2 py-1 rounded text-[10px] bg-gray-50 hover:bg-blue-50 text-gray-600 border border-gray-100">⚖️ Unidade</button>
                <button @click="addElement('observation', 'observation')" class="px-2 py-1 rounded text-[10px] bg-gray-50 hover:bg-blue-50 text-gray-600 border border-gray-100">💬 Obs</button>
                <button @click="addElement('shape', '')" class="px-2 py-1 rounded text-[10px] bg-gray-50 hover:bg-blue-50 text-gray-600 border border-gray-100 col-span-2">🔶 Forma decorativa</button>
              </div>
            </div>

            <!-- Lista de elementos -->
            <div class="p-3">
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Elementos (ordem)</p>
              <div class="space-y-1">
                <div v-for="(el, idx) in elements" :key="el.id" class="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-gray-50 border border-gray-100">
                  <span class="flex-1 truncate text-gray-600">{{ el.type === 'text' ? '📝' : el.type === 'image' ? '🖼️' : el.type === 'price' ? '💰' : el.type === 'badge' ? '🏷️' : el.type === 'unit' ? '⚖️' : el.type === 'observation' ? '💬' : '🔶' }} {{ el.type }}</span>
                  <button @click="moveEl(idx, -1)" class="text-gray-300 hover:text-gray-600">↑</button>
                  <button @click="moveEl(idx, 1)" class="text-gray-300 hover:text-gray-600">↓</button>
                  <button @click="removeElement(el.id)" class="text-gray-300 hover:text-red-500">✕</button>
                </div>
                <p v-if="!elements.length" class="text-[10px] text-gray-300 text-center py-2">Use um preset ou adicione elementos</p>
              </div>
            </div>
          </div>

          <!-- CANVAS CENTRAL — preview REAL em tempo real -->
          <div class="flex-1 bg-gray-800 flex flex-col overflow-hidden">
            <!-- Barra de controle do preview -->
            <div class="h-10 bg-gray-900 border-b border-gray-700 flex items-center px-4 gap-3 shrink-0">
              <span class="text-[10px] text-gray-500 font-medium">PREVIEW</span>
              <div class="flex gap-1 ml-2">
                <button @click="previewMode = 'single'" :class="['px-3 py-1 rounded text-[10px] font-medium transition-all', previewMode === 'single' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white']">1 Produto</button>
                <button @click="previewMode = '2x2'" :class="['px-3 py-1 rounded text-[10px] font-medium transition-all', previewMode === '2x2' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white']">2x2</button>
                <button @click="previewMode = '3x3'" :class="['px-3 py-1 rounded text-[10px] font-medium transition-all', previewMode === '3x3' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white']">3x3</button>
              </div>
            </div>

            <!-- Area do preview -->
            <div class="flex-1 flex items-center justify-center p-6 overflow-auto">

              <!-- 1 produto grande -->
              <div v-if="previewMode === 'single'" style="width: 380px; height: 540px" class="shadow-2xl rounded-xl overflow-hidden">
                <BuilderDynamicCard
                  :product="MOCK_PRODUCTS[0]!"
                  :template="liveTemplate"
                  :columns="1"
                  :page-product-count="1"
                />
              </div>

              <!-- 2x2 -->
              <div v-else-if="previewMode === '2x2'" style="width: 520px; height: 680px; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 6px; background: #374151; border-radius: 14px; padding: 6px" class="shadow-2xl">
                <div v-for="(p, i) in MOCK_PRODUCTS.slice(0, 4)" :key="i" style="overflow: hidden; border-radius: 8px">
                  <BuilderDynamicCard
                    :product="p"
                    :template="liveTemplate"
                    :columns="2"
                    :page-product-count="4"
                  />
                </div>
              </div>

              <!-- 3x3 -->
              <div v-else style="width: 560px; height: 720px; display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; gap: 4px; background: #374151; border-radius: 14px; padding: 4px" class="shadow-2xl">
                <div v-for="(p, i) in MOCK_PRODUCTS.slice(0, 9)" :key="i" style="overflow: hidden; border-radius: 6px">
                  <BuilderDynamicCard
                    :product="p"
                    :template="liveTemplate"
                    :columns="3"
                    :page-product-count="9"
                  />
                </div>
              </div>

            </div>
          </div>

          <!-- SIDEBAR DIREITA (configuracoes) -->
          <div class="w-64 shrink-0 bg-white border-l border-gray-200 overflow-y-auto p-3 space-y-4">
            <div>
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Layout do Card</p>
              <!-- Direcao -->
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Direcao</span>
                <div class="flex gap-1 mt-1">
                  <button @click="cardStyle.direction = 'column'; cardStyle.imagePosition = 'top'" :class="['flex-1 py-1.5 rounded text-[10px] font-medium', cardStyle.direction === 'column' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400']">↕ Vertical</button>
                  <button @click="cardStyle.direction = 'row'; cardStyle.imagePosition = 'left'" :class="['flex-1 py-1.5 rounded text-[10px] font-medium', cardStyle.direction === 'row' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400']">↔ Horizontal</button>
                </div>
              </label>
              <!-- Posicao da imagem -->
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Posicao da imagem</span>
                <div class="flex gap-1 mt-1">
                  <button v-for="pos in (cardStyle.direction === 'row' ? ['left', 'right'] : ['top', 'bottom'])" :key="pos" @click="cardStyle.imagePosition = pos as any" :class="['flex-1 py-1 rounded text-[10px]', cardStyle.imagePosition === pos ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400']">
                    {{ pos === 'top' ? '⬆ Topo' : pos === 'bottom' ? '⬇ Base' : pos === 'left' ? '⬅ Esq' : '➡ Dir' }}
                  </button>
                </div>
              </label>
              <!-- Tamanho imagem -->
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Tamanho imagem</span><span class="text-[9px] text-gray-400">{{ cardStyle.imageSize }}</span></div>
                <input type="range" min="20" max="100" :value="parseInt(cardStyle.imageSize || '55')" @input="cardStyle.imageSize = ($event.target as HTMLInputElement).value + '%'" class="w-full mt-1 accent-emerald-500" />
              </label>
            </div>

            <!-- Aparencia -->
            <div>
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Aparencia</p>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Fundo</span>
                <input v-model="cardStyle.bg" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Borda</span>
                <input v-model="cardStyle.border" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Border Radius</span>
                <input v-model="cardStyle.borderRadius" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Sombra</span>
                <input v-model="cardStyle.boxShadow" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Padding interno</span>
                <input v-model="cardStyle.padding" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Gap entre elementos</span>
                <input v-model="cardStyle.gap" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
            </div>

            <!-- Nome do Produto -->
            <div>
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Nome do Produto</p>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Escala do nome</span><span class="text-[9px] text-gray-400">{{ cardStyle.nameScale || 1 }}x</span></div>
                <input type="range" min="0.5" max="2" step="0.1" :value="cardStyle.nameScale || 1" @input="cardStyle.nameScale = parseFloat(($event.target as HTMLInputElement).value)" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Maximo de linhas</span>
                <select :value="cardStyle.nameMaxLines || 3" @change="cardStyle.nameMaxLines = parseInt(($event.target as HTMLSelectElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                  <option :value="1">1 linha</option><option :value="2">2 linhas</option><option :value="3">3 linhas</option><option :value="4">4 linhas</option><option :value="5">5 linhas</option>
                </select>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Peso da fonte</span>
                <select :value="cardStyle.nameFontWeight || 800" @change="cardStyle.nameFontWeight = parseInt(($event.target as HTMLSelectElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                  <option :value="400">Normal</option><option :value="600">Semibold</option><option :value="700">Bold</option><option :value="800">Extra Bold</option><option :value="900">Black</option>
                </select>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Alinhamento</span>
                <div class="flex gap-1 mt-1">
                  <button v-for="a in ['left','center','right']" :key="a" @click="cardStyle.nameTextAlign = a" :class="['flex-1 py-1 rounded text-[10px]', (cardStyle.nameTextAlign || 'center') === a ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400']">{{ a === 'left' ? '⬅' : a === 'right' ? '➡' : '⬌' }}</button>
                </div>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Transformacao</span>
                <select :value="cardStyle.nameTextTransform || 'uppercase'" @change="cardStyle.nameTextTransform = ($event.target as HTMLSelectElement).value" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                  <option value="uppercase">MAIUSCULAS</option><option value="capitalize">Capitalizar</option><option value="lowercase">minusculas</option><option value="none">Normal</option>
                </select>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Cor do nome</span>
                <div class="flex gap-1 mt-1">
                  <input type="color" :value="cardStyle.nameColor || '#000000'" @input="cardStyle.nameColor = ($event.target as HTMLInputElement).value" class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
                  <input :value="cardStyle.nameColor || ''" @input="cardStyle.nameColor = ($event.target as HTMLInputElement).value || undefined" placeholder="inherit" class="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                </div>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Padding do nome</span>
                <input :value="cardStyle.namePadding || ''" @input="cardStyle.namePadding = ($event.target as HTMLInputElement).value || undefined" placeholder="1% 3% 2.5%" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Espaco abaixo do nome (px)</span><span class="text-[9px] text-gray-400">{{ cardStyle.nameMarginBottom || 0 }}</span></div>
                <input type="range" min="0" max="40" step="1" :value="cardStyle.nameMarginBottom || 0" @input="cardStyle.nameMarginBottom = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
            </div>

            <!-- Imagem -->
            <div>
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Imagem</p>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Object Fit</span>
                <select :value="cardStyle.imageObjectFit || 'contain'" @change="cardStyle.imageObjectFit = ($event.target as HTMLSelectElement).value" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                  <option value="contain">Contain (inteira)</option><option value="cover">Cover (preenche)</option><option value="fill">Fill (estica)</option>
                </select>
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Subir imagem (%)</span><span class="text-[9px] text-gray-400">{{ cardStyle.imageLift || 'Auto' }}</span></div>
                <input type="range" min="0" max="40" step="1" :value="cardStyle.imageLift || 0" @input="cardStyle.imageLift = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Margem acima (px)</span><span class="text-[9px] text-gray-400">{{ cardStyle.imageMarginTop || 0 }}</span></div>
                <input type="range" min="-20" max="40" step="1" :value="cardStyle.imageMarginTop || 0" @input="cardStyle.imageMarginTop = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Margem abaixo (px)</span><span class="text-[9px] text-gray-400">{{ cardStyle.imageMarginBottom || 0 }}</span></div>
                <input type="range" min="-20" max="40" step="1" :value="cardStyle.imageMarginBottom || 0" @input="cardStyle.imageMarginBottom = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
            </div>

            <!-- Etiqueta de Preco -->
            <div>
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Etiqueta de Preco</p>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Escala do preco</span><span class="text-[9px] text-gray-400">{{ cardStyle.priceScale || 1 }}x</span></div>
                <input type="range" min="0.3" max="5" step="0.1" :value="cardStyle.priceScale || 1" @input="cardStyle.priceScale = parseFloat(($event.target as HTMLInputElement).value)" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Posicao do preco</span>
                <select :value="cardStyle.pricePosition || 'below'" @change="cardStyle.pricePosition = ($event.target as HTMLSelectElement).value" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                  <option value="below">Abaixo da imagem</option><option value="overlay-bottom">Overlay embaixo</option><option value="overlay-center">Overlay centro</option><option value="overlay-top">Overlay topo</option>
                </select>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Alinhamento</span>
                <div class="flex gap-1 mt-1">
                  <button v-for="a in ['flex-start','center','flex-end']" :key="a" @click="cardStyle.priceAlign = a" :class="['flex-1 py-1 rounded text-[10px]', (cardStyle.priceAlign || 'center') === a ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400']">{{ a === 'flex-start' ? '⬅' : a === 'flex-end' ? '➡' : '⬌' }}</button>
                </div>
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Mover horizontal (%)</span><span class="text-[9px] text-gray-400">{{ cardStyle.priceOffsetX || 0 }}</span></div>
                <input type="range" min="-50" max="50" step="1" :value="cardStyle.priceOffsetX || 0" @input="cardStyle.priceOffsetX = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Mover vertical (%)</span><span class="text-[9px] text-gray-400">{{ cardStyle.priceOffsetY || 0 }}</span></div>
                <input type="range" min="-50" max="50" step="1" :value="cardStyle.priceOffsetY || 0" @input="cardStyle.priceOffsetY = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Margem acima (px)</span><span class="text-[9px] text-gray-400">{{ cardStyle.priceMarginTop || 0 }}</span></div>
                <input type="range" min="-40" max="60" step="1" :value="cardStyle.priceMarginTop || 0" @input="cardStyle.priceMarginTop = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Margem abaixo (px)</span><span class="text-[9px] text-gray-400">{{ cardStyle.priceMarginBottom || 0 }}</span></div>
                <input type="range" min="-40" max="60" step="1" :value="cardStyle.priceMarginBottom || 0" @input="cardStyle.priceMarginBottom = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Altura da etiqueta (px)</span><span class="text-[9px] text-gray-400">{{ cardStyle.priceHeight || 'Auto' }}</span></div>
                <input type="range" min="0" max="300" step="5" :value="cardStyle.priceHeight || 0" @input="cardStyle.priceHeight = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Largura da etiqueta</span>
                <select :value="cardStyle.priceWidth || '100%'" @change="cardStyle.priceWidth = ($event.target as HTMLSelectElement).value" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                  <option value="100%">100% (toda largura)</option><option value="90%">90%</option><option value="80%">80%</option><option value="70%">70%</option><option value="60%">60%</option><option value="50%">50%</option><option value="auto">Auto (tamanho do conteudo)</option>
                </select>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Padding da etiqueta</span>
                <input :value="cardStyle.pricePadding || ''" @input="cardStyle.pricePadding = ($event.target as HTMLInputElement).value || undefined" placeholder="0 3%" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Fundo da etiqueta</span>
                <div class="flex gap-1 mt-1">
                  <input type="color" :value="cardStyle.priceBg || '#dc2626'" @input="cardStyle.priceBg = ($event.target as HTMLInputElement).value" class="w-8 h-6 rounded border border-gray-200 cursor-pointer" />
                  <input :value="cardStyle.priceBg || ''" @input="cardStyle.priceBg = ($event.target as HTMLInputElement).value || undefined" placeholder="transparente" class="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                </div>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Border radius etiqueta</span>
                <input :value="cardStyle.priceBorderRadius || ''" @input="cardStyle.priceBorderRadius = ($event.target as HTMLInputElement).value || undefined" placeholder="8px" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
              </label>
            </div>

            <!-- Imagem Duplicada -->
            <div>
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Imagem Duplicada</p>
              <p class="text-[8px] text-gray-300 mb-2">Controles para quando o produto tem imagens extras (duplicar horizontal/vertical)</p>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Largura da imagem (%)</span><span class="text-[9px] text-gray-400">{{ cardStyle.dupImageWidth || 'Auto' }}</span></div>
                <input type="range" min="0" max="120" step="1" :value="cardStyle.dupImageWidth || 0" @input="cardStyle.dupImageWidth = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Distancia horizontal (%)</span><span class="text-[9px] text-gray-400">{{ cardStyle.dupHorizontalStep || 'Auto' }}</span></div>
                <input type="range" min="0" max="50" step="1" :value="cardStyle.dupHorizontalStep || 0" @input="cardStyle.dupHorizontalStep = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Elevacao horizontal (%)</span><span class="text-[9px] text-gray-400">{{ cardStyle.dupHorizontalLift || 'Auto' }}</span></div>
                <input type="range" min="0" max="20" step="0.5" :value="cardStyle.dupHorizontalLift || 0" @input="cardStyle.dupHorizontalLift = parseFloat(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Distancia vertical (%)</span><span class="text-[9px] text-gray-400">{{ cardStyle.dupVerticalStep || 'Auto' }}</span></div>
                <input type="range" min="0" max="80" step="1" :value="cardStyle.dupVerticalStep || 0" @input="cardStyle.dupVerticalStep = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
              <label class="block mb-2">
                <div class="flex justify-between"><span class="text-[9px] text-gray-400">Subir imagem vertical (%)</span><span class="text-[9px] text-gray-400">{{ cardStyle.dupVerticalLift || 'Auto' }}</span></div>
                <input type="range" min="0" max="50" step="1" :value="cardStyle.dupVerticalLift || 0" @input="cardStyle.dupVerticalLift = parseInt(($event.target as HTMLInputElement).value) || undefined" class="w-full mt-1 accent-emerald-500" />
              </label>
            </div>

            <!-- Grade Sugerida -->
            <div>
              <p class="text-[10px] font-semibold text-gray-400 uppercase mb-2">Grade Sugerida</p>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Produtos por pagina (recomendado)</span>
                <select :value="cardStyle.suggestedPerPage || 0" @change="cardStyle.suggestedPerPage = parseInt(($event.target as HTMLSelectElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                  <option :value="0">Qualquer (flexivel)</option>
                  <option :value="1">1 produto (destaque)</option>
                  <option :value="2">2 produtos</option>
                  <option :value="4">4 produtos (2x2)</option>
                  <option :value="6">6 produtos (3x2)</option>
                  <option :value="8">8 produtos (4x2)</option>
                  <option :value="9">9 produtos (3x3)</option>
                  <option :value="12">12 produtos (4x3)</option>
                  <option :value="16">16 produtos (4x4)</option>
                  <option :value="20">20 produtos (5x4)</option>
                </select>
              </label>
              <label class="block mb-2">
                <span class="text-[9px] text-gray-400">Colunas recomendadas</span>
                <select :value="cardStyle.suggestedColumns || 0" @change="cardStyle.suggestedColumns = parseInt(($event.target as HTMLSelectElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                  <option :value="0">Auto</option>
                  <option :value="1">1 coluna</option>
                  <option :value="2">2 colunas</option>
                  <option :value="3">3 colunas</option>
                  <option :value="4">4 colunas</option>
                  <option :value="5">5 colunas</option>
                  <option :value="6">6 colunas</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- JSON Editor Modal -->
      <Teleport to="body">
        <div v-if="showJsonEditor" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showJsonEditor = false">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            <div class="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 class="font-semibold text-gray-900">Editor JSON</h3>
              <button @click="showJsonEditor = false" class="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <textarea v-model="jsonText" class="flex-1 p-4 text-xs font-mono outline-none resize-none min-h-80" />
            <div class="p-4 border-t border-gray-200 flex gap-2 justify-end">
              <button @click="showJsonEditor = false" class="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-700">Cancelar</button>
              <button @click="applyJson" class="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white font-medium">Aplicar JSON</button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
