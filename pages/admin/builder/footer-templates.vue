<script setup lang="ts">
import type { CardTemplateElement, CardTemplateStyle } from '~/types/builder'

definePageMeta({ layout: false, middleware: ['auth', 'admin'], ssr: false })

const { getApiAuthHeaders } = useApiAuth()

type CardTemplate = {
  id: string; name: string; thumbnail: string | null; category: string
  elements: CardTemplateElement[]; container_style: CardTemplateStyle
  is_active: boolean; sort_order: number
}

// ── Estado geral ──
const items = ref<CardTemplate[]>([])
const isLoading = ref(false)
const error = ref('')
const editingId = ref<string | null>(null)

// ── Modo: 'list' ou 'editor' ──
const mode = ref<'list' | 'editor'>('list')

// ── Form basico ──
const formName = ref('')
const formCategory = ref('geral')
const formSortOrder = ref(0)
const formIsActive = ref(true)

// ── Card style (container) ──
const cardStyle = ref<CardTemplateStyle>({
  bg: '#ffffff', borderRadius: '8px', overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: 'none', padding: '0',
})

// ── Elementos visuais ──
const elements = ref<CardTemplateElement[]>([])
const selectedElementId = ref<string | null>(null)
const selectedElement = computed(() => elements.value.find(e => e.id === selectedElementId.value) || null)

const categories = ['geral', 'basico', 'compacto', 'destaque', 'moderno', 'tradicional', 'premium']

// ── Canvas config ──
const CANVAS_W = 500
const CANVAS_H = 200
const canvasRef = ref<HTMLElement | null>(null)

// ── Tipos de elemento disponiveis ──
const ELEMENT_TYPES = [
  { type: 'image', slot: 'logo', label: 'Logo', icon: '🏪', defaultW: '20%', defaultH: '50%', defaultX: '3%', defaultY: '25%' },
  { type: 'text', slot: 'company_name', label: 'Nome Empresa', icon: '🏢', defaultW: '40%', defaultH: '20%', defaultX: '25%', defaultY: '25%' },
  { type: 'text', slot: 'whatsapp', label: 'WhatsApp', icon: '📱', defaultW: '30%', defaultH: '15%', defaultX: '65%', defaultY: '25%' },
  { type: 'text', slot: 'phone', label: 'Telefone', icon: '📞', defaultW: '25%', defaultH: '12%', defaultX: '65%', defaultY: '42%' },
  { type: 'text', slot: 'address', label: 'Endereco', icon: '📍', defaultW: '50%', defaultH: '12%', defaultX: '25%', defaultY: '50%' },
  { type: 'text', slot: 'hours', label: 'Horario', icon: '🕐', defaultW: '40%', defaultH: '10%', defaultX: '25%', defaultY: '65%' },
  { type: 'text', slot: 'instagram', label: 'Instagram', icon: '📷', defaultW: '20%', defaultH: '10%', defaultX: '5%', defaultY: '5%' },
  { type: 'text', slot: 'facebook', label: 'Facebook', icon: '📘', defaultW: '20%', defaultH: '10%', defaultX: '30%', defaultY: '5%' },
  { type: 'text', slot: 'social', label: 'Redes Sociais', icon: '🌐', defaultW: '50%', defaultH: '10%', defaultX: '5%', defaultY: '5%' },
  { type: 'text', slot: 'payments', label: 'Bandeiras Pgto', icon: '💳', defaultW: '35%', defaultH: '15%', defaultX: '60%', defaultY: '60%' },
  { type: 'text', slot: 'validity', label: 'Validade', icon: '📅', defaultW: '80%', defaultH: '10%', defaultX: '10%', defaultY: '78%' },
  { type: 'text', slot: 'disclaimer', label: 'Disclaimer', icon: '⚖️', defaultW: '90%', defaultH: '8%', defaultX: '5%', defaultY: '90%' },
  { type: 'shape', slot: '', label: 'Forma/Deco', icon: '🔶', defaultW: '100%', defaultH: '15%', defaultX: '0%', defaultY: '0%' },
] as const

// ── Dados mock para preview ──
const MOCK_PRODUCT = {
  name: 'MEU SUPERMERCADO',
  price: '',
  unit: '',
  observation: '',
  badge: '',
  image: '',
}

