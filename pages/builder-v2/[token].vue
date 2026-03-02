<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { BuilderAllowedField, BuilderSession } from '~/types/builder'
import BuilderReadonlyPreview from '~/components/BuilderReadonlyPreview.vue'

type BuilderPagePayload = {
  templateId: string
  pageId: string
  zoneId: string
  pageName: string
  width: number
  height: number
  canvasData: any
}

type EditableProduct = {
  id: string
  name: string
  brand: string
  priceUnit: string
  pricePack: string
  priceSpecialUnit: string
  priceSpecial: string
  specialCondition: string
  imageUrl: string
  packageLabel: string
  packQuantity: number | null
  packUnit: string
}

definePageMeta({
  layout: false,
  ssr: false
})

const route = useRoute()
const token = computed(() => String(route.params.token || '').trim())

const isLoadingSession = ref(true)
const sessionError = ref<string | null>(null)
const session = ref<BuilderSession | null>(null)
const templatePages = ref<BuilderPagePayload[]>([])

const selectedTemplateId = ref('')
const selectedThemeId = ref('')
const selectedLabelTemplateId = ref('')
const products = ref<EditableProduct[]>([])
const importText = ref('')
const isSubmitting = ref(false)
const submitFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null)
const imageUploadTargetId = ref<string | null>(null)
const imageUploadInput = ref<HTMLInputElement | null>(null)
const isUploadingImage = ref(false)

const normalizeText = (value: unknown, maxLen = 240): string => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

const createEmptyProduct = (): EditableProduct => ({
  id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  brand: '',
  priceUnit: '',
  pricePack: '',
  priceSpecialUnit: '',
  priceSpecial: '',
  specialCondition: '',
  imageUrl: '',
  packageLabel: '',
  packQuantity: null,
  packUnit: ''
})

const canEdit = (field: BuilderAllowedField): boolean => {
  const list = session.value?.allowedFields || []
  return list.includes(field)
}

const selectedTemplate = computed(() => {
  const list = session.value?.templates || []
  return list.find((template) => template.id === selectedTemplateId.value) || null
})

const selectedTemplatePage = computed(() => {
  return templatePages.value.find((item) => item.templateId === selectedTemplateId.value) || null
})

const parsePrice = (value: unknown): string => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const normalized = raw.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.')
  const numberValue = Number.parseFloat(normalized)
  if (!Number.isFinite(numberValue)) return raw
  return numberValue.toFixed(2).replace('.', ',')
}

const splitPrice = (value: unknown): { integer: string; decimal: string } => {
  const formatted = parsePrice(value)
  if (!formatted) return { integer: '', decimal: '' }
  const [integer, decimal] = formatted.split(',')
  return { integer: integer || '', decimal: decimal || '00' }
}

const resolveMainPrice = (product: EditableProduct): string => {
  return (
    parsePrice(product.priceSpecialUnit) ||
    parsePrice(product.priceSpecial) ||
    parsePrice(product.priceUnit) ||
    parsePrice(product.pricePack) ||
    ''
  )
}

const toNodeName = (node: Record<string, any>): string =>
  normalizeText(node?.name || node?.data?.smartType, 120)

const isTextNode = (node: Record<string, any>): boolean => {
  const type = String(node?.type || '').toLowerCase()
  return type === 'text' || type === 'textbox' || type === 'itext'
}

