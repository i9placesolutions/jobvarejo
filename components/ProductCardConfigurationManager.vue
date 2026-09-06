<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles
} from 'lucide-vue-next'
import type {
  ProductCardConfiguration,
  ProductCardConfigurationProfile,
  ProductCardConfigurationProfileKey,
  ProductCardElementKey,
  ProductCardElementLayout
} from '~/types/product-zone'
import {
  createDefaultProductCardConfiguration,
  normalizeProductCardConfiguration,
  normalizeProductCardElementLayout,
  PRODUCT_CARD_ELEMENT_KEYS,
  PRODUCT_ALCOHOL_BADGE_ASSET_URL
} from '~/utils/product-card-configuration'
import { trimImageSourceToDataUrl } from '~/utils/fabricImageHelpers'

const {
  configuration: savedConfiguration,
  isLoading,
  lastError,
  load,
  save,
  publishLive
} = useProductCardConfiguration()

const cloneConfiguration = (value: ProductCardConfiguration): ProductCardConfiguration => {
  try {
    return JSON.parse(JSON.stringify(value)) as ProductCardConfiguration
  } catch {
    return normalizeProductCardConfiguration(value)
  }
}

const draft = ref<ProductCardConfiguration>(createDefaultProductCardConfiguration())
const selectedElement = ref<ProductCardElementKey>('name')
const selectedProfile = ref<ProductCardConfigurationProfileKey>('standard')
const isSaving = ref(false)
const feedback = ref('')
const feedbackTone = ref<'success' | 'error'>('success')

type RealPriceLabelPreview = {
  id: string
  name: string
  previewDataUrl: string
}

const { getApiAuthHeaders } = useApiAuth()
const labelTemplatePreviews = ref<RealPriceLabelPreview[]>([])
const selectedLabelTemplateId = ref<string | null>(null)
const isLabelPreviewLoading = ref(false)
const labelPreviewError = ref('')
const productPreviewSrc = ref('/coins/LEITE%20PO%20INTEGRAL%20ITALAC%20400G.png')
const alcoholBadgePreviewSrc = ref(PRODUCT_ALCOHOL_BADGE_ASSET_URL)
const previewImageAspectRatios = ref<Record<'image' | 'price' | 'alcoholBadge', number>>({
  image: 1,
  price: 1,
  alcoholBadge: 1
})

const elementMeta: Array<{ key: ProductCardElementKey; label: string; description: string; symbol: string }> = [
  { key: 'name', label: 'Nome', description: 'Título do produto', symbol: 'Aa' },
  { key: 'image', label: 'Imagem', description: 'Foto do produto', symbol: '◈' },
  { key: 'price', label: 'Etiqueta de preço', description: 'Preço principal e unidade', symbol: 'R$' },
  { key: 'alcoholBadge', label: 'Selo -18', description: 'Bebidas alcoólicas', symbol: '-18' },
  { key: 'limit', label: 'Limite por cliente', description: 'Texto de limite da oferta', symbol: '3×' }
]

const profileMeta: Array<{
  key: ProductCardConfigurationProfileKey;
  label: string;
  description: string;
}> = [
  { key: 'compact', label: 'Compacto', description: 'Cards pequenos' },
  { key: 'standard', label: 'Médio', description: 'Card regular' },
  { key: 'wide', label: 'Largo', description: 'Card horizontal' },
  { key: 'featured', label: 'Destaque', description: 'Card maior' }
]

const anchorOptions = [
  { id: 'top-left', label: 'Topo esquerdo', x: 22, y: 14 },
  { id: 'top-center', label: 'Topo centro', x: 50, y: 14 },
  { id: 'top-right', label: 'Topo direito', x: 78, y: 14 },
  { id: 'middle-left', label: 'Meio esquerdo', x: 22, y: 50 },
  { id: 'center', label: 'Centro', x: 50, y: 50 },
  { id: 'middle-right', label: 'Meio direito', x: 78, y: 50 },
  { id: 'bottom-left', label: 'Base esquerda', x: 22, y: 84 },
  { id: 'bottom-center', label: 'Base centro', x: 50, y: 84 },
  { id: 'bottom-right', label: 'Base direita', x: 78, y: 84 }
] as const

const selectedMeta = computed(() =>
  elementMeta.find((item) => item.key === selectedElement.value) ?? elementMeta[0]!
)

const selectedProfileMeta = computed(() =>
  profileMeta.find((item) => item.key === selectedProfile.value) ?? profileMeta[1]!
)

// O perfil Largo é aplicado pelo editor em cards horizontais (os cards de
// zonas do encarte usam aproximadamente 1,96:1). Antes, a prévia usava
// sempre 4:5, então a mesma receita parecia ter imagem/etiqueta enormes na
// configuração e muito menores quando era renderizada no encarte. Manter a
// mesma proporção aqui faz a prévia representar o card real e também mantém
// o cálculo de `contain` dos elementos consistente entre as duas superfícies.
const previewCardAspectRatio = computed(() =>
  selectedProfile.value === 'wide' ? 1.96 : (4 / 5)
)

const selectedProfileElements = computed(() =>
  draft.value.profiles?.[selectedProfile.value]?.elements ?? draft.value.elements
)

const cloneProfileElements = (
  elements: Record<ProductCardElementKey, ProductCardElementLayout>
) => Object.fromEntries(
  PRODUCT_CARD_ELEMENT_KEYS.map((key) => [key, { ...elements[key] }])
) as Record<ProductCardElementKey, ProductCardElementLayout>

/**
 * Copia a receita do formato aberto para todos os perfis de card.
 * Os perfis continuam disponíveis para ajustes individuais depois da cópia.
 */
const applySelectedProfileToAll = () => {
  const source = cloneProfileElements(selectedProfileElements.value)
  const currentProfiles = draft.value.profiles || normalizeProductCardConfiguration(draft.value).profiles!
  const profiles = Object.fromEntries(
    profileMeta.map(({ key }) => [
      key,
      {
        ...(currentProfiles[key] || {}),
        elements: cloneProfileElements(source)
      }
    ])
  ) as ProductCardConfiguration['profiles']

  draft.value = {
    ...draft.value,
    elements: cloneProfileElements(source),
    profiles
  }
  feedbackTone.value = 'success'
  feedback.value = 'Estrutura copiada para todos os formatos. Clique em Salvar para gravar.'
  publishLive(draft.value)
}

const selectedLayout = computed(() => selectedProfileElements.value[selectedElement.value])

