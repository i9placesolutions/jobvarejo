<script setup lang="ts">
import {
  ArrowLeft, Loader2, Image, Package, Layers,
  X, ExternalLink, ClipboardPaste, ShoppingCart,
  Wand2, ScanSearch, Check, AlertCircle, Download,
  RefreshCw, FileStack, CheckCircle2, Type,
  ChevronDown, ChevronUp, Building2, Calendar,
  MapPin, Phone, MessageCircle, Instagram,
  Globe, Plus,
} from 'lucide-vue-next'
import type { CanvaMappedProduct } from '~/types/canva'

definePageMeta({
  layout: false,
  middleware: 'builder-auth',
})

const route = useRoute()
const designId = route.params.id as string
const canva = useCanva()
const auth = useBuilderAuth()
const tenantId = computed(() => auth.tenant.value?.id || '')

// Estado local
const isLoading = ref(true)
const isAnalyzing = ref(false)
const isExporting = ref(false)
const activePage = ref(1)
const showCatalogPicker = ref(false)
const showPasteList = ref(false)

// Conferencia antes de enviar
const showReview = ref(false)
const reviewPageIndex = ref(1)
const reviewProducts = ref<CanvaMappedProduct[]>([])
const designInfo = ref<any>(null)
const analysis = ref<any>(null)
const step = ref<'loading' | 'analyzed' | 'applying' | 'done'>('loading')

// Secoes colapsaveis
const sections = ref({
  company: true,
  validity: true,
  texts: true,
  products: true,
})

const toggleSection = (key: 'company' | 'validity' | 'texts' | 'products') => {
  sections.value[key] = !sections.value[key]
}

// Tipo do design detectado pela IA
const designType = computed(() => analysis.value?.design_type || 'offer')
const isInstitutional = computed(() => designType.value === 'institutional')
const isMixed = computed(() => designType.value === 'mixed')
const hasProducts = computed(() => designType.value === 'offer' || designType.value === 'mixed')
const hasEditableTexts = computed(() => designType.value === 'institutional' || designType.value === 'mixed')
const hasValidity = computed(() => designType.value === 'offer' || designType.value === 'mixed')

// Dados da empresa (tenant)
const tenant = computed(() => auth.tenant.value)
const tenantLogoUrl = computed(() => {
  if (!tenant.value?.logo) return null
  const logo = tenant.value.logo
  if (logo.startsWith('http') || logo.startsWith('/api/')) return logo
  return `/api/storage/p?key=${encodeURIComponent(logo)}`
})

// Data de validade
const validityMode = ref<'dates' | 'custom'>('dates')
const validityFrom = ref('')
const validityUntil = ref('')
const validityCustomText = ref('')
const validityOriginalText = ref('')

// Textos editaveis para modo institucional/misto
const editableTexts = computed(() => {
  if (!analysis.value?.pages) return []
  const texts: Array<{
    element_id: string
    page_index: number
    category: string
    text: string
    label: string
  }> = []
  for (const page of analysis.value.pages) {
    for (const el of (page.editable_texts || [])) {
      // Ignorar elementos de data (tratados na secao de validade)
      if (el.category === 'promo_date') continue
      // Ignorar elementos de empresa (tratados na secao de empresa)
      if (el.category?.startsWith('company_') || el.category?.startsWith('contact_')) continue

      const labels: Record<string, string> = {
        'promo_title': 'Titulo Promocional',
        'promo_subtitle': 'Subtitulo',
        'custom_text': 'Texto',
        'slogan': 'Slogan',
        'title': 'Titulo',
        'subtitle': 'Subtitulo',
        'heading': 'Titulo',
        'body': 'Texto',
        'description': 'Descricao',
      }
      texts.push({
        element_id: el.element_id,
        page_index: page.page_index,
        category: el.category,
        text: el.raw_text || '',
        label: labels[el.category] || 'Texto',
      })
    }
  }
  return texts
})

// Textos editados pelo cliente (apenas os que foram alterados)
const editedTexts = ref<Record<string, string>>({})

// Elementos de data de validade do design
const validityElements = computed(() => {
  if (!analysis.value?.pages) return []
  const elements: Array<{ element_id: string; page_index: number; raw_text: string }> = []
  for (const page of analysis.value.pages) {
    for (const el of (page.editable_texts || [])) {
      if (el.category === 'promo_date') {
        elements.push({
          element_id: el.element_id,
          page_index: page.page_index,
          raw_text: el.raw_text || '',
        })
      }
    }
  }
  return elements
})

// Produtos organizados por pagina: { 1: [...], 2: [...], 3: [...] }
const productsByPage = ref<Record<number, CanvaMappedProduct[]>>({})

// Thumbnails por pagina: { 1: 'url', 2: 'url', ... }
const pageThumbnails = ref<Record<number, string | null>>({})

// Paginas que foram editadas pelo cliente
const editedPages = ref<Set<number>>(new Set())

// Companion (sugestao de Story quando fazendo Feed)
const companion = ref<any>(null)
const showCompanionSuggestion = ref(false)
const showCompanionPicker = ref(false)
const companionDismissed = ref(false)
const isCreatingCompanion = ref(false)

// Total de paginas vindo da analise
const totalPages = computed(() => analysis.value?.total_pages || 1)

// Lista de numeros de pagina para as abas
const pageNumbers = computed(() => {
  const pages: number[] = []
  for (let i = 1; i <= totalPages.value; i++) {
    pages.push(i)
  }
  return pages
})

// Produtos da pagina ativa
const currentPageProducts = computed({
  get: () => productsByPage.value[activePage.value] || [],
  set: (val: CanvaMappedProduct[]) => {
    productsByPage.value[activePage.value] = val
  },
})

// Slots da analise da pagina ativa
const currentPageSlots = computed(() => {
  if (!analysis.value?.products) return []
  return analysis.value.products.filter((p: any) => p.page_index === activePage.value)
})

// Quantidade de produtos por pagina (da analise)
const productsCountPerPage = computed(() => {
  if (!analysis.value?.products_per_page) return {}
  return analysis.value.products_per_page
})

// Thumbnail da pagina ativa
const currentThumbnail = computed(() => {
  return pageThumbnails.value[activePage.value] || analysis.value?.thumbnail || null
})

// Total geral de produtos preenchidos (todas as paginas)
const totalFilledProducts = computed(() => {
  let count = 0
  for (const pageIdx of Object.keys(productsByPage.value)) {
    const list = productsByPage.value[Number(pageIdx)]
    count += list.filter(p => !!p.name).length
  }
  return count
})