const applyProductToNode = (node: Record<string, any>, product: EditableProduct) => {
  const name = toNodeName(node)
  const price = resolveMainPrice(product)
  const parts = splitPrice(price)

  if (isTextNode(node)) {
    if (name === 'smart_title' || name === 'product_title' || name === 'product_name_text') {
      node.text = product.name
    } else if (name === 'smart_brand' || name === 'product_brand_text') {
      node.text = product.brand
    } else if (name === 'smart_price' || name === 'price_value_text' || name === 'price_text') {
      node.text = price
    } else if (name === 'price_main_int_text' || name === 'price_integer_text' || name === 'price_int_text' || name === 'price_main_text') {
      node.text = parts.integer
    } else if (name === 'price_cents_text' || name === 'price_decimal_text' || name === 'price_decimals_text' || name === 'price_fraction_text') {
      node.text = parts.decimal
    } else if (name === 'price_condition_text' || name === 'price_special_condition_text' || name === 'special_condition_text') {
      node.text = product.specialCondition
    } else if (name === 'price_unit_text' || name === 'price_unit_suffix_text') {
      node.text = product.packUnit || product.packageLabel || 'UN'
    } else if (name === 'smart_limit' || name === 'limitText' || name === 'product_limit') {
      node.text = ''
    }
  }

  if (String(node?.type || '').toLowerCase() === 'image') {
    if (name === 'smart_image' || name === 'product_image' || name === 'productImage') {
      if (product.imageUrl) {
        node.src = product.imageUrl
        node.crossOrigin = 'anonymous'
      }
    }
  }

  const children = Array.isArray(node?.objects) ? node.objects : []
  children.forEach((child: Record<string, any>) => applyProductToNode(child, product))
}

const previewCanvasData = computed(() => {
  const page = selectedTemplatePage.value
  const template = selectedTemplate.value
  if (!page?.canvasData || !template) return null
  const cloned = JSON.parse(JSON.stringify(page.canvasData))
  const objects = Array.isArray(cloned?.objects) ? cloned.objects : []
  const cards = objects
    .filter((obj: Record<string, any>) => {
      const parentZoneId = normalizeText(obj?.parentZoneId, 120)
      const isCard = obj?.isProductCard || obj?.isSmartObject || String(obj?.name || '').startsWith('product-card')
      return String(obj?.type || '').toLowerCase() === 'group' && isCard && parentZoneId === template.zoneId
    })
    .sort((a: any, b: any) => {
      const aOrder = Number(a?._zoneOrder)
      const bOrder = Number(b?._zoneOrder)
      if (Number.isFinite(aOrder) && Number.isFinite(bOrder) && aOrder !== bOrder) return aOrder - bOrder
      return Number(a?.top || 0) - Number(b?.top || 0)
    })

  for (let i = 0; i < cards.length && i < products.value.length; i += 1) {
    applyProductToNode(cards[i], products.value[i] as any)
  }

  return cloned
})

const loadSession = async () => {
  if (!token.value) {
    sessionError.value = 'Token ausente.'
    isLoadingSession.value = false
    return
  }

  isLoadingSession.value = true
  sessionError.value = null
  submitFeedback.value = null

  try {
    const data: any = await $fetch('/api/builder/session.resolve', {
      method: 'POST',
      body: { token: token.value }
    })
    session.value = data?.session || null
    templatePages.value = Array.isArray(data?.templatePages) ? data.templatePages : []

    const firstTemplate = session.value?.templates?.[0]
    selectedTemplateId.value = firstTemplate?.id || ''
    selectedThemeId.value = firstTemplate?.themeOptions?.[0]?.id || ''
    selectedLabelTemplateId.value = firstTemplate?.labelTemplateOptions?.[0]?.id || ''
    products.value = [createEmptyProduct()]
  } catch (error: any) {
    const message = String(
      error?.data?.statusMessage ||
      error?.statusMessage ||
      error?.message ||
      'Não foi possível carregar este link.'
    ).trim()
    session.value = null
    templatePages.value = []
    sessionError.value = message || 'Não foi possível carregar este link.'
  } finally {
    isLoadingSession.value = false
  }
}

const ensureProductLimit = () => {
  const max = Number(session.value?.maxProductsPerSubmit || 0)
  if (!Number.isFinite(max) || max <= 0) return
  if (products.value.length > max) {
    products.value = products.value.slice(0, max)
    submitFeedback.value = {
      type: 'error',
      message: `Limite aplicado: máximo de ${max} produtos por envio.`
    }
  }
}

const addProduct = () => {
  products.value.push(createEmptyProduct())
  ensureProductLimit()
}

const removeProduct = (productId: string) => {
  products.value = products.value.filter((item) => item.id !== productId)
  if (!products.value.length) products.value = [createEmptyProduct()]
}