// Mock de dados do footer para preview
const MOCK_FOOTER: Record<string, string> = {
  logo: '🏪',
  company_name: 'MEU SUPERMERCADO',
  whatsapp: '(64) 3.4234-2342',
  phone: '(64) 3234-5678',
  address: 'Rua Exemplo, 123 - Centro - Cidade/GO',
  hours: 'Seg a Sab: 7h-21h | Dom: 8h-18h',
  instagram: '@meusupermercado',
  facebook: 'meusupermercado',
  social: '@meusupermercado | /meusupermercado',
  payments: 'PIX | VISA | MASTER | ELO',
  validity: 'Ofertas validas de 01/04 ate 07/04/2026',
  disclaimer: '*Imagens meramente ilustrativas. Ofertas enquanto durarem os estoques.',
}

// ── Drag state ──
const isDragging = ref(false)
const isResizing = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartElX = ref(0)
const dragStartElY = ref(0)
const dragStartElW = ref(0)
const dragStartElH = ref(0)

// ── CRUD ──
const fetchData = async () => {
  isLoading.value = true; error.value = ''
  try {
    const data = await $fetch<any>('/api/admin/builder/footer-templates', { headers: await getApiAuthHeaders() })
    items.value = (Array.isArray(data) ? data : data?.footerTemplates ?? [])
  } catch (err: any) { error.value = err.message || 'Erro ao carregar' }
  finally { isLoading.value = false }
}

const saveItem = async () => {
  error.value = ''
  try {
    const payload = {
      name: formName.value.trim(),
      category: formCategory.value,
      elements: elements.value,
      container_style: cardStyle.value,
      is_active: formIsActive.value,
      sort_order: formSortOrder.value,
    }
    if (!payload.name) throw new Error('Nome e obrigatorio')

    if (editingId.value) {
      await $fetch(`/api/admin/builder/footer-templates/${editingId.value}`, { method: 'PUT', body: payload, headers: await getApiAuthHeaders() })
    } else {
      await $fetch('/api/admin/builder/footer-templates', { method: 'POST', body: payload, headers: await getApiAuthHeaders() })
    }
    mode.value = 'list'
    await fetchData()
  } catch (err: any) { error.value = err.message || 'Erro ao salvar' }
}

const deleteItem = async (id: string) => {
  if (!confirm('Excluir este template?')) return
  try {
    await $fetch(`/api/admin/builder/footer-templates/${id}`, { method: 'DELETE', headers: await getApiAuthHeaders() })
    await fetchData()
  } catch (err: any) { error.value = err.message || 'Erro ao excluir' }
}

// ── Abrir editor ──
const openEditor = (item?: CardTemplate) => {
  if (item) {
    editingId.value = item.id
    formName.value = item.name
    formCategory.value = item.category || 'geral'
    formSortOrder.value = item.sort_order
    formIsActive.value = item.is_active
    cardStyle.value = { ...{ bg: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: 'none', padding: '0' }, ...item.container_style }
    elements.value = (item.elements || []).map(e => ({ ...e }))
  } else {
    editingId.value = null
    formName.value = ''
    formCategory.value = 'geral'
    formSortOrder.value = 0
    formIsActive.value = true
    cardStyle.value = { bg: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: 'none', padding: '0' }
    elements.value = []
  }
  selectedElementId.value = null
  mode.value = 'editor'
}

// ── Adicionar elemento ──
const addElement = (type: typeof ELEMENT_TYPES[number]) => {
  const el: CardTemplateElement = {
    id: crypto.randomUUID().slice(0, 8),
    type: type.type as any,
    slot: type.slot,
    x: type.defaultX, y: type.defaultY,
    w: type.defaultW, h: type.defaultH,
    fontSize: type.type === 'text' ? 'auto' : undefined,
    fontWeight: type.type === 'text' ? 800 : undefined,
    textAlign: 'center',
    textTransform: type.type === 'text' ? 'uppercase' : undefined,
    color: 'inherit',
    showIf: type.slot ? 'has_value' : 'always',
  }
  elements.value.push(el)
  selectedElementId.value = el.id
}

// ── Remover elemento ──
const removeElement = (id: string) => {
  elements.value = elements.value.filter(e => e.id !== id)
  if (selectedElementId.value === id) selectedElementId.value = null
}