// Formato de preco
const formatPrice = (price: number | null): string => {
  if (price === null || price === undefined) return '--'
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Resolver URL da imagem
const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

// Carregar info do design
const loadDesign = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<any>(`/api/canva/designs/${designId}`)
    designInfo.value = data
  } catch (err: any) {
    console.error('Erro ao carregar design:', err)
    canva.error.value = 'Erro ao carregar design'
  } finally {
    isLoading.value = false
  }
}

// Buscar design companion (ex: Story para Feed)
const loadCompanion = async (templateId: string) => {
  try {
    const data = await $fetch<any>(`/api/canva/companions/${templateId}`)
    if (data.companions && data.companions.length > 0) {
      companion.value = data.companions[0]
    }
  } catch {
    // Sem companion disponivel
  }
}

// Carregar thumbnails de cada pagina
const loadPageThumbnails = async () => {
  try {
    const data = await $fetch<any>(`/api/canva/designs/${designId}/pages`)
    if (data && Array.isArray(data.pages)) {
      for (const page of data.pages) {
        pageThumbnails.value[page.index || page.page_index] = page.thumbnail || null
      }
    } else if (data && typeof data === 'object') {
      for (const [idx, info] of Object.entries(data)) {
        pageThumbnails.value[Number(idx)] = (info as any)?.thumbnail || null
      }
    }
  } catch (err: any) {
    console.error('Erro ao carregar thumbnails das paginas:', err)
  }
}

// Analisar design
const analyzeDesignAction = async () => {
  isAnalyzing.value = true
  try {
    const result = await canva.analyzeDesign(designId)
    analysis.value = result

    // Inicializar textos editaveis (vazio = manter original)
    if (result.design_type === 'institutional' || result.design_type === 'mixed') {
      editedTexts.value = {}
    }

    // Capturar texto original de data de validade
    if (result.pages) {
      for (const page of result.pages) {
        for (const el of (page.editable_texts || [])) {
          if (el.category === 'promo_date' && el.raw_text) {
            validityOriginalText.value = el.raw_text
            break
          }
        }
        if (validityOriginalText.value) break
      }
    }

    // Pre-preencher lista de produtos por pagina com slots vazios
    const byPage: Record<number, CanvaMappedProduct[]> = {}
    for (const p of (result.products || [])) {
      const pageIdx = p.page_index || 1
      if (!byPage[pageIdx]) byPage[pageIdx] = []
      byPage[pageIdx].push({
        name: p.name?.text || '',
        offer_price: p.price?.text ? parseFloat(p.price.text.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
        unit: p.unit || 'UN',
        image: null,
        image_wasabi_key: null,
      })
    }
    productsByPage.value = byPage

    // Garantir que a pagina ativa eh valida
    if (!byPage[activePage.value]) {
      activePage.value = Number(Object.keys(byPage)[0]) || 1
    }

    step.value = 'analyzed'

    // Carregar thumbnails em paralelo
    loadPageThumbnails()
  } catch (err: any) {
    console.error('Erro ao analisar:', err)
  } finally {
    isAnalyzing.value = false
  }
}

// Adicionar produto na pagina ativa
const addProduct = () => {
  if (!productsByPage.value[activePage.value]) {
    productsByPage.value[activePage.value] = []
  }
  productsByPage.value[activePage.value].push({
    name: '',
    offer_price: null,
    unit: 'UN',
    image: null,
  })
}

// Remover produto da pagina ativa
const removeProduct = (index: number) => {
  if (productsByPage.value[activePage.value]) {
    productsByPage.value[activePage.value].splice(index, 1)
  }
}

// Receber produtos do catalogo (preenche na pagina ativa)
const onCatalogSelect = (products: Array<{ name: string; image: string | null; brand: string | null }>) => {
  if (!productsByPage.value[activePage.value]) {
    productsByPage.value[activePage.value] = []
  }
  const list = productsByPage.value[activePage.value]

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const emptyIdx = list.findIndex((slot, idx) => idx >= 0 && !slot.name)
    if (emptyIdx !== -1) {
      list[emptyIdx].name = p.name
      list[emptyIdx].image = p.image
      list[emptyIdx].image_wasabi_key = p.image
    } else {
      list.push({
        name: p.name,
        offer_price: null,
        unit: 'UN',
        image: p.image,
        image_wasabi_key: p.image,
      })
    }
  }
}

// Receber produtos da lista colada (preenche na pagina ativa)
const onPasteProducts = (items: Array<{ name: string; price: number | null }>) => {
  if (!productsByPage.value[activePage.value]) {
    productsByPage.value[activePage.value] = []
  }
  const list = productsByPage.value[activePage.value]

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (i < list.length) {
      list[i].name = item.name
      list[i].offer_price = item.price
    } else {
      list.push({
        name: item.name,
        offer_price: item.price,
        unit: 'UN',
        image: null,
      })
    }
  }
}

// Marcar pagina como editada quando o cliente altera algum produto
const markPageEdited = (pageIndex: number) => {
  editedPages.value.add(pageIndex)
}

// Verificar se pagina foi editada
const isPageEdited = (pageIndex: number): boolean => {
  return editedPages.value.has(pageIndex)
}

// Paginas editadas ordenadas
const editedPagesList = computed(() => {
  return Array.from(editedPages.value).sort((a, b) => a - b)
})

// Exportar apenas as paginas editadas
const exportEditedPages = async () => {
  if (editedPagesList.value.length === 0) return
  isExporting.value = true
  canva.error.value = null

  try {
    const data = await $fetch<any>(`/api/canva/designs/${designId}/export`, {
      method: 'POST',
      body: {
        format: 'png',
        pages: editedPagesList.value,
      },
    })

    if (data.download_url) {
      window.open(data.download_url, '_blank')
    } else if (data.urls && data.urls.length > 0) {
      for (const url of data.urls) {
        window.open(url, '_blank')
      }
    }
  } catch (err: any) {
    console.error('Erro ao exportar:', err)
    canva.error.value = 'Erro ao exportar paginas'
  } finally {
    isExporting.value = false
  }
}