const selectedLayoutLabel = computed(() =>
  `${Math.round(selectedLayout.value.x)}% horizontal · ${Math.round(selectedLayout.value.y)}% vertical · ${Math.round(selectedLayout.value.rotation)}°`
)

const previewElements = computed(() =>
  PRODUCT_CARD_ELEMENT_KEYS.filter((key) => selectedProfileElements.value[key].visible)
)

const selectedPriceLabelPreview = computed(() =>
  labelTemplatePreviews.value.find((template) => template.id === selectedLabelTemplateId.value) ??
  labelTemplatePreviews.value[0] ??
  null
)

const previewCardElementStyle = (key: ProductCardElementKey): Record<string, string> => {
  const layout = selectedProfileElements.value[key]
  return {
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    width: `${layout.width}%`,
    height: `${layout.height}%`,
    transform: `translate(-50%, -50%) rotate(${layout.rotation}deg)`,
    transformOrigin: 'center center',
    zIndex: key === 'alcoholBadge' ? '5' : key === 'price' ? '4' : key === 'limit' ? '3' : key === 'name' ? '2' : '1'
  }
}

const previewCardElementVisualStyle = (key: ProductCardElementKey): Record<string, string> => {
  if (key !== 'image' && key !== 'price' && key !== 'alcoholBadge') return {}

  const layout = selectedProfileElements.value[key]
  const aspectRatio = previewImageAspectRatios.value[key]
  const configuredAspectRatio = (layout.width / Math.max(layout.height, 1)) * previewCardAspectRatio.value
  const widthScale = Math.min(1, aspectRatio / Math.max(configuredAspectRatio, 0.001))
  const heightScale = Math.min(1, configuredAspectRatio / Math.max(aspectRatio, 0.001))

  return {
    width: `${widthScale * 100}%`,
    height: `${heightScale * 100}%`
  }
}

const handlePreviewImageLoad = (key: 'image' | 'price' | 'alcoholBadge', event: Event) => {
  const image = event.currentTarget
  if (!(image instanceof HTMLImageElement) || !image.naturalWidth || !image.naturalHeight) return
  const nextRatio = image.naturalWidth / image.naturalHeight
  if (!Number.isFinite(nextRatio) || nextRatio <= 0) return
  previewImageAspectRatios.value = {
    ...previewImageAspectRatios.value,
    [key]: nextRatio
  }
}

type PreviewInteractionMode = 'move' | 'resize' | 'rotate'

interface PreviewInteraction {
  mode: PreviewInteractionMode;
  key: ProductCardElementKey;
  startClientX: number;
  startClientY: number;
  startLayout: ProductCardElementLayout;
  cardRect: DOMRect;
  startVisualWidth: number;
  startVisualHeight: number;
  elementCenterX?: number;
  elementCenterY?: number;
  startPointerAngle?: number;
}

const previewInteraction = ref<PreviewInteraction | null>(null)
const previewInteractionMoved = ref(false)

const updateElementLayout = (
  key: ProductCardElementKey,
  patch: Partial<ProductCardElementLayout>,
  live = false
) => {
  const current = selectedProfileElements.value[key]
  const next = normalizeProductCardElementLayout({ ...current, ...patch }, current)
  const currentProfiles: Record<ProductCardConfigurationProfileKey, ProductCardConfigurationProfile> =
    draft.value.profiles || normalizeProductCardConfiguration(draft.value).profiles!
  const currentProfile = currentProfiles[selectedProfile.value]
  draft.value = {
    ...draft.value,
    profiles: {
      ...currentProfiles,
      [selectedProfile.value]: {
        ...currentProfile,
        elements: {
          ...currentProfile.elements,
          [key]: next
        }
      }
    }
  }
  feedback.value = ''
  if (live) publishLive(draft.value)
}

const updateSelectedLayout = (patch: Partial<ProductCardElementLayout>, live = false) => {
  updateElementLayout(selectedElement.value, patch, live)
}

const updateSelectedNumber = (
  prop: 'x' | 'y' | 'width' | 'height' | 'rotation',
  rawValue: unknown,
  live = false
) => {
  const parsed = Number(rawValue)
  updateSelectedLayout({ [prop]: Number.isFinite(parsed) ? parsed : selectedLayout.value[prop] }, live)
}

const toggleElement = (key: ProductCardElementKey) => {
  selectedElement.value = key
  updateSelectedLayout({ visible: !selectedProfileElements.value[key].visible }, true)
}

const applyAnchor = (anchor: typeof anchorOptions[number]) => {
  updateSelectedLayout({ x: anchor.x, y: anchor.y }, true)
}

const getPreviewCardElement = (target: EventTarget | null) => {
  const element = target instanceof HTMLElement ? target : null
  return element?.closest('.preview-card') as HTMLElement | null
}

const getPreviewElement = (target: EventTarget | null) => {
  const element = target instanceof HTMLElement ? target : null
  return element?.closest('.preview-element') as HTMLElement | null
}

const getPreviewVisual = (target: EventTarget | null) => {
  const element = target instanceof HTMLElement ? target : null
  const directVisual = element?.closest('.preview-element__visual')
  if (directVisual instanceof HTMLElement) return directVisual
  return getPreviewElement(target)?.querySelector('.preview-element__visual') as HTMLElement | null
}

const startPreviewInteraction = (
  event: PointerEvent,
  key: ProductCardElementKey,
  mode: PreviewInteractionMode
) => {
  if (event.button !== 0) return
  const card = getPreviewCardElement(event.currentTarget)
  if (!card) return

  const previewElement = getPreviewVisual(event.currentTarget) || getPreviewElement(event.currentTarget)
  const elementRect = previewElement?.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  const elementCenterX = elementRect ? elementRect.left + elementRect.width / 2 : undefined
  const elementCenterY = elementRect ? elementRect.top + elementRect.height / 2 : undefined
  const startPointerAngle = mode === 'rotate' && elementCenterX !== undefined && elementCenterY !== undefined
    ? Math.atan2(event.clientY - elementCenterY, event.clientX - elementCenterX) * 180 / Math.PI
    : undefined

  selectedElement.value = key
  previewInteraction.value = {
    mode,
    key,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startLayout: { ...selectedProfileElements.value[key] },
    cardRect,
    startVisualWidth: elementRect
      ? (elementRect.width / Math.max(cardRect.width, 1)) * 100
      : selectedProfileElements.value[key].width,
    startVisualHeight: elementRect
      ? (elementRect.height / Math.max(cardRect.height, 1)) * 100
      : selectedProfileElements.value[key].height,
    elementCenterX,
    elementCenterY,
    startPointerAngle
  }
  previewInteractionMoved.value = false
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', handlePreviewInteraction)
  window.addEventListener('pointerup', finishPreviewInteraction)
  window.addEventListener('pointercancel', finishPreviewInteraction)
}