// ── Duplicar elemento ──
const dupElement = (el: CardTemplateElement) => {
  const copy = { ...el, id: crypto.randomUUID().slice(0, 8), y: `${parseFloat(el.y) + 5}%` }
  elements.value.push(copy)
  selectedElementId.value = copy.id
}

// ── Mover camada ──
const moveLayer = (id: string, dir: 'up' | 'down') => {
  const idx = elements.value.findIndex(e => e.id === id)
  if (idx < 0) return
  const newIdx = dir === 'up' ? idx + 1 : idx - 1
  if (newIdx < 0 || newIdx >= elements.value.length) return
  const copy = [...elements.value]
  ;[copy[idx], copy[newIdx]] = [copy[newIdx]!, copy[idx]!]
  elements.value = copy
}

// ── Atualizar campo do elemento selecionado ──
const updateEl = (field: string, value: any) => {
  const el = elements.value.find(e => e.id === selectedElementId.value)
  if (el) (el as any)[field] = value
}

// ── Drag & drop no canvas ──
const parsePercent = (val: string): number => parseFloat(val) || 0

const startDrag = (e: MouseEvent, elId: string) => {
  e.preventDefault(); e.stopPropagation()
  const el = elements.value.find(e => e.id === elId)
  if (!el) return
  selectedElementId.value = elId
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  dragStartElX.value = parsePercent(el.x)
  dragStartElY.value = parsePercent(el.y)
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value || !canvasRef.value) return
  const el = elements.value.find(e => e.id === selectedElementId.value)
  if (!el) return
  const rect = canvasRef.value.getBoundingClientRect()
  const dx = ((e.clientX - dragStartX.value) / rect.width) * 100
  const dy = ((e.clientY - dragStartY.value) / rect.height) * 100
  el.x = `${Math.max(0, Math.min(100 - parsePercent(el.w), dragStartElX.value + dx)).toFixed(1)}%`
  el.y = `${Math.max(0, Math.min(100 - parsePercent(el.h), dragStartElY.value + dy)).toFixed(1)}%`
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// ── Resize no canvas ──
const startResize = (e: MouseEvent, elId: string) => {
  e.preventDefault(); e.stopPropagation()
  const el = elements.value.find(e => e.id === elId)
  if (!el) return
  selectedElementId.value = elId
  isResizing.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY
  dragStartElW.value = parsePercent(el.w)
  dragStartElH.value = parsePercent(el.h)
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

const onResize = (e: MouseEvent) => {
  if (!isResizing.value || !canvasRef.value) return
  const el = elements.value.find(e => e.id === selectedElementId.value)
  if (!el) return
  const rect = canvasRef.value.getBoundingClientRect()
  const dx = ((e.clientX - dragStartX.value) / rect.width) * 100
  const dy = ((e.clientY - dragStartY.value) / rect.height) * 100
  el.w = `${Math.max(5, dragStartElW.value + dx).toFixed(1)}%`
  el.h = `${Math.max(3, dragStartElH.value + dy).toFixed(1)}%`
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// ── Mock content para preview ──
const mockContent = (el: CardTemplateElement): string => {
  return MOCK_FOOTER[el.slot] || ''
}

// ── Label do tipo ──
const typeLabel = (type: string): string => {
  return ELEMENT_TYPES.find(t => t.type === type)?.label || type
}
const typeIcon = (type: string): string => {
  return ELEMENT_TYPES.find(t => t.type === type)?.icon || '⬜'
}

onMounted(fetchData)
</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <!-- ═════════════════════════��══════════════════════ -->
    <!-- MODO LISTA -->
    <!-- ═══════════════════════════════════════════════��� -->
    <template v-if="mode === 'list'">
      <div class="p-6 max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Footer Templates</h1>
            <p class="text-sm text-gray-500 mt-1">Templates de rodape do encarte. Crie rodapes visuais, o cliente escolhe.</p>
          </div>
          <div class="flex gap-2">
            <NuxtLink to="/admin/builder" class="px-4 py-2 rounded-lg text-sm bg-gray-200 text-gray-700 hover:bg-gray-300">Voltar</NuxtLink>
            <button @click="openEditor()" class="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 font-medium">+ Novo Template</button>
          </div>
        </div>

        <div v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{{ error }}</div>
        <div v-if="isLoading" class="text-center py-12 text-gray-400">Carregando...</div>

        <!-- Grid de cards com preview visual -->
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div
            v-for="item in items" :key="item.id"
            class="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
            @click="openEditor(item)"
          >
            <!-- Mini preview do template -->
            <div class="relative bg-gray-100 p-3" style="aspect-ratio: 3/4">
              <div
                class="w-full h-full relative overflow-hidden"
                :style="{
                  background: item.container_style?.bg || '#fff',
                  borderRadius: item.container_style?.borderRadius || '8px',
                  boxShadow: item.container_style?.boxShadow || 'none',
                  border: item.container_style?.border || 'none',
                }"
              >
                <div
                  v-for="el in (item.elements || [])" :key="el.id"
                  :style="{
                    position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
                    background: el.type === 'shape' ? (el.bg || 'rgba(0,0,0,0.1)') : el.type === 'image' ? '#e5e7eb' : 'rgba(59,130,246,0.1)',
                    borderRadius: el.borderRadius || '2px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px', color: '#999', overflow: 'hidden',
                    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  }"
                >
                  <span v-if="el.type !== 'shape'" class="truncate px-0.5">{{ typeIcon(el.type) }}</span>
                </div>
              </div>
            </div>
            <!-- Info -->
            <div class="p-3">
              <div class="flex items-center justify-between">
                <span class="font-medium text-sm text-gray-900 truncate">{{ item.name }}</span>
                <span :class="item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'" class="px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ml-2">{{ item.is_active ? 'Ativo' : 'Off' }}</span>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-[10px] text-gray-400">{{ item.category }}</span>
                <span class="text-[10px] text-gray-400">{{ (item.elements || []).length }} elementos</span>
              </div>
              <!-- Acoes rapidas -->
              <div class="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                <button @click="openEditor(item)" class="text-[10px] text-blue-600 hover:text-blue-800">Editar</button>
                <button @click="deleteItem(item.id)" class="text-[10px] text-red-500 hover:text-red-700">Excluir</button>
              </div>
            </div>
          </div>

          <!-- Card adicionar -->
          <button @click="openEditor()" class="rounded-xl border-2 border-dashed border-gray-300 hover:border-emerald-400 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-emerald-500 transition-all" style="aspect-ratio: 3/5">
            <span class="text-3xl">+</span>
            <span class="text-xs">Novo Template</span>
          </button>
        </div>
      </div>
    </template>

    <!-- ═════════════════════════════���══════════════════ -->
    <!-- MODO EDITOR VISUAL -->
    <!-- ════════════════════════════════════════════════ -->
    <template v-else>
      <div class="h-screen flex flex-col overflow-hidden">

        <!-- Toolbar topo -->
        <header class="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
          <button @click="mode = 'list'" class="text-sm text-gray-500 hover:text-gray-700">← Voltar</button>
          <div class="w-px h-6 bg-gray-200" />
          <input v-model="formName" placeholder="Nome do template" class="text-sm font-medium text-gray-900 bg-transparent outline-none flex-1 min-w-0" />
          <select v-model="formCategory" class="text-xs bg-gray-100 rounded px-2 py-1 border border-gray-200 outline-none">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
          <label class="flex items-center gap-1.5 text-xs text-gray-500">
            <input v-model="formIsActive" type="checkbox" class="rounded accent-emerald-500" /> Ativo
          </label>
          <div class="w-px h-6 bg-gray-200" />
          <div v-if="error" class="text-xs text-red-500 truncate max-w-48">{{ error }}</div>
          <button @click="saveItem" class="px-4 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 font-medium">Salvar</button>
        </header>

        <!-- Corpo: sidebar esquerda + canvas + sidebar direita -->
        <div class="flex-1 flex min-h-0 overflow-hidden">

          <!-- ── SIDEBAR ESQUERDA: Elementos ── -->
          <div class="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
            <!-- Adicionar elemento -->
            <div class="p-3 border-b border-gray-100">
              <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Adicionar Elemento</p>
              <div class="grid grid-cols-2 gap-1">
                <button
                  v-for="t in ELEMENT_TYPES" :key="t.type"
                  @click="addElement(t)"
                  class="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 border border-gray-100 hover:border-emerald-200 transition-all"
                >
                  <span>{{ t.icon }}</span>
                  <span class="truncate">{{ t.label }}</span>
                </button>
              </div>
            </div>

            <!-- Lista de camadas -->
            <div class="flex-1 overflow-y-auto p-3">
              <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Camadas</p>
              <div class="space-y-1">
                <div
                  v-for="(el, idx) in [...elements].reverse()" :key="el.id"
                  @click="selectedElementId = el.id"
                  :class="['flex items-center gap-2 px-2 py-1.5 rounded text-[11px] cursor-pointer transition-all',
                    selectedElementId === el.id ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'hover:bg-gray-50 text-gray-600']"
                >
                  <span>{{ typeIcon(el.type) }}</span>
                  <span class="flex-1 truncate">{{ typeLabel(el.type) }}</span>
                  <button @click.stop="moveLayer(el.id, 'up')" class="text-gray-300 hover:text-gray-500 text-[9px]">↑</button>
                  <button @click.stop="moveLayer(el.id, 'down')" class="text-gray-300 hover:text-gray-500 text-[9px]">↓</button>
                  <button @click.stop="removeElement(el.id)" class="text-gray-300 hover:text-red-500 text-[9px]">✕</button>
                </div>
                <p v-if="!elements.length" class="text-[10px] text-gray-300 text-center py-4">Adicione elementos acima</p>
              </div>
            </div>
          </div>

          <!-- ── CANVAS CENTRAL ── -->
          <div class="flex-1 bg-gray-100 flex items-center justify-center overflow-auto p-8">
            <div
              ref="canvasRef"
              class="relative shadow-2xl"
              :style="{
                width: CANVAS_W + 'px', height: CANVAS_H + 'px',
                background: cardStyle.bg || '#ffffff',
                borderRadius: cardStyle.borderRadius || '8px',
                boxShadow: cardStyle.boxShadow || 'none',
                border: cardStyle.border || 'none',
                overflow: cardStyle.overflow || 'hidden',
              }"
              @click.self="selectedElementId = null"
            >
              <div
                v-for="el in elements" :key="el.id"
                :style="{
                  position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
                  transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                  zIndex: el.zIndex || (elements.indexOf(el) + 1),
                  opacity: el.opacity ?? 1,
                  cursor: isDragging ? 'grabbing' : 'grab',
                }"
                @mousedown="startDrag($event, el.id)"
                @click.stop="selectedElementId = el.id"
              >
                <!-- Conteudo visual do elemento -->
                <div
                  :style="{
                    width: '100%', height: '100%', overflow: el.overflow || 'hidden',
                    borderRadius: el.borderRadius || '0',
                    background: el.type === 'shape' ? (el.bg || 'rgba(0,0,0,0.1)')
                      : el.type === 'image' ? '#e5e7eb'
                      : el.type === 'price' ? 'rgba(220,38,38,0.1)'
                      : el.type === 'badge' ? 'rgba(245,158,11,0.15)'
                      : (el.bg || 'transparent'),
                    display: 'flex', alignItems: 'center', justifyContent: el.textAlign === 'right' ? 'flex-end' : el.textAlign === 'left' ? 'flex-start' : 'center',
                    fontSize: el.fontSize === 'auto' ? '11px' : (el.fontSize || '10px'),
                    fontWeight: el.fontWeight || 400,
                    textAlign: el.textAlign || 'center',
                    textTransform: el.textTransform || 'none',
                    color: el.color === 'inherit' ? '#333' : (el.color || '#333'),
                    padding: '2px 4px',
                    userSelect: 'none',
                    lineHeight: '1.2',
                    wordBreak: 'break-word',
                    boxShadow: el.boxShadow || 'none',
                  }"
                >
                  <!-- Preview de conteudo mock -->
                  <div v-if="el.type === 'image'" :style="{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: el.borderRadius || '4px', fontSize: '24px' }">🏪</div>
                  <span v-else-if="el.type === 'shape'" />
                  <span v-else class="truncate w-full text-center">{{ mockContent(el) || typeLabel(el.type) }}</span>
                </div>

                <!-- Borda de selecao -->
                <div
                  v-if="selectedElementId === el.id"
                  :style="{ position: 'absolute', inset: '-1px', border: '2px solid #10b981', borderRadius: (el.borderRadius || '0'), pointerEvents: 'none' }"
                />
                <!-- Handle de resize (canto inferior direito) -->
                <div
                  v-if="selectedElementId === el.id"
                  @mousedown.stop="startResize($event, el.id)"
                  :style="{ position: 'absolute', right: '-4px', bottom: '-4px', width: '10px', height: '10px', background: '#10b981', borderRadius: '2px', cursor: 'se-resize', zIndex: 999 }"
                />
              </div>
            </div>
          </div>

          <!-- ── SIDEBAR DIREITA: Propriedades ── -->
          <div class="w-64 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
            <!-- Propriedades do elemento selecionado -->
            <template v-if="selectedElement">
              <div class="p-3 border-b border-gray-100">
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{{ typeIcon(selectedElement.type) }} {{ typeLabel(selectedElement.type) }}</p>
              </div>

              <div class="p-3 space-y-3">
                <!-- Posicao -->
                <div>
                  <p class="text-[9px] font-semibold text-gray-400 uppercase mb-1.5">Posicao</p>
                  <div class="grid grid-cols-2 gap-2">
                    <label class="block">
                      <span class="text-[9px] text-gray-400">X</span>
                      <input :value="selectedElement.x" @input="updateEl('x', ($event.target as HTMLInputElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-emerald-500" />
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Y</span>
                      <input :value="selectedElement.y" @input="updateEl('y', ($event.target as HTMLInputElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-emerald-500" />
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Largura</span>
                      <input :value="selectedElement.w" @input="updateEl('w', ($event.target as HTMLInputElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-emerald-500" />
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Altura</span>
                      <input :value="selectedElement.h" @input="updateEl('h', ($event.target as HTMLInputElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-emerald-500" />
                    </label>
                  </div>
                </div>

                <!-- Tipografia (para text, unit, observation) -->
                <div v-if="['text', 'unit', 'observation'].includes(selectedElement.type)">
                  <p class="text-[9px] font-semibold text-gray-400 uppercase mb-1.5">Tipografia</p>
                  <div class="space-y-2">
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Tamanho</span>
                      <select :value="selectedElement.fontSize || 'auto'" @change="updateEl('fontSize', ($event.target as HTMLSelectElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                        <option value="auto">Auto (preenche)</option>
                        <option v-for="s in ['8px','9px','10px','11px','12px','14px','16px','18px','20px','24px','28px','32px']" :key="s" :value="s">{{ s }}</option>
                      </select>
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Peso</span>
                      <select :value="selectedElement.fontWeight || 400" @change="updateEl('fontWeight', Number(($event.target as HTMLSelectElement).value))" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                        <option :value="400">Normal</option>
                        <option :value="600">Semibold</option>
                        <option :value="700">Bold</option>
                        <option :value="800">Extra Bold</option>
                        <option :value="900">Black</option>
                      </select>
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Alinhamento</span>
                      <div class="flex gap-1">
                        <button v-for="a in ['left','center','right']" :key="a" @click="updateEl('textAlign', a)" :class="['flex-1 py-1 rounded text-[10px] transition-all', selectedElement.textAlign === a ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100']">
                          {{ a === 'left' ? '←' : a === 'right' ? '→' : '↔' }}
                        </button>
                      </div>
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Caixa</span>
                      <select :value="selectedElement.textTransform || 'none'" @change="updateEl('textTransform', ($event.target as HTMLSelectElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                        <option value="none">Normal</option>
                        <option value="uppercase">MAIUSCULAS</option>
                        <option value="capitalize">Capitalizar</option>
                        <option value="lowercase">minusculas</option>
                      </select>
                    </label>
                  </div>
                </div>

                <!-- Imagem (para image) -->
                <div v-if="selectedElement.type === 'image'">
                  <p class="text-[9px] font-semibold text-gray-400 uppercase mb-1.5">Imagem</p>
                  <label class="block">
                    <span class="text-[9px] text-gray-400">Encaixe</span>
                    <select :value="selectedElement.objectFit || 'contain'" @change="updateEl('objectFit', ($event.target as HTMLSelectElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                      <option value="contain">Conter (sem corte)</option>
                      <option value="cover">Cobrir (com corte)</option>
                      <option value="fill">Esticar</option>
                    </select>
                  </label>
                </div>

                <!-- Aparencia geral -->
                <div>
                  <p class="text-[9px] font-semibold text-gray-400 uppercase mb-1.5">Aparencia</p>
                  <div class="space-y-2">
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Cor texto</span>
                      <div class="flex gap-1">
                        <input type="color" :value="selectedElement.color === 'inherit' ? '#000000' : (selectedElement.color || '#000000')" @input="updateEl('color', ($event.target as HTMLInputElement).value)" class="w-8 h-7 rounded border border-gray-200 cursor-pointer" />
                        <button @click="updateEl('color', 'inherit')" :class="['flex-1 text-[9px] rounded py-1 transition-all', selectedElement.color === 'inherit' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400']">Herdar</button>
                      </div>
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Fundo</span>
                      <input :value="selectedElement.bg || ''" @input="updateEl('bg', ($event.target as HTMLInputElement).value)" placeholder="transparent, #fff, rgba(...)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Borda arredondada</span>
                      <input :value="selectedElement.borderRadius || ''" @input="updateEl('borderRadius', ($event.target as HTMLInputElement).value)" placeholder="0, 8px, 50%" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                    </label>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Sombra</span>
                      <input :value="selectedElement.boxShadow || ''" @input="updateEl('boxShadow', ($event.target as HTMLInputElement).value)" placeholder="0 2px 8px rgba(0,0,0,0.1)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                    </label>
                    <div class="grid grid-cols-2 gap-2">
                      <label class="block">
                        <span class="text-[9px] text-gray-400">Rotacao</span>
                        <input type="number" :value="selectedElement.rotation || 0" @input="updateEl('rotation', Number(($event.target as HTMLInputElement).value))" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                      </label>
                      <label class="block">
                        <span class="text-[9px] text-gray-400">Opacidade</span>
                        <input type="number" step="0.1" min="0" max="1" :value="selectedElement.opacity ?? 1" @input="updateEl('opacity', Number(($event.target as HTMLInputElement).value))" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                      </label>
                    </div>
                    <label class="block">
                      <span class="text-[9px] text-gray-400">Exibir quando</span>
                      <select :value="selectedElement.showIf || 'always'" @change="updateEl('showIf', ($event.target as HTMLSelectElement).value)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                        <option value="always">Sempre</option>
                        <option value="has_value">Quando tem valor</option>
                        <option value="is_highlight">Quando e destaque</option>
                      </select>
                    </label>
                  </div>
                </div>

                <!-- Acoes do elemento -->
                <div class="flex gap-2 pt-2 border-t border-gray-100">
                  <button @click="dupElement(selectedElement)" class="flex-1 text-[10px] py-1.5 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">Duplicar</button>
                  <button @click="removeElement(selectedElement.id)" class="flex-1 text-[10px] py-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100">Remover</button>
                </div>
              </div>
            </template>

            <!-- Card Style (quando nenhum elemento selecionado) -->
            <template v-else>
              <div class="p-3 border-b border-gray-100">
                <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estilo do Card</p>
              </div>
              <div class="p-3 space-y-3">
                <label class="block">
                  <span class="text-[9px] text-gray-400">Fundo</span>
                  <input v-model="cardStyle.bg" placeholder="#ffffff" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                </label>
                <label class="block">
                  <span class="text-[9px] text-gray-400">Borda</span>
                  <input v-model="cardStyle.border" placeholder="none, 1px solid #ddd" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                </label>
                <label class="block">
                  <span class="text-[9px] text-gray-400">Border Radius</span>
                  <input v-model="cardStyle.borderRadius" placeholder="8px" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                </label>
                <label class="block">
                  <span class="text-[9px] text-gray-400">Sombra</span>
                  <input v-model="cardStyle.boxShadow" placeholder="0 1px 4px rgba(0,0,0,0.08)" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none" />
                </label>
                <label class="block">
                  <span class="text-[9px] text-gray-400">Overflow</span>
                  <select v-model="cardStyle.overflow" class="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none">
                    <option value="hidden">Esconder (hidden)</option>
                    <option value="visible">Visivel</option>
                  </select>
                </label>

                <div class="pt-3 border-t border-gray-100">
                  <p class="text-[9px] text-gray-400 mb-1">Clique em um elemento no canvas para editar suas propriedades</p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