// Montar mapeamentos de empresa para uma pagina
const buildCompanyMappings = (pageIndex: number): any[] => {
  const mappingsToApply: any[] = []
  if (!analysis.value?.pages || !tenant.value) return mappingsToApply

  for (const page of analysis.value.pages) {
    if (page.page_index !== pageIndex) continue
    for (const el of (page.company_elements || [])) {
      const t = tenant.value
      const categoryMap: Record<string, string | null> = {
        'contact_address': t.address,
        'contact_whatsapp': t.whatsapp,
        'contact_phone': t.phone,
        'contact_instagram': t.instagram,
        'contact_website': t.website,
        'company_name': t.name,
        'company_slogan': t.slogan,
      }
      const value = categoryMap[el.category]
      if (value) {
        mappingsToApply.push({
          slot_index: -1,
          element_id: el.element_id,
          type: 'name',
          page_index: el.page_index || pageIndex,
          page_id: '',
          product: { name: value, offer_price: null, unit: null },
        })
      }
    }
  }

  // Logo da empresa
  if (tenant.value.logo) {
    for (const page of analysis.value.pages) {
      if (page.page_index !== pageIndex) continue
      for (const el of (page.company_elements || [])) {
        if (el.category === 'company_logo') {
          mappingsToApply.push({
            slot_index: -1,
            element_id: el.element_id,
            type: 'image',
            page_index: el.page_index || pageIndex,
            page_id: '',
            product: {
              name: 'Logo',
              offer_price: null,
              unit: null,
              image_wasabi_key: tenant.value.logo,
            },
          })
        }
      }
    }
  }

  return mappingsToApply
}

// Montar mapeamentos de data de validade
const buildValidityMappings = (): any[] => {
  const mappingsToApply: any[] = []
  if (!hasValidity.value || validityElements.value.length === 0) return mappingsToApply

  let dateText = ''
  if (validityMode.value === 'custom' && validityCustomText.value.trim()) {
    dateText = validityCustomText.value.trim()
  } else if (validityMode.value === 'dates' && (validityFrom.value || validityUntil.value)) {
    if (validityFrom.value && validityUntil.value) {
      const from = formatDateBR(validityFrom.value)
      const until = formatDateBR(validityUntil.value)
      dateText = `Valido de ${from} ate ${until}`
    } else if (validityUntil.value) {
      dateText = `Valido ate ${formatDateBR(validityUntil.value)}`
    } else if (validityFrom.value) {
      dateText = `A partir de ${formatDateBR(validityFrom.value)}`
    }
  }

  if (!dateText) return mappingsToApply

  for (const el of validityElements.value) {
    mappingsToApply.push({
      slot_index: -1,
      element_id: el.element_id,
      type: 'name',
      page_index: el.page_index,
      page_id: '',
      product: { name: dateText, offer_price: null, unit: null },
    })
  }

  return mappingsToApply
}

// Formatar data para pt-BR
const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

// Montar mapeamentos de textos editados
const buildTextMappings = (): any[] => {
  const mappingsToApply: any[] = []
  if (!hasEditableTexts.value) return mappingsToApply

  for (const field of editableTexts.value) {
    const newText = editedTexts.value[field.element_id]
    // So envia se o cliente digitou algo diferente do original
    if (newText !== undefined && newText !== '' && newText !== field.text) {
      mappingsToApply.push({
        slot_index: -1,
        element_id: field.element_id,
        type: 'name',
        page_index: field.page_index,
        page_id: '',
        product: { name: newText, offer_price: null, unit: null },
      })
    }
  }

  return mappingsToApply
}

// Aplicar produtos de UMA pagina especifica
const applyPageProducts = async (pageIndex: number) => {
  const pageProducts = productsByPage.value[pageIndex]
  if (!analysis.value) return false

  step.value = 'applying'
  canva.error.value = null

  try {
    const txn = await canva.startTransaction(designId)
    const transactionId = txn.transaction_id

    const mappingsToApply: any[] = []

    // 1. Dados da empresa (SEMPRE)
    mappingsToApply.push(...buildCompanyMappings(pageIndex))

    // 2. Data de validade (se oferta/misto)
    mappingsToApply.push(...buildValidityMappings())

    // 3. Textos editados (se institucional/misto)
    mappingsToApply.push(...buildTextMappings())

    // 4. Produtos (se oferta/misto e tem produtos na pagina)
    if (hasProducts.value && pageProducts && pageProducts.length > 0) {
      const pageSlots = analysis.value.products.filter((p: any) => p.page_index === pageIndex)

      for (let i = 0; i < pageProducts.length; i++) {
        const product = pageProducts[i]
        const slot = pageSlots[i]
        if (!slot || !product.name) continue

        if (slot.name) {
          let nameText = product.name
          if (product.unit && product.unit !== 'UN') {
            nameText += ` ${product.unit}`
          }
          mappingsToApply.push({
            slot_index: slot.index,
            element_id: slot.name.element_id,
            type: 'name',
            page_index: slot.page_index,
            page_id: slot.page_id,
            product: { ...product, name: nameText },
          })
        }

        if (slot.price && product.offer_price !== null) {
          mappingsToApply.push({
            slot_index: slot.index,
            element_id: slot.price.element_id,
            type: 'price',
            page_index: slot.page_index,
            page_id: slot.page_id,
            product: { ...product },
          })
        }

        if (slot.images && slot.images.length > 0 && product.image_wasabi_key) {
          mappingsToApply.push({
            slot_index: slot.index,
            element_id: slot.images[0].element_id,
            image_element_ids: slot.images.map((img: any) => img.element_id),
            type: 'image',
            page_index: slot.page_index,
            page_id: slot.page_id,
            product: { ...product },
          })
        } else if (slot.image && product.image_wasabi_key) {
          mappingsToApply.push({
            slot_index: slot.index,
            element_id: slot.image.element_id,
            image_element_ids: [slot.image.element_id],
            type: 'image',
            page_index: slot.page_index,
            page_id: slot.page_id,
            product: { ...product },
          })
        }
      }
    }

    // Upload das imagens do Wasabi para o Canva
    for (const mapping of mappingsToApply) {
      if (mapping.type === 'image' && mapping.product?.image_wasabi_key && !mapping.product?.canva_asset_id) {
        try {
          const assetId = await canva.uploadImageToCanva(
            mapping.product.image_wasabi_key,
            mapping.product.name || 'produto'
          )
          if (assetId) {
            mapping.product.canva_asset_id = assetId
          }
        } catch (err) {
          console.error('Erro ao fazer upload de imagem:', err)
        }
      }
    }

    // Setar mappings no composable e aplicar
    canva.mappings.value = mappingsToApply
    const result = await canva.applyMappings(transactionId)

    if (result.success || (result as any).products_applied > 0) {
      await canva.commitTransaction(transactionId)
      markPageEdited(pageIndex)
      return true
    } else {
      await canva.cancelTransaction(transactionId)
      canva.error.value = `Nenhum elemento aplicado na pagina ${pageIndex}`
      return false
    }
  } catch (err: any) {
    console.error('Erro ao aplicar pagina:', err)
    return false
  }
}