const parseDelimitedText = (raw: string): EditableProduct[] => {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return []

  const items: EditableProduct[] = []
  lines.forEach((line) => {
    const delimiter = line.includes(';') ? ';' : (line.includes('\t') ? '\t' : ',')
    const cols = line.split(delimiter).map((part) => part.trim())
    if (!cols[0]) return
    items.push({
      ...createEmptyProduct(),
      name: cols[0] || '',
      priceUnit: cols[1] || '',
      priceSpecialUnit: cols[2] || '',
      pricePack: cols[3] || '',
      brand: cols[4] || ''
    })
  })
  return items
}

const importFromText = () => {
  const parsed = parseDelimitedText(importText.value)
  if (!parsed.length) {
    submitFeedback.value = {
      type: 'error',
      message: 'Nenhuma linha válida encontrada para importar.'
    }
    return
  }
  products.value = parsed
  ensureProductLimit()
  submitFeedback.value = null
}

const handleFileImport = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const lower = String(file.name || '').toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const mod: any = await import('xlsx')
      const XLSX = mod?.default || mod
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames?.[0]
      const firstSheet = firstSheetName ? workbook.Sheets?.[firstSheetName] : null
      const csv = firstSheet ? XLSX.utils.sheet_to_csv(firstSheet) : ''
      const parsed = parseDelimitedText(csv)
      if (!parsed.length) throw new Error('Arquivo sem linhas válidas')
      products.value = parsed
      ensureProductLimit()
      return
    }

    const text = await file.text()
    const parsed = parseDelimitedText(text)
    if (!parsed.length) throw new Error('Arquivo sem linhas válidas')
    products.value = parsed
    ensureProductLimit()
  } catch (error: any) {
    submitFeedback.value = {
      type: 'error',
      message: String(error?.message || 'Falha ao importar arquivo')
    }
  }
}

const openImageUploadPicker = (productId: string) => {
  imageUploadTargetId.value = productId
  imageUploadInput.value?.click()
}

const onImageUploadSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !imageUploadTargetId.value) return
  if (!token.value) return

  isUploadingImage.value = true
  submitFeedback.value = null

  try {
    const form = new FormData()
    form.append('token', token.value)
    form.append('file', file)
    const data: any = await $fetch('/api/builder/image.upload', {
      method: 'POST',
      body: form
    })
    const imageUrl = normalizeText(data?.url, 4000)
    if (!imageUrl) throw new Error('Upload concluído sem URL')
    products.value = products.value.map((product) => (
      product.id === imageUploadTargetId.value
        ? { ...product, imageUrl }
        : product
    ))
  } catch (error: any) {
    submitFeedback.value = {
      type: 'error',
      message: String(
        error?.data?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'Falha ao enviar imagem'
      )
    }
  } finally {
    isUploadingImage.value = false
    imageUploadTargetId.value = null
  }
}

const canSubmit = computed(() => {
  if (!session.value || !selectedTemplate.value) return false
  if (isSubmitting.value || isLoadingSession.value) return false
  const hasAtLeastOneNamedProduct = products.value.some((product) => normalizeText(product.name).length > 0)
  return hasAtLeastOneNamedProduct
})

