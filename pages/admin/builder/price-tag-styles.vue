<script setup lang="ts">
import { ArrowLeft, Plus, Pencil, Trash2, X, Zap, Upload, ChevronDown, Palette, Type, Layers, Image, Move, Settings, Scissors, Eye } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()
const { uploadFile: doUpload, isUploading: isUploadingBgImage } = useUpload()
const bgImageInputRef = ref<HTMLInputElement | null>(null)

const handleBgImageUpload = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const result = await doUpload(file)
    if (result?.url) {
      form.value.bgImage = result.url
    }
  } catch (err: any) {
    error.value = `Falha no upload: ${err?.message || 'erro desconhecido'}`
  }
  if (bgImageInputRef.value) bgImageInputRef.value.value = ''
}

type PriceTagStyle = {
  id: string
  name: string
  css_config: {
    bgColor: string
    textColor: string
    shape: string
    fontFamily?: string
    decimalStyle?: string
    borderWidth?: number
    borderColor?: string
    borderStyle?: string
    borderRadiusTL?: number | null
    borderRadiusTR?: number | null
    borderRadiusBL?: number | null
    borderRadiusBR?: number | null
    shadow?: string
    bgGradient?: boolean
    bgGradientColor?: string
    bgGradientDirection?: string
    padding?: string
    priceScale?: number
    bgOpacity?: number
    hideUnit?: boolean
    bgImage?: string
    bgImageSize?: string
    bgImageOpacity?: number
    displayMode?: string
    textShadow?: string
    currencySize?: string
    rotation?: number
    showCutLine?: boolean
    showBarcode?: boolean
    showValidity?: boolean
  }
  is_global: boolean
  is_active: boolean
  sort_order: number
}

