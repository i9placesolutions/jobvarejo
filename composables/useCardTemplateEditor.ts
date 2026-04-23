// Composable para gerenciar estado e CRUD do editor de card templates
import { ref, computed } from 'vue'
import type { CardTemplateElement, CardTemplateStyle, BuilderCardTemplate } from '~/types/builder'

// ── Produtos mock para preview ──
const MOCK_PRODUCTS = [
  { id: '1', name: 'Arroz Tio João 5kg', image: '/img/mock/arroz.png', offer_price: 24.99, original_price: 29.90, unit: 'UN', observation: 'Limite 3 por cliente', brand: 'Tio João' },
  { id: '2', name: 'Feijão Carioca Camil 1kg', image: '/img/mock/feijao.png', offer_price: 7.49, original_price: 9.99, unit: 'UN', observation: '', brand: 'Camil' },
  { id: '3', name: 'Óleo de Soja Liza 900ml', image: '/img/mock/oleo.png', offer_price: 5.99, original_price: 8.49, unit: 'UN', observation: '', brand: 'Liza' },
  { id: '4', name: 'Leite Integral Italac 1L', image: '/img/mock/leite.png', offer_price: 4.89, original_price: 6.29, unit: 'UN', observation: 'Apenas unidade', brand: 'Italac' },
  { id: '5', name: 'Açúcar Cristal União 1kg', image: '/img/mock/acucar.png', offer_price: 4.49, original_price: 5.99, unit: 'UN', observation: '', brand: 'União' },
  { id: '6', name: 'Café Pilão 500g', image: '/img/mock/cafe.png', offer_price: 15.99, original_price: 19.90, unit: 'UN', observation: 'Torrado e moído', brand: 'Pilão' },
  { id: '7', name: 'Macarrão Espaguete Barilla 500g', image: '/img/mock/macarrao.png', offer_price: 6.29, original_price: 8.99, unit: 'UN', observation: '', brand: 'Barilla' },
  { id: '8', name: 'Sabão em Pó Omo 1.6kg', image: '/img/mock/sabao.png', offer_price: 18.99, original_price: 24.90, unit: 'UN', observation: 'Multiação', brand: 'Omo' },
  { id: '9', name: 'Refrigerante Coca-Cola 2L', image: '/img/mock/coca.png', offer_price: 8.99, original_price: 10.99, unit: 'UN', observation: 'Gelada', brand: 'Coca-Cola' },
]

// ── Posicoes padrao por tipo de elemento ──
const DEFAULT_ELEMENT_PROPS: Record<string, Partial<CardTemplateElement>> = {
  text: { x: '4%', y: '2%', w: '92%', h: '18%', fontWeight: 800, textAlign: 'center', textTransform: 'uppercase' },
  image: { x: '5%', y: '22%', w: '90%', h: '50%', objectFit: 'contain' },
  price: { x: '5%', y: '72%', w: '90%', h: '26%' },
  badge: { x: '70%', y: '0%', w: '30%', h: '12%', showIf: 'has_value' },
  unit: { x: '65%', y: '90%', w: '30%', h: '8%', showIf: 'has_value' },
  observation: { x: '4%', y: '93%', w: '92%', h: '5%', showIf: 'has_value' },
  shape: { x: '0%', y: '50%', w: '100%', h: '2%' },
}

// ── Gerar ID unico simples ──
function uid(): string {
  return `el_${makeId()}`
}

// ── Estilo padrao do card ──
function defaultCardStyle(): CardTemplateStyle {
  return {
    bg: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    padding: '0',
    layout: 'vertical',
    direction: 'column',
    imagePosition: 'top',
    gap: '0',
  }
}

// ── Presets completos ──