const submitBuilder = async () => {
  if (!canSubmit.value || !session.value || !selectedTemplate.value) return
  isSubmitting.value = true
  submitFeedback.value = null

  try {
    const payloadProducts = products.value.map((product) => ({
      id: product.id,
      name: canEdit('name') ? product.name : null,
      brand: canEdit('brand') ? product.brand : null,
      priceUnit: canEdit('priceUnit') ? product.priceUnit : null,
      pricePack: canEdit('pricePack') ? product.pricePack : null,
      priceSpecialUnit: canEdit('priceSpecialUnit') ? product.priceSpecialUnit : null,
      priceSpecial: canEdit('priceSpecial') ? product.priceSpecial : null,
      specialCondition: canEdit('specialCondition') ? product.specialCondition : null,
      imageUrl: canEdit('imageUrl') ? product.imageUrl : null,
      packageLabel: canEdit('packageLabel') ? product.packageLabel : null,
      packQuantity: canEdit('packQuantity') ? product.packQuantity : null,
      packUnit: canEdit('packUnit') ? product.packUnit : null
    }))

    const response: any = await $fetch('/api/builder/submit', {
      method: 'POST',
      body: {
        token: token.value,
        payload: {
          templateId: selectedTemplate.value.id,
          themeId: selectedThemeId.value || null,
          labelTemplateId: selectedLabelTemplateId.value || null,
          products: payloadProducts
        }
      }
    })

    submitFeedback.value = {
      type: 'success',
      message: `Aplicado com sucesso. ${response?.stats?.productsApplied || 0} produto(s) atualizado(s).`
    }
    if (session.value && Number.isFinite(Number(response?.submissionsCount))) {
      session.value = {
        ...session.value,
        submissionsCount: Number(response.submissionsCount)
      }
    }
  } catch (error: any) {
    submitFeedback.value = {
      type: 'error',
      message: String(
        error?.data?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        'Não foi possível aplicar as alterações.'
      )
    }
  } finally {
    isSubmitting.value = false
  }
}

watch(selectedTemplateId, (nextTemplateId) => {
  const tpl = session.value?.templates?.find((item) => item.id === nextTemplateId)
  selectedThemeId.value = tpl?.themeOptions?.[0]?.id || ''
  selectedLabelTemplateId.value = tpl?.labelTemplateOptions?.[0]?.id || ''
  submitFeedback.value = null
})

watch(() => session.value?.maxProductsPerSubmit, () => ensureProductLimit())

onMounted(() => {
  void loadSession()
})
</script>