const startElementMove = (event: PointerEvent, key: ProductCardElementKey) => {
  startPreviewInteraction(event, key, 'move')
}

const startElementResize = (event: PointerEvent, key: ProductCardElementKey) => {
  startPreviewInteraction(event, key, 'resize')
}

const startElementRotate = (event: PointerEvent, key: ProductCardElementKey) => {
  startPreviewInteraction(event, key, 'rotate')
}

const normalizeAngleDelta = (angle: number) => {
  let normalized = angle
  while (normalized > 180) normalized -= 360
  while (normalized < -180) normalized += 360
  return normalized
}

const handlePreviewInteraction = (event: PointerEvent) => {
  const interaction = previewInteraction.value
  if (!interaction) return

  const deltaX = ((event.clientX - interaction.startClientX) / interaction.cardRect.width) * 100
  const deltaY = ((event.clientY - interaction.startClientY) / interaction.cardRect.height) * 100
  if (Math.abs(deltaX) > 0.15 || Math.abs(deltaY) > 0.15) previewInteractionMoved.value = true

  if (
    interaction.mode === 'rotate' &&
    interaction.elementCenterX !== undefined &&
    interaction.elementCenterY !== undefined &&
    interaction.startPointerAngle !== undefined
  ) {
    const currentPointerAngle = Math.atan2(
      event.clientY - interaction.elementCenterY,
      event.clientX - interaction.elementCenterX
    ) * 180 / Math.PI
    let nextRotation = interaction.startLayout.rotation + normalizeAngleDelta(
      currentPointerAngle - interaction.startPointerAngle
    )
    if (event.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15
    updateElementLayout(interaction.key, { rotation: nextRotation })
    return
  }

  if (interaction.mode === 'move') {
    const { startLayout } = interaction
    const visualWidth = Math.min(100, Math.max(0, interaction.startVisualWidth))
    const visualHeight = Math.min(100, Math.max(0, interaction.startVisualHeight))
    updateElementLayout(interaction.key, {
      x: Math.min(100 - visualWidth / 2, Math.max(visualWidth / 2, startLayout.x + deltaX)),
      y: Math.min(100 - visualHeight / 2, Math.max(visualHeight / 2, startLayout.y + deltaY))
    })
    return
  }

  const { startLayout } = interaction
  const relativeScaleX = deltaX / Math.max(interaction.startVisualWidth, 1)
  const relativeScaleY = deltaY / Math.max(interaction.startVisualHeight, 1)
  const maxWidthScale = (2 * Math.min(startLayout.x, 100 - startLayout.x)) / Math.max(interaction.startVisualWidth, 1)
  const maxHeightScale = (2 * Math.min(startLayout.y, 100 - startLayout.y)) / Math.max(interaction.startVisualHeight, 1)
  const maxScale = Math.max(1, Math.min(
    maxWidthScale,
    maxHeightScale,
    100 / Math.max(interaction.startVisualWidth, 1),
    100 / Math.max(interaction.startVisualHeight, 1)
  ))
  const scale = Math.min(maxScale, Math.max(0.35, 1 + Math.max(relativeScaleX, relativeScaleY)))

  updateElementLayout(interaction.key, {
    width: Math.min(100, startLayout.width * scale),
    height: Math.min(100, startLayout.height * scale)
  })
}

const finishPreviewInteraction = () => {
  if (!previewInteraction.value) return
  if (previewInteractionMoved.value) publishLive(draft.value)
  previewInteraction.value = null
  previewInteractionMoved.value = false
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', handlePreviewInteraction)
  window.removeEventListener('pointerup', finishPreviewInteraction)
  window.removeEventListener('pointercancel', finishPreviewInteraction)
}

const commitLive = () => publishLive(draft.value)

const loadLabelTemplatePreviews = async () => {
  isLabelPreviewLoading.value = true
  labelPreviewError.value = ''
  try {
    const headers = await getApiAuthHeaders()
    const response: any = await $fetch('/api/label-templates', {
      method: 'GET',
      headers
    })
    const rows = Array.isArray(response?.templates) ? response.templates : []
    // Etiquetas antigas podem carregar uma margem transparente grande no PNG/WebP.
    // Recortar somente essa margem deixa a selecao rente ao conteudo sem alterar o layout salvo.
    const previews = (await Promise.all(
      rows.map(async (row: any): Promise<RealPriceLabelPreview | null> => {
        const id = String(row?.id || '').trim()
        const previewDataUrl = String(row?.preview_data_url ?? row?.previewDataUrl ?? '').trim()
        if (!id || !previewDataUrl) return null

        const trimmedPreviewDataUrl = await trimImageSourceToDataUrl(previewDataUrl, {
          alphaThreshold: 12,
          padding: 0
        })

        return {
          id,
          name: String(row?.name || 'Etiqueta sem nome').trim() || 'Etiqueta sem nome',
          previewDataUrl: trimmedPreviewDataUrl || previewDataUrl
        }
      })
    )).filter(Boolean) as RealPriceLabelPreview[]

    labelTemplatePreviews.value = previews
    if (!previews.some((template) => template.id === selectedLabelTemplateId.value)) {
      selectedLabelTemplateId.value = previews[0]?.id ?? null
    }
  } catch (error: any) {
    labelPreviewError.value = String(
      error?.data?.statusMessage || error?.message || 'Não foi possível carregar as etiquetas reais.'
    )
    labelTemplatePreviews.value = []
    selectedLabelTemplateId.value = null
  } finally {
    isLabelPreviewLoading.value = false
  }
}

const restoreDefaults = () => {
  draft.value = createDefaultProductCardConfiguration()
  selectedElement.value = 'name'
  selectedProfile.value = 'standard'
  feedback.value = ''
  publishLive(draft.value)
}

const persist = async () => {
  isSaving.value = true
  feedback.value = ''
  try {
    const result = await save(normalizeProductCardConfiguration(draft.value))
    draft.value = cloneConfiguration(result)
    feedbackTone.value = 'success'
    feedback.value = 'Configuração salva. As zonas do editor já receberam o novo layout dos cards.'
  } catch (error: any) {
    feedbackTone.value = 'error'
    feedback.value = String(
      error?.data?.statusMessage || error?.message || 'Não foi possível salvar a configuração dos cards.'
    )
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  const [loaded] = await Promise.all([
    load(),
    loadLabelTemplatePreviews()
  ])
  draft.value = cloneConfiguration(loaded || savedConfiguration.value)
  const [trimmedProductPreview, trimmedAlcoholBadge] = await Promise.all([
    trimImageSourceToDataUrl(productPreviewSrc.value, {
      alphaThreshold: 12,
      padding: 0
    }),
    trimImageSourceToDataUrl(alcoholBadgePreviewSrc.value, {
      alphaThreshold: 12,
      padding: 0
    })
  ])
  productPreviewSrc.value = trimmedProductPreview || productPreviewSrc.value
  alcoholBadgePreviewSrc.value = trimmedAlcoholBadge || alcoholBadgePreviewSrc.value
})

onBeforeUnmount(() => {
  finishPreviewInteraction()
})
</script>

<template>
  <div class="card-config-page">
    <header class="card-config-page__topbar">
      <div class="card-config-page__topbar-inner">
        <NuxtLink to="/" class="card-config-page__back" aria-label="Voltar para o dashboard">
          <ArrowLeft class="h-4 w-4" />
          <span>Dashboard</span>
        </NuxtLink>
        <div class="card-config-page__brand">
          <span class="card-config-page__brand-mark"><SlidersHorizontal class="h-4 w-4" /></span>
          <span>Configuração dos cards</span>
        </div>
        <div class="card-config-page__topbar-spacer" />
        <NuxtLink to="/zone-structures" class="card-config-page__secondary-link">Estruturas por quantidade</NuxtLink>
      </div>
    </header>

    <main class="card-config-page__main">
      <section class="card-config-page__intro">
        <div>
          <p class="eyebrow"><Sparkles class="h-3.5 w-3.5" /> Sistema de cards por zona</p>
          <h1>Escolha onde cada informação aparece</h1>
          <p class="intro-copy">
            Organize nome, imagem, etiqueta de preço, selo -18 e limite por cliente em quatro cards de referência:
            compacto, médio, largo e destaque. Cada zona recebe automaticamente o formato correspondente no editor.
            Para repetir uma criação em todos, use “Aplicar em todos” na prévia.
          </p>
        </div>
        <div class="card-config-page__actions">
          <button type="button" class="button button--secondary" @click="restoreDefaults">
            <RotateCcw class="h-4 w-4" />
            Restaurar base
          </button>
          <button type="button" class="button button--primary" :disabled="isSaving || isLoading" @click="persist">
            <Save class="h-4 w-4" />
            {{ isSaving ? 'Salvando...' : 'Salvar configuração' }}
          </button>
        </div>
      </section>

      <p
        v-if="feedback || lastError"
        class="feedback"
        :class="(feedbackTone === 'error' || lastError) ? 'feedback--error' : 'feedback--success'"
      >
        <Check v-if="!(feedbackTone === 'error' || lastError)" class="h-4 w-4" />
        {{ feedback || lastError }}
      </p>

      <section class="scope-banner">
        <div class="scope-banner__icon"><Sparkles class="h-5 w-5" /></div>
        <div>
          <strong>Aplicação automática dentro das zonas</strong>
          <p>Esta é a configuração padrão da conta. Toda zona de produtos recebe a receita e recalcula seus cards sem alterar o restante do encarte.</p>
        </div>
        <span class="scope-banner__status">{{ draft.enabled ? 'Ativa' : 'Pausada' }}</span>
      </section>

      <div class="card-config-workspace">
        <section class="preview-panel">
          <div class="panel-heading">
            <div>
              <span class="panel-kicker">Card de referência</span>
              <h2>Prévia ao vivo</h2>
            </div>
            <span class="preview-hint">Clique em um elemento para editar</span>
          </div>

          <div class="profile-switcher" role="tablist" aria-label="Tipos de card por zona">
            <button
              v-for="profile in profileMeta"
              :key="profile.key"
              type="button"
              class="profile-switcher__item"
              :class="{ 'profile-switcher__item--active': selectedProfile === profile.key }"
              role="tab"
              :aria-selected="selectedProfile === profile.key"
              :aria-label="`${profile.label}: ${profile.description}`"
              @click="selectedProfile = profile.key"
            >
              <strong>{{ profile.label }}</strong>
              <small>{{ profile.description }}</small>
            </button>
          </div>

          <div class="profile-tools">
            <div class="profile-tools__copy">
              <strong>Mesma estrutura em todos os formatos?</strong>
              <span>Use o {{ selectedProfileMeta.label.toLowerCase() }} como base para compacto, médio, largo e destaque.</span>
            </div>
            <button
              type="button"
              class="profile-bulk-button"
              title="Copiar esta estrutura para todos os formatos"
              @click="applySelectedProfileToAll"
            >
              <Copy class="h-3.5 w-3.5" />
              Aplicar em todos
            </button>
          </div>

          <div class="preview-stage" :class="`preview-stage--${selectedProfile}`">
            <div
              class="preview-card"
              :class="[
                { 'preview-card--paused': !draft.enabled },
                `preview-card--${selectedProfile}`
              ]"
              :style="{ aspectRatio: String(previewCardAspectRatio) }"
            >
              <button
                v-for="key in previewElements"
                :key="key"
                type="button"
                class="preview-element"
                :class="[
                  `preview-element--${key}`,
                  {
                    'preview-element--selected': selectedElement === key,
                    'preview-element--price-real': key === 'price' && !!selectedPriceLabelPreview
                  }
                ]"
                :style="previewCardElementStyle(key)"
                :aria-label="`Editar ${elementMeta.find((item) => item.key === key)?.label}`"
                @pointerdown.stop.prevent="startElementMove($event, key)"
                @click="selectedElement = key"
              >
                <span
                  class="preview-element__visual"
                  :style="previewCardElementVisualStyle(key)"
                  @pointerdown.stop.prevent="startElementMove($event, key)"
                >
                  <template v-if="key === 'name'">
                    <span>LEITE EM PÓ ITALAC 400G</span>
                  </template>
                  <template v-else-if="key === 'image'">
                    <img
                      :src="productPreviewSrc"
                      alt="Produto de exemplo"
                      @load="handlePreviewImageLoad('image', $event)"
                    />
                  </template>
                  <template v-else-if="key === 'price'">
                    <img
                      v-if="selectedPriceLabelPreview"
                      class="preview-price-label-image"
                      :src="selectedPriceLabelPreview.previewDataUrl"
                      :alt="`Etiqueta real: ${selectedPriceLabelPreview.name}`"
                      @load="handlePreviewImageLoad('price', $event)"
                    />
                    <template v-else>
                      <span class="preview-price__currency">R$</span>
                      <strong>12</strong><sup>,99</sup><small>UN</small>
                    </template>
                  </template>
                  <template v-else-if="key === 'alcoholBadge'">
                    <img
                      :src="alcoholBadgePreviewSrc"
                      alt="Álcool para menores é proibido"
                      @load="handlePreviewImageLoad('alcoholBadge', $event)"
                    />
                  </template>
                  <template v-else>
                    <span>LIMITE 3 POR CLIENTE</span>
                  </template>
                  <span
                    v-if="selectedElement === key"
                    class="preview-element__resize-handle"
                    title="Aumentar ou reduzir o elemento"
                    aria-label="Aumentar ou reduzir o elemento"
                    @pointerdown.stop.prevent="startElementResize($event, key)"
                  />
                  <span
                    v-if="selectedElement === key"
                    class="preview-element__rotation-stem"
                    aria-hidden="true"
                  />
                  <span
                    v-if="selectedElement === key"
                    class="preview-element__rotate-handle"
                    title="Girar elemento"
                    aria-label="Girar elemento"
                    role="button"
                    @pointerdown.stop.prevent="startElementRotate($event, key)"
                  >↻</span>
                </span>
              </button>
            </div>
          </div>

          <section class="real-label-library" aria-label="Biblioteca de etiquetas reais">
            <div class="real-label-library__heading">
              <div>
                <span class="panel-kicker">Biblioteca real</span>
                <strong>Escolha a etiqueta exibida no card</strong>
              </div>
              <span v-if="labelTemplatePreviews.length" class="real-label-library__count">
                {{ labelTemplatePreviews.length }} modelos
              </span>
            </div>

            <p v-if="isLabelPreviewLoading" class="real-label-library__status">
              Carregando as etiquetas salvas...
            </p>
            <p v-else-if="labelPreviewError" class="real-label-library__status real-label-library__status--error">
              {{ labelPreviewError }} A prévia continua usando o formato de exemplo.
            </p>
            <p v-else-if="!labelTemplatePreviews.length" class="real-label-library__status">
              Nenhuma etiqueta com imagem de prévia foi encontrada ainda. Crie ou salve um modelo em Etiquetas.
            </p>
            <div v-else class="real-label-library__items" role="listbox" aria-label="Selecionar etiqueta para a prévia">
              <button
                v-for="template in labelTemplatePreviews"
                :key="template.id"
                type="button"
                class="real-label-library__item"
                :class="{ 'real-label-library__item--selected': selectedLabelTemplateId === template.id }"
                role="option"
                :aria-selected="selectedLabelTemplateId === template.id"
                :title="`Mostrar ${template.name} no card`"
                @click="selectedLabelTemplateId = template.id"
              >
                <span class="real-label-library__thumb">
                  <img :src="template.previewDataUrl" :alt="template.name" loading="lazy" decoding="async" />
                </span>
                <span class="real-label-library__name">{{ template.name }}</span>
              </button>
            </div>
            <p class="real-label-library__help">
              A etiqueta acima é real, vinda da biblioteca global. A posição, tamanho e rotação configurados aqui valem para qualquer modelo usado pelas zonas.
            </p>
          </section>

          <div class="preview-legend">
            <span><i class="legend-dot legend-dot--active" /> Elemento selecionado</span>
            <span><i class="legend-dot legend-dot--safe" /> Área relativa do card</span>
          </div>
        </section>

        <aside class="settings-panel">
          <div class="panel-heading">
            <div>
              <span class="panel-kicker">Conteúdo do card</span>
              <h2>Elementos</h2>
            </div>
            <span class="element-count">{{ previewElements.length }}/5 visíveis</span>
          </div>

          <div class="element-list">
            <button
              v-for="item in elementMeta"
              :key="item.key"
              type="button"
              class="element-row"
              :class="{ 'element-row--selected': selectedElement === item.key }"
              @click="selectedElement = item.key"
            >
              <span class="element-row__symbol">{{ item.symbol }}</span>
              <span class="element-row__copy">
                <strong>{{ item.label }}</strong>
                <small>{{ item.description }}</small>
              </span>
              <span
                class="visibility-toggle"
                :class="{ 'visibility-toggle--on': draft.elements[item.key].visible }"
                :title="draft.elements[item.key].visible ? `Ocultar ${item.label}` : `Mostrar ${item.label}`"
                @click.stop="toggleElement(item.key)"
              >
                <Eye v-if="draft.elements[item.key].visible" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </span>
            </button>
          </div>

          <div class="selected-settings">
            <div class="selected-settings__heading">
              <div>
                <span class="panel-kicker">Posição relativa</span>
                <h3>{{ selectedMeta.label }} · {{ selectedProfileMeta.label }}</h3>
              </div>
              <span class="position-pill">{{ selectedLayoutLabel }}</span>
            </div>

            <div class="range-grid">
              <label class="range-field">
                <span>Horizontal <b>{{ Math.round(selectedLayout.x) }}%</b></span>
                <input type="range" min="0" max="100" step="1" :value="selectedLayout.x" @input="updateSelectedNumber('x', ($event.target as HTMLInputElement).value)" @change="commitLive" />
              </label>
              <label class="range-field">
                <span>Vertical <b>{{ Math.round(selectedLayout.y) }}%</b></span>
                <input type="range" min="0" max="100" step="1" :value="selectedLayout.y" @input="updateSelectedNumber('y', ($event.target as HTMLInputElement).value)" @change="commitLive" />
              </label>
              <label class="range-field">
                <span>Largura <b>{{ Math.round(selectedLayout.width) }}%</b></span>
                <input type="range" min="5" max="100" step="1" :value="selectedLayout.width" @input="updateSelectedNumber('width', ($event.target as HTMLInputElement).value)" @change="commitLive" />
              </label>
              <label class="range-field">
                <span>Altura <b>{{ Math.round(selectedLayout.height) }}%</b></span>
                <input type="range" min="5" max="100" step="1" :value="selectedLayout.height" @input="updateSelectedNumber('height', ($event.target as HTMLInputElement).value)" @change="commitLive" />
              </label>
              <label class="range-field range-field--rotation">
                <span>Rotação <b>{{ Math.round(selectedLayout.rotation) }}°</b></span>
                <input type="range" min="-180" max="180" step="1" :value="selectedLayout.rotation" @input="updateSelectedNumber('rotation', ($event.target as HTMLInputElement).value)" @change="commitLive" />
              </label>
            </div>

            <div class="rotation-help">
              Arraste o controle acima do elemento para girar. Segure <strong>Shift</strong> para ajustar em passos de 15°.
              <button type="button" class="rotation-reset" @click="updateSelectedLayout({ rotation: 0 }, true)">Zerar rotação</button>
            </div>

            <div class="anchor-picker">
              <div class="field-label">Atalhos de posição</div>
              <div class="anchor-grid">
                <button v-for="anchor in anchorOptions" :key="anchor.id" type="button" :title="anchor.label" @click="applyAnchor(anchor)">
                  <span :class="{ 'anchor-dot--active': Math.abs(selectedLayout.x - anchor.x) < 1 && Math.abs(selectedLayout.y - anchor.y) < 1 }" />
                </button>
              </div>
            </div>
          </div>

          <div class="badge-settings">
            <div class="selected-settings__heading">
              <div>
                <span class="panel-kicker">Regra comercial</span>
                <h3><ShieldAlert class="h-4 w-4" /> Selo de bebida alcoólica</h3>
              </div>
              <label class="switch">
                <input v-model="draft.alcoholBadgeEnabled" type="checkbox" @change="commitLive" />
                <span />
              </label>
            </div>
            <p>O selo oficial aparece somente quando o produto tiver uma flag alcoólica ou for identificado como bebida alcoólica pela categoria/nome.</p>
            <div class="badge-settings__asset">
              <img :src="PRODUCT_ALCOHOL_BADGE_ASSET_URL" alt="Selo oficial de álcool para menores" />
              <span>Imagem fixa do selo oficial. A posição e o tamanho continuam ajustáveis acima.</span>
            </div>
          </div>

          <label class="master-switch">
            <span>
              <strong>Aplicar configuração nas zonas</strong>
              <small>Desative somente para pausar a receita global sem apagar o layout.</small>
            </span>
            <input v-model="draft.enabled" type="checkbox" @change="commitLive" />
          </label>
        </aside>
      </div>
    </main>
  </div>
