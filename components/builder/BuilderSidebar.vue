<script setup lang="ts">
import {
  ShoppingCart,
  Palette,
  LayoutGrid,
  Sparkles,
  Type,
  Building2,
  Calendar,
  Share2,
  FileEdit,
  Globe,
  Pencil,
  ClipboardPaste,
  Search,
  ImagePlus,
  Loader2,
  Trash2,
} from 'lucide-vue-next'

const {
  flyer,
  theme,
  model,
  layout,
  themes,
  models,
  layouts,
  products,
  updateFlyer,
  updateProduct,
  setTheme,
  setModel,
  setLayout,
  addProduct,
  priceTagStyles,
} = useBuilderFlyer()

const { tenant } = useBuilderAuth()
const { isAuto } = useBuilderLayout()

// Active panel
const activePanel = ref<string | null>(null)

const togglePanel = (id: string) => {
  activePanel.value = activePanel.value === id ? null : id
}

// Sidebar tabs (spec: 10 panels)
const tabs = [
  { id: 'products', label: 'Produtos', icon: ShoppingCart },
  { id: 'themes', label: 'Temas', icon: Palette },
  { id: 'layouts', label: 'Grades', icon: LayoutGrid },
  { id: 'styles', label: 'Estilos', icon: Sparkles },
  { id: 'fonts', label: 'Fontes', icon: Type },
  { id: 'company', label: 'Empresa', icon: Building2 },
  { id: 'dates', label: 'Datas', icon: Calendar },
  { id: 'postar', label: 'Postar', icon: Share2 },
  { id: 'encarte', label: 'Encarte', icon: FileEdit },
  { id: 'portal', label: 'Portal', icon: Globe },
]

// ── Products panel ──────────────────────────────────────────────────────────
// ── Capas sazonais (cores pre-definidas aplicadas via font_config) ───────────
type SeasonalCap = { id: string; label: string; preview: string; headerBg: string; primaryColor: string; accentColor: string; bodyBg: string; footerBg: string }

const activeCap = computed(() => fontConfig.value.seasonal_cap_id || '')

const seasonalCategories = [
  {
    name: 'Pascoa',
    caps: [
      { id: 'pascoa-1', label: 'Chocolate', preview: 'linear-gradient(135deg, #5D4037, #8D6E63, #FFCC80)', headerBg: '#5D4037', primaryColor: '#FFCC80', accentColor: '#FF8F00', bodyBg: '#FFF8E1', footerBg: '#3E2723' },
      { id: 'pascoa-2', label: 'Coelho', preview: 'linear-gradient(135deg, #7B1FA2, #CE93D8, #F3E5F5)', headerBg: '#7B1FA2', primaryColor: '#CE93D8', accentColor: '#E040FB', bodyBg: '#F3E5F5', footerBg: '#4A148C' },
      { id: 'pascoa-3', label: 'Primavera', preview: 'linear-gradient(135deg, #2E7D32, #81C784, #FFF9C4)', headerBg: '#2E7D32', primaryColor: '#FFF176', accentColor: '#66BB6A', bodyBg: '#F1F8E9', footerBg: '#1B5E20' },
    ],
  },
  {
    name: 'Natal',
    caps: [
      { id: 'natal-1', label: 'Classico', preview: 'linear-gradient(135deg, #B71C1C, #D32F2F, #1B5E20)', headerBg: '#B71C1C', primaryColor: '#FFD54F', accentColor: '#C62828', bodyBg: '#FFF8E1', footerBg: '#1B5E20' },
      { id: 'natal-2', label: 'Neve', preview: 'linear-gradient(135deg, #0D47A1, #42A5F5, #E3F2FD)', headerBg: '#0D47A1', primaryColor: '#E3F2FD', accentColor: '#1565C0', bodyBg: '#E3F2FD', footerBg: '#0D47A1' },
      { id: 'natal-3', label: 'Dourado', preview: 'linear-gradient(135deg, #880E4F, #C62828, #FFD700)', headerBg: '#880E4F', primaryColor: '#FFD700', accentColor: '#F44336', bodyBg: '#FFF8E1', footerBg: '#4A148C' },
    ],
  },
  {
    name: 'Black Friday',
    caps: [
      { id: 'bf-1', label: 'Escuro', preview: 'linear-gradient(135deg, #000000, #212121, #FF6F00)', headerBg: '#000000', primaryColor: '#FF6F00', accentColor: '#FFD600', bodyBg: '#1a1a1a', footerBg: '#000000' },
      { id: 'bf-2', label: 'Neon', preview: 'linear-gradient(135deg, #0a0a0a, #1a237E, #00E676)', headerBg: '#0a0a0a', primaryColor: '#00E676', accentColor: '#651FFF', bodyBg: '#121212', footerBg: '#000000' },
      { id: 'bf-3', label: 'Vermelho', preview: 'linear-gradient(135deg, #1a1a1a, #B71C1C, #FF1744)', headerBg: '#1a1a1a', primaryColor: '#FF1744', accentColor: '#FF5252', bodyBg: '#212121', footerBg: '#0a0a0a' },
    ],
  },
  {
    name: 'Dia das Maes',
    caps: [
      { id: 'maes-1', label: 'Rosa', preview: 'linear-gradient(135deg, #AD1457, #EC407A, #FCE4EC)', headerBg: '#AD1457', primaryColor: '#FCE4EC', accentColor: '#E91E63', bodyBg: '#FCE4EC', footerBg: '#880E4F' },
      { id: 'maes-2', label: 'Lilas', preview: 'linear-gradient(135deg, #6A1B9A, #AB47BC, #F3E5F5)', headerBg: '#6A1B9A', primaryColor: '#F3E5F5', accentColor: '#9C27B0', bodyBg: '#F3E5F5', footerBg: '#4A148C' },
    ],
  },
  {
    name: 'Dia dos Pais',
    caps: [
      { id: 'pais-1', label: 'Azul', preview: 'linear-gradient(135deg, #0D47A1, #1565C0, #BBDEFB)', headerBg: '#0D47A1', primaryColor: '#BBDEFB', accentColor: '#1976D2', bodyBg: '#E3F2FD', footerBg: '#0D47A1' },
      { id: 'pais-2', label: 'Elegante', preview: 'linear-gradient(135deg, #263238, #455A64, #CFD8DC)', headerBg: '#263238', primaryColor: '#CFD8DC', accentColor: '#546E7A', bodyBg: '#ECEFF1', footerBg: '#263238' },
    ],
  },
  {
    name: 'Sao Joao',
    caps: [
      { id: 'sj-1', label: 'Fogueira', preview: 'linear-gradient(135deg, #E65100, #FF6D00, #FFF176)', headerBg: '#E65100', primaryColor: '#FFF176', accentColor: '#FF6D00', bodyBg: '#FFF8E1', footerBg: '#BF360C' },
      { id: 'sj-2', label: 'Bandeirinhas', preview: 'linear-gradient(135deg, #1565C0, #E53935, #FDD835)', headerBg: '#1565C0', primaryColor: '#FDD835', accentColor: '#E53935', bodyBg: '#FFFDE7', footerBg: '#0D47A1' },
    ],
  },
  {
    name: 'Aniversario',
    caps: [
      { id: 'aniv-1', label: 'Festivo', preview: 'linear-gradient(135deg, #6A1B9A, #E91E63, #FFD600)', headerBg: '#6A1B9A', primaryColor: '#FFD600', accentColor: '#E91E63', bodyBg: '#FFF8E1', footerBg: '#4A148C' },
      { id: 'aniv-2', label: 'Confete', preview: 'linear-gradient(135deg, #00897B, #26C6DA, #FFF9C4)', headerBg: '#00897B', primaryColor: '#FFF9C4', accentColor: '#00BCD4', bodyBg: '#E0F7FA', footerBg: '#004D40' },
      { id: 'aniv-3', label: 'Baloes', preview: 'linear-gradient(135deg, #F44336, #FF9800, #4CAF50)', headerBg: '#F44336', primaryColor: '#FFFFFF', accentColor: '#FF9800', bodyBg: '#FFF3E0', footerBg: '#D32F2F' },
    ],
  },
  {
    name: 'Generico',
    caps: [
      { id: 'gen-1', label: 'Ofertas', preview: 'linear-gradient(135deg, #D32F2F, #FF5722, #FDD835)', headerBg: '#D32F2F', primaryColor: '#FDD835', accentColor: '#FF5722', bodyBg: '#FFF8E1', footerBg: '#B71C1C' },
      { id: 'gen-2', label: 'Limpo', preview: 'linear-gradient(135deg, #FFFFFF, #F5F5F5, #E0E0E0)', headerBg: '#FFFFFF', primaryColor: '#1a1a1a', accentColor: '#4CAF50', bodyBg: '#FAFAFA', footerBg: '#F5F5F5' },
      { id: 'gen-3', label: 'Verde', preview: 'linear-gradient(135deg, #1B5E20, #4CAF50, #C8E6C9)', headerBg: '#1B5E20', primaryColor: '#C8E6C9', accentColor: '#4CAF50', bodyBg: '#E8F5E9', footerBg: '#1B5E20' },
      { id: 'gen-4', label: 'Azul', preview: 'linear-gradient(135deg, #0D47A1, #2196F3, #BBDEFB)', headerBg: '#0D47A1', primaryColor: '#BBDEFB', accentColor: '#2196F3', bodyBg: '#E3F2FD', footerBg: '#0D47A1' },
    ],
  },
]