const PRESETS: Record<string, { name: string; elements: CardTemplateElement[]; card_style: CardTemplateStyle }> = {
  classico: {
    name: 'Clássico',
    elements: [
      { id: uid(), type: 'text', slot: 'product_name', x: '4%', y: '2%', w: '92%', h: '18%', order: 1, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase', fontSize: '0.85rem', color: '#1f2937' },
      { id: uid(), type: 'image', slot: 'product_image', x: '5%', y: '22%', w: '90%', h: '50%', order: 2, objectFit: 'contain' },
      { id: uid(), type: 'price', slot: 'product_price', x: '5%', y: '72%', w: '90%', h: '28%', order: 3 },
    ],
    card_style: { ...defaultCardStyle() },
  },

  imagem_grande: {
    name: 'Imagem Grande',
    elements: [
      { id: uid(), type: 'text', slot: 'product_name', x: '4%', y: '2%', w: '92%', h: '12%', order: 1, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', fontSize: '0.8rem', color: '#374151' },
      { id: uid(), type: 'image', slot: 'product_image', x: '3%', y: '14%', w: '94%', h: '62%', order: 2, objectFit: 'contain' },
      { id: uid(), type: 'price', slot: 'product_price', x: '5%', y: '76%', w: '90%', h: '24%', order: 3 },
    ],
    card_style: { ...defaultCardStyle() },
  },

  preco_destaque: {
    name: 'Preço Destaque',
    elements: [
      { id: uid(), type: 'text', slot: 'product_name', x: '4%', y: '2%', w: '92%', h: '15%', order: 1, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', fontSize: '0.8rem', color: '#1f2937' },
      { id: uid(), type: 'image', slot: 'product_image', x: '10%', y: '18%', w: '80%', h: '40%', order: 2, objectFit: 'contain' },
      { id: uid(), type: 'price', slot: 'product_price', x: '2%', y: '58%', w: '96%', h: '42%', order: 3 },
    ],
    card_style: { ...defaultCardStyle(), priceScale: 1.4 },
  },

  lateral: {
    name: 'Lateral',
    elements: [
      { id: uid(), type: 'image', slot: 'product_image', x: '0%', y: '0%', w: '40%', h: '100%', order: 1, objectFit: 'contain' },
      { id: uid(), type: 'text', slot: 'product_name', x: '42%', y: '5%', w: '55%', h: '40%', order: 2, fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', fontSize: '0.85rem', color: '#1f2937' },
      { id: uid(), type: 'price', slot: 'product_price', x: '42%', y: '50%', w: '55%', h: '45%', order: 3 },
    ],
    card_style: { ...defaultCardStyle(), layout: 'horizontal', direction: 'row', imagePosition: 'left', imageSize: '40%' },
  },

  dark: {
    name: 'Dark',
    elements: [
      { id: uid(), type: 'text', slot: 'product_name', x: '4%', y: '2%', w: '92%', h: '16%', order: 1, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase', fontSize: '0.85rem', color: '#ffffff' },
      { id: uid(), type: 'image', slot: 'product_image', x: '5%', y: '20%', w: '90%', h: '48%', order: 2, objectFit: 'contain' },
      { id: uid(), type: 'price', slot: 'product_price', x: '5%', y: '70%', w: '90%', h: '30%', order: 3 },
    ],
    card_style: { ...defaultCardStyle(), bg: '#1a1a2e', border: '1px solid #333', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', nameColor: '#ffffff', priceColor: '#ffffff' },
  },

  etiqueta: {
    name: 'Etiqueta',
    elements: [
      { id: uid(), type: 'image', slot: 'product_image', x: '0%', y: '0%', w: '22%', h: '100%', order: 1, objectFit: 'contain' },
      { id: uid(), type: 'text', slot: 'product_name', x: '24%', y: '5%', w: '73%', h: '40%', order: 2, fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', fontSize: '0.8rem', color: '#1f2937' },
      { id: uid(), type: 'price', slot: 'product_price', x: '24%', y: '50%', w: '73%', h: '45%', order: 3 },
    ],
    card_style: { ...defaultCardStyle(), layout: 'horizontal', direction: 'row', imagePosition: 'left', imageSize: '22%', border: '2px solid #dc2626', borderRadius: '4px' },
  },
}

// ── Composable principal ──

export function useCardTemplateEditor() {
  const { getApiAuthHeaders } = useApiAuth()

  // ── Estado da lista de templates ──
  const items = ref<BuilderCardTemplate[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Estado do editor ──
  const editingId = ref<string | null>(null)
  const formName = ref('')
  const formCategory = ref('geral')
  const formIsActive = ref(true)
  const formSortOrder = ref(0)

  // ── Elementos e estilo do card ──
  const elements = ref<CardTemplateElement[]>([])
  const cardStyle = ref<CardTemplateStyle>(defaultCardStyle())

  // ── Selecao ──
  const selectedElementId = ref<string | null>(null)

  const selectedElement = computed<CardTemplateElement | null>(() => {
    if (!selectedElementId.value) return null
    return elements.value.find(el => el.id === selectedElementId.value) ?? null
  })

  // ── Template ao vivo (para preview) ──
  const liveTemplate = computed<BuilderCardTemplate>(() => ({
    id: editingId.value ?? 'preview',
    name: formName.value || 'Sem nome',
    category: formCategory.value,
    elements: elements.value,
    card_style: cardStyle.value,
    is_active: formIsActive.value,
    sort_order: formSortOrder.value,
  }))

  // ── CRUD: buscar templates ──
  async function fetchTemplates() {
    isLoading.value = true
    error.value = null
    try {
      const headers = await getApiAuthHeaders()
      const data = await $fetch<any>('/api/admin/builder/card-templates', { headers })
      // A API retorna { cardTemplates: [...] }
      items.value = (Array.isArray(data) ? data : data?.cardTemplates) ?? []
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar templates'
      error.value = msg
      console.error('[useCardTemplateEditor] fetchTemplates:', msg)
    } finally {
      isLoading.value = false
    }
  }

  // ── CRUD: salvar (criar ou atualizar) ──
  async function saveTemplate() {
    isLoading.value = true
    error.value = null
    try {
      const headers = await getApiAuthHeaders()
      const body = {
        name: formName.value,
        category: formCategory.value,
        is_active: formIsActive.value,
        sort_order: formSortOrder.value,
        elements: elements.value,
        card_style: cardStyle.value,
      }

      if (editingId.value) {
        await $fetch(`/api/admin/builder/card-templates/${editingId.value}`, {
          method: 'PUT',
          headers,
          body,
        })
      } else {
        await $fetch('/api/admin/builder/card-templates', {
          method: 'POST',
          headers,
          body,
        })
      }

      await fetchTemplates()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar template'
      error.value = msg
      console.error('[useCardTemplateEditor] saveTemplate:', msg)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ── CRUD: deletar ──
  async function deleteTemplate(id: string) {
    isLoading.value = true
    error.value = null
    try {
      const headers = await getApiAuthHeaders()
      await $fetch(`/api/admin/builder/card-templates/${id}`, {
        method: 'DELETE',
        headers,
      })
      await fetchTemplates()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao deletar template'
      error.value = msg
      console.error('[useCardTemplateEditor] deleteTemplate:', msg)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ── Abrir editor (novo ou existente) ──
  function openEditor(item?: BuilderCardTemplate) {
    if (item) {
      editingId.value = item.id
      formName.value = item.name
      formCategory.value = item.category ?? 'geral'
      formIsActive.value = item.is_active ?? true
      formSortOrder.value = item.sort_order ?? 0
      elements.value = JSON.parse(JSON.stringify(item.elements ?? []))
      cardStyle.value = { ...defaultCardStyle(), ...JSON.parse(JSON.stringify(item.card_style ?? {})) }
    } else {
      editingId.value = null
      formName.value = ''
      formCategory.value = 'geral'
      formIsActive.value = true
      formSortOrder.value = 0
      elements.value = []
      cardStyle.value = defaultCardStyle()
    }
    selectedElementId.value = null
  }

  // ── Elementos: adicionar ──
  function addElement(type: string) {
    const defaults = DEFAULT_ELEMENT_PROPS[type] ?? { x: '10%', y: '10%', w: '80%', h: '20%' }
    const slotMap: Record<string, string> = {
      text: 'product_name',
      image: 'product_image',
      price: 'product_price',
      badge: 'badge',
      unit: 'unit',
      observation: 'observation',
      shape: 'separator',
    }

    const newElement: CardTemplateElement = {
      id: uid(),
      type: type as CardTemplateElement['type'],
      slot: slotMap[type] ?? type,
      x: defaults.x ?? '10%',
      y: defaults.y ?? '10%',
      w: defaults.w ?? '80%',
      h: defaults.h ?? '20%',
      order: elements.value.length + 1,
      ...(defaults.fontWeight !== undefined && { fontWeight: defaults.fontWeight }),
      ...(defaults.textAlign !== undefined && { textAlign: defaults.textAlign }),
      ...(defaults.textTransform !== undefined && { textTransform: defaults.textTransform }),
      ...(defaults.objectFit !== undefined && { objectFit: defaults.objectFit }),
      ...(defaults.showIf !== undefined && { showIf: defaults.showIf }),
    }

    elements.value.push(newElement)
    selectedElementId.value = newElement.id
  }

  // ── Elementos: remover ──
  function removeElement(id: string) {
    elements.value = elements.value.filter(el => el.id !== id)
    if (selectedElementId.value === id) {
      selectedElementId.value = null
    }
  }

  // ── Elementos: duplicar ──
  function duplicateElement(id: string) {
    const source = elements.value.find(el => el.id === id)
    if (!source) return
    const clone: CardTemplateElement = {
      ...JSON.parse(JSON.stringify(source)),
      id: uid(),
      order: elements.value.length + 1,
    }
    elements.value.push(clone)
    selectedElementId.value = clone.id
  }

  // ── Elementos: atualizar ──
  function updateElement(id: string, changes: Partial<CardTemplateElement>) {
    const idx = elements.value.findIndex(el => el.id === id)
    if (idx === -1) return
    const current = elements.value[idx]
    if (!current) return
    elements.value[idx] = { ...current, ...changes }
  }

  // ── Atualizar elemento selecionado ──
  function updateSelectedElement(changes: Partial<CardTemplateElement>) {
    if (!selectedElementId.value) return
    updateElement(selectedElementId.value, changes)
  }

  // ── Selecao ──
  function selectElement(id: string | null) {
    selectedElementId.value = id
  }

  // ── Aplicar preset ──
  function applyPreset(presetName: string) {
    const preset = PRESETS[presetName]
    if (!preset) {
      console.warn(`[useCardTemplateEditor] Preset "${presetName}" nao encontrado`)
      return
    }
    // Gera novos IDs para evitar conflitos
    elements.value = preset.elements.map(el => ({
      ...JSON.parse(JSON.stringify(el)),
      id: uid(),
    }))
    cardStyle.value = { ...defaultCardStyle(), ...JSON.parse(JSON.stringify(preset.card_style)) }
    if (!formName.value) {
      formName.value = preset.name
    }
    selectedElementId.value = null
  }

  return {
    // Estado da lista
    items,
    isLoading,
    error,

    // Estado do editor
    editingId,
    formName,
    formCategory,
    formIsActive,
    formSortOrder,

    // Elementos e estilo
    elements,
    cardStyle,

    // Selecao
    selectedElementId,
    selectedElement,

    // Computed
    liveTemplate,

    // CRUD
    fetchTemplates,
    saveTemplate,
    deleteTemplate,

    // Editor
    openEditor,
    addElement,
    removeElement,
    duplicateElement,
    updateElement,
    updateSelectedElement,
    selectElement,

    // Presets
    applyPreset,
    presets: PRESETS,

    // Dados mock para preview
    mockProducts: MOCK_PRODUCTS,
  }
}