// Aplicar modo institucional (sem produtos, apenas textos + empresa)
const applyInstitutionalTexts = async () => {
  step.value = 'applying'
  canva.error.value = null

  try {
    const txn = await canva.startTransaction(designId)
    const mappingsToApply: any[] = []

    // 1. Dados da empresa (SEMPRE)
    for (const page of (analysis.value?.pages || [])) {
      mappingsToApply.push(...buildCompanyMappings(page.page_index))
    }

    // 2. Textos editados
    mappingsToApply.push(...buildTextMappings())

    if (mappingsToApply.length === 0) {
      await canva.cancelTransaction(txn.transaction_id)
      canva.error.value = 'Nenhuma alteracao para aplicar'
      step.value = 'analyzed'
      return
    }

    canva.mappings.value = mappingsToApply
    const result = await canva.applyMappings(txn.transaction_id)

    if (result.success || (result as any).products_applied > 0) {
      await canva.commitTransaction(txn.transaction_id)
      for (const page of (analysis.value?.pages || [])) {
        markPageEdited(page.page_index)
      }
      step.value = 'done'
    } else {
      await canva.cancelTransaction(txn.transaction_id)
      step.value = 'analyzed'
    }
  } catch (err: any) {
    console.error('Erro ao aplicar textos:', err)
    step.value = 'analyzed'
  }
}

// Abrir conferencia antes de aplicar
const openReview = (pageIndex: number) => {
  const products = productsByPage.value[pageIndex]
  if (!products || products.length === 0) return
  reviewPageIndex.value = pageIndex
  reviewProducts.value = products.map(p => ({ ...p }))
  showReview.value = true
}

// Quando o cliente confirma na conferencia
const onReviewConfirm = async (confirmedProducts: CanvaMappedProduct[]) => {
  showReview.value = false
  productsByPage.value[reviewPageIndex.value] = confirmedProducts
  step.value = 'applying'
  const success = await applyPageProducts(reviewPageIndex.value)
  step.value = success ? 'done' : 'analyzed'
}

// Conferencia para todas as paginas (abre a primeira que tem produtos)
const openReviewAll = () => {
  for (const pageIdx of pageNumbers.value) {
    const products = productsByPage.value[pageIdx]
    if (products && products.some(p => !!p.name)) {
      reviewPageIndex.value = pageIdx
      reviewProducts.value = products.map(p => ({ ...p }))
      showReview.value = true
      return
    }
  }
}

// Aplicar TODAS as paginas de uma vez
const applyAllPages = async () => {
  if (!analysis.value) return
  step.value = 'applying'
  canva.error.value = null

  let allSuccess = true
  for (const pageIdx of pageNumbers.value) {
    const pageProducts = productsByPage.value[pageIdx]
    if (!pageProducts || pageProducts.length === 0) continue
    if (pageProducts.every(p => !p.name)) continue

    const success = await applyPageProducts(pageIdx)
    if (!success) allSuccess = false
  }

  step.value = allSuccess ? 'done' : 'analyzed'
}

// Verificar se a pagina ativa tem produtos preenchidos
const currentPageHasProducts = computed(() => {
  const list = productsByPage.value[activePage.value]
  return list && list.some(p => !!p.name)
})

// Verificar se qualquer pagina tem produtos preenchidos
const anyPageHasProducts = computed(() => {
  for (const pageIdx of Object.keys(productsByPage.value)) {
    const list = productsByPage.value[Number(pageIdx)]
    if (list && list.some(p => !!p.name)) return true
  }
  return false
})

// Validacao de quantidade de produtos por pagina
const currentPageValidation = computed(() => {
  const slots = productsCountPerPage.value[activePage.value] || 0
  const filled = currentPageProducts.value.filter(p => !!p.name).length

  if (filled === 0) return { valid: false, message: 'Preencha os produtos' }
  if (filled < slots) return { valid: false, message: `Faltam ${slots - filled} produtos. Esta pagina aceita exatamente ${slots}.` }
  if (filled > slots) return { valid: false, message: `${filled - slots} produtos a mais. Esta pagina aceita no maximo ${slots}.` }
  return { valid: true, message: '' }
})

// Companion
const companionTotalSlots = computed(() => {
  if (!companion.value?.products_per_page) return 0
  return Object.values(companion.value.products_per_page as Record<string, number>)
    .reduce((sum: number, count: number) => sum + count, 0)
})

const onAcceptCompanion = () => {
  showCompanionSuggestion.value = false
  const allProducts: any[] = []
  for (const pageIdx of Object.keys(productsByPage.value)) {
    const list = productsByPage.value[Number(pageIdx)]
    for (const p of list) {
      if (p.name) allProducts.push({ ...p })
    }
  }

  const maxSlots = companionTotalSlots.value

  if (allProducts.length === maxSlots) {
    createCompanionDesign(allProducts)
  } else {
    showCompanionPicker.value = true
  }
}

const onCompanionProductsSelected = (selectedProducts: any[]) => {
  showCompanionPicker.value = false
  createCompanionDesign(selectedProducts)
}

const createCompanionDesign = async (products: any[]) => {
  if (!companion.value || isCreatingCompanion.value) return
  isCreatingCompanion.value = true
  canva.error.value = null

  try {
    const result = await $fetch<any>(`/api/canva/templates/${companion.value.id}/copy`, {
      method: 'POST',
      body: { title: `${companion.value.label} - ${designInfo.value?.title || 'Meu Design'}` },
      credentials: 'include',
    })

    if (result.design?.id) {
      sessionStorage.setItem('companion_products', JSON.stringify(products))
      await navigateTo(`/canva/${result.design.id}?companion=true`)
    }
  } catch (err: any) {
    console.error('Erro ao criar companion:', err)
    canva.error.value = 'Erro ao criar design companion'
  } finally {
    isCreatingCompanion.value = false
  }
}

// Acao principal do botao final
const handleMainAction = () => {
  if (isInstitutional.value) {
    applyInstitutionalTexts()
  } else if (hasProducts.value) {
    openReview(activePage.value)
  }
}