</template>

<style scoped>
.card-config-page { min-height: 100vh; color: #172033; background: #f4f7fb; }
.card-config-page__topbar { height: 64px; border-bottom: 1px solid #e5eaf1; background: rgba(255,255,255,.96); }
.card-config-page__topbar-inner, .card-config-page__main { width: min(1380px, calc(100% - 40px)); margin: 0 auto; }
.card-config-page__topbar-inner { display: flex; align-items: center; gap: 24px; height: 100%; }
.card-config-page__back, .card-config-page__secondary-link { display: inline-flex; align-items: center; gap: 8px; color: #64748b; font-size: 12px; text-decoration: none; transition: .16s ease; }
.card-config-page__back:hover, .card-config-page__secondary-link:hover { color: #172033; }
.card-config-page__brand { display: inline-flex; align-items: center; gap: 10px; color: #172033; font-size: 14px; font-weight: 800; }
.card-config-page__brand-mark { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid #ddd6fe; border-radius: 9px; color: #7c3aed; background: #f5f3ff; }
.card-config-page__topbar-spacer { flex: 1; }
.card-config-page__main { padding: 42px 0 60px; }
.card-config-page__intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.eyebrow, .panel-kicker { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 8px; color: #7c3aed; font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
h1 { margin: 0; color: #172033; font-size: clamp(26px, 3vw, 38px); line-height: 1.08; }
.intro-copy { max-width: 720px; margin: 12px 0 0; color: #64748b; font-size: 14px; line-height: 1.6; }
.card-config-page__actions { display: flex; gap: 10px; flex-shrink: 0; }
.button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 0 15px; border: 1px solid transparent; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; transition: .16s ease; }
.button:disabled { opacity: .55; cursor: wait; }
.button--primary { color: #fff; background: #7c3aed; box-shadow: 0 6px 16px rgba(124,58,237,.18); }
.button--primary:hover:not(:disabled) { background: #6d28d9; }
.button--secondary { color: #475569; border-color: #dbe3ed; background: #fff; }
.button--secondary:hover { border-color: #c4b5fd; color: #6d28d9; }
.feedback { display: flex; align-items: center; gap: 8px; margin: 0 0 18px; padding: 11px 13px; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; background: #f0fdf4; font-size: 13px; }
.feedback--error { border-color: #fecaca; color: #b91c1c; background: #fef2f2; }
.scope-banner { display: flex; align-items: center; gap: 13px; margin-bottom: 16px; padding: 14px 16px; border: 1px solid #ddd6fe; border-radius: 10px; background: linear-gradient(100deg, #faf5ff, #f8fbff); }
.scope-banner__icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; color: #7c3aed; background: #ede9fe; }
.scope-banner strong { color: #4c1d95; font-size: 13px; }
.scope-banner p { margin: 3px 0 0; color: #7c6f9d; font-size: 11px; line-height: 1.4; }
.scope-banner__status { margin-left: auto; padding: 6px 9px; border-radius: 999px; color: #6d28d9; background: #ede9fe; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.card-config-workspace { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(360px, .85fr); gap: 16px; align-items: start; }
.preview-panel, .settings-panel { min-width: 0; border: 1px solid #e1e8f0; border-radius: 10px; background: #fff; box-shadow: 0 12px 30px rgba(15,23,42,.045); }
.preview-panel { padding: 22px; }
.settings-panel { padding: 20px; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding-bottom: 17px; border-bottom: 1px solid #edf1f5; }
.panel-heading h2, .selected-settings h3 { margin: 0; color: #1e293b; font-size: 17px; }
.preview-hint, .element-count { color: #94a3b8; font-size: 11px; }
.profile-switcher { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 16px; }
.profile-switcher__item { display: grid; gap: 3px; min-width: 0; padding: 9px 8px; border: 1px solid #e5e7eb; border-radius: 8px; color: #64748b; background: #fff; text-align: left; cursor: pointer; transition: .16s ease; }
.profile-switcher__item:hover { border-color: #c4b5fd; background: #faf5ff; }
.profile-switcher__item--active { border-color: #8b5cf6; color: #5b21b6; background: #f5f3ff; box-shadow: 0 0 0 2px rgba(139,92,246,.1); }
.profile-switcher__item strong { overflow: hidden; color: inherit; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.profile-switcher__item small { overflow: hidden; color: #94a3b8; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.profile-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; padding: 10px 11px; border: 1px solid #ddd6fe; border-radius: 8px; background: #faf5ff; }
.profile-tools__copy { display: grid; gap: 3px; min-width: 0; }
.profile-tools__copy strong { color: #4c1d95; font-size: 11px; }
.profile-tools__copy span { color: #7c6f9d; font-size: 10px; line-height: 1.35; }
.profile-bulk-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 0 0 auto; min-height: 31px; padding: 0 10px; border: 1px solid #c4b5fd; border-radius: 7px; color: #6d28d9; background: #fff; font-size: 10px; font-weight: 800; cursor: pointer; transition: .16s ease; }
.profile-bulk-button:hover { border-color: #8b5cf6; color: #5b21b6; background: #f5f3ff; }
.preview-stage { display: grid; place-items: center; min-height: 650px; margin-top: 20px; padding: 34px; border: 1px solid #e5e7eb; border-radius: 10px; background: radial-gradient(circle at 30% 20%, #eef2ff 0, transparent 42%), #f8fafc; }
.preview-stage--wide { min-height: 390px; }
.preview-card { position: relative; width: min(100%, 420px); aspect-ratio: 4 / 5; overflow: hidden; border: 8px solid #111827; border-radius: 22px; background: #fff; box-shadow: 0 25px 55px rgba(15,23,42,.18); transition: opacity .2s ease; }
.preview-card--paused { opacity: .45; }
.preview-element { position: absolute; display: flex; box-sizing: border-box; align-items: center; justify-content: center; margin: 0; padding: 0; overflow: visible; border: 0; border-radius: 0; color: #172033; background: transparent; cursor: grab; font: inherit; pointer-events: auto; touch-action: none; transform: translate(-50%, -50%); transition: border-color .16s ease, box-shadow .16s ease, background .16s ease; }
.preview-element:active { cursor: grabbing; }
.preview-element__visual { position: relative; display: inline-flex; flex: 0 1 auto; box-sizing: border-box; align-items: center; justify-content: center; min-width: 0; min-height: 0; max-width: 100%; max-height: 100%; cursor: grab; pointer-events: auto; }
.preview-element:hover .preview-element__visual, .preview-element--selected .preview-element__visual { border: 1px dashed #a78bfa; border-radius: 8px; background: rgba(245,243,255,.55); box-shadow: 0 0 0 3px rgba(167,139,250,.15); }
.preview-element--selected { overflow: visible; }
.preview-element__resize-handle { position: absolute; right: -7px; bottom: -7px; z-index: 6; width: 12px; height: 12px; border: 2px solid #fff; border-radius: 3px; background: #7c3aed; box-shadow: 0 2px 6px rgba(15,23,42,.28); cursor: nwse-resize; }
.preview-element__rotation-stem { position: absolute; left: 50%; top: -25px; z-index: 5; width: 1px; height: 17px; background: #7c3aed; pointer-events: none; transform: translateX(-50%); }
.preview-element__rotate-handle { position: absolute; left: 50%; top: -42px; z-index: 7; display: grid; place-items: center; width: 20px; height: 20px; border: 2px solid #fff; border-radius: 50%; color: #fff; background: #7c3aed; box-shadow: 0 2px 6px rgba(15,23,42,.28); cursor: grab; font-size: 14px; line-height: 1; pointer-events: auto; transform: translateX(-50%); }
.preview-element__rotate-handle:active { cursor: grabbing; }
.preview-element--name .preview-element__visual { color: #172033; font-size: clamp(12px, 2.1vw, 20px); font-weight: 900; line-height: 1.03; text-align: center; text-transform: uppercase; }
.preview-element--image .preview-element__visual, .preview-element--price-real .preview-element__visual, .preview-element--alcoholBadge .preview-element__visual { flex: 0 0 auto; }
.preview-element--image img, .preview-price-label-image, .preview-element--alcoholBadge img { display: block; width: 100%; height: 100%; max-width: none; max-height: none; object-fit: contain; pointer-events: none; }
.preview-element--image img { filter: drop-shadow(0 8px 6px rgba(15,23,42,.18)); }
.preview-element--price .preview-element__visual { align-items: baseline; gap: 2px; border-radius: 14px; color: #fff; background: #e11d48; font-weight: 900; line-height: .8; white-space: nowrap; }
.preview-element--price-real .preview-element__visual { border-radius: 0; background: transparent; }
.preview-price-label-image { filter: drop-shadow(0 8px 7px rgba(15,23,42,.2)); }
.preview-price__currency { align-self: flex-start; margin-top: 10%; font-size: clamp(10px, 1.8vw, 16px); }
.preview-element--price strong { font-size: clamp(30px, 6vw, 58px); letter-spacing: -.07em; }
.preview-element--price sup { position: relative; top: -.38em; font-size: clamp(14px, 2.5vw, 24px); }
.preview-element--price small { align-self: flex-end; margin-bottom: 10%; font-size: clamp(9px, 1.5vw, 14px); }
.preview-element--alcoholBadge .preview-element__visual { border-radius: 50%; }
.preview-element--alcoholBadge img { clip-path: circle(50% at 50% 50%); }
.preview-element--limit .preview-element__visual { color: #be123c; font-size: clamp(8px, 1.4vw, 13px); font-weight: 900; line-height: 1.05; text-align: center; text-transform: uppercase; }
.preview-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 13px; color: #94a3b8; font-size: 10px; }
.preview-legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.legend-dot--active { background: #8b5cf6; }.legend-dot--safe { background: #cbd5e1; }
.real-label-library { margin-top: 18px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 10px; background: linear-gradient(135deg, #fbfdff, #f8f7ff); }
.real-label-library__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.real-label-library__heading strong { display: block; margin-top: 3px; color: #334155; font-size: 12px; }
.real-label-library__count { flex: 0 0 auto; padding: 5px 8px; border-radius: 999px; color: #6d28d9; background: #ede9fe; font-size: 10px; font-weight: 800; }
.real-label-library__items { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 8px; margin-top: 12px; }
.real-label-library__item { display: grid; gap: 6px; min-width: 0; padding: 7px; border: 1px solid #e2e8f0; border-radius: 8px; color: #64748b; background: #fff; text-align: left; cursor: pointer; transition: border-color .16s ease, background .16s ease, box-shadow .16s ease, transform .16s ease; }
.real-label-library__item:hover { border-color: #c4b5fd; background: #faf5ff; transform: translateY(-1px); }
.real-label-library__item:focus-visible { outline: 3px solid rgba(124,58,237,.2); outline-offset: 2px; }
.real-label-library__item--selected { border-color: #8b5cf6; background: #f5f3ff; box-shadow: 0 0 0 2px rgba(139,92,246,.1); }
.real-label-library__thumb { display: grid; place-items: center; height: 54px; padding: 4px; border-radius: 6px; background: radial-gradient(circle at 30% 20%, #eef2ff, transparent 42%), #f8fafc; }
.real-label-library__thumb img { display: block; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 3px 4px rgba(15,23,42,.16)); }
.real-label-library__name { overflow: hidden; color: inherit; font-size: 10px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.real-label-library__status { margin: 11px 0 0; color: #94a3b8; font-size: 10px; line-height: 1.45; }
.real-label-library__status--error { color: #b45309; }
.real-label-library__help { margin: 11px 0 0; color: #94a3b8; font-size: 10px; line-height: 1.45; }
.element-list { display: grid; gap: 5px; margin-top: 14px; }
.element-row { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 7px 8px; border: 1px solid transparent; border-radius: 8px; color: #64748b; background: transparent; text-align: left; cursor: pointer; transition: .16s ease; }
.element-row:hover { background: #f8fafc; }.element-row--selected { border-color: #ddd6fe; color: #5b21b6; background: #faf5ff; }
.element-row__symbol { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; color: #64748b; background: #f1f5f9; font-size: 10px; font-weight: 900; }
.element-row--selected .element-row__symbol { color: #6d28d9; background: #ede9fe; }
.element-row__copy { display: grid; gap: 3px; min-width: 0; }.element-row__copy strong { color: inherit; font-size: 12px; }.element-row__copy small { color: #94a3b8; font-size: 10px; }
.visibility-toggle { display: grid; place-items: center; width: 30px; height: 30px; margin-left: auto; border-radius: 7px; color: #cbd5e1; cursor: pointer; }.visibility-toggle--on { color: #7c3aed; background: #ede9fe; }
.selected-settings, .badge-settings { margin-top: 18px; padding-top: 18px; border-top: 1px solid #edf1f5; }
.selected-settings__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.selected-settings__heading h3 { display: flex; align-items: center; gap: 6px; font-size: 15px; }
.position-pill { padding: 6px 8px; border-radius: 999px; color: #6d28d9; background: #f5f3ff; font-size: 10px; font-weight: 800; white-space: nowrap; }
.range-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 13px 14px; margin-top: 18px; }.range-field--rotation { grid-column: 1 / -1; }
.range-field { display: grid; gap: 7px; color: #475569; font-size: 11px; font-weight: 800; }.range-field span { display: flex; justify-content: space-between; gap: 8px; }.range-field b { color: #7c3aed; }.range-field input { width: 100%; accent-color: #7c3aed; }
.rotation-help { margin-top: 12px; color: #94a3b8; font-size: 10px; line-height: 1.45; }.rotation-help strong { color: #7c3aed; }.rotation-reset { margin-left: 5px; padding: 0; border: 0; color: #7c3aed; background: transparent; font: inherit; font-weight: 800; cursor: pointer; }
.anchor-picker { margin-top: 19px; }.field-label { color: #475569; font-size: 11px; font-weight: 800; }.anchor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; max-width: 180px; margin-top: 9px; }.anchor-grid button { display: grid; place-items: center; width: 100%; aspect-ratio: 1; border: 1px solid #dbe3ed; border-radius: 6px; background: #fff; cursor: pointer; }.anchor-grid button:hover { border-color: #a78bfa; background: #faf5ff; }.anchor-grid span { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; }.anchor-grid span.anchor-dot--active { background: #7c3aed; box-shadow: 0 0 0 3px #ede9fe; }
.badge-settings p { margin: 8px 0 13px; color: #94a3b8; font-size: 11px; line-height: 1.45; }.text-field { display: grid; gap: 6px; }.text-field span { color: #475569; font-size: 11px; font-weight: 800; }.text-field input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid #dbe3ed; border-radius: 7px; outline: none; color: #334155; background: #fff; font-size: 12px; }.text-field input:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,.12); }
.badge-settings__asset { display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fafafa; color: #64748b; font-size: 10px; line-height: 1.35; }
.badge-settings__asset img { flex: 0 0 42px; width: 42px; height: 42px; object-fit: contain; clip-path: circle(50% at 50% 50%); }
.switch { position: relative; display: inline-flex; flex: 0 0 auto; width: 34px; height: 20px; cursor: pointer; }.switch input, .master-switch input { position: absolute; opacity: 0; pointer-events: none; }.switch span { width: 100%; height: 100%; border-radius: 999px; background: #cbd5e1; transition: .16s ease; }.switch span::after { display: block; width: 14px; height: 14px; margin: 3px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.25); content: ''; transition: .16s ease; }.switch input:checked + span { background: #7c3aed; }.switch input:checked + span::after { transform: translateX(14px); }
.master-switch { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 18px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; }.master-switch span { display: grid; gap: 4px; }.master-switch strong { color: #334155; font-size: 12px; }.master-switch small { color: #94a3b8; font-size: 10px; line-height: 1.35; }.master-switch::after { flex: 0 0 auto; width: 34px; height: 20px; border-radius: 999px; background: #cbd5e1; content: ''; }.master-switch:has(input:checked)::after { background: #7c3aed; }
@media (max-width: 980px) { .card-config-workspace { grid-template-columns: 1fr; }.preview-stage { min-height: 520px; }.card-config-page__intro { align-items: flex-start; flex-direction: column; }.card-config-page__actions { width: 100%; }.button { flex: 1; } }
@media (max-width: 560px) { .card-config-page__topbar-inner, .card-config-page__main { width: min(100% - 24px, 1380px); }.card-config-page__topbar { height: 56px; }.card-config-page__back span, .card-config-page__secondary-link { display: none; }.card-config-page__brand { font-size: 12px; }.card-config-page__main { padding-top: 26px; }.preview-panel, .settings-panel { padding: 15px; }.preview-stage { min-height: 390px; padding: 16px; }.profile-switcher { grid-template-columns: repeat(2, minmax(0, 1fr)); }.profile-tools { align-items: stretch; flex-direction: column; }.profile-bulk-button { width: 100%; }.range-grid { grid-template-columns: 1fr; }.scope-banner { align-items: flex-start; }.scope-banner__status { display: none; }.real-label-library__items { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
