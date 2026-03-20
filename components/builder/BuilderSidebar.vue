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
  setTheme,
  setModel,
  setLayout,
  addProduct,
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

const addFromSearch = (product: any) => {
  addProduct({
    product_id: product.id,
    custom_name: product.name,
    custom_image: product.image,
    offer_price: null,
    unit: 'UN',
  })
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

const addAllParsed = () => {
  for (const p of parsedProducts.value) {
    addProduct({ custom_name: p.name, offer_price: p.price || null, unit: 'UN' })
  }
  parsedProducts.value = []
  pasteText.value = ''
}

const addParsedProduct = (p: { name: string; price: number }, idx: number) => {
  addProduct({ custom_name: p.name, offer_price: p.price || null, unit: 'UN' })
  parsedProducts.value.splice(idx, 1)
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
    <div class="w-[72px] shrink-0 bg-[#111] border-r border-white/5 flex flex-col items-center py-2 gap-0.5 overflow-y-auto">
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
      class="w-[360px] shrink-0 bg-[#141414] border-r border-white/5 overflow-y-auto"
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
            <div class="space-y-1 max-h-[400px] overflow-y-auto">
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
                <button @click="addAllParsed" class="text-[10px] text-emerald-400 font-medium">Adicionar tudo</button>
              </div>
              <div class="space-y-1 max-h-[300px] overflow-y-auto">
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
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Temas</h3>
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
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Estilos</h3>
          <label class="block mb-3">
            <span class="text-[10px] text-zinc-500 font-medium">Boxes de Produtos</span>
            <select :value="flyer?.product_box_style || 'smart'" @change="updateFlyer({ product_box_style: ($event.target as HTMLSelectElement).value as any })" class="w-full mt-1 bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none">
              <option value="smart">Inteligente</option>
              <option value="standard">Padrao</option>
            </select>
          </label>
          <label class="block mb-3">
            <span class="text-[10px] text-zinc-500 font-medium">Cores</span>
            <select :value="flyer?.color_mode || 'smart'" @change="updateFlyer({ color_mode: ($event.target as HTMLSelectElement).value as any })" class="w-full mt-1 bg-white/5 text-[11px] text-zinc-300 rounded px-2 py-1.5 border border-white/5 outline-none">
              <option value="smart">Inteligente</option>
              <option value="standard">Padrao</option>
            </select>
          </label>
          <label class="block">
            <span class="text-[10px] text-zinc-500 font-medium">Economia de Tinta: {{ flyer?.ink_economy ?? 0 }}%</span>
            <input type="range" min="0" max="100" :value="flyer?.ink_economy ?? 0" @input="updateFlyer({ ink_economy: parseInt(($event.target as HTMLInputElement).value) })" class="w-full mt-1" />
          </label>
        </div>
      </template>

      <!-- FONTES -->
      <template v-else-if="activePanel === 'fonts'">
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Fontes</h3>
          <p class="text-[10px] text-zinc-500">Configuracao de fontes via Google Fonts.</p>
        </div>
      </template>

      <!-- EMPRESA -->
      <template v-else-if="activePanel === 'company'">
        <div class="p-3">
          <h3 class="text-xs font-semibold text-zinc-300 mb-3">Empresa</h3>
          <div class="space-y-2">
            <div v-for="opt in companyToggles" :key="opt.key">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] text-zinc-400 flex-1">{{ opt.label }}</span>
                <button v-if="opt.editField" @click="editingCompanyField = editingCompanyField === opt.key ? null : opt.key" class="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-zinc-300"><Pencil class="w-3 h-3" /></button>
                <button type="button" role="switch" :aria-checked="getToggleValue(opt.key)" @click="handleToggle(opt.key, !getToggleValue(opt.key))" :class="['relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors', getToggleValue(opt.key) ? 'bg-emerald-600' : 'bg-white/10']">
                  <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', getToggleValue(opt.key) ? 'translate-x-[18px] ml-px' : 'translate-x-0.5']" />
                </button>
              </div>
              <div v-if="editingCompanyField === opt.key && opt.editField" class="mt-1">
                <input :value="(tenant as any)?.[opt.editField] || ''" readonly class="w-full bg-white/5 text-[11px] text-zinc-400 rounded px-2 py-1 border border-white/5" />
                <p class="text-[9px] text-zinc-600 mt-0.5">Edite em Perfil da Empresa</p>
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
                <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', (flyer as any)?.[tog.key] ?? tog.def ? 'translate-x-[18px] ml-px' : 'translate-x-0.5']" />
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
            <pre class="whitespace-pre-wrap text-[11px] text-zinc-300 bg-white/5 rounded p-2 max-h-[200px] overflow-y-auto font-sans">{{ socialText }}</pre>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] text-zinc-500 font-medium">#PraCegoVer</span>
              <button @click="copyToClipboard(pracegover)" class="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium">Copiar</button>
            </div>
            <pre class="whitespace-pre-wrap text-[11px] text-zinc-300 bg-white/5 rounded p-2 max-h-[200px] overflow-y-auto font-sans">{{ pracegover }}</pre>
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
              <span :class="['inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5', flyer?.publish_to_portal ? 'translate-x-[18px] ml-px' : 'translate-x-0.5']" />
            </button>
          </label>
        </div>
      </template>
    </div>
  </div>
</template>