const handleApplyAll = () => {
  if (hasProducts.value) {
    openReviewAll()
  }
}

const goBack = () => navigateTo('/canva')

onMounted(async () => {
  await loadDesign()
  await analyzeDesignAction()

  // Verificar se veio com produtos de um companion
  if (route.query.companion === 'true') {
    const stored = sessionStorage.getItem('companion_products')
    if (stored) {
      try {
        const companionProducts = JSON.parse(stored)
        if (productsByPage.value[1]) {
          const list = productsByPage.value[1]
          for (let i = 0; i < Math.min(companionProducts.length, list.length); i++) {
            list[i].name = companionProducts[i].name
            list[i].offer_price = companionProducts[i].offer_price
            list[i].unit = companionProducts[i].unit || 'UN'
            list[i].image = companionProducts[i].image || null
          }
        }
      } catch {
        // Erro ao parsear produtos do companion
      }
      sessionStorage.removeItem('companion_products')
    }
  }

  // Carregar companion se temos template_id
  if (designInfo.value?.template_id) {
    loadCompanion(designInfo.value.template_id)
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#0f0f0f] text-white">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-white/5 bg-[#0f0f0f]/90 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <button @click="goBack" class="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft class="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <h1 class="text-sm font-semibold text-white truncate max-w-[300px]">
          {{ designInfo?.title || 'Carregando...' }}
        </h1>

        <div class="flex items-center gap-2">
          <a
            v-if="designInfo?.urls?.edit_url"
            :href="designInfo.urls.edit_url"
            target="_blank"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Abrir no Canva</span>
          </a>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-32">
      <div class="text-center">
        <Loader2 class="w-8 h-8 text-violet-500 animate-spin mx-auto mb-4" />
        <p class="text-sm text-zinc-500">Carregando design...</p>
      </div>
    </div>

    <!-- Conteudo -->
    <div v-else class="max-w-7xl mx-auto px-4 py-6">
      <!-- Erro -->
      <div v-if="canva.error.value" class="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p class="text-sm text-red-300">{{ canva.error.value }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- ============================================ -->
        <!-- COLUNA ESQUERDA: Preview do Design           -->
        <!-- ============================================ -->
        <div>
          <div class="bg-[#18181b]/80 border border-white/5 rounded-2xl overflow-hidden">
            <div class="aspect-square bg-[#09090b] flex items-center justify-center p-4">
              <img
                v-if="currentThumbnail"
                :src="currentThumbnail"
                :alt="`${designInfo?.title} - Pagina ${activePage}`"
                class="max-w-full max-h-full object-contain rounded-lg"
              />
              <div v-else class="text-center">
                <Image class="w-16 h-16 text-zinc-700 mx-auto mb-3" />
                <p class="text-sm text-zinc-500">Preview nao disponivel</p>
              </div>
            </div>

            <!-- Info do Design + Analise -->
            <div class="p-4 border-t border-white/5">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold text-white">{{ designInfo?.title || 'Sem titulo' }}</h2>
                <span class="text-[11px] text-zinc-500">{{ totalPages }} pag.</span>
              </div>

              <!-- Analise em andamento -->
              <div v-if="isAnalyzing" class="flex items-center gap-2 py-3">
                <ScanSearch class="w-4 h-4 text-violet-400 animate-pulse" />
                <span class="text-xs text-zinc-400">Analisando estrutura do design...</span>
              </div>

              <!-- Resultado da analise -->
              <div v-else-if="analysis" class="space-y-2">
                <div class="flex items-center gap-2">
                  <Check class="w-4 h-4 text-emerald-400" />
                  <span class="text-xs text-emerald-400 font-medium">
                    {{ analysis.products?.length || 0 }} produtos detectados em {{ totalPages }} paginas
                  </span>
                </div>
                <div class="flex flex-wrap gap-2 text-[10px] text-zinc-500">
                  <span v-for="(count, page) in productsCountPerPage" :key="page" class="px-2 py-0.5 bg-white/5 rounded">
                    Pag {{ page }}: {{ count }} produtos
                  </span>
                </div>
                <div class="flex items-center gap-2 text-[10px]">
                  <span class="text-zinc-500">Tipo:</span>
                  <span :class="isInstitutional ? 'text-blue-400' : isMixed ? 'text-amber-400' : 'text-violet-400'">
                    {{ isInstitutional ? 'Institucional' : isMixed ? 'Misto (Ofertas + Textos)' : 'Ofertas' }}
                  </span>
                </div>
              </div>

              <button
                v-if="!isAnalyzing"
                @click="analyzeDesignAction"
                class="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors"
              >
                <RefreshCw class="w-3 h-3" />
                Re-analisar
              </button>
            </div>
          </div>

          <!-- Card sucesso + export -->
          <div v-if="step === 'done' || editedPages.size > 0" class="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <Check class="w-5 h-5 text-emerald-400" />
              <h3 class="text-sm font-semibold text-emerald-300">
                {{ editedPages.size }} {{ editedPages.size === 1 ? 'pagina editada' : 'paginas editadas' }}
              </h3>
            </div>
            <p class="text-[11px] text-zinc-400 mb-3">
              Paginas: {{ editedPagesList.join(', ') }}. Apenas essas serao exportadas.
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                @click="exportEditedPages"
                :disabled="isExporting"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Loader2 v-if="isExporting" class="w-3.5 h-3.5 animate-spin" />
                <Download v-else class="w-3.5 h-3.5" />
                {{ isExporting ? 'Exportando...' : 'Baixar paginas editadas' }}
              </button>
              <a
                v-if="designInfo?.urls?.edit_url"
                :href="designInfo.urls.edit_url"
                target="_blank"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-white/5"
              >
                <ExternalLink class="w-3.5 h-3.5" />
                Abrir no Canva
              </a>
            </div>
          </div>

          <!-- Sugestao de Companion (ex: Story) -->
          <CanvaCompanionSuggestion
            v-if="companion && !companionDismissed && editedPages.size > 0"
            :companion="companion"
            :total-products="totalFilledProducts"
            @accept="onAcceptCompanion"
            @dismiss="companionDismissed = true"
          />
        </div>

        <!-- ============================================ -->
        <!-- COLUNA DIREITA: Secoes de Edicao             -->
        <!-- ============================================ -->
        <div class="space-y-4 overflow-y-auto max-h-[calc(100vh-120px)] pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

          <!-- ============================== -->
          <!-- SECAO 1: DADOS DA EMPRESA      -->
          <!-- ============================== -->
          <div class="bg-[#18181b]/80 border border-white/5 rounded-2xl overflow-hidden">
            <button
              @click="toggleSection('company')"
              class="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                  <Building2 class="w-4 h-4 text-violet-400" />
                </div>
                <div class="text-left">
                  <h2 class="text-sm font-semibold text-white">Dados da Empresa</h2>
                  <p class="text-[11px] text-zinc-500">Substituidos automaticamente no design</p>
                </div>
              </div>
              <ChevronDown v-if="!sections.company" class="w-4 h-4 text-zinc-500" />
              <ChevronUp v-else class="w-4 h-4 text-zinc-500" />
            </button>

            <div v-if="sections.company" class="px-5 pb-4 border-t border-white/5">
              <div class="pt-4 space-y-3">
                <!-- Logo -->
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      v-if="tenantLogoUrl"
                      :src="tenantLogoUrl"
                      alt="Logo"
                      class="w-full h-full object-contain"
                    />
                    <Building2 v-else class="w-5 h-5 text-zinc-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-white truncate">{{ tenant?.name || 'Sem nome' }}</p>
                    <p class="text-[10px] text-zinc-500">{{ tenant?.logo ? 'Logo configurada' : 'Sem logo' }}</p>
                  </div>
                </div>

                <!-- Campos readonly -->
                <div class="space-y-2">
                  <!-- Endereco -->
                  <div class="flex items-center gap-2 text-xs">
                    <MapPin class="w-3.5 h-3.5 shrink-0" :class="tenant?.address ? 'text-emerald-400' : 'text-amber-400'" />
                    <span class="text-zinc-400 truncate">{{ tenant?.address || 'Endereco nao informado' }}</span>
                    <Check v-if="tenant?.address" class="w-3 h-3 text-emerald-400 shrink-0" />
                    <AlertCircle v-else class="w-3 h-3 text-amber-400 shrink-0" />
                  </div>

                  <!-- WhatsApp -->
                  <div class="flex items-center gap-2 text-xs">
                    <MessageCircle class="w-3.5 h-3.5 shrink-0" :class="tenant?.whatsapp ? 'text-emerald-400' : 'text-amber-400'" />
                    <span class="text-zinc-400 truncate">{{ tenant?.whatsapp || 'WhatsApp nao informado' }}</span>
                    <Check v-if="tenant?.whatsapp" class="w-3 h-3 text-emerald-400 shrink-0" />
                    <AlertCircle v-else class="w-3 h-3 text-amber-400 shrink-0" />
                  </div>

                  <!-- Telefone -->
                  <div class="flex items-center gap-2 text-xs">
                    <Phone class="w-3.5 h-3.5 shrink-0" :class="tenant?.phone ? 'text-emerald-400' : 'text-amber-400'" />
                    <span class="text-zinc-400 truncate">{{ tenant?.phone || 'Telefone nao informado' }}</span>
                    <Check v-if="tenant?.phone" class="w-3 h-3 text-emerald-400 shrink-0" />
                    <AlertCircle v-else class="w-3 h-3 text-amber-400 shrink-0" />
                  </div>

                  <!-- Instagram -->
                  <div class="flex items-center gap-2 text-xs">
                    <Instagram class="w-3.5 h-3.5 shrink-0" :class="tenant?.instagram ? 'text-emerald-400' : 'text-amber-400'" />
                    <span class="text-zinc-400 truncate">{{ tenant?.instagram || 'Instagram nao informado' }}</span>
                    <Check v-if="tenant?.instagram" class="w-3 h-3 text-emerald-400 shrink-0" />
                    <AlertCircle v-else class="w-3 h-3 text-amber-400 shrink-0" />
                  </div>
                </div>

                <!-- Link editar perfil -->
                <a
                  href="/builder/profile"
                  target="_blank"
                  class="inline-flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 transition-colors mt-1"
                >
                  <ExternalLink class="w-3 h-3" />
                  Editar dados da empresa
                </a>

                <p class="text-[10px] text-zinc-600 mt-1">
                  Esses dados serao substituidos automaticamente no design
                </p>
              </div>
            </div>
          </div>

          <!-- ============================== -->
          <!-- SECAO 2: DATA DE VALIDADE      -->
          <!-- (So para offer e mixed)        -->
          <!-- ============================== -->
          <div v-if="hasValidity && analysis" class="bg-[#18181b]/80 border border-white/5 rounded-2xl overflow-hidden">
            <button
              @click="toggleSection('validity')"
              class="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Calendar class="w-4 h-4 text-amber-400" />
                </div>
                <div class="text-left">
                  <h2 class="text-sm font-semibold text-white">Data de Validade</h2>
                  <p class="text-[11px] text-zinc-500">Periodo da promocao</p>
                </div>
              </div>
              <ChevronDown v-if="!sections.validity" class="w-4 h-4 text-zinc-500" />
              <ChevronUp v-else class="w-4 h-4 text-zinc-500" />
            </button>

            <div v-if="sections.validity" class="px-5 pb-4 border-t border-white/5">
              <div class="pt-4 space-y-4">
                <!-- Texto original do design -->
                <div v-if="validityOriginalText" class="p-3 bg-white/[0.03] border border-white/5 rounded-lg">
                  <p class="text-[10px] text-zinc-500 mb-1">Texto original do design:</p>
                  <p class="text-xs text-zinc-300 italic">"{{ validityOriginalText }}"</p>
                </div>

                <!-- Toggle modo -->
                <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                  <button
                    @click="validityMode = 'dates'"
                    class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                    :class="validityMode === 'dates'
                      ? 'bg-violet-600/30 text-violet-300 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-300'"
                  >
                    Usar datas
                  </button>
                  <button
                    @click="validityMode = 'custom'"
                    class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                    :class="validityMode === 'custom'
                      ? 'bg-violet-600/30 text-violet-300 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-300'"
                  >
                    Texto personalizado
                  </button>
                </div>

                <!-- Modo datas -->
                <div v-if="validityMode === 'dates'" class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] text-zinc-400 mb-1">Valido de</label>
                    <input
                      v-model="validityFrom"
                      type="date"
                      class="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-lg text-sm text-white outline-none focus:border-violet-500/50 transition-colors [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label class="block text-[11px] text-zinc-400 mb-1">Valido ate</label>
                    <input
                      v-model="validityUntil"
                      type="date"
                      class="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-lg text-sm text-white outline-none focus:border-violet-500/50 transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>

                <!-- Modo texto personalizado -->
                <div v-else>
                  <label class="block text-[11px] text-zinc-400 mb-1">Texto personalizado</label>
                  <input
                    v-model="validityCustomText"
                    :placeholder="validityOriginalText || 'Ex: OFERTA VALIDA NESTA QUINTA 02/04'"
                    class="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>

                <p class="text-[10px] text-zinc-600">
                  Deixe em branco para manter o texto original do design
                </p>
              </div>
            </div>
          </div>

          <!-- ============================== -->
          <!-- SECAO 3: TEXTOS DO DESIGN      -->
          <!-- (So para institutional e mixed)-->
          <!-- ============================== -->
          <div v-if="hasEditableTexts && editableTexts.length > 0 && analysis" class="bg-[#18181b]/80 border border-white/5 rounded-2xl overflow-hidden">
            <button
              @click="toggleSection('texts')"
              class="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Type class="w-4 h-4 text-blue-400" />
                </div>
                <div class="text-left">
                  <h2 class="text-sm font-semibold text-white">Textos do Design</h2>
                  <p class="text-[11px] text-zinc-500">{{ editableTexts.length }} textos editaveis detectados</p>
                </div>
              </div>
              <ChevronDown v-if="!sections.texts" class="w-4 h-4 text-zinc-500" />
              <ChevronUp v-else class="w-4 h-4 text-zinc-500" />
            </button>

            <div v-if="sections.texts" class="border-t border-white/5">
              <div class="max-h-[400px] overflow-y-auto divide-y divide-white/5">
                <div v-for="field in editableTexts" :key="field.element_id" class="px-5 py-3">
                  <label class="block text-[11px] font-medium text-zinc-400 mb-1.5">
                    {{ field.label }}
                    <span class="text-zinc-600 ml-1">(Pag {{ field.page_index }})</span>
                  </label>
                  <textarea
                    v-if="field.text.length > 60"
                    v-model="editedTexts[field.element_id]"
                    :placeholder="field.text"
                    rows="3"
                    class="w-full px-3 py-2 bg-white/5 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors resize-none"
                  />
                  <input
                    v-else
                    v-model="editedTexts[field.element_id]"
                    :placeholder="field.text"
                    class="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
              </div>
              <div class="px-5 py-3 border-t border-white/5">
                <p class="text-[10px] text-zinc-600">
                  Deixe em branco para manter o texto original do design
                </p>
              </div>
            </div>
          </div>

          <!-- ============================== -->
          <!-- SECAO 4: PRODUTOS              -->
          <!-- (So para offer e mixed)        -->
          <!-- ============================== -->
          <div v-if="hasProducts && analysis" class="bg-[#18181b]/80 border border-white/5 rounded-2xl overflow-hidden">
            <button
              @click="toggleSection('products')"
              class="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                  <ShoppingCart class="w-4 h-4 text-emerald-400" />
                </div>
                <div class="text-left">
                  <h2 class="text-sm font-semibold text-white">Produtos</h2>
                  <p class="text-[11px] text-zinc-500">
                    {{ totalFilledProducts }} preenchidos de {{ Object.values(productsCountPerPage).reduce((a: number, b: number) => a + b, 0) }} slots
                  </p>
                </div>
              </div>
              <ChevronDown v-if="!sections.products" class="w-4 h-4 text-zinc-500" />
              <ChevronUp v-else class="w-4 h-4 text-zinc-500" />
            </button>

            <div v-if="sections.products" class="border-t border-white/5">
              <!-- Abas de pagina -->
              <div v-if="totalPages > 0" class="px-4 pt-4 pb-2 border-b border-white/5">
                <div class="flex items-center gap-1 flex-wrap">
                  <button
                    v-for="page in pageNumbers"
                    :key="page"
                    @click="activePage = page"
                    class="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                    :class="activePage === page
                      ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
                      : isPageEdited(page)
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/5 text-zinc-400 border border-transparent hover:bg-white/10 hover:text-zinc-300'"
                  >
                    <CheckCircle2 v-if="isPageEdited(page)" class="w-3 h-3 text-emerald-400" />
                    <FileStack v-else class="w-3 h-3" />
                    <span>Pag {{ page }}</span>
                    <span
                      class="ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
                      :class="activePage === page ? 'bg-violet-500/30 text-violet-200' : 'bg-white/5 text-zinc-500'"
                    >
                      {{ productsCountPerPage[page] || 0 }}
                    </span>
                  </button>
                </div>
                <div v-if="editedPages.size > 0" class="mt-2 text-[10px] text-emerald-400/70">
                  {{ editedPages.size }} de {{ totalPages }} paginas editadas
                </div>
              </div>

              <!-- Botoes de adicao -->
              <div class="px-5 py-3 border-b border-white/5">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs text-zinc-400">
                    Pagina {{ activePage }}
                    <span class="text-zinc-600 ml-1">
                      ({{ currentPageProducts.length }} / {{ productsCountPerPage[activePage] || '?' }} slots)
                    </span>
                  </span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    @click="showCatalogPicker = true"
                    class="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-medium rounded-lg transition-colors border border-violet-500/20"
                  >
                    <ShoppingCart class="w-3.5 h-3.5" />
                    Catalogo
                  </button>
                  <button
                    @click="showPasteList = true"
                    class="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-white/5"
                  >
                    <ClipboardPaste class="w-3.5 h-3.5" />
                    Colar Lista
                  </button>
                  <button
                    @click="addProduct"
                    class="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-white/5"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    Manual
                  </button>
                </div>
              </div>

              <!-- Lista de produtos da pagina ativa -->
              <div class="max-h-[400px] overflow-y-auto">
                <div v-if="currentPageProducts.length === 0" class="flex flex-col items-center justify-center py-12 text-center px-4">
                  <Package class="w-10 h-10 text-zinc-700 mb-3" />
                  <p class="text-sm text-zinc-400 mb-1">Nenhum produto na pagina {{ activePage }}</p>
                  <p class="text-[11px] text-zinc-600">Use o catalogo, cole uma lista ou adicione manualmente</p>
                </div>

                <div v-else class="divide-y divide-white/5">
                  <div
                    v-for="(product, index) in currentPageProducts"
                    :key="`p${activePage}-${index}`"
                    class="px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div class="flex items-start gap-3">
                      <!-- Numero do slot -->
                      <div class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                        :class="currentPageSlots[index] ? 'bg-violet-500/15' : 'bg-zinc-800'"
                      >
                        <span class="text-[10px] font-bold"
                          :class="currentPageSlots[index] ? 'text-violet-400' : 'text-zinc-600'"
                        >{{ index + 1 }}</span>
                      </div>

                      <!-- Imagem -->
                      <div class="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                          v-if="resolveImageUrl(product.image ?? null)"
                          :src="resolveImageUrl(product.image ?? null)!"
                          class="w-full h-full object-contain"
                        />
                        <Image v-else class="w-5 h-5 text-zinc-700" />
                      </div>

                      <!-- Campos -->
                      <div class="flex-1 min-w-0 space-y-2">
                        <input
                          v-model="product.name"
                          :placeholder="currentPageSlots[index]?.name?.text || 'Nome do produto'"
                          class="w-full h-8 px-2.5 bg-white/5 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
                        />
                        <div class="flex gap-2">
                          <div class="relative flex-1">
                            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">R$</span>
                            <input
                              v-model.number="product.offer_price"
                              type="number"
                              step="0.01"
                              :placeholder="currentPageSlots[index]?.price?.text || '0,00'"
                              class="w-full h-8 pl-8 pr-2.5 bg-white/5 border border-white/5 rounded-lg text-sm text-emerald-400 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
                            />
                          </div>
                          <select
                            v-model="product.unit"
                            class="h-8 px-2 bg-white/5 border border-white/5 rounded-lg text-xs text-zinc-300 outline-none focus:border-violet-500/50 transition-colors"
                          >
                            <option value="UN">UN</option>
                            <option value="KG">KG</option>
                            <option value="G">G</option>
                            <option value="100G">100G</option>
                            <option value="500G">500G</option>
                            <option value="L">L</option>
                            <option value="ML">ML</option>
                            <option value="PCT">PCT</option>
                            <option value="CX">CX</option>
                            <option value="DZ">DZ</option>
                            <option value="BANDEJA">BDJ</option>
                            <option value="PEA">PEA</option>
                          </select>
                        </div>
                      </div>

                      <!-- Remover -->
                      <button
                        @click="removeProduct(index)"
                        class="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                      >
                        <X class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Validacao de quantidade -->
              <div v-if="currentPageProducts.length > 0 && !currentPageValidation.valid" class="px-4 py-3 border-t border-white/5">
                <div class="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertCircle class="w-4 h-4 text-amber-400 shrink-0" />
                  <span class="text-xs text-amber-300">{{ currentPageValidation.message }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ============================== -->
          <!-- BOTAO FINAL                    -->
          <!-- ============================== -->
          <div v-if="analysis && step !== 'done'" class="space-y-2">
            <!-- Botao principal -->
            <button
              v-if="isInstitutional"
              @click="applyInstitutionalTexts"
              :disabled="canva.isProcessing.value || step === 'applying'"
              class="w-full flex items-center justify-center gap-2 h-12 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_8px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_12px_25px_rgba(139,92,246,0.4)] border border-violet-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="step === 'applying'" class="w-4 h-4 animate-spin" />
              <Wand2 v-else class="w-4 h-4" />
              <span>{{ step === 'applying' ? 'Aplicando...' : 'Aplicar no Design' }}</span>
            </button>

            <button
              v-else-if="hasProducts && anyPageHasProducts"
              @click="openReview(activePage)"
              :disabled="canva.isProcessing.value || step === 'applying' || !currentPageHasProducts || !currentPageValidation.valid"
              class="w-full flex items-center justify-center gap-2 h-12 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_8px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_12px_25px_rgba(139,92,246,0.4)] border border-violet-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="step === 'applying'" class="w-4 h-4 animate-spin" />
              <Wand2 v-else class="w-4 h-4" />
              <span>{{ step === 'applying' ? 'Aplicando...' : 'Conferir e Enviar' }}</span>
            </button>

            <!-- Aplicar todas as paginas -->
            <button
              v-if="hasProducts && totalPages > 1 && anyPageHasProducts"
              @click="openReviewAll()"
              :disabled="canva.isProcessing.value || step === 'applying'"
              class="w-full flex items-center justify-center gap-2 h-10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl text-sm font-medium transition-all border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Layers class="w-4 h-4" />
              <span>Aplicar Todas ({{ totalPages }} paginas)</span>
            </button>
          </div>

          <!-- Instrucoes -->
          <div class="bg-violet-500/5 border border-violet-500/10 rounded-xl p-4">
            <h3 class="text-xs font-semibold text-violet-300 mb-2">Como funciona</h3>
            <ol class="text-[11px] text-zinc-400 space-y-1.5 list-decimal list-inside">
              <li>O sistema analisa o design e detecta os elementos editaveis</li>
              <li>Seus dados de empresa sao substituidos automaticamente</li>
              <li v-if="hasProducts">Preencha os produtos usando catalogo, lista ou manualmente</li>
              <li v-if="hasValidity">Configure a data de validade da promocao</li>
              <li v-if="hasEditableTexts">Edite os textos que desejar (deixe vazio para manter original)</li>
              <li>Confira e aplique - apenas as paginas editadas ficam para download</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <!-- Modais -->
    <CanvaCatalogPicker
      :open="showCatalogPicker"
      @close="showCatalogPicker = false"
      @select="onCatalogSelect"
    />
    <CanvaPasteListDialog
      :open="showPasteList"
      @close="showPasteList = false"
      @add="onPasteProducts"
    />

    <!-- Conferencia de produtos antes de enviar -->
    <CanvaProductReview
      :open="showReview"
      :products="reviewProducts"
      :page-index="reviewPageIndex"
      :total-slots="productsCountPerPage[reviewPageIndex] || 0"
      :tenant-id="tenantId"
      :design-type="designType"
      @close="showReview = false"
      @confirm="onReviewConfirm"
    />

    <!-- Companion Picker (selecionar produtos para Story) -->
    <CanvaCompanionPicker
      v-if="companion"
      :open="showCompanionPicker"
      :products="Object.values(productsByPage).flat().filter(p => !!p.name)"
      :max-slots="companionTotalSlots"
      :min-slots="companionTotalSlots"
      :companion-title="`${companion.label} - ${companion.title}`"
      @close="showCompanionPicker = false"
      @confirm="onCompanionProductsSelected"
    />
  </div>
</template>