<template>
  <div class="min-h-screen bg-[radial-gradient(circle_at_15%_20%,#1e2e2b_0%,#0c1014_45%,#06080c_100%)] text-zinc-100">
    <div class="mx-auto max-w-[1700px] px-4 py-5 md:px-8 md:py-8">
      <header class="mb-5 rounded-2xl border border-white/10 bg-black/35 px-5 py-4 backdrop-blur-md md:px-7 md:py-5">
        <p class="text-[11px] uppercase tracking-[0.28em] text-[#9dc8b8]">Builder v2</p>
        <h1 class="mt-1 text-xl font-semibold text-white md:text-2xl">
          {{ session?.projectName || 'Campanha Cliente' }}
        </h1>
        <p class="mt-1 text-xs text-zinc-300/80 md:text-sm">
          Preencha dados comerciais e aplique sem alterar layout.
        </p>
      </header>

      <section
        v-if="isLoadingSession"
        class="rounded-2xl border border-white/10 bg-black/35 p-10 text-center"
      >
        <p class="text-sm text-zinc-200">Validando link e carregando sessão...</p>
      </section>

      <section
        v-else-if="sessionError"
        class="rounded-2xl border border-red-400/30 bg-red-950/40 p-10 text-center"
      >
        <h2 class="text-lg font-semibold text-red-100">Link indisponível</h2>
        <p class="mt-2 text-sm text-red-100/80">{{ sessionError }}</p>
      </section>

      <section
        v-else-if="!session"
        class="rounded-2xl border border-white/10 bg-black/35 p-10 text-center"
      >
        <p class="text-sm text-zinc-200">Sessão do builder não encontrada.</p>
      </section>

      <section v-else class="grid gap-4 lg:grid-cols-[minmax(420px,560px)_1fr]">
        <article class="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md md:p-5">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="text-xs">
              <span class="mb-1 block uppercase tracking-[0.16em] text-zinc-300/75">Template</span>
              <select
                v-model="selectedTemplateId"
                class="w-full rounded-lg border border-white/15 bg-[#101419] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#7ebfa7]"
              >
                <option
                  v-for="template in session.templates"
                  :key="template.id"
                  :value="template.id"
                >
                  {{ template.name }}
                </option>
              </select>
            </label>

            <label class="text-xs">
              <span class="mb-1 block uppercase tracking-[0.16em] text-zinc-300/75">Tema</span>
              <select
                v-model="selectedThemeId"
                class="w-full rounded-lg border border-white/15 bg-[#101419] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#7ebfa7]"
                :disabled="!(selectedTemplate?.themeOptions || []).length"
              >
                <option value="">Padrão</option>
                <option
                  v-for="theme in selectedTemplate?.themeOptions || []"
                  :key="theme.id"
                  :value="theme.id"
                >
                  {{ theme.name }}
                </option>
              </select>
            </label>
          </div>

          <label class="mt-3 block text-xs">
            <span class="mb-1 block uppercase tracking-[0.16em] text-zinc-300/75">Etiqueta</span>
            <select
              v-model="selectedLabelTemplateId"
              class="w-full rounded-lg border border-white/15 bg-[#101419] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#7ebfa7]"
              :disabled="!(selectedTemplate?.labelTemplateOptions || []).length"
            >
              <option value="">Padrão</option>
              <option
                v-for="labelTemplate in selectedTemplate?.labelTemplateOptions || []"
                :key="labelTemplate.id"
                :value="labelTemplate.id"
              >
                {{ labelTemplate.name }}
              </option>
            </select>
          </label>

          <div class="mt-4 rounded-xl border border-[#7ebfa7]/25 bg-[#11211d]/45 p-3">
            <p class="text-[11px] uppercase tracking-[0.16em] text-[#9cd5bf]">Importação rápida</p>
            <p class="mt-1 text-xs text-[#d4f0e4]/85">
              Cole linhas em formato `nome;preço unitário;preço especial;preço pacote;marca`.
            </p>
            <textarea
              v-model="importText"
              class="mt-2 h-24 w-full rounded-lg border border-white/15 bg-[#101419] px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#7ebfa7]"
              placeholder="ARROZ 5KG;23,99;21,90; ;MARCA X"
            />
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-[#7ebfa7]/50 bg-[#142a24] px-3 py-1.5 text-xs font-semibold text-[#caf2df] hover:bg-[#173227]"
                @click="importFromText"
              >
                Importar texto
              </button>
              <label class="cursor-pointer rounded-lg border border-white/20 bg-[#121820] px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-[#19212b]">
                Importar arquivo
                <input
                  type="file"
                  class="hidden"
                  accept=".csv,.txt,.tsv,.xlsx,.xls"
                  @change="handleFileImport"
                >
              </label>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between">
            <p class="text-xs text-zinc-300">
              Produtos: <span class="font-semibold text-white">{{ products.length }}</span>
              / {{ session.maxProductsPerSubmit }}
            </p>
            <button
              type="button"
              class="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10"
              @click="addProduct"
            >
              + Produto
            </button>
          </div>

          <div class="mt-3 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            <div
              v-for="(product, index) in products"
              :key="product.id"
              class="rounded-xl border border-white/10 bg-[#0f141b] p-3"
            >
              <div class="mb-2 flex items-center justify-between">
                <p class="text-xs font-semibold text-zinc-200">Item {{ index + 1 }}</p>
                <button
                  type="button"
                  class="text-[11px] text-red-300 hover:text-red-200"
                  @click="removeProduct(product.id)"
                >
                  Remover
                </button>
              </div>

              <div class="grid gap-2 sm:grid-cols-2">
                <label class="text-[11px] text-zinc-300">
                  Nome
                  <input
                    v-model="product.name"
                    :disabled="!canEdit('name')"
                    class="mt-1 w-full rounded-md border border-white/15 bg-[#131922] px-2 py-1.5 text-xs text-zinc-100 outline-none disabled:opacity-45"
                  >
                </label>
                <label class="text-[11px] text-zinc-300">
                  Marca
                  <input
                    v-model="product.brand"
                    :disabled="!canEdit('brand')"
                    class="mt-1 w-full rounded-md border border-white/15 bg-[#131922] px-2 py-1.5 text-xs text-zinc-100 outline-none disabled:opacity-45"
                  >
                </label>
                <label class="text-[11px] text-zinc-300">
                  Preço unitário
                  <input
                    v-model="product.priceUnit"
                    :disabled="!canEdit('priceUnit')"
                    class="mt-1 w-full rounded-md border border-white/15 bg-[#131922] px-2 py-1.5 text-xs text-zinc-100 outline-none disabled:opacity-45"
                  >
                </label>
                <label class="text-[11px] text-zinc-300">
                  Preço especial un.
                  <input
                    v-model="product.priceSpecialUnit"
                    :disabled="!canEdit('priceSpecialUnit')"
                    class="mt-1 w-full rounded-md border border-white/15 bg-[#131922] px-2 py-1.5 text-xs text-zinc-100 outline-none disabled:opacity-45"
                  >
                </label>
                <label class="text-[11px] text-zinc-300">
                  Preço pacote
                  <input
                    v-model="product.pricePack"
                    :disabled="!canEdit('pricePack')"
                    class="mt-1 w-full rounded-md border border-white/15 bg-[#131922] px-2 py-1.5 text-xs text-zinc-100 outline-none disabled:opacity-45"
                  >
                </label>
                <label class="text-[11px] text-zinc-300">
                  Condição especial
                  <input
                    v-model="product.specialCondition"
                    :disabled="!canEdit('specialCondition')"
                    class="mt-1 w-full rounded-md border border-white/15 bg-[#131922] px-2 py-1.5 text-xs text-zinc-100 outline-none disabled:opacity-45"
                  >
                </label>
              </div>

              <label class="mt-2 block text-[11px] text-zinc-300">
                URL da imagem
                <input
                  v-model="product.imageUrl"
                  :disabled="!canEdit('imageUrl')"
                  class="mt-1 w-full rounded-md border border-white/15 bg-[#131922] px-2 py-1.5 text-xs text-zinc-100 outline-none disabled:opacity-45"
                  placeholder="/api/storage/p?key=..."
                >
              </label>

              <div class="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 disabled:opacity-40"
                  :disabled="!canEdit('imageUrl') || isUploadingImage"
                  @click="openImageUploadPicker(product.id)"
                >
                  {{ isUploadingImage && imageUploadTargetId === product.id ? 'Enviando...' : 'Enviar imagem' }}
                </button>
                <img
                  v-if="product.imageUrl"
                  :src="product.imageUrl"
                  alt=""
                  class="h-8 w-8 rounded border border-white/20 object-cover"
                >
              </div>
            </div>
          </div>

          <div
            v-if="submitFeedback"
            class="mt-4 rounded-lg border px-3 py-2 text-xs"
            :class="submitFeedback.type === 'success'
              ? 'border-emerald-300/40 bg-emerald-950/45 text-emerald-100'
              : 'border-red-300/35 bg-red-950/45 text-red-100'"
          >
            {{ submitFeedback.message }}
          </div>

          <button
            type="button"
            class="mt-4 w-full rounded-xl bg-[#e1ff72] px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em] text-[#10160d] transition hover:bg-[#d7fb56] disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!canSubmit"
            @click="submitBuilder"
          >
            {{ isSubmitting ? 'Aplicando...' : 'Aplicar no projeto' }}
          </button>
        </article>

        <article class="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-md md:p-5">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <p class="text-[11px] uppercase tracking-[0.16em] text-zinc-300/75">Preview bloqueado</p>
              <p class="text-sm text-zinc-100">{{ selectedTemplatePage?.pageName || 'Pré-visualização' }}</p>
            </div>
            <p class="text-xs text-zinc-400">
              {{ selectedTemplatePage?.width || 0 }} x {{ selectedTemplatePage?.height || 0 }}
            </p>
          </div>

          <div class="aspect-[0.72] w-full overflow-hidden rounded-xl bg-[#0d1118]">
            <BuilderReadonlyPreview
              :canvas-data="previewCanvasData"
              :width="selectedTemplatePage?.width || 1080"
              :height="selectedTemplatePage?.height || 1350"
            />
          </div>

          <p class="mt-3 text-xs text-zinc-300/80">
            O layout permanece travado. Apenas dados comerciais e opções permitidas são alterados.
          </p>
        </article>
      </section>
    </div>

    <input
      ref="imageUploadInput"
      type="file"
      class="hidden"
      accept="image/*"
      @change="onImageUploadSelected"
    >
  </div>
</template>