const applySeasonalCap = (cap: SeasonalCap) => {
  updateFlyer({
    font_config: {
      ...fontConfig.value,
      seasonal_cap_id: cap.id,
      // Cores do rodape premium
      footer_color_1: cap.footerBg,
      footer_color_2: cap.primaryColor,
      footer_color_3: cap.accentColor,
    },
    // Cores do header/body via campos do flyer
    footer_bg: cap.footerBg,
    footer_primary: cap.primaryColor,
    footer_secondary: cap.accentColor,
    card_bg_color: cap.bodyBg === '#1a1a1a' || cap.bodyBg === '#121212' || cap.bodyBg === '#212121' ? '#2a2a2a' : '#ffffff',
    card_text_color: cap.bodyBg === '#1a1a1a' || cap.bodyBg === '#121212' || cap.bodyBg === '#212121' ? '#ffffff' : '#1a1a1a',
  } as any)
}

// ── Overlay images (imagens decorativas) ────────────────────────────────────
type OverlayImage = { id: string; url: string; x: number; y: number; width: number; opacity: number; zFront: boolean }
const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)
const overlayImages = computed<OverlayImage[]>(() => fontConfig.value.overlay_images || [])
const isUploadingOverlay = ref(false)

const resolveOverlayUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('/api/') || url.startsWith('http')) return url
  return `/api/storage/p?key=${encodeURIComponent(url)}`
}

const updateOverlay = (idx: number, changes: Partial<OverlayImage>) => {
  const list = [...overlayImages.value]
  list[idx] = { ...list[idx], ...changes }
  updateFlyer({ font_config: { ...fontConfig.value, overlay_images: list } })
}

const removeOverlay = (idx: number) => {
  const list = overlayImages.value.filter((_, i) => i !== idx)
  updateFlyer({ font_config: { ...fontConfig.value, overlay_images: list } })
}