const styles = ref<PriceTagStyle[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const showDeleteConfirm = ref<string | null>(null)
const isSaving = ref(false)
const isSeeding = ref(false)
const previewMode = ref<string>('simple')

// Accordion sections state
const openSections = ref<Record<string, boolean>>({
  appearance: true,
  displayMode: false,
  textEffects: false,
  border: false,
  shadowEffects: false,
  gradient: false,
  bgImage: false,
  spacing: false,
  gondola: false,
  settings: false,
})
const toggleSection = (key: string) => {
  openSections.value[key] = !openSections.value[key]
}

const FONT_OPTIONS = [
  { value: 'inherit', label: 'Padrao (tema)' },
  { value: "'Arial Black', 'Arial', sans-serif", label: 'Arial Black' },
  { value: "'Impact', 'Haettenschweiler', sans-serif", label: 'Impact' },
  { value: "'Georgia', serif", label: 'Georgia' },
  { value: "'Verdana', sans-serif", label: 'Verdana' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "'Comic Sans MS', cursive", label: 'Comic Sans' },
  { value: "'Oswald', sans-serif", label: 'Oswald (Google)' },
  { value: "'Roboto Condensed', sans-serif", label: 'Roboto Condensed (Google)' },
  { value: "'Bebas Neue', sans-serif", label: 'Bebas Neue (Google)' },
  { value: "'Luckiest Guy', cursive", label: 'Luckiest Guy (Google)' },
  { value: "'Bangers', cursive", label: 'Bangers (Google)' },
  { value: "'Permanent Marker', cursive", label: 'Permanent Marker (Google)' },
  { value: "'Passion One', sans-serif", label: 'Passion One (Google)' },
  { value: "'Anton', sans-serif", label: 'Anton (Google)' },
]

const DECIMAL_STYLE_OPTIONS = [
  { value: 'small', label: 'Centavos Pequenos' },
  { value: 'large', label: 'Centavos Grandes' },
  { value: 'superscript', label: 'Centavos Sobrescrito' },
]

const BORDER_STYLE_OPTIONS = [
  { value: 'none', label: 'Sem Borda' },
  { value: 'solid', label: 'Solida' },
  { value: 'dashed', label: 'Tracejada' },
  { value: 'dotted', label: 'Pontilhada' },
  { value: 'double', label: 'Dupla' },
]

const SHADOW_OPTIONS = [
  { value: 'none', label: 'Sem Sombra' },
  { value: 'sm', label: 'Leve' },
  { value: 'md', label: 'Media' },
  { value: 'lg', label: 'Forte' },
  { value: 'glow', label: 'Brilho (Glow)' },
]

const GRADIENT_DIR_OPTIONS = [
  { value: 'to-right', label: 'Horizontal →' },
  { value: 'to-bottom', label: 'Vertical ↓' },
  { value: 'to-br', label: 'Diagonal ↘' },
  { value: 'to-bl', label: 'Diagonal ↙' },
  { value: 'radial', label: 'Radial ◎' },
]

const PADDING_OPTIONS = [
  { value: 'compact', label: 'Compacto' },
  { value: 'normal', label: 'Normal' },
  { value: 'spacious', label: 'Espacoso' },
]

const DISPLAY_MODE_OPTIONS = [
  { value: 'filled', label: 'Preenchido (padrao)' },
  { value: 'outline', label: 'Contorno' },
  { value: 'underline', label: 'Sublinhado' },
  { value: 'naked', label: 'Sem fundo' },
  { value: 'splash', label: 'Splash / Estrela' },
]

const TEXT_SHADOW_OPTIONS = [
  { value: 'none', label: 'Sem sombra' },
  { value: 'sm', label: 'Leve' },
  { value: 'md', label: 'Media' },
  { value: 'lg', label: 'Forte' },
  { value: 'hard', label: 'Solida (contorno)' },
]

const CURRENCY_SIZE_OPTIONS = [
  { value: 'small', label: 'Pequeno' },
  { value: 'medium', label: 'Medio' },
  { value: 'large', label: 'Grande (mesmo tamanho)' },
]

const form = ref({
  name: '',
  bgColor: '#ef4444',
  textColor: '#ffffff',
  shape: 'rounded',
  fontFamily: 'inherit',
  decimalStyle: 'small',
  borderWidth: 0,
  borderColor: '#000000',
  borderStyle: 'none',
  borderRadiusTL: null as number | null,
  borderRadiusTR: null as number | null,
  borderRadiusBL: null as number | null,
  borderRadiusBR: null as number | null,
  shadow: 'none',
  bgGradient: false,
  bgGradientColor: '#991b1b',
  bgGradientDirection: 'to-right',
  padding: 'normal',
  priceScale: 1,
  bgOpacity: 1,
  hideUnit: false,
  bgImage: '',
  bgImageSize: 'cover',
  bgImageOpacity: 1,
  displayMode: 'filled',
  textShadow: 'none',
  currencySize: 'small',
  rotation: 0,
  showCutLine: false,
  showBarcode: false,
  showValidity: false,
  is_global: true,
  is_active: true,
  sort_order: 0
})

// ── 12 predefined styles from spec ────────────────────────────────────────────
const PREDEFINED_STYLES = [
  { name: 'Vermelho',         bgColor: '#e53e3e', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Azul',             bgColor: '#2b6cb0', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Verde',            bgColor: '#38a169', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Amarelo',          bgColor: '#ecc94b', textColor: '#1a202c', shape: 'rounded' },
  { name: 'Laranja',          bgColor: '#dd6b20', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Preto',            bgColor: '#1a202c', textColor: '#f6e05e', shape: 'square' },
  { name: 'Marrom',           bgColor: '#5D4037', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Roxo',             bgColor: '#805ad5', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Rosa',             bgColor: '#d53f8c', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Pilula Vermelha',  bgColor: '#e53e3e', textColor: '#ffffff', shape: 'pill' },
  { name: 'Pilula Verde',     bgColor: '#38a169', textColor: '#ffffff', shape: 'pill' },
  { name: 'Quadrado Vermelho', bgColor: '#e53e3e', textColor: '#ffffff', shape: 'square' },
  { name: 'Vermelho Amarelo',  bgColor: '#c0392b', textColor: '#f1c40f', shape: 'rounded' },
  { name: 'Azul Escuro',       bgColor: '#1a365d', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Verde Neon',        bgColor: '#22c55e', textColor: '#052e16', shape: 'pill' },
  { name: 'Gradiente Quente',  bgColor: '#dc2626', textColor: '#fef08a', shape: 'rounded' },
  { name: 'Elegante Dourado',  bgColor: '#1c1917', textColor: '#fbbf24', shape: 'square' },
  { name: 'Supermercado',      bgColor: '#b91c1c', textColor: '#ffffff', shape: 'rounded' },
  { name: 'Atacado',           bgColor: '#1e40af', textColor: '#fde68a', shape: 'square' },
]

// ── 8 price mode previews ─────────────────────────────────────────────────────
const PRICE_MODES = [
  { value: 'simple',       label: 'Simples' },
  { value: 'from_to',      label: 'De/Por' },
  { value: 'x_per_y',      label: 'X por Y' },
  { value: 'take_pay',     label: 'Leve/Pague' },
  { value: 'installment',  label: 'Parcelado' },
  { value: 'symbolic',     label: 'Simbolico' },
  { value: 'club_price',   label: 'Clube' },
  { value: 'anticipation', label: 'Antecipacao' },
]

const resetForm = () => {
  form.value = {
    name: '',
    bgColor: '#ef4444',
    textColor: '#ffffff',
    shape: 'rounded',
    fontFamily: 'inherit',
    decimalStyle: 'small',
    borderWidth: 0,
    borderColor: '#000000',
    borderStyle: 'none',
    borderRadiusTL: null as number | null,
    borderRadiusTR: null as number | null,
    borderRadiusBL: null as number | null,
    borderRadiusBR: null as number | null,
    shadow: 'none',
    bgGradient: false,
    bgGradientColor: '#991b1b',
    bgGradientDirection: 'to-right',
    padding: 'normal',
    priceScale: 1,
    bgOpacity: 1,
    hideUnit: false,
    bgImage: '',
    bgImageSize: 'cover',
    bgImageOpacity: 1,
    displayMode: 'filled',
    textShadow: 'none',
    currencySize: 'small',
    rotation: 0,
    showCutLine: false,
    showBarcode: false,
    showValidity: false,
    is_global: true,
    is_active: true,
    sort_order: 0
  }
  editingId.value = null
}

const openCreate = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (style: PriceTagStyle) => {
  editingId.value = style.id
  form.value = {
    name: style.name,
    bgColor: style.css_config?.bgColor || '#ef4444',
    textColor: style.css_config?.textColor || '#ffffff',
    shape: style.css_config?.shape || 'rounded',
    fontFamily: style.css_config?.fontFamily || 'inherit',
    decimalStyle: style.css_config?.decimalStyle || 'small',
    borderWidth: style.css_config?.borderWidth ?? 0,
    borderColor: style.css_config?.borderColor || '#000000',
    borderStyle: style.css_config?.borderStyle || 'none',
    borderRadiusTL: style.css_config?.borderRadiusTL ?? null,
    borderRadiusTR: style.css_config?.borderRadiusTR ?? null,
    borderRadiusBL: style.css_config?.borderRadiusBL ?? null,
    borderRadiusBR: style.css_config?.borderRadiusBR ?? null,
    shadow: style.css_config?.shadow || 'none',
    bgGradient: style.css_config?.bgGradient ?? false,
    bgGradientColor: style.css_config?.bgGradientColor || '#991b1b',
    bgGradientDirection: style.css_config?.bgGradientDirection || 'to-right',
    padding: style.css_config?.padding || 'normal',
    priceScale: style.css_config?.priceScale ?? 1,
    bgOpacity: style.css_config?.bgOpacity ?? 1,
    hideUnit: style.css_config?.hideUnit ?? false,
    bgImage: style.css_config?.bgImage || '',
    bgImageSize: style.css_config?.bgImageSize || 'cover',
    bgImageOpacity: style.css_config?.bgImageOpacity ?? 1,
    displayMode: style.css_config?.displayMode || 'filled',
    textShadow: style.css_config?.textShadow || 'none',
    currencySize: style.css_config?.currencySize || 'small',
    rotation: style.css_config?.rotation ?? 0,
    showCutLine: style.css_config?.showCutLine ?? false,
    showBarcode: style.css_config?.showBarcode ?? false,
    showValidity: style.css_config?.showValidity ?? false,
    is_global: style.is_global ?? true,
    is_active: style.is_active ?? true,
    sort_order: style.sort_order || 0
  }
  showForm.value = true
}

const fetchStyles = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>('/api/admin/builder/price-tag-styles', { headers })
    styles.value = Array.isArray(data) ? data : data?.priceTagStyles ?? data?.styles ?? data?.data ?? data?.items ?? []
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao carregar estilos de preco')
  } finally {
    isLoading.value = false
  }
}

const saveStyle = async () => {
  isSaving.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const payload = {
      name: form.value.name,
      css_config: {
        bgColor: form.value.bgColor,
        textColor: form.value.textColor,
        shape: form.value.shape,
        fontFamily: form.value.fontFamily,
        decimalStyle: form.value.decimalStyle,
        borderWidth: form.value.borderWidth,
        borderColor: form.value.borderColor,
        borderStyle: form.value.borderStyle,
        borderRadiusTL: form.value.borderRadiusTL,
        borderRadiusTR: form.value.borderRadiusTR,
        borderRadiusBL: form.value.borderRadiusBL,
        borderRadiusBR: form.value.borderRadiusBR,
        shadow: form.value.shadow,
        bgGradient: form.value.bgGradient,
        bgGradientColor: form.value.bgGradientColor,
        bgGradientDirection: form.value.bgGradientDirection,
        padding: form.value.padding,
        priceScale: form.value.priceScale,
        bgOpacity: form.value.bgOpacity,
        hideUnit: form.value.hideUnit,
        bgImage: form.value.bgImage || undefined,
        bgImageSize: form.value.bgImageSize,
        bgImageOpacity: form.value.bgImageOpacity,
        displayMode: form.value.displayMode,
        textShadow: form.value.textShadow,
        currencySize: form.value.currencySize,
        rotation: form.value.rotation,
        showCutLine: form.value.showCutLine,
        showBarcode: form.value.showBarcode,
        showValidity: form.value.showValidity,
      },
      is_global: form.value.is_global,
      is_active: form.value.is_active,
      sort_order: form.value.sort_order
    }

    if (editingId.value) {
      await $fetch(`/api/admin/builder/price-tag-styles/${editingId.value}`, {
        method: 'PUT',
        headers,
        body: payload
      })
    } else {
      await $fetch('/api/admin/builder/price-tag-styles', {
        method: 'POST',
        headers,
        body: payload
      })
    }

    showForm.value = false
    resetForm()
    await fetchStyles()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao salvar estilo')
  } finally {
    isSaving.value = false
  }
}

const deleteStyle = async (id: string) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/price-tag-styles/${id}`, {
      method: 'DELETE',
      headers
    })
    showDeleteConfirm.value = null
    await fetchStyles()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao excluir estilo')
  }
}

const seedStyles = async () => {
  isSeeding.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const existingNames = new Set(styles.value.map(s => s.name.toLowerCase()))

    let created = 0
    for (let i = 0; i < PREDEFINED_STYLES.length; i++) {
      const preset = PREDEFINED_STYLES[i]
      if (!preset) continue
      if (existingNames.has(preset.name.toLowerCase())) continue

      await $fetch('/api/admin/builder/price-tag-styles', {
        method: 'POST',
        headers,
        body: {
          name: preset.name,
          css_config: {
            bgColor: preset.bgColor,
            textColor: preset.textColor,
            shape: preset.shape
          },
          is_global: true,
          is_active: true,
          sort_order: i
        }
      })
      created++
    }

    await fetchStyles()
    if (created > 0) {
      error.value = null
    }
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao criar estilos predefinidos')
  } finally {
    isSeeding.value = false
  }
}

const shapeLabel = (shape: string) => {
  const map: Record<string, string> = {
    rounded: 'Arredondado',
    square: 'Quadrado',
    pill: 'Pilula',
    circle: 'Circulo'
  }
  return map[shape] || shape
}

const getShapeRadius = (shape: string) => {
  switch (shape) {
    case 'pill': return '9999px'
    case 'square': return '0'
    case 'circle': return '50%'
    default: return '8px'
  }
}

const previewDecimalSize = computed(() => {
  switch (form.value.decimalStyle) {
    case 'large': return '24px'
    case 'superscript': return '10px'
    default: return '12px' // small
  }
})

const previewDecimalClass = computed(() => {
  return form.value.decimalStyle === 'superscript' ? '-mt-2' : ''
})

const hasCustomRadiusForm = computed(() => {
  return form.value.borderRadiusTL != null || form.value.borderRadiusTR != null || form.value.borderRadiusBL != null || form.value.borderRadiusBR != null
})

const previewBorderRadius = computed(() => {
  if (hasCustomRadiusForm.value) {
    const tl = form.value.borderRadiusTL ?? 8
    const tr = form.value.borderRadiusTR ?? 8
    const br = form.value.borderRadiusBR ?? 8
    const bl = form.value.borderRadiusBL ?? 8
    return `${tl}px ${tr}px ${br}px ${bl}px`
  }
  return getShapeRadius(form.value.shape)
})

const previewBackground = computed(() => {
  if (!form.value.bgGradient) return form.value.bgColor
  const dir = form.value.bgGradientDirection
  if (dir === 'radial') return `radial-gradient(circle, ${form.value.bgColor}, ${form.value.bgGradientColor})`
  const cssDir = dir.replace('to-', 'to ').replace('br', 'bottom right').replace('bl', 'bottom left')
  return `linear-gradient(${cssDir}, ${form.value.bgColor}, ${form.value.bgGradientColor})`
})

const previewBorder = computed(() => {
  if (form.value.borderStyle === 'none' || !form.value.borderWidth) return 'none'
  return `${form.value.borderWidth}px ${form.value.borderStyle} ${form.value.borderColor}`
})

const previewShadow = computed(() => {
  const map: Record<string, string> = {
    none: 'none',
    sm: '0 1px 3px rgba(0,0,0,0.25)',
    md: '0 4px 8px rgba(0,0,0,0.35)',
    lg: '0 8px 20px rgba(0,0,0,0.45)',
    glow: `0 0 12px ${form.value.bgColor}80, 0 0 24px ${form.value.bgColor}40`,
  }
  return map[form.value.shadow] || 'none'
})

const previewPadding = computed(() => {
  const map: Record<string, string> = { compact: '4px 8px', normal: '6px 12px', spacious: '10px 20px' }
  return map[form.value.padding] || '6px 12px'
})

const previewTextShadow = computed(() => {
  const ts = form.value.textShadow
  const map: Record<string, string> = {
    none: 'none',
    sm: '1px 1px 2px rgba(0,0,0,0.5)',
    md: '2px 2px 4px rgba(0,0,0,0.6)',
    lg: '3px 3px 6px rgba(0,0,0,0.7)',
    hard: `2px 2px 0 ${form.value.bgColor}, -1px -1px 0 ${form.value.bgColor}, 1px -1px 0 ${form.value.bgColor}, -1px 1px 0 ${form.value.bgColor}`,
  }
  return map[ts] || 'none'
})

const previewCurrencySize = computed(() => {
  const map: Record<string, string> = { small: '10px', medium: '16px', large: '24px' }
  return map[form.value.currencySize] || '10px'
})

const previewSealStyle = computed(() => {
  const dm = form.value.displayMode
  const style: Record<string, string> = {
    color: form.value.textColor,
    borderRadius: previewBorderRadius.value,
    fontFamily: form.value.fontFamily,
    padding: previewPadding.value,
    position: 'relative',
    overflow: 'hidden',
  }

  if (dm === 'filled' || dm === 'splash') {
    style.background = previewBackground.value
    style.opacity = String(form.value.bgOpacity)
  } else if (dm === 'outline') {
    style.background = 'transparent'
    style.border = `2px solid ${form.value.bgColor}`
    style.color = form.value.bgColor
  } else if (dm === 'underline') {
    style.background = 'transparent'
    style.color = form.value.bgColor
    style.borderBottom = `3px solid ${form.value.bgColor}`
    style.borderRadius = '0'
    style.padding = '2px 4px'
  } else if (dm === 'naked') {
    style.background = 'transparent'
    style.color = form.value.bgColor
    style.padding = '0'
  }

  if (dm === 'filled' || dm === 'splash') {
    if (previewBorder.value !== 'none') style.border = previewBorder.value
  }
  if (previewShadow.value !== 'none') style.boxShadow = previewShadow.value
  if (previewTextShadow.value !== 'none') style.textShadow = previewTextShadow.value
  if (form.value.rotation !== 0) style.transform = `rotate(${form.value.rotation}deg)`
  if (dm === 'splash') {
    style.background = 'transparent'
    style.padding = '14px 18px'
  }
  return style
})

const previewBgImageStyle = computed(() => {
  if (!form.value.bgImage) return null
  return {
    position: 'absolute' as const,
    inset: '0',
    backgroundImage: `url(${form.value.bgImage})`,
    backgroundSize: form.value.bgImageSize === 'stretch' ? '100% 100%' : form.value.bgImageSize,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    opacity: form.value.bgImageOpacity,
    zIndex: '0',
    pointerEvents: 'none' as const,
  }
})

const COIN_IMAGES = {
  real1: '/coins/1real.svg',
  cent50: '/coins/50centavos.svg',
  cent25: '/coins/25centavos.svg',
}

const getFontLabel = (fontFamily: string | undefined) => {
  if (!fontFamily || fontFamily === 'inherit') return ''
  const found = FONT_OPTIONS.find(f => f.value === fontFamily)
  return found ? found.label : 'Custom'
}

const getCardSealStyle = (cfg: PriceTagStyle['css_config']) => {
  const dm = cfg?.displayMode || 'filled'
  const style: Record<string, string> = {
    fontFamily: cfg?.fontFamily || 'inherit',
  }
  // Display mode
  if (dm === 'outline') {
    style.background = 'transparent'
    style.border = `2px solid ${cfg?.bgColor || '#ef4444'}`
    style.color = cfg?.bgColor || '#ef4444'
  } else if (dm === 'underline') {
    style.background = 'transparent'
    style.color = cfg?.bgColor || '#ef4444'
    style.borderBottom = `3px solid ${cfg?.bgColor || '#ef4444'}`
    style.borderRadius = '0'
  } else if (dm === 'naked') {
    style.background = 'transparent'
    style.color = cfg?.bgColor || '#ef4444'
  } else {
    // filled / splash
    if (cfg?.bgGradient && cfg?.bgGradientColor) {
      const dir = cfg.bgGradientDirection || 'to-right'
      if (dir === 'radial') {
        style.background = `radial-gradient(circle, ${cfg.bgColor}, ${cfg.bgGradientColor})`
      } else {
        const cssDir = dir.replace('to-', 'to ').replace('br', 'bottom right').replace('bl', 'bottom left')
        style.background = `linear-gradient(${cssDir}, ${cfg.bgColor}, ${cfg.bgGradientColor})`
      }
    } else {
      style.backgroundColor = cfg?.bgColor || '#ef4444'
    }
    style.color = cfg?.textColor || '#fff'
  }
  // Border radius
  const hasCustom = cfg?.borderRadiusTL != null || cfg?.borderRadiusTR != null || cfg?.borderRadiusBL != null || cfg?.borderRadiusBR != null
  if (hasCustom) {
    style.borderRadius = `${cfg?.borderRadiusTL ?? 8}px ${cfg?.borderRadiusTR ?? 8}px ${cfg?.borderRadiusBR ?? 8}px ${cfg?.borderRadiusBL ?? 8}px`
  } else {
    style.borderRadius = getShapeRadius(cfg?.shape)
  }
  // Border
  if (cfg?.borderStyle && cfg.borderStyle !== 'none' && cfg?.borderWidth) {
    style.border = `${cfg.borderWidth}px ${cfg.borderStyle} ${cfg.borderColor || '#000'}`
  }
  // Shadow
  if (cfg?.shadow && cfg.shadow !== 'none') {
    const map: Record<string, string> = {
      sm: '0 1px 3px rgba(0,0,0,0.25)',
      md: '0 4px 8px rgba(0,0,0,0.35)',
      lg: '0 8px 20px rgba(0,0,0,0.45)',
      glow: `0 0 12px ${cfg.bgColor}80, 0 0 24px ${cfg.bgColor}40`,
    }
    style.boxShadow = map[cfg.shadow] || 'none'
  }
  if (cfg?.bgOpacity != null && cfg.bgOpacity < 1) {
    style.opacity = String(cfg.bgOpacity)
  }
  if (cfg?.textShadow && cfg.textShadow !== 'none') {
    const tsMap: Record<string, string> = {
      sm: '1px 1px 2px rgba(0,0,0,0.5)',
      md: '2px 2px 4px rgba(0,0,0,0.6)',
      lg: '3px 3px 6px rgba(0,0,0,0.7)',
      hard: `2px 2px 0 ${cfg.bgColor}`,
    }
    style.textShadow = tsMap[cfg.textShadow] || 'none'
  }
  if (cfg?.rotation) {
    style.transform = `rotate(${cfg.rotation}deg)`
  }
  return style
}

onMounted(() => {
  fetchStyles()
})
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <!-- Subtle grain texture overlay -->
    <div class="fixed inset-0 pointer-events-none opacity-[0.015] z-50" style="background-image: url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E');" />

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 relative">
      <!-- ═══════ Header ═══════ -->
      <div class="mb-8">
        <NuxtLink
          to="/admin/builder"
          class="group inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 transition-all duration-200"
        >
          <ArrowLeft class="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Voltar ao Builder</span>
        </NuxtLink>

        <div class="flex items-end justify-between mt-4">
          <div>
            <h1 class="text-3xl font-bold tracking-tight bg-linear-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              Estilos de Etiqueta
            </h1>
            <p class="text-sm text-zinc-500 mt-1.5">Configure cores, formatos e efeitos das etiquetas de preco</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-200 border border-zinc-800 hover:border-zinc-700"
              :disabled="isSeeding"
              @click="seedStyles"
              title="Criar estilos predefinidos"
            >
              <Zap class="h-4 w-4" />
              {{ isSeeding ? 'Criando...' : 'Seed' }}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30"
              @click="openCreate"
            >
              <Plus class="h-4 w-4" />
              Novo Estilo
            </button>
          </div>
        </div>
      </div>

      <!-- Error banner -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="error" class="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-sm p-4 text-sm text-red-300 flex items-start gap-3">
          <div class="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0 animate-pulse" />
          <span class="flex-1">{{ error }}</span>
          <button @click="error = null" class="text-red-500/60 hover:text-red-400 transition-colors">
            <X class="h-4 w-4" />
          </button>
        </div>
      </Transition>

      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center py-24">
        <div class="flex flex-col items-center gap-4">
          <div class="w-8 h-8 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
          <span class="text-sm text-zinc-500">Carregando estilos...</span>
        </div>
      </div>

      <!-- ═══════ Cards Grid ═══════ -->
      <div v-else-if="styles.length && !showForm" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div
          v-for="style in styles"
          :key="style.id"
          class="group relative rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm hover:border-zinc-700/80 hover:bg-zinc-900/60 transition-all duration-300 overflow-hidden cursor-pointer"
          @click="openEdit(style)"
        >
          <!-- Colored top accent bar -->
          <div class="h-0.5 w-full" :style="{ background: style.css_config?.bgGradient && style.css_config?.bgGradientColor ? `linear-gradient(to right, ${style.css_config.bgColor}, ${style.css_config.bgGradientColor})` : style.css_config?.bgColor || '#ef4444' }" />

          <!-- Preview area -->
          <div class="px-4 pt-5 pb-3 flex flex-col items-center">
            <div class="flex items-center gap-2">
              <div class="flex flex-col items-center gap-0.5 opacity-50">
                <span class="text-[6px] text-zinc-600 font-bold uppercase">De</span>
                <span
                  class="text-[8px] font-bold line-through px-1 py-0.5 rounded"
                  :style="{ backgroundColor: style.css_config?.bgColor + '15', color: style.css_config?.bgColor }"
                >R$40</span>
              </div>
              <div
                class="flex items-baseline gap-0.5 px-3 py-1.5 font-bold"
                :style="getCardSealStyle(style.css_config)"
              >
                <span class="text-[8px]">R$</span>
                <span class="text-[22px] font-extrabold leading-none">15</span>
                <span
                  :class="{ '-mt-1.5': style.css_config?.decimalStyle === 'superscript' }"
                  :style="{ fontSize: style.css_config?.decimalStyle === 'large' ? '22px' : style.css_config?.decimalStyle === 'superscript' ? '8px' : '11px' }"
                >,88</span>
                <span v-if="!style.css_config?.hideUnit" class="text-[7px] opacity-70 ml-0.5">/kg</span>
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="px-4 pb-3">
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <h3 class="text-sm font-semibold text-zinc-200 truncate">{{ style.name }}</h3>
                <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span class="text-[9px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded">{{ shapeLabel(style.css_config?.shape) }}</span>
                  <span
                    class="w-3 h-3 rounded-sm border border-zinc-700 shrink-0"
                    :style="{ backgroundColor: style.css_config?.bgColor }"
                  />
                  <template v-if="style.css_config?.displayMode && style.css_config.displayMode !== 'filled'">
                    <span class="text-[9px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded">{{ { outline: 'Contorno', underline: 'Sublinhado', naked: 'Sem fundo', splash: 'Splash' }[style.css_config.displayMode] || style.css_config.displayMode }}</span>
                  </template>
                  <span
                    v-if="style.is_global"
                    class="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  >Global</span>
                  <span
                    v-if="!style.is_active"
                    class="text-[8px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700"
                  >Inativo</span>
                </div>
              </div>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  class="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                  title="Editar"
                  @click.stop="openEdit(style)"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
                <button
                  class="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  title="Excluir"
                  @click.stop="showDeleteConfirm = style.id"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!styles.length && !showForm && !isLoading" class="flex flex-col items-center justify-center py-24">
        <div class="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6">
          <svg class="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </div>
        <p class="text-zinc-400 font-medium mb-1">Nenhum estilo cadastrado</p>
        <p class="text-sm text-zinc-600 mb-6">Comece criando estilos predefinidos ou crie o seu</p>
        <div class="flex items-center gap-3">
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-all duration-200 border border-zinc-800"
            :disabled="isSeeding"
            @click="seedStyles"
          >
            <Zap class="h-4 w-4" />
            {{ isSeeding ? 'Criando...' : 'Criar Predefinidos' }}
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-all duration-200 shadow-lg shadow-emerald-600/20"
            @click="openCreate"
          >
            <Plus class="h-4 w-4" />
            Criar Manualmente
          </button>
        </div>
      </div>

      <!-- ═══════ Delete Confirmation Modal ═══════ -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showDeleteConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          @click.self="showDeleteConfirm = null"
        >
          <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl max-w-sm w-full mx-4">
            <div class="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
              <Trash2 class="h-6 w-6 text-red-400" />
            </div>
            <h3 class="text-lg font-semibold text-zinc-100">Excluir estilo?</h3>
            <p class="mt-2 text-sm text-zinc-400">Esta acao nao pode ser desfeita.</p>
            <div class="mt-6 flex justify-end gap-2">
              <button
                class="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                @click="showDeleteConfirm = null"
              >
                Cancelar
              </button>
              <button
                class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
                @click="deleteStyle(showDeleteConfirm!)"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ═══════ Form Panel ═══════ -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0 -translate-y-4"
      >
        <div v-if="showForm">
          <!-- Form header -->
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <button
                class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                @click="showForm = false; resetForm()"
              >
                <ArrowLeft class="h-5 w-5" />
              </button>
              <div>
                <h2 class="text-xl font-semibold">
                  {{ editingId ? 'Editar Estilo' : 'Novo Estilo' }}
                </h2>
                <p class="text-xs text-zinc-500 mt-0.5">Configure todas as propriedades visuais</p>
              </div>
            </div>
            <button
              class="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              @click="showForm = false; resetForm()"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <!-- ═══ Left: Form with Accordion Sections ═══ -->
            <form @submit.prevent="saveStyle" class="lg:col-span-3 space-y-2">

              <!-- ── Nome (always visible) ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm p-4">
                <label class="block text-xs font-semibold text-zinc-300 mb-2">Nome do Estilo *</label>
                <input
                  v-model="form.name"
                  type="text"
                  required
                  class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                  placeholder="Ex: Vermelho Classico"
                />
              </div>

              <!-- ── Section: Aparencia ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('appearance')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Palette class="h-3.5 w-3.5 text-violet-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Aparencia</span>
                    <span class="text-[10px] text-zinc-600">Cores, formato, fonte</span>
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.appearance }" />
                </button>
                <div v-show="openSections.appearance" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="grid grid-cols-2 gap-3 pt-3">
                    <div v-if="!form.bgImage && (form.displayMode === 'filled' || form.displayMode === 'splash')">
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Cor de Fundo</label>
                      <div class="flex items-center gap-2">
                        <input v-model="form.bgColor" type="color" class="h-9 w-11 rounded-lg border border-zinc-700/60 bg-zinc-950 cursor-pointer" />
                        <input v-model="form.bgColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Cor do Texto</label>
                      <div class="flex items-center gap-2">
                        <input v-model="form.textColor" type="color" class="h-9 w-11 rounded-lg border border-zinc-700/60 bg-zinc-950 cursor-pointer" />
                        <input v-model="form.textColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Formato</label>
                      <select v-model="form.shape" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option value="rounded">Arredondado</option>
                        <option value="square">Quadrado</option>
                        <option value="pill">Pilula</option>
                        <option value="circle">Circulo</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Fonte</label>
                      <select v-model="form.fontFamily" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option v-for="f in FONT_OPTIONS" :key="f.value" :value="f.value" :style="{ fontFamily: f.value }">{{ f.label }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Estilo Centavos</label>
                      <select v-model="form.decimalStyle" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option v-for="ds in DECIMAL_STYLE_OPTIONS" :key="ds.value" :value="ds.value">{{ ds.label }}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Section: Modo de Exibicao ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('displayMode')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center">
                      <Eye class="h-3.5 w-3.5 text-sky-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Modo de Exibicao</span>
                    <span class="text-[10px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">{{ DISPLAY_MODE_OPTIONS.find(d => d.value === form.displayMode)?.label || 'Preenchido' }}</span>
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.displayMode }" />
                </button>
                <div v-show="openSections.displayMode" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="grid grid-cols-2 gap-3 pt-3">
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Tipo da Etiqueta</label>
                      <select v-model="form.displayMode" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option v-for="dm in DISPLAY_MODE_OPTIONS" :key="dm.value" :value="dm.value">{{ dm.label }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Tamanho do R$</label>
                      <select v-model="form.currencySize" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option v-for="cs in CURRENCY_SIZE_OPTIONS" :key="cs.value" :value="cs.value">{{ cs.label }}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Section: Efeitos de Texto ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('textEffects')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Type class="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Efeitos de Texto</span>
                    <span v-if="form.textShadow !== 'none' || form.rotation !== 0" class="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.textEffects }" />
                </button>
                <div v-show="openSections.textEffects" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="grid grid-cols-2 gap-3 pt-3">
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Sombra no Texto</label>
                      <select v-model="form.textShadow" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option v-for="ts in TEXT_SHADOW_OPTIONS" :key="ts.value" :value="ts.value">{{ ts.label }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Rotacao</label>
                      <div class="flex items-center gap-2">
                        <input v-model.number="form.rotation" type="range" min="-15" max="15" step="1" class="flex-1 accent-emerald-500" />
                        <span class="text-xs text-zinc-400 font-mono w-8 text-right">{{ form.rotation }}°</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Section: Borda ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('border')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                      <Layers class="h-3.5 w-3.5 text-rose-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Borda</span>
                    <span v-if="form.borderStyle !== 'none'" class="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.border }" />
                </button>
                <div v-show="openSections.border" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="grid grid-cols-2 gap-3 pt-3">
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Estilo da Borda</label>
                      <select v-model="form.borderStyle" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option v-for="bs in BORDER_STYLE_OPTIONS" :key="bs.value" :value="bs.value">{{ bs.label }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Largura</label>
                      <div class="flex items-center gap-2">
                        <input v-model.number="form.borderWidth" type="range" min="0" max="8" step="1" class="flex-1 accent-emerald-500" />
                        <span class="text-xs text-zinc-400 font-mono w-8 text-right">{{ form.borderWidth }}px</span>
                      </div>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Cor da Borda</label>
                      <div class="flex items-center gap-2">
                        <input v-model="form.borderColor" type="color" class="h-9 w-11 rounded-lg border border-zinc-700/60 bg-zinc-950 cursor-pointer" />
                        <input v-model="form.borderColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all" />
                      </div>
                    </div>
                  </div>
                  <!-- Corner radius -->
                  <div class="mt-4 pt-3 border-t border-zinc-800/40">
                    <label class="block text-[11px] font-medium text-zinc-500 mb-2.5">Arredondamento por Canto</label>
                    <div class="flex items-center gap-4">
                      <div class="relative w-16 h-14 border-2 border-zinc-700 shrink-0 transition-all duration-200" :style="{ borderRadius: previewBorderRadius }">
                        <div class="absolute -top-1 -left-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-950" title="Top-Left" />
                        <div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-zinc-950" title="Top-Right" />
                        <div class="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-zinc-950" title="Bottom-Left" />
                        <div class="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-zinc-950" title="Bottom-Right" />
                      </div>
                      <div class="grid grid-cols-2 gap-2 flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
                          <input
                            :value="form.borderRadiusTL ?? ''"
                            type="number" min="0" max="100" step="1" placeholder="Auto"
                            class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                            @input="form.borderRadiusTL = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                          />
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                          <input
                            :value="form.borderRadiusTR ?? ''"
                            type="number" min="0" max="100" step="1" placeholder="Auto"
                            class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                            @input="form.borderRadiusTR = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                          />
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="w-2 h-2 bg-amber-500 rounded-full shrink-0" />
                          <input
                            :value="form.borderRadiusBL ?? ''"
                            type="number" min="0" max="100" step="1" placeholder="Auto"
                            class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                            @input="form.borderRadiusBL = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                          />
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span class="w-2 h-2 bg-rose-500 rounded-full shrink-0" />
                          <input
                            :value="form.borderRadiusBR ?? ''"
                            type="number" min="0" max="100" step="1" placeholder="Auto"
                            class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                            @input="form.borderRadiusBR = ($event.target as HTMLInputElement).value === '' ? null : Number(($event.target as HTMLInputElement).value)"
                          />
                        </div>
                      </div>
                    </div>
                    <span class="text-[10px] text-zinc-600 mt-1.5 block">Vazio = usa o formato padrao</span>
                  </div>
                </div>
              </div>

              <!-- ── Section: Sombra & Efeitos (conditional) ── -->
              <div v-if="!form.bgImage && (form.displayMode === 'filled' || form.displayMode === 'splash')" class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('shadowEffects')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Layers class="h-3.5 w-3.5 text-indigo-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Sombra & Opacidade</span>
                    <span v-if="form.shadow !== 'none' || form.bgOpacity < 1" class="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.shadowEffects }" />
                </button>
                <div v-show="openSections.shadowEffects" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="grid grid-cols-2 gap-3 pt-3">
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Sombra</label>
                      <select v-model="form.shadow" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option v-for="sh in SHADOW_OPTIONS" :key="sh.value" :value="sh.value">{{ sh.label }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Opacidade do Fundo</label>
                      <div class="flex items-center gap-2">
                        <input v-model.number="form.bgOpacity" type="range" min="0.1" max="1" step="0.05" class="flex-1 accent-emerald-500" />
                        <span class="text-xs text-zinc-400 font-mono w-8 text-right">{{ Math.round(form.bgOpacity * 100) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Section: Gradiente (conditional) ── -->
              <div v-if="!form.bgImage && (form.displayMode === 'filled' || form.displayMode === 'splash')" class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('gradient')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden" :style="{ background: form.bgGradient ? `linear-gradient(to right, ${form.bgColor}, ${form.bgGradientColor})` : 'rgb(236 72 153 / 0.1)' }">
                      <Palette class="h-3.5 w-3.5" :class="form.bgGradient ? 'text-white' : 'text-pink-400'" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Gradiente</span>
                    <span v-if="form.bgGradient" class="w-1.5 h-1.5 rounded-full bg-pink-500" />
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.gradient }" />
                </button>
                <div v-show="openSections.gradient" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="pt-3">
                    <label class="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer mb-3">
                      <input v-model="form.bgGradient" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                      Ativar Gradiente
                    </label>
                    <div v-if="form.bgGradient" class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Cor Final</label>
                        <div class="flex items-center gap-2">
                          <input v-model="form.bgGradientColor" type="color" class="h-9 w-11 rounded-lg border border-zinc-700/60 bg-zinc-950 cursor-pointer" />
                          <input v-model="form.bgGradientColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-2.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40" />
                        </div>
                      </div>
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Direcao</label>
                        <select v-model="form.bgGradientDirection" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                          <option v-for="gd in GRADIENT_DIR_OPTIONS" :key="gd.value" :value="gd.value">{{ gd.label }}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Section: Imagem de Fundo ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('bgImage')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Image class="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Imagem de Fundo</span>
                    <span v-if="form.bgImage" class="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.bgImage }" />
                </button>
                <div v-show="openSections.bgImage" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="pt-3">
                    <div class="flex items-center gap-2">
                      <input
                        v-model="form.bgImage"
                        type="text"
                        readonly
                        placeholder="Nenhuma imagem"
                        class="flex-1 min-w-0 rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none truncate"
                      />
                      <input ref="bgImageInputRef" type="file" accept="image/*" class="hidden" @change="handleBgImageUpload" />
                      <button
                        type="button"
                        :disabled="isUploadingBgImage"
                        class="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors border border-zinc-700/60 whitespace-nowrap disabled:opacity-50"
                        @click="bgImageInputRef?.click()"
                      >
                        <Upload class="h-3.5 w-3.5" />
                        {{ isUploadingBgImage ? '...' : 'Upload' }}
                      </button>
                      <button
                        v-if="form.bgImage"
                        type="button"
                        class="rounded-lg p-2 text-red-400 hover:bg-red-500/10 transition-colors"
                        @click="form.bgImage = ''"
                      >
                        <X class="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div v-if="form.bgImage" class="mt-3 flex items-center gap-3">
                      <img :src="form.bgImage" class="h-12 w-20 object-cover rounded-lg border border-zinc-700" alt="Preview" />
                      <span class="text-[10px] text-zinc-500 truncate">{{ form.bgImage }}</span>
                    </div>
                    <div v-if="form.bgImage" class="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Ajuste</label>
                        <select v-model="form.bgImageSize" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                          <option value="cover">Cobrir</option>
                          <option value="contain">Conter</option>
                          <option value="stretch">Esticar</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Opacidade</label>
                        <div class="flex items-center gap-2">
                          <input v-model.number="form.bgImageOpacity" type="range" min="0.05" max="1" step="0.05" class="flex-1 accent-emerald-500" />
                          <span class="text-xs text-zinc-400 font-mono w-8 text-right">{{ Math.round(form.bgImageOpacity * 100) }}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Section: Espacamento & Tamanho ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('spacing')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Move class="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Espacamento & Tamanho</span>
                    <span class="text-[10px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">{{ Math.round(form.priceScale * 100) }}%</span>
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.spacing }" />
                </button>
                <div v-show="openSections.spacing" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="grid grid-cols-2 gap-3 pt-3">
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Padding</label>
                      <select v-model="form.padding" class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition-all">
                        <option v-for="p in PADDING_OPTIONS" :key="p.value" :value="p.value">{{ p.label }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Escala do Preco</label>
                      <div class="flex items-center gap-2">
                        <input v-model.number="form.priceScale" type="range" min="0.6" max="1.8" step="0.05" class="flex-1 accent-emerald-500" />
                        <span class="text-xs text-zinc-400 font-mono w-10 text-right">{{ Math.round(form.priceScale * 100) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Section: Gondola ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('gondola')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Scissors class="h-3.5 w-3.5 text-orange-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Gondola (Impresso)</span>
                    <span v-if="form.showCutLine || form.showBarcode || form.showValidity" class="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.gondola }" />
                </button>
                <div v-show="openSections.gondola" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="flex flex-col gap-3 pt-3">
                    <label class="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors">
                      <input v-model="form.showCutLine" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                      Linha de Corte
                    </label>
                    <label class="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors">
                      <input v-model="form.showBarcode" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                      Codigo de Barras
                    </label>
                    <label class="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors">
                      <input v-model="form.showValidity" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                      Validade da Oferta
                    </label>
                  </div>
                </div>
              </div>

              <!-- ── Section: Configuracoes ── -->
              <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  @click="toggleSection('settings')"
                >
                  <div class="flex items-center gap-2.5">
                    <div class="w-7 h-7 rounded-lg bg-zinc-500/10 flex items-center justify-center">
                      <Settings class="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <span class="text-sm font-medium text-zinc-200">Configuracoes</span>
                  </div>
                  <ChevronDown class="h-4 w-4 text-zinc-500 transition-transform duration-200" :class="{ 'rotate-180': openSections.settings }" />
                </button>
                <div v-show="openSections.settings" class="px-4 pb-4 border-t border-zinc-800/50">
                  <div class="pt-3 space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[11px] font-medium text-zinc-500 mb-1.5">Ordem</label>
                        <input
                          v-model.number="form.sort_order"
                          type="number"
                          class="w-full rounded-lg border border-zinc-700/60 bg-zinc-950/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
                        />
                      </div>
                    </div>
                    <div class="flex flex-col gap-2.5">
                      <label class="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors">
                        <input v-model="form.is_global" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                        Global (visivel para todos)
                      </label>
                      <label class="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors">
                        <input v-model="form.is_active" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                        Ativo
                      </label>
                      <label class="flex items-center gap-2.5 text-sm text-zinc-300 cursor-pointer hover:text-zinc-100 transition-colors">
                        <input v-model="form.hideUnit" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                        Ocultar unidade (/kg, /un)
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  :disabled="isSaving || !form.name"
                  class="rounded-xl bg-emerald-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30"
                >
                  {{ isSaving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar Estilo') }}
                </button>
                <button
                  type="button"
                  class="rounded-xl bg-zinc-800 px-6 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                  @click="showForm = false; resetForm()"
                >
                  Cancelar
                </button>
              </div>
            </form>

            <!-- ═══ Right: Sticky Preview ═══ -->
            <div class="lg:col-span-2">
              <div class="lg:sticky lg:top-6 space-y-4">
                <!-- Mode selector tabs -->
                <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm p-3">
                  <label class="block text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Preview</label>
                  <div class="flex flex-wrap gap-1">
                    <button
                      v-for="pm in PRICE_MODES"
                      :key="pm.value"
                      :class="[
                        'text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200',
                        previewMode === pm.value
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                          : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                      ]"
                      @click="previewMode = pm.value"
                    >
                      {{ pm.label }}
                    </button>
                  </div>
                </div>

                <!-- Preview card -->
                <div class="rounded-xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-sm p-6 min-h-40 flex items-center justify-center">
                  <!-- simple -->
                  <div v-if="previewMode === 'simple'" class="flex flex-col items-center gap-2">
                    <p class="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Preco Simples</p>
                    <div v-if="form.showCutLine" class="w-full border-t-2 border-dashed opacity-30" :style="{ borderColor: form.bgColor }" />
                    <div
                      class="flex items-baseline gap-0.5 font-bold"
                      :class="{ 'splash-preview': form.displayMode === 'splash' }"
                      :style="previewSealStyle"
                    >
                      <svg v-if="form.displayMode === 'splash'" class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style="z-index: 0;">
                        <polygon :fill="form.bgColor" points="50,0 61,12 78,5 73,22 95,25 82,38 100,50 82,62 95,75 73,78 78,95 61,88 50,100 39,88 22,95 27,78 5,75 18,62 0,50 18,38 5,25 27,22 22,5 39,12" />
                      </svg>
                      <div v-if="previewBgImageStyle" :style="previewBgImageStyle" />
                      <span class="relative z-1" :style="{ fontSize: previewCurrencySize }">R$</span>
                      <span class="font-extrabold leading-none relative z-1" :style="{ fontSize: `${28 * form.priceScale}px` }">15</span>
                      <span class="relative z-1" :class="previewDecimalClass" :style="{ fontSize: previewDecimalSize }">,88</span>
                      <span v-if="!form.hideUnit" class="text-[8px] opacity-70 ml-1 relative z-1">/kg</span>
                    </div>
                    <div v-if="form.showBarcode" class="flex flex-col items-center mt-1">
                      <div class="flex items-end gap-px" style="height: 14px;">
                        <div v-for="i in 20" :key="i" class="bg-zinc-400" :style="{ width: i % 3 === 0 ? '2px' : '1px', height: `${40 + (i * 7) % 30}%` }" />
                      </div>
                      <span class="text-[7px] text-zinc-500 font-mono mt-0.5">7891234567890</span>
                    </div>
                    <span v-if="form.showValidity" class="text-[8px] text-zinc-500 mt-0.5">Valido ate __/__/____</span>
                    <div v-if="form.showCutLine" class="w-full border-t-2 border-dashed opacity-30" :style="{ borderColor: form.bgColor }" />
                  </div>

                  <!-- from_to -->
                  <div v-else-if="previewMode === 'from_to'" class="flex flex-col items-center gap-2">
                    <p class="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">De / Por</p>
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[8px] text-zinc-500 font-bold uppercase">De</span>
                        <span class="text-[11px] font-bold line-through px-2 py-1 rounded" :style="{ backgroundColor: form.bgColor + '22', color: form.bgColor }">R$40,00</span>
                      </div>
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[8px] font-bold" :style="{ color: form.bgColor }">Por</span>
                        <div class="flex items-baseline gap-0.5 px-3 py-1.5 font-bold" :style="previewSealStyle">
                          <div v-if="previewBgImageStyle" :style="previewBgImageStyle" />
                          <span class="text-[8px] relative z-1">R$</span>
                          <span class="text-[24px] font-extrabold leading-none relative z-1">20</span>
                          <span class="relative z-1" :class="previewDecimalClass" :style="{ fontSize: previewDecimalSize }">,00</span>
                        </div>
                      </div>
                    </div>
                    <span class="text-[9px] font-bold" :style="{ color: form.bgColor }">-50% OFF</span>
                  </div>

                  <!-- x_per_y -->
                  <div v-else-if="previewMode === 'x_per_y'" class="flex flex-col items-center gap-2">
                    <p class="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">X por Y</p>
                    <span class="text-[11px] font-bold" :style="{ color: form.bgColor }">3 Kilos Por</span>
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[8px] text-zinc-500 font-bold">PRECO</span>
                        <span class="text-[10px] font-bold px-2 py-1 rounded" :style="{ backgroundColor: form.bgColor + '22', color: form.bgColor }">R$16,88</span>
                      </div>
                      <div class="flex items-baseline gap-0.5 px-3 py-1.5 font-bold" :style="previewSealStyle">
                        <div v-if="previewBgImageStyle" :style="previewBgImageStyle" />
                        <span class="text-[8px] relative z-1">R$</span>
                        <span class="text-[24px] font-extrabold leading-none relative z-1">15</span>
                        <span class="relative z-1" :class="previewDecimalClass" :style="{ fontSize: previewDecimalSize }">,88</span>
                      </div>
                    </div>
                  </div>

                  <!-- take_pay -->
                  <div v-else-if="previewMode === 'take_pay'" class="flex flex-col items-center gap-2">
                    <p class="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Leve X Pague Y</p>
                    <span class="text-[11px] font-bold" :style="{ color: form.bgColor }">Leve 3 Pague 2</span>
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[8px] text-zinc-500 font-bold">KILO</span>
                        <span class="text-[10px] font-bold px-2 py-1 rounded" :style="{ backgroundColor: form.bgColor + '22', color: form.bgColor }">R$20,00</span>
                      </div>
                      <div class="flex items-baseline gap-0.5 px-3 py-1.5 font-bold" :style="previewSealStyle">
                        <div v-if="previewBgImageStyle" :style="previewBgImageStyle" />
                        <span class="text-[8px] relative z-1">R$</span>
                        <span class="text-[24px] font-extrabold leading-none relative z-1">40</span>
                        <span class="relative z-1" :class="previewDecimalClass" :style="{ fontSize: previewDecimalSize }">,00</span>
                        <span v-if="!form.hideUnit" class="text-[7px] opacity-70 ml-0.5 relative z-1">/kg</span>
                      </div>
                    </div>
                  </div>

                  <!-- installment -->
                  <div v-else-if="previewMode === 'installment'" class="flex flex-col items-center gap-2">
                    <p class="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Parcelado</p>
                    <span class="text-[11px] font-bold" :style="{ color: form.bgColor }">Apenas 10X de</span>
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[8px] text-zinc-500 font-bold">A VISTA</span>
                        <span class="text-[10px] font-bold px-2 py-1 rounded" :style="{ backgroundColor: form.bgColor + '22', color: form.bgColor }">R$1.539</span>
                      </div>
                      <div class="flex items-baseline gap-0.5 px-3 py-1.5 font-bold" :style="previewSealStyle">
                        <div v-if="previewBgImageStyle" :style="previewBgImageStyle" />
                        <span class="text-[8px] relative z-1">R$</span>
                        <span class="text-[24px] font-extrabold leading-none relative z-1">153</span>
                        <span class="relative z-1" :class="previewDecimalClass" :style="{ fontSize: previewDecimalSize }">,90</span>
                      </div>
                    </div>
                    <span class="text-[10px] font-bold" :style="{ color: form.bgColor }">Sem Juros</span>
                  </div>

                  <!-- symbolic -->
                  <div v-else-if="previewMode === 'symbolic'" class="flex flex-col items-center gap-2">
                    <p class="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Simbolico</p>
                    <div class="flex items-center gap-3 py-2">
                      <div class="flex flex-col items-center gap-1">
                        <img :src="COIN_IMAGES.cent25" alt="25 centavos" class="w-11 h-11 rounded-full shadow-lg" />
                        <span class="text-[7px] text-zinc-600">25 centavos</span>
                      </div>
                      <div class="flex flex-col items-center gap-1">
                        <img :src="COIN_IMAGES.cent50" alt="50 centavos" class="w-11 h-11 rounded-full shadow-lg" />
                        <span class="text-[7px] text-zinc-600">50 centavos</span>
                      </div>
                      <div class="flex flex-col items-center gap-1">
                        <img :src="COIN_IMAGES.real1" alt="1 real" class="w-12 h-12 rounded-full shadow-lg" />
                        <span class="text-[7px] text-zinc-600">1 real</span>
                      </div>
                    </div>
                    <div class="flex items-center mt-1" style="margin-left: 12px;">
                      <img :src="COIN_IMAGES.real1" alt="R$1" class="w-10 h-10 rounded-full shadow-lg relative" style="z-index: 2;" />
                      <img :src="COIN_IMAGES.cent25" alt="25¢" class="w-10 h-10 rounded-full shadow-lg relative" style="z-index: 1; margin-left: -10px;" />
                    </div>
                    <span class="text-[8px] text-zinc-500">R$1,25</span>
                    <div class="flex items-center gap-2 mt-2">
                      <div class="flex items-center justify-center rounded-md border w-12 h-6 shadow-md" style="background-color: #6b46c1; border-color: rgba(255,255,255,0.3); color: #fff;">
                        <span class="text-[7px] font-extrabold">R$5</span>
                      </div>
                      <div class="flex items-center justify-center rounded-md border w-12 h-6 shadow-md" style="background-color: #c53030; border-color: rgba(255,255,255,0.3); color: #fff;">
                        <span class="text-[7px] font-extrabold">R$10</span>
                      </div>
                      <div class="flex items-center justify-center rounded-md border w-12 h-6 shadow-md" style="background-color: #d69e2e; border-color: rgba(255,255,255,0.3); color: #fff;">
                        <span class="text-[7px] font-extrabold">R$20</span>
                      </div>
                    </div>
                  </div>

                  <!-- club_price -->
                  <div v-else-if="previewMode === 'club_price'" class="flex flex-col items-center gap-2">
                    <p class="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Preco Clube</p>
                    <span class="text-[11px] font-bold" :style="{ color: form.bgColor }">Preco Clube</span>
                    <div class="flex items-center gap-3">
                      <div class="flex flex-col items-center gap-0.5">
                        <span class="text-[8px] text-zinc-500 font-bold">PRECO</span>
                        <span class="text-[10px] font-bold line-through px-2 py-1 rounded" :style="{ backgroundColor: form.bgColor + '22', color: form.bgColor }">R$16,88</span>
                      </div>
                      <div class="flex items-baseline gap-0.5 px-3 py-1.5 font-bold" :style="previewSealStyle">
                        <div v-if="previewBgImageStyle" :style="previewBgImageStyle" />
                        <span class="text-[8px] relative z-1">R$</span>
                        <span class="text-[24px] font-extrabold leading-none relative z-1">15</span>
                        <span class="relative z-1" :class="previewDecimalClass" :style="{ fontSize: previewDecimalSize }">,88</span>
                        <span v-if="!form.hideUnit" class="text-[7px] opacity-70 ml-0.5 relative z-1">/kg</span>
                      </div>
                    </div>
                  </div>

                  <!-- anticipation -->
                  <div v-else-if="previewMode === 'anticipation'" class="flex flex-col items-center gap-2">
                    <p class="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Antecipacao</p>
                    <span class="text-[10px] opacity-70" :style="{ color: form.textColor }">Preco</span>
                    <div class="px-6 py-3 font-bold text-center" :style="previewSealStyle">
                      <div v-if="previewBgImageStyle" :style="previewBgImageStyle" />
                      <span class="text-[18px] font-bold relative z-1">Especial</span>
                    </div>
                  </div>
                </div>

                <!-- All 8 modes mini grid -->
                <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm p-3">
                  <label class="block text-[10px] font-semibold text-zinc-600 mb-2 uppercase tracking-wider">Todos os modos</label>
                  <div class="grid grid-cols-4 gap-1.5">
                    <div
                      v-for="pm in PRICE_MODES"
                      :key="pm.value"
                      class="rounded-lg p-1.5 flex flex-col items-center gap-1 cursor-pointer border transition-all duration-200"
                      :class="previewMode === pm.value ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800/50 hover:border-zinc-700 bg-zinc-950/30'"
                      @click="previewMode = pm.value"
                    >
                      <div
                        v-if="pm.value !== 'symbolic' && pm.value !== 'anticipation'"
                        class="flex items-baseline gap-px"
                        :style="{ ...previewSealStyle, fontSize: '7px', padding: '2px 6px' }"
                      >
                        <span>R$</span>
                        <span class="font-extrabold text-[10px]">15</span>
                        <span>,88</span>
                      </div>
                      <div v-else-if="pm.value === 'symbolic'" class="flex -space-x-1">
                        <img :src="COIN_IMAGES.real1" alt="R$1" class="w-4 h-4 rounded-full shadow-sm relative z-2" />
                        <img :src="COIN_IMAGES.cent25" alt="25¢" class="w-4 h-4 rounded-full shadow-sm relative z-1" />
                      </div>
                      <div v-else class="text-[7px] font-bold" :style="{ ...previewSealStyle, padding: '2px 6px' }">Texto</div>
                      <span class="text-[7px] text-zinc-600 text-center leading-tight">{{ pm.label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.splash-preview {
  background: transparent !important;
  padding: 14px 18px !important;
}

/* Custom range slider track for dark theme */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgb(63 63 70);
  border-radius: 9999px;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #10b981;
  cursor: pointer;
  border: 2px solid #09090b;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}
input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #10b981;
  cursor: pointer;
  border: 2px solid #09090b;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

/* Smooth checkbox styling */
input[type="checkbox"] {
  transition: all 0.15s ease;
}
</style>