const handleOverlayUpload = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !tenant.value) return
  isUploadingOverlay.value = true
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const key = `builder/${tenant.value.id}/overlays/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const buf = await file.arrayBuffer()
    await $fetch('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType: file.type },
      body: new Uint8Array(buf),
    })
    const newOverlay: OverlayImage = { id: crypto.randomUUID(), url: key, x: 10, y: 10, width: 20, opacity: 1, zFront: false }
    updateFlyer({ font_config: { ...fontConfig.value, overlay_images: [...overlayImages.value, newOverlay] } })
  } catch (err) {
    console.error('Erro ao enviar imagem overlay:', err)
  } finally {
    isUploadingOverlay.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

// ── Products panel ──────────────────────────────────────────────────────────
const productTab = ref<'search' | 'paste'>('search')
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)
const pasteText = ref('')
const parsedProducts = ref<Array<{ name: string; price: number }>>([])

const searchProducts = async () => {
  if (!searchQuery.value.trim()) return
  isSearching.value = true
  try {
    const data = await $fetch<any[]>('/api/builder/products', {
      params: { q: searchQuery.value },
    })
    searchResults.value = data || []
  } catch {
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const addFromSearch = async (product: any) => {
  const startIndex = products.value.length
  addProduct({
    product_id: product.id,
    custom_name: product.name,
    custom_image: product.image || null,
    offer_price: null,
    unit: 'UN',
  })
  // If no image from catalog, auto-search from Wasabi
  if (!product.image && product.name) {
    await autoSearchImages([product.name], startIndex)
  }
}

// Parse product list text
const parseProductLine = (line: string): { name: string; price: number } | null => {
  const trimmed = line.trim()
  if (!trimmed) return null
  const formats = [
    /^(.+?)\s+([0-9]+[.,][0-9]{2})$/,
    /^(.+?)\s*-\s*([0-9]+[.,][0-9]{2})$/,
    /^(.+?)\s*R\$\s*([0-9]+[.,][0-9]{2})$/,
    /^(.+?)\s*–\s*([0-9]+[.,][0-9]{2})$/,
  ]
  for (const format of formats) {
    const match = trimmed.match(format)
    if (match) {
      const name = match[1]!.trim()
      const price = parseFloat(match[2]!.replace(',', '.'))
      if (name && !isNaN(price)) return { name, price }
    }
  }
  if (trimmed.length > 2) return { name: trimmed, price: 0 }
  return null
}

const parsePasteText = () => {
  parsedProducts.value = pasteText.value
    .split('\n')
    .map(parseProductLine)
    .filter((p): p is { name: string; price: number } => p !== null)
}

const isAutoSearching = ref(false)

const addAllParsed = async () => {
  const items = [...parsedProducts.value]
  parsedProducts.value = []
  pasteText.value = ''

  // Add products immediately (no image yet)
  const startIndex = products.value.length
  for (const p of items) {
    addProduct({ custom_name: p.name, offer_price: p.price || null, unit: 'UN' })
  }

  // Then auto-search images in background
  await autoSearchImages(items.map(p => p.name), startIndex)
}

const addParsedProduct = async (p: { name: string; price: number }, idx: number) => {
  const startIndex = products.value.length
  addProduct({ custom_name: p.name, offer_price: p.price || null, unit: 'UN' })
  parsedProducts.value.splice(idx, 1)

  // Auto-search image
  await autoSearchImages([p.name], startIndex)
}

// Auto-search images from Wasabi for product names
const autoSearchImages = async (names: string[], startIndex: number) => {
  if (names.length === 0) return
  isAutoSearching.value = true
  try {
    const data = await $fetch<{ results: Record<string, { key: string; url: string; name: string } | null> }>(
      '/api/builder/batch-search-images',
      { method: 'POST', body: { terms: names } }
    )
    if (data?.results) {
      names.forEach((name, i) => {
        const match = data.results[name]
        if (match?.key) {
          updateProduct(startIndex + i, { custom_image: match.key })
        }
      })
    }
  } catch (err) {
    console.error('[BuilderSidebar] Auto image search error:', err)
  } finally {
    isAutoSearching.value = false
  }
}

// ── Company panel ───────────────────────────────────────────────────────────
interface CompanyToggle { key: string; label: string; editField?: string }

const companyToggles: CompanyToggle[] = [
  { key: 'show_phone', label: 'Telefone', editField: 'phone' },
  { key: 'show_whatsapp', label: 'WhatsApp', editField: 'whatsapp' },
  { key: 'show_phone_label', label: 'Legenda telefones' },
  { key: 'show_company_name', label: 'Nome da Empresa', editField: 'name' },
  { key: 'show_slogan', label: 'Slogan', editField: 'slogan' },
  { key: 'show_payment_methods', label: 'Formas pagamento' },
  { key: 'show_payment_notes', label: 'Obs. pagamento', editField: 'payment_notes' },
  { key: 'show_address', label: 'Endereco', editField: 'address' },
  { key: 'show_instagram', label: 'Instagram', editField: 'instagram' },
  { key: 'show_facebook', label: 'Facebook', editField: 'facebook' },
  { key: 'show_website', label: 'Website', editField: 'website' },
]

const editingCompanyField = ref<string | null>(null)

const getToggleValue = (key: string): boolean => {
  if (!flyer.value) return false
  return (flyer.value as any)[key] ?? false
}

const handleToggle = (key: string, value: boolean) => {
  updateFlyer({ [key]: value } as any)
}

// ── Logo upload ─────────────────────────────────────────────────────────────
const logoFileInput = ref<HTMLInputElement | null>(null)
const isUploadingLogo = ref(false)

const currentLogoUrl = computed(() => {
  const logo = (flyer.value as any)?.custom_logo || tenant.value?.logo
  if (!logo) return null
  if (logo.startsWith('/api/')) return logo
  const wasabiMatch = logo.match(/^https?:\/\/[^/]*wasabi[^/]*\/[^/]+\/(.+)$/)
  if (wasabiMatch) return `/api/storage/p?key=${encodeURIComponent(wasabiMatch[1])}`
  if (logo.startsWith('http://') || logo.startsWith('https://')) return logo
  if (logo.startsWith('builder/') || logo.includes('.')) {
    return `/api/storage/p?key=${encodeURIComponent(logo)}`
  }
  return logo
})

const handleLogoUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !tenant.value) return

  isUploadingLogo.value = true
  try {
    const tenantId = tenant.value.id
    const ext = file.name.split('.').pop() || 'png'
    const filename = `logo-${Date.now()}.${ext}`
    const key = `builder/${tenantId}/branding/${filename}`

    const body = await file.arrayBuffer()
    await $fetch('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType: file.type || 'image/png' },
      body: new Uint8Array(body),
      headers: { 'Content-Type': 'application/octet-stream' },
    })

    // Save just the key — components resolve via /api/storage/p?key= proxy
    updateFlyer({ custom_logo: key } as any)
  } catch (err) {
    console.error('[BuilderSidebar] Logo upload error:', err)
  } finally {
    isUploadingLogo.value = false
    if (input) input.value = ''
  }
}

const removeLogo = () => {
  updateFlyer({ custom_logo: null } as any)
}

// ── Payment methods ─────────────────────────────────────────────────────────
const PAYMENT_OPTIONS = [
  { id: 'pix', label: 'PIX', color: '#32BCAD' },
  { id: 'dinheiro', label: 'Dinheiro', color: '#2d6a4f' },
  { id: 'visa', label: 'Visa', color: '#1A1F71' },
  { id: 'mastercard', label: 'Mastercard', color: '#EB001B' },
  { id: 'elo', label: 'Elo', color: '#000' },
  { id: 'hipercard', label: 'Hipercard', color: '#822124' },
  { id: 'amex', label: 'American Express', color: '#016FD0' },
  { id: 'alelo', label: 'Alelo', color: '#00965E' },
  { id: 'sodexo', label: 'Sodexo', color: '#ED1C24' },
  { id: 'ticket', label: 'Ticket', color: '#DC0032' },
  { id: 'vr', label: 'VR', color: '#003399' },
  { id: 'greencard', label: 'GreenCard', color: '#006837' },
  { id: 'ben', label: 'Ben', color: '#FF6900' },
  { id: 'goodcard', label: 'GoodCard', color: '#0066B3' },
  { id: 'cabal', label: 'Cabal', color: '#00529B' },
  { id: 'banescard', label: 'Banescard', color: '#003366' },
]

const DEFAULT_METHODS = ['pix', 'dinheiro', 'visa', 'mastercard', 'elo']

const getPaymentMethods = (): string[] => {
  return (flyer.value as any)?.payment_methods || DEFAULT_METHODS
}

const isPaymentSelected = (id: string): boolean => {
  return getPaymentMethods().includes(id)
}

const togglePaymentMethod = (id: string) => {
  const current = getPaymentMethods()
  const updated = current.includes(id)
    ? current.filter((x: string) => x !== id)
    : [...current, id]
  updateFlyer({ payment_methods: updated } as any)
}

const selectAllPayments = () => {
  updateFlyer({ payment_methods: PAYMENT_OPTIONS.map(p => p.id) } as any)
}

const clearAllPayments = () => {
  updateFlyer({ payment_methods: [] } as any)
}

// ── Dates panel ─────────────────────────────────────────────────────────────
const datesShortcuts = [
  { label: 'Esta Semana', days: 7, fromMonday: true },
  { label: 'Este Mes', days: 30, fromFirst: true },
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
]

const setDateShortcut = (shortcut: typeof datesShortcuts[number]) => {
  const now = new Date()
  let start = new Date()
  let end = new Date()
  if (shortcut.fromMonday) {
    const day = now.getDay()
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    end = new Date(start)
    end.setDate(start.getDate() + 6)
  } else if (shortcut.fromFirst) {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  } else {
    end.setDate(now.getDate() + (shortcut.days - 1))
  }
  updateFlyer({
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
  })
}

// ── Encarte panel ───────────────────────────────────────────────────────────
const FLYER_CATEGORIES = [
  'supermercado', 'acougue', 'padaria', 'hortifruti',
  'farmacia', 'bebidas', 'pet-shop', 'material-construcao',
  'eletronicos', 'cosmeticos', 'restaurante',
]

// ── Social text (Postar) ────────────────────────────────────────────────────
const socialText = computed(() => {
  if (!flyer.value) return ''
  const lines: string[] = []
  lines.push(flyer.value.title || 'Ofertas')
  lines.push('')
  lines.push('Confira:')
  for (const p of products.value) {
    const price = p.offer_price ? `R$${p.offer_price.toFixed(2).replace('.', ',')}` : ''
    lines.push(`- ${p.custom_name || 'Produto'}${price ? ' - ' + price : ''}`)
  }
  if (flyer.value.start_date && flyer.value.end_date) {
    const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    lines.push('')
    lines.push(`Valido de ${fmt(flyer.value.start_date)} ate ${fmt(flyer.value.end_date)}`)
  }
  lines.push('')
  lines.push('#Ofertas #Encartes #Promocoes #Economia')
  return lines.join('\n')
})

const pracegover = computed(() => {
  if (!flyer.value) return ''
  const lines: string[] = []
  lines.push('#PraCegoVer')
  lines.push(`Encarte de ofertas "${flyer.value.title || 'Ofertas'}" com ${products.value.length} produtos em promocao.`)
  lines.push('')
  lines.push('Produtos em oferta:')
  products.value.forEach((p, i) => {
    const price = p.offer_price ? `R$${p.offer_price.toFixed(2).replace('.', ',')}` : ''
    lines.push(`${i + 1}. ${p.custom_name || 'Produto'}${price ? ' - ' + price : ''}`)
  })
  return lines.join('\n')
})

const copyToClipboard = async (text: string) => {
  try { await navigator.clipboard.writeText(text) } catch {}
}

const storageProxyUrl = (keyOrUrl: string | null | undefined): string => {
  if (!keyOrUrl) return ''
  const v = keyOrUrl.trim()
  if (v.startsWith('/api/')) return v
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  return `/api/storage/p?key=${encodeURIComponent(v)}`
}
</script>

<template>
  <div class="flex h-full shrink-0">
    <!-- Icon column (72px) -->
    <div class="w-18 shrink-0 bg-[#111] border-r border-white/5 flex flex-col items-center py-2 gap-0.5 overflow-y-auto">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="togglePanel(tab.id)"
        :class="[
          'w-14 h-14 flex flex-col items-center justify-center rounded-lg text-[9px] font-medium transition-all gap-1',
          activePanel === tab.id
            ? 'bg-emerald-600/15 text-emerald-400'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
        ]"
        :title="tab.label"
      >
        <component :is="tab.icon" class="w-4.5 h-4.5" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Panel content (360px) -->
    <div
      v-if="activePanel"
      class="w-90 shrink-0 bg-[#141414] border-r border-white/5 overflow-y-auto"
    >
      <!-- PRODUTOS -->
      <template v-if="activePanel === 'products'">
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Produtos</h3>
          <div class="flex gap-1 mb-3">
            <button @click="productTab = 'search'" :class="['flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-medium transition-colors', productTab === 'search' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-white/5 text-zinc-400']">
              <Search class="w-3 h-3" /> Buscar
            </button>
            <button @click="productTab = 'paste'" :class="['flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-medium transition-colors', productTab === 'paste' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-white/5 text-zinc-400']">
              <ClipboardPaste class="w-3 h-3" /> Colar Lista
            </button>
          </div>

          <div v-if="productTab === 'search'">
            <div class="flex gap-1 mb-2">
              <input v-model="searchQuery" @keydown.enter="searchProducts" placeholder="Buscar produto..." class="flex-1 bg-white/5 text-xs text-white rounded px-2 py-1.5 border border-white/5 outline-none focus:border-emerald-500/50 placeholder-zinc-600" />
              <button @click="searchProducts" class="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500">Buscar</button>
            </div>
            <div class="space-y-1 max-h-100 overflow-y-auto">
              <button v-for="p in searchResults" :key="p.id" @click="addFromSearch(p)" class="w-full flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors text-left">
                <img v-if="p.image" :src="storageProxyUrl(p.image)" class="w-8 h-8 rounded object-cover" />
                <div v-else class="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-zinc-600 text-xs">?</div>
                <span class="text-[11px] text-zinc-300 flex-1 truncate">{{ p.name }}</span>
                <span class="text-[10px] text-emerald-400 font-medium shrink-0">+ Adicionar</span>
              </button>
            </div>
          </div>

          <div v-if="productTab === 'paste'">
            <textarea v-model="pasteText" @input="parsePasteText" placeholder="Cole a lista de produtos aqui..." class="w-full h-32 bg-white/5 text-xs text-white rounded px-2 py-2 border border-white/5 outline-none resize-none placeholder-zinc-600" />
            <div v-if="parsedProducts.length" class="mt-2">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] text-zinc-400">{{ parsedProducts.length }} produto(s)</span>
                <button @click="addAllParsed" :disabled="isAutoSearching" class="text-[10px] text-emerald-400 font-medium disabled:opacity-50">
                  <Loader2 v-if="isAutoSearching" class="w-3 h-3 animate-spin inline mr-1" />{{ isAutoSearching ? 'Buscando imagens...' : 'Adicionar tudo' }}
                </button>
              </div>
              <div class="space-y-1 max-h-75 overflow-y-auto">
                <div v-for="(p, idx) in parsedProducts" :key="idx" class="flex items-center gap-2 p-1.5 rounded bg-white/5">
                  <span class="text-[11px] text-zinc-300 flex-1 truncate">{{ p.name }}</span>
                  <span v-if="p.price" class="text-[10px] text-emerald-400">R${{ p.price.toFixed(2) }}</span>
                  <button @click="addParsedProduct(p, idx)" class="text-[10px] text-zinc-400 hover:text-emerald-400">+</button>
                </div>
              </div>
            </div>
          </div>
          <p class="text-[10px] text-zinc-600 mt-3">{{ products.length }} produto(s) no encarte</p>
        </div>
      </template>

      <!-- TEMAS -->
      <template v-else-if="activePanel === 'themes'">
        <div class="p-3 space-y-4">
          <!-- Temas do banco -->
          <div>
            <h3 class="text-xs font-semibold text-zinc-300 mb-2">Temas</h3>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="t in themes" :key="t.id" @click="setTheme(t.id)" :class="['relative rounded-lg overflow-hidden border-2 transition-all aspect-square', theme?.id === t.id ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-white/5 hover:border-white/15']" :title="t.name">
                <img v-if="t.thumbnail" :src="storageProxyUrl(t.thumbnail)" :alt="t.name" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-zinc-500" :style="{ backgroundColor: t.css_config?.bgColor || '#333' }">{{ t.name?.charAt(0) || '?' }}</div>
                <div v-if="theme?.id === t.id" class="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                  <div class="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg></div>
                </div>
              </button>
            </div>
            <p v-if="!themes.length" class="text-[10px] text-zinc-600 text-center py-4">Nenhum tema disponivel</p>
          </div>

          <!-- Capas sazonais (cores pre-definidas) -->
          <div v-for="cat in seasonalCategories" :key="cat.name">
            <h4 class="text-[10px] font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">{{ cat.name }}</h4>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="cap in cat.caps"
                :key="cap.id"
                @click="applySeasonalCap(cap)"
                :class="['relative rounded-lg overflow-hidden border-2 transition-all aspect-video', activeCap === cap.id ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-white/5 hover:border-white/15']"
                :title="cap.label"
              >
                <div class="w-full h-full" :style="{ background: cap.preview }" />
                <span class="absolute bottom-0 inset-x-0 text-[7px] text-white font-bold text-center py-0.5 bg-black/50 leading-tight">{{ cap.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- GRADES -->
      <template v-else-if="activePanel === 'layouts'">
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Grades</h3>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="l in layouts" :key="l.id" @click="setLayout(l.id)" :class="['px-3 py-2 rounded-lg text-[11px] font-medium transition-all border', layout?.id === l.id ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10']">
              {{ l.name }}<span v-if="l.columns === 0" class="text-[9px] ml-1 opacity-60">(Auto)</span>
            </button>
          </div>
        </div>
      </template>

      <!-- ESTILOS -->
      <template v-else-if="activePanel === 'styles'">
        <div class="p-3 space-y-4">
          <h3 class="text-xs font-semibold text-zinc-300">Estilos</h3>

          <!-- Product box style -->
          <label class="block">
            <span class="text-[10px] text-zinc-500 font-medium">Boxes de Produtos</span>
            <select :value="flyer?.product_box_style || 'smart'" @change="updateFlyer({ product_box_style: ($event.target as HTMLSelectElement).value as any })" class="w-full mt-1 bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none">
              <option value="smart">Inteligente</option>
              <option value="standard">Padrao</option>
            </select>
          </label>

          <!-- Color mode -->
          <label class="block">
            <span class="text-[10px] text-zinc-500 font-medium">Cores</span>
            <select :value="flyer?.color_mode || 'smart'" @change="updateFlyer({ color_mode: ($event.target as HTMLSelectElement).value as any })" class="w-full mt-1 bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none">
              <option value="smart">Inteligente</option>
              <option value="standard">Padrao</option>
            </select>
          </label>

          <!-- Card colors -->
          <div class="border-t border-white/5 pt-3">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Cores do Card de Produto</p>
            <div class="grid grid-cols-2 gap-2">
              <label class="block">
                <span class="text-[9px] text-zinc-600 block mb-1">Fundo do Card</span>
                <input type="color" :value="(flyer as any)?.card_bg_color || '#ffffff'" @input="updateFlyer({ card_bg_color: ($event.target as HTMLInputElement).value } as any)" class="w-full h-7 rounded border border-white/10 cursor-pointer bg-transparent" />
              </label>
              <label class="block">
                <span class="text-[9px] text-zinc-600 block mb-1">Texto do Card</span>
                <input type="color" :value="(flyer as any)?.card_text_color || '#000000'" @input="updateFlyer({ card_text_color: ($event.target as HTMLInputElement).value } as any)" class="w-full h-7 rounded border border-white/10 cursor-pointer bg-transparent" />
              </label>
            </div>
            <button @click="updateFlyer({ card_bg_color: null, card_text_color: null } as any)" class="text-[9px] text-zinc-500 hover:text-zinc-300 mt-1.5 transition-colors">
              Resetar cores do card
            </button>
          </div>

          <!-- Price tag style selector -->
          <div v-if="priceTagStyles.length" class="border-t border-white/5 pt-3">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Etiqueta de Preco</p>
            <div class="grid grid-cols-3 gap-1.5">
              <!-- Default (no style) -->
              <button
                @click="updateFlyer({ price_tag_style_id: null })"
                class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-all"
                :class="!flyer?.price_tag_style_id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-white/3 hover:bg-white/5'"
              >
                <div class="w-full h-8 rounded flex items-center justify-center bg-red-500">
                  <span class="text-[10px] font-black text-white">R$ 9,99</span>
                </div>
                <span class="text-[8px] text-zinc-500">Padrao</span>
              </button>
              <!-- Custom styles -->
              <button
                v-for="pts in priceTagStyles"
                :key="pts.id"
                @click="updateFlyer({ price_tag_style_id: pts.id })"
                class="flex flex-col items-center gap-1 p-2 rounded-lg border transition-all"
                :class="flyer?.price_tag_style_id === pts.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-white/3 hover:bg-white/5'"
              >
                <div
                  class="w-full h-8 rounded flex items-center justify-center"
                  :style="{
                    backgroundColor: pts.css_config?.bgColor || '#e53e3e',
                    color: pts.css_config?.textColor || '#fff',
                    borderRadius: pts.css_config?.shape === 'pill' ? '999px' : pts.css_config?.shape === 'square' ? '0' : '6px',
                  }"
                >
                  <span class="text-[10px] font-black">R$ 9,99</span>
                </div>
                <span class="text-[8px] text-zinc-500 truncate w-full text-center">{{ pts.name }}</span>
              </button>
            </div>
          </div>

          <!-- Ink economy -->
          <label class="block">
            <span class="text-[10px] text-zinc-500 font-medium">Economia de Tinta: {{ flyer?.ink_economy ?? 0 }}%</span>
            <input type="range" min="0" max="100" :value="flyer?.ink_economy ?? 0" @input="updateFlyer({ ink_economy: parseInt(($event.target as HTMLInputElement).value) })" class="w-full mt-1" />
          </label>

        </div>
      </template>

      <!-- FONTES & IMAGENS -->
      <template v-else-if="activePanel === 'fonts'">
        <div class="p-3 space-y-4">
          <h3 class="text-xs font-semibold text-zinc-300">Fontes & Imagens</h3>

          <!-- Cores do Rodape Premium -->
          <div v-if="fontConfig.footer_mode === 'premium'">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Cores do Rodape</p>
            <div class="space-y-2">
              <label class="flex items-center gap-2">
                <input type="color" :value="fontConfig.footer_color_1 || '#1B5E20'" @input="updateFlyer({ font_config: { ...fontConfig, footer_color_1: ($event.target as HTMLInputElement).value } })" class="w-6 h-6 rounded cursor-pointer border border-white/10" />
                <span class="text-[9px] text-zinc-400">Redes Sociais</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="color" :value="fontConfig.footer_color_2 || '#FDD835'" @input="updateFlyer({ font_config: { ...fontConfig, footer_color_2: ($event.target as HTMLInputElement).value } })" class="w-6 h-6 rounded cursor-pointer border border-white/10" />
                <span class="text-[9px] text-zinc-400">Info Empresa</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="color" :value="fontConfig.footer_color_3 || '#D32F2F'" @input="updateFlyer({ font_config: { ...fontConfig, footer_color_3: ($event.target as HTMLInputElement).value } })" class="w-6 h-6 rounded cursor-pointer border border-white/10" />
                <span class="text-[9px] text-zinc-400">Endereco</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="color" :value="fontConfig.footer_text_color_premium || '#ffffff'" @input="updateFlyer({ font_config: { ...fontConfig, footer_text_color_premium: ($event.target as HTMLInputElement).value } })" class="w-6 h-6 rounded cursor-pointer border border-white/10" />
                <span class="text-[9px] text-zinc-400">Texto</span>
              </label>
            </div>
          </div>

          <!-- Imagens Decorativas (overlay) -->
          <div>
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Imagens Decorativas</p>
            <p class="text-[9px] text-zinc-600 mb-2">Adicione imagens extras ao encarte (selos, logos, decoracoes)</p>

            <!-- Lista de overlays existentes -->
            <div v-for="(ov, idx) in overlayImages" :key="ov.id" class="mb-3 p-2 bg-white/5 rounded border border-white/5">
              <div class="flex items-center gap-2 mb-2">
                <img :src="resolveOverlayUrl(ov.url)" class="w-10 h-10 object-contain rounded bg-white/10" alt="" />
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] text-zinc-400 truncate">{{ ov.url.split('/').pop() }}</p>
                </div>
                <button @click="removeOverlay(idx)" class="p-1 hover:bg-red-500/20 rounded text-red-400">
                  <Trash2 class="w-3 h-3" />
                </button>
              </div>

              <!-- Posicao X -->
              <label class="block mb-1">
                <span class="text-[9px] text-zinc-500">Posicao X: {{ ov.x }}%</span>
                <input type="range" min="0" max="100" :value="ov.x" @input="updateOverlay(idx, { x: parseInt(($event.target as HTMLInputElement).value) })" class="w-full" />
              </label>

              <!-- Posicao Y -->
              <label class="block mb-1">
                <span class="text-[9px] text-zinc-500">Posicao Y: {{ ov.y }}%</span>
                <input type="range" min="0" max="100" :value="ov.y" @input="updateOverlay(idx, { y: parseInt(($event.target as HTMLInputElement).value) })" class="w-full" />
              </label>

              <!-- Tamanho -->
              <label class="block mb-1">
                <span class="text-[9px] text-zinc-500">Tamanho: {{ ov.width }}%</span>
                <input type="range" min="5" max="100" :value="ov.width" @input="updateOverlay(idx, { width: parseInt(($event.target as HTMLInputElement).value) })" class="w-full" />
              </label>

              <!-- Opacidade -->
              <label class="block mb-1">
                <span class="text-[9px] text-zinc-500">Opacidade: {{ Math.round((ov.opacity ?? 1) * 100) }}%</span>
                <input type="range" min="10" max="100" :value="Math.round((ov.opacity ?? 1) * 100)" @input="updateOverlay(idx, { opacity: parseInt(($event.target as HTMLInputElement).value) / 100 })" class="w-full" />
              </label>

              <!-- Camada -->
              <label class="flex items-center gap-2 mt-1 cursor-pointer">
                <input type="checkbox" :checked="ov.zFront" @change="updateOverlay(idx, { zFront: ($event.target as HTMLInputElement).checked })" class="rounded" />
                <span class="text-[9px] text-zinc-500">Na frente dos produtos</span>
              </label>
            </div>

            <!-- Botao adicionar -->
            <label class="flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-dashed border-white/10 cursor-pointer transition-colors">
              <ImagePlus class="w-3.5 h-3.5" />
              <span>{{ isUploadingOverlay ? 'Enviando...' : 'Adicionar Imagem' }}</span>
              <input type="file" accept="image/*" class="hidden" :disabled="isUploadingOverlay" @change="handleOverlayUpload" />
            </label>
          </div>
        </div>
      </template>

      <!-- EMPRESA -->
      <template v-else-if="activePanel === 'company'">
        <div class="p-3 space-y-4">
          <h3 class="text-xs font-semibold text-zinc-300">Empresa</h3>

          <!-- Logo upload section -->
          <div>
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Logo da Empresa</p>
            <div class="flex items-center gap-3">
              <button
                @click="logoFileInput?.click()"
                class="relative w-16 h-16 rounded-lg border border-dashed border-white/10 bg-white/5
                  flex items-center justify-center overflow-hidden
                  hover:border-emerald-500/30 hover:bg-white/10 transition-all group"
              >
                <img
                  v-if="currentLogoUrl"
                  :src="currentLogoUrl"
                  alt="Logo"
                  class="w-full h-full object-contain p-1"
                />
                <div v-else-if="isUploadingLogo" class="text-zinc-500">
                  <Loader2 class="w-5 h-5 animate-spin" />
                </div>
                <div v-else class="text-zinc-500 group-hover:text-emerald-400 transition-colors">
                  <ImagePlus class="w-5 h-5" />
                </div>
              </button>
              <div class="flex-1">
                <button
                  @click="logoFileInput?.click()"
                  class="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {{ currentLogoUrl ? 'Trocar logo' : 'Enviar logo' }}
                </button>
                <button
                  v-if="currentLogoUrl"
                  @click="removeLogo"
                  class="ml-2 text-[10px] text-red-400 hover:text-red-300 font-medium"
                >
                  Remover
                </button>
                <p class="text-[9px] text-zinc-600 mt-0.5">PNG ou JPG, fundo transparente recomendado</p>
              </div>
            </div>
            <input
              ref="logoFileInput"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              class="hidden"
              @change="handleLogoUpload"
            />
          </div>

          <!-- Header visibility toggles -->
          <div>
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Visibilidade na Capa</p>
            <div class="flex items-center justify-between gap-2">
              <span class="text-[11px] text-zinc-400">Mostrar Logo</span>
              <button type="button" role="switch" :aria-checked="getToggleValue('show_logo')" @click="handleToggle('show_logo', !getToggleValue('show_logo'))" :class="['relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', getToggleValue('show_logo') ? 'bg-emerald-600' : 'bg-white/10']">
                <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', getToggleValue('show_logo') ? 'n ml-px' : 'translate-x-0.5']" />
              </button>
            </div>
          </div>

          <!-- Logo position & size controls -->
          <div v-if="getToggleValue('show_logo')" class="border-t border-white/5 pt-3">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Posicao e Tamanho da Logo</p>
            <p class="text-[9px] text-zinc-600 mb-2">Arraste a logo diretamente na capa ou use os controles abaixo</p>

            <!-- Size slider -->
            <label class="block mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[9px] text-zinc-600">Tamanho</span>
                <span class="text-[9px] text-zinc-500 tabular-nums">{{ (flyer as any)?.logo_size || 80 }}px</span>
              </div>
              <input
                type="range"
                min="30"
                max="400"
                step="5"
                :value="(flyer as any)?.logo_size || 80"
                @input="updateFlyer({ logo_size: Number(($event.target as HTMLInputElement).value) } as any)"
                class="w-full accent-emerald-500 h-1"
              />
            </label>

            <!-- X position -->
            <label class="block mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[9px] text-zinc-600">Horizontal</span>
                <span class="text-[9px] text-zinc-500 tabular-nums">{{ (flyer as any)?.logo_x ?? 50 }}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="(flyer as any)?.logo_x ?? 50"
                @input="updateFlyer({ logo_x: Number(($event.target as HTMLInputElement).value) } as any)"
                class="w-full accent-emerald-500 h-1"
              />
            </label>

            <!-- Y position -->
            <label class="block mb-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[9px] text-zinc-600">Vertical</span>
                <span class="text-[9px] text-zinc-500 tabular-nums">{{ (flyer as any)?.logo_y ?? 50 }}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                :value="(flyer as any)?.logo_y ?? 50"
                @input="updateFlyer({ logo_y: Number(($event.target as HTMLInputElement).value) } as any)"
                class="w-full accent-emerald-500 h-1"
              />
            </label>

            <!-- Quick position presets -->
            <div class="grid grid-cols-3 gap-1">
              <button
                v-for="pos in [
                  { label: '↖', x: 15, y: 25 },
                  { label: '↑', x: 50, y: 20 },
                  { label: '↗', x: 85, y: 25 },
                  { label: '←', x: 15, y: 50 },
                  { label: '•', x: 50, y: 50 },
                  { label: '→', x: 85, y: 50 },
                  { label: '↙', x: 15, y: 80 },
                  { label: '↓', x: 50, y: 80 },
                  { label: '↘', x: 85, y: 80 },
                ]"
                :key="pos.label"
                @click="updateFlyer({ logo_x: pos.x, logo_y: pos.y } as any)"
                class="w-full h-7 rounded bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-[11px] transition-colors flex items-center justify-center"
                :class="(flyer as any)?.logo_x === pos.x && (flyer as any)?.logo_y === pos.y ? 'ring-1 ring-emerald-500/50 bg-emerald-500/10 text-emerald-400' : ''"
              >
                {{ pos.label }}
              </button>
            </div>
          </div>

          <div class="border-t border-white/5 pt-3">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Informacoes no Rodape</p>
            <div class="space-y-2">
              <div v-for="opt in companyToggles" :key="opt.key">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] text-zinc-400 flex-1">{{ opt.label }}</span>
                  <button v-if="opt.editField" @click="editingCompanyField = editingCompanyField === opt.key ? null : opt.key" class="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-zinc-300"><Pencil class="w-3 h-3" /></button>
                  <button type="button" role="switch" :aria-checked="getToggleValue(opt.key)" @click="handleToggle(opt.key, !getToggleValue(opt.key))" :class="['relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', getToggleValue(opt.key) ? 'bg-emerald-600' : 'bg-white/10']">
                    <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', getToggleValue(opt.key) ? 'translate-x-4.5 ml-px' : 'translate-x-0.5']" />
                  </button>
                </div>
                <!-- Editable field -->
                <div v-if="editingCompanyField === opt.key && opt.editField" class="mt-1">
                  <input
                    :value="(flyer as any)?.[`custom_${opt.editField}`] || (tenant as any)?.[opt.editField] || ''"
                    @input="updateFlyer({ [`custom_${opt.editField}`]: ($event.target as HTMLInputElement).value } as any)"
                    :placeholder="`Insira ${opt.label.toLowerCase()}`"
                    class="w-full bg-white/5 text-[11px] text-white rounded px-2 py-1.5 border border-white/5 outline-none focus:border-emerald-500/50 placeholder-zinc-600"
                  />
                  <p v-if="(tenant as any)?.[opt.editField]" class="text-[9px] text-zinc-600 mt-0.5">
                    Perfil: {{ (tenant as any)?.[opt.editField] }}
                  </p>
                </div>
                <!-- Empty warning -->
                <p
                  v-else-if="getToggleValue(opt.key) && opt.editField && !((flyer as any)?.[`custom_${opt.editField}`] || (tenant as any)?.[opt.editField])"
                  class="text-[9px] text-amber-400/70 mt-0.5"
                >
                  Clique no lapiz para preencher
                </p>

                <!-- PAYMENT METHODS: show card selection when "Formas pagamento" is ON -->
                <div v-if="opt.key === 'show_payment_methods' && getToggleValue('show_payment_methods')" class="mt-2 ml-0.5">
                  <p class="text-[9px] text-zinc-500 mb-1.5">Bandeiras aceitas pelo estabelecimento:</p>
                  <div class="grid grid-cols-2 gap-1">
                    <button
                      v-for="pm in PAYMENT_OPTIONS"
                      :key="pm.id"
                      @click="togglePaymentMethod(pm.id)"
                      class="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all text-left"
                      :class="isPaymentSelected(pm.id) ? 'bg-white/10 ring-1 ring-emerald-500/30' : 'bg-white/2 opacity-40 hover:opacity-70'"
                    >
                      <div class="w-3.5 h-3.5 rounded-sm flex items-center justify-center shrink-0"
                        :class="isPaymentSelected(pm.id) ? 'bg-emerald-600' : 'bg-white/10'"
                      >
                        <svg v-if="isPaymentSelected(pm.id)" class="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="w-3 h-3 rounded-sm shrink-0" :style="{ backgroundColor: pm.color }"></div>
                      <span class="text-[9px] text-zinc-300 truncate">{{ pm.label }}</span>
                    </button>
                  </div>
                  <div class="flex gap-3 mt-1.5">
                    <button @click="selectAllPayments" class="text-[9px] text-emerald-400 hover:text-emerald-300 font-medium">Todas</button>
                    <button @click="clearAllPayments" class="text-[9px] text-zinc-500 hover:text-zinc-300">Limpar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer layout selector -->
          <div class="border-t border-white/5 pt-3">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Layout do Rodape</p>
            <div class="grid grid-cols-2 gap-1.5">
              <button
                v-for="fl in [
                  { id: 'classico', label: 'Classico', desc: 'Tradicional' },
                  { id: 'moderno', label: 'Moderno', desc: 'Clean e arredondado' },
                  { id: 'elegante', label: 'Elegante', desc: 'Sofisticado' },
                  { id: 'banner', label: 'Banner', desc: 'Impacto maximo' },
                ]"
                :key="fl.id"
                @click="updateFlyer({ footer_layout: fl.id } as any)"
                class="flex flex-col items-start p-2 rounded-lg border transition-all text-left"
                :class="((flyer as any)?.footer_layout || 'classico') === fl.id
                  ? 'border-emerald-500/50 bg-emerald-600/10 ring-1 ring-emerald-500/20'
                  : 'border-white/5 bg-white/3 hover:bg-white/5'"
              >
                <span class="text-[10px] font-semibold" :class="((flyer as any)?.footer_layout || 'classico') === fl.id ? 'text-emerald-400' : 'text-zinc-300'">{{ fl.label }}</span>
                <span class="text-[8px] text-zinc-600">{{ fl.desc }}</span>
              </button>
            </div>
          </div>

          <!-- Footer colors -->
          <div class="border-t border-white/5 pt-3">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Cores do Rodape</p>
            <div class="grid grid-cols-2 gap-2">
              <label class="block">
                <span class="text-[9px] text-zinc-600 block mb-1">Fundo</span>
                <input type="color" :value="(flyer as any)?.footer_bg || '#1a1a1a'" @input="updateFlyer({ footer_bg: ($event.target as HTMLInputElement).value } as any)" class="w-full h-7 rounded border border-white/10 cursor-pointer bg-transparent" />
              </label>
              <label class="block">
                <span class="text-[9px] text-zinc-600 block mb-1">Texto</span>
                <input type="color" :value="(flyer as any)?.footer_text_color || '#ffffff'" @input="updateFlyer({ footer_text_color: ($event.target as HTMLInputElement).value } as any)" class="w-full h-7 rounded border border-white/10 cursor-pointer bg-transparent" />
              </label>
              <label class="block">
                <span class="text-[9px] text-zinc-600 block mb-1">Primaria</span>
                <input type="color" :value="(flyer as any)?.footer_primary || '#e85d04'" @input="updateFlyer({ footer_primary: ($event.target as HTMLInputElement).value } as any)" class="w-full h-7 rounded border border-white/10 cursor-pointer bg-transparent" />
              </label>
              <label class="block">
                <span class="text-[9px] text-zinc-600 block mb-1">Secundaria</span>
                <input type="color" :value="(flyer as any)?.footer_secondary || '#f48c06'" @input="updateFlyer({ footer_secondary: ($event.target as HTMLInputElement).value } as any)" class="w-full h-7 rounded border border-white/10 cursor-pointer bg-transparent" />
              </label>
            </div>
            <button @click="updateFlyer({ footer_bg: null, footer_primary: null, footer_secondary: null, footer_text_color: null } as any)" class="text-[9px] text-zinc-500 hover:text-zinc-300 mt-1.5 transition-colors">
              Resetar cores do tema
            </button>
          </div>

          <!-- Footer typography -->
          <div class="border-t border-white/5 pt-3">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Tipografia do Rodape</p>

            <!-- Font family -->
            <label class="block mb-2.5">
              <span class="text-[9px] text-zinc-600 block mb-1">Fonte do nome</span>
              <select
                :value="(flyer as any)?.footer_name_font || ''"
                @change="updateFlyer({ footer_name_font: ($event.target as HTMLSelectElement).value } as any)"
                class="w-full bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none"
              >
                <option value="">Padrao (tema)</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
                <option value="'Oswald', sans-serif">Oswald</option>
                <option value="'Montserrat', sans-serif">Montserrat</option>
                <option value="'Poppins', sans-serif">Poppins</option>
                <option value="'Roboto', sans-serif">Roboto</option>
                <option value="'Lato', sans-serif">Lato</option>
                <option value="'Open Sans', sans-serif">Open Sans</option>
                <option value="'Raleway', sans-serif">Raleway</option>
                <option value="'Playfair Display', serif">Playfair Display</option>
                <option value="'Merriweather', serif">Merriweather</option>
                <option value="'Lobster', cursive">Lobster</option>
                <option value="'Pacifico', cursive">Pacifico</option>
                <option value="Impact, sans-serif">Impact</option>
                <option value="'Georgia', serif">Georgia</option>
              </select>
            </label>
            <label class="block mb-2.5">
              <span class="text-[9px] text-zinc-600 block mb-1">Fonte dos contatos</span>
              <select
                :value="(flyer as any)?.footer_body_font || ''"
                @change="updateFlyer({ footer_body_font: ($event.target as HTMLSelectElement).value } as any)"
                class="w-full bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none"
              >
                <option value="">Padrao (tema)</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Montserrat', sans-serif">Montserrat</option>
                <option value="'Poppins', sans-serif">Poppins</option>
                <option value="'Roboto', sans-serif">Roboto</option>
                <option value="'Lato', sans-serif">Lato</option>
                <option value="'Open Sans', sans-serif">Open Sans</option>
                <option value="'Raleway', sans-serif">Raleway</option>
                <option value="'Oswald', sans-serif">Oswald</option>
                <option value="'Nunito', sans-serif">Nunito</option>
              </select>
            </label>

            <!-- Text transform for company name -->
            <div class="mb-2.5">
              <span class="text-[9px] text-zinc-600 block mb-1">Caixa do nome</span>
              <div class="flex gap-1">
                <button
                  v-for="tt in [
                    { id: 'uppercase', label: 'ABC' },
                    { id: 'capitalize', label: 'Abc' },
                    { id: 'lowercase', label: 'abc' },
                    { id: 'none', label: 'Aa' },
                  ]"
                  :key="tt.id"
                  @click="updateFlyer({ footer_name_transform: tt.id } as any)"
                  class="flex-1 py-1.5 rounded text-[10px] font-semibold transition-all"
                  :class="((flyer as any)?.footer_name_transform || 'uppercase') === tt.id
                    ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/8'"
                >
                  {{ tt.label }}
                </button>
              </div>
            </div>

            <!-- Text transform for contacts/social -->
            <div class="mb-2.5">
              <span class="text-[9px] text-zinc-600 block mb-1">Caixa dos contatos</span>
              <div class="flex gap-1">
                <button
                  v-for="tt in [
                    { id: 'none', label: 'Aa' },
                    { id: 'uppercase', label: 'ABC' },
                    { id: 'lowercase', label: 'abc' },
                  ]"
                  :key="tt.id"
                  @click="updateFlyer({ footer_body_transform: tt.id } as any)"
                  class="flex-1 py-1.5 rounded text-[10px] font-semibold transition-all"
                  :class="((flyer as any)?.footer_body_transform || 'none') === tt.id
                    ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/8'"
                >
                  {{ tt.label }}
                </button>
              </div>
            </div>

            <!-- Font weight for company name -->
            <div class="mb-2.5">
              <span class="text-[9px] text-zinc-600 block mb-1">Peso do nome</span>
              <div class="flex gap-1">
                <button
                  v-for="fw in [
                    { id: '700', label: 'Bold' },
                    { id: '800', label: 'Extra' },
                    { id: '900', label: 'Black' },
                    { id: '400', label: 'Normal' },
                  ]"
                  :key="fw.id"
                  @click="updateFlyer({ footer_name_weight: fw.id } as any)"
                  class="flex-1 py-1.5 rounded text-[10px] transition-all"
                  :class="((flyer as any)?.footer_name_weight || '900') === fw.id
                    ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/8'"
                  :style="{ fontWeight: fw.id }"
                >
                  {{ fw.label }}
                </button>
              </div>
            </div>

            <!-- Sizes -->
            <div class="space-y-2 mt-3">
              <label class="block">
                <div class="flex items-center justify-between">
                  <span class="text-[9px] text-zinc-600">Tamanho nome</span>
                  <span class="text-[9px] text-zinc-500 font-mono">{{ (flyer as any)?.footer_name_size || 20 }}px</span>
                </div>
                <input type="range" min="12" max="36" :value="(flyer as any)?.footer_name_size || 20" @input="updateFlyer({ footer_name_size: parseInt(($event.target as HTMLInputElement).value) } as any)" class="w-full mt-0.5 accent-emerald-500" />
              </label>
              <label class="block">
                <div class="flex items-center justify-between">
                  <span class="text-[9px] text-zinc-600">Tamanho telefones</span>
                  <span class="text-[9px] text-zinc-500 font-mono">{{ (flyer as any)?.footer_phone_size || 15 }}px</span>
                </div>
                <input type="range" min="10" max="28" :value="(flyer as any)?.footer_phone_size || 15" @input="updateFlyer({ footer_phone_size: parseInt(($event.target as HTMLInputElement).value) } as any)" class="w-full mt-0.5 accent-emerald-500" />
              </label>
              <label class="block">
                <div class="flex items-center justify-between">
                  <span class="text-[9px] text-zinc-600">Tamanho redes sociais</span>
                  <span class="text-[9px] text-zinc-500 font-mono">{{ (flyer as any)?.footer_social_size || 11 }}px</span>
                </div>
                <input type="range" min="8" max="18" :value="(flyer as any)?.footer_social_size || 11" @input="updateFlyer({ footer_social_size: parseInt(($event.target as HTMLInputElement).value) } as any)" class="w-full mt-0.5 accent-emerald-500" />
              </label>
            </div>
          </div>

          <!-- Footer extra options -->
          <div class="border-t border-white/5 pt-3">
            <p class="text-[10px] text-zinc-500 font-medium mb-2">Opcoes Extras</p>
            <div class="space-y-2">
              <!-- WhatsApp label -->
              <label class="block">
                <span class="text-[9px] text-zinc-600">Legenda WhatsApp</span>
                <input
                  :value="(flyer as any)?.footer_whatsapp_label || ''"
                  @input="updateFlyer({ footer_whatsapp_label: ($event.target as HTMLInputElement).value } as any)"
                  placeholder="Ex: Peca pelo WhatsApp"
                  class="w-full mt-0.5 bg-white/5 text-[11px] text-white rounded px-2 py-1.5 border border-white/5 outline-none focus:border-emerald-500/50 placeholder-zinc-600"
                />
              </label>
              <!-- Phone label -->
              <label class="block">
                <span class="text-[9px] text-zinc-600">Legenda Telefone</span>
                <input
                  :value="(flyer as any)?.footer_phone_label || ''"
                  @input="updateFlyer({ footer_phone_label: ($event.target as HTMLInputElement).value } as any)"
                  placeholder="Ex: Ligue agora"
                  class="w-full mt-0.5 bg-white/5 text-[11px] text-white rounded px-2 py-1.5 border border-white/5 outline-none focus:border-emerald-500/50 placeholder-zinc-600"
                />
              </label>
              <!-- Date label format -->
              <label class="block">
                <span class="text-[9px] text-zinc-600">Texto da barra de datas</span>
                <input
                  :value="(flyer as any)?.footer_date_label || ''"
                  @input="updateFlyer({ footer_date_label: ($event.target as HTMLInputElement).value } as any)"
                  placeholder="Ofertas validas"
                  class="w-full mt-0.5 bg-white/5 text-[11px] text-white rounded px-2 py-1.5 border border-white/5 outline-none focus:border-emerald-500/50 placeholder-zinc-600"
                />
              </label>
              <!-- Show social labels toggle -->
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] text-zinc-400">Mostrar @ nas redes</span>
                <button type="button" role="switch" :aria-checked="(flyer as any)?.footer_show_social_labels ?? true" @click="updateFlyer({ footer_show_social_labels: !((flyer as any)?.footer_show_social_labels ?? true) } as any)" :class="['relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', (flyer as any)?.footer_show_social_labels ?? true ? 'bg-emerald-600' : 'bg-white/10']">
                  <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', (flyer as any)?.footer_show_social_labels ?? true ? 'translate-x-4.5 ml-px' : 'translate-x-0.5']" />
                </button>
              </div>
              <!-- Show payment label toggle -->
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] text-zinc-400">Mostrar "Aceitamos"</span>
                <button type="button" role="switch" :aria-checked="(flyer as any)?.footer_show_payment_label ?? true" @click="updateFlyer({ footer_show_payment_label: !((flyer as any)?.footer_show_payment_label ?? true) } as any)" :class="['relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', (flyer as any)?.footer_show_payment_label ?? true ? 'bg-emerald-600' : 'bg-white/10']">
                  <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', (flyer as any)?.footer_show_payment_label ?? true ? 'translate-x-4.5 ml-px' : 'translate-x-0.5']" />
                </button>
              </div>
              <!-- Logo in footer toggle -->
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] text-zinc-400">Logo no rodape</span>
                <button type="button" role="switch" :aria-checked="(flyer as any)?.footer_show_logo ?? true" @click="updateFlyer({ footer_show_logo: !((flyer as any)?.footer_show_logo ?? true) } as any)" :class="['relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', (flyer as any)?.footer_show_logo ?? true ? 'bg-emerald-600' : 'bg-white/10']">
                  <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', (flyer as any)?.footer_show_logo ?? true ? 'translate-x-4.5 ml-px' : 'translate-x-0.5']" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- DATAS -->
      <template v-else-if="activePanel === 'dates'">
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Datas e Regras</h3>
          <div class="space-y-2 mb-3">
            <label class="block"><span class="text-[10px] text-zinc-500">Data de Inicio</span>
              <input type="date" :value="flyer?.start_date?.split('T')[0] || ''" @input="updateFlyer({ start_date: ($event.target as HTMLInputElement).value })" class="w-full mt-0.5 bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none" />
            </label>
            <label class="block"><span class="text-[10px] text-zinc-500">Data Final</span>
              <input type="date" :value="flyer?.end_date?.split('T')[0] || ''" @input="updateFlyer({ end_date: ($event.target as HTMLInputElement).value })" class="w-full mt-0.5 bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none" />
            </label>
          </div>
          <div class="flex flex-wrap gap-1 mb-4">
            <button v-for="s in datesShortcuts" :key="s.label" @click="setDateShortcut(s)" class="px-2 py-1 rounded text-[10px] bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors">{{ s.label }}</button>
          </div>
          <div class="space-y-2.5">
            <label v-for="tog in [
              { key: 'show_dates', label: 'Mostrar datas', def: false },
              { key: 'show_stock_warning', label: 'Enquanto durarem estoques', def: false },
              { key: 'show_illustrative_note', label: 'Imagens Ilustrativas', def: true },
              { key: 'show_medicine_warning', label: 'Advertencia Medicamento', def: false },
              { key: 'show_promo_phrase', label: 'Frase Promocional', def: false },
            ]" :key="tog.key" class="flex items-center justify-between gap-2 cursor-pointer">
              <span class="text-[11px] text-zinc-400">{{ tog.label }}</span>
              <button type="button" role="switch" :aria-checked="(flyer as any)?.[tog.key] ?? tog.def" @click="updateFlyer({ [tog.key]: !((flyer as any)?.[tog.key] ?? tog.def) } as any)" :class="['relative inline-flex h-5 w-9 rounded-full transition-colors', (flyer as any)?.[tog.key] ?? tog.def ? 'bg-emerald-600' : 'bg-white/10']">
                <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', (flyer as any)?.[tog.key] ?? tog.def ? 'translate-x-4.5 ml-px' : 'translate-x-0.5']" />
              </button>
            </label>
            <textarea v-if="flyer?.show_promo_phrase" :value="flyer?.promo_phrase || ''" @input="updateFlyer({ promo_phrase: ($event.target as HTMLTextAreaElement).value })" placeholder="Frase promocional..." maxlength="300" class="w-full h-16 bg-white/5 text-[11px] text-white rounded px-2 py-1.5 border border-white/5 outline-none resize-none" />
          </div>
        </div>
      </template>

      <!-- POSTAR -->
      <template v-else-if="activePanel === 'postar'">
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Texto para Redes Sociais</h3>
          <div class="mb-4">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-zinc-500 font-medium">Texto Principal</span>
              <button @click="copyToClipboard(socialText)" class="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium">Copiar</button>
            </div>
            <pre class="whitespace-pre-wrap text-[11px] text-zinc-300 bg-white/5 rounded p-2 max-h-50 overflow-y-auto font-sans">{{ socialText }}</pre>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-zinc-500 font-medium">#PraCegoVer</span>
              <button @click="copyToClipboard(pracegover)" class="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium">Copiar</button>
            </div>
            <pre class="whitespace-pre-wrap text-[11px] text-zinc-300 bg-white/5 rounded p-2 max-h-50 overflow-y-auto font-sans">{{ pracegover }}</pre>
          </div>
        </div>
      </template>

      <!-- ENCARTE -->
      <template v-else-if="activePanel === 'encarte'">
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Encarte</h3>
          <label class="block mb-3"><span class="text-[10px] text-zinc-500">Titulo</span>
            <input :value="flyer?.title || ''" @input="updateFlyer({ title: ($event.target as HTMLInputElement).value })" class="w-full mt-0.5 bg-white/5 text-[11px] text-white rounded px-2 py-1.5 border border-white/5 outline-none" />
          </label>
          <label class="block mb-3"><span class="text-[10px] text-zinc-500">Categoria</span>
            <select :value="flyer?.category || ''" @change="updateFlyer({ category: ($event.target as HTMLSelectElement).value })" class="w-full mt-0.5 bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none">
              <option value="">Sem Categoria</option>
              <option v-for="c in FLYER_CATEGORIES" :key="c" :value="c">{{ c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' ') }}</option>
            </select>
          </label>
          <label class="block mb-3"><span class="text-[10px] text-zinc-500">Observacoes</span>
            <textarea :value="flyer?.observations || ''" @input="updateFlyer({ observations: ($event.target as HTMLTextAreaElement).value })" class="w-full mt-0.5 h-16 bg-white/5 text-[11px] text-white rounded px-2 py-1.5 border border-white/5 outline-none resize-none" />
          </label>
          <label class="block"><span class="text-[10px] text-zinc-500">Mensagem Personalizada</span>
            <input :value="flyer?.custom_message || ''" @input="updateFlyer({ custom_message: ($event.target as HTMLInputElement).value })" class="w-full mt-0.5 bg-white/5 text-[11px] text-white rounded px-2 py-1.5 border border-white/5 outline-none" />
          </label>
        </div>
      </template>

      <!-- PORTAL -->
      <template v-else-if="activePanel === 'portal'">
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Portal</h3>
          <label class="flex items-center justify-between gap-2 cursor-pointer">
            <span class="text-[11px] text-zinc-400">Publicar este encarte no portal</span>
            <button type="button" role="switch" :aria-checked="flyer?.publish_to_portal ?? false" @click="updateFlyer({ publish_to_portal: !(flyer?.publish_to_portal ?? false) })" :class="['relative inline-flex h-5 w-9 rounded-full transition-colors', flyer?.publish_to_portal ? 'bg-emerald-600' : 'bg-white/10']">
              <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', flyer?.publish_to_portal ? 'translate-x-4.5 ml-px' : 'translate-x-0.5']" />
            </button>
          </label>
        </div>
      </template>
    </div>
  </div>
</template>
