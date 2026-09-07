<script setup lang="ts">
import { Copy, LockKeyhole, Plus, RotateCcw, Trash2, UnlockKeyhole } from 'lucide-vue-next'
import type {
  BuilderThemeBusinessField,
  BuilderThemeComposition,
  BuilderThemeElement,
  BuilderThemeElementStyle,
} from '~/types/builder'
import {
  BUILDER_THEME_FIELD_DEFINITIONS,
  builderThemeElementLabel,
  createBuilderThemeElementId,
  createDefaultBuilderThemeComposition,
  normalizeBuilderThemeComposition,
  shouldRevealBackgroundThroughProductZone,
} from '~/utils/builderThemeComposition'

const props = defineProps<{
  modelValue: BuilderThemeComposition
  previewFormat: { label?: string; width: number; height: number }
  backgroundColor: string
  backgroundImage?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BuilderThemeComposition]
  'update:backgroundColor': [value: string]
}>()

const canvasRef = ref<HTMLElement | null>(null)
const selectedId = ref<string | null>(null)

const composition = computed(() => normalizeBuilderThemeComposition(props.modelValue))
const elements = computed(() => [...composition.value.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)))
const selectedElement = computed(() => composition.value.elements.find(element => element.id === selectedId.value) || null)
const selectedStyle = computed(() => selectedElement.value?.style || {})
const productZoneCount = computed(() => composition.value.elements.filter(element => element.kind === 'product_zone').length)
const selectedLabel = computed(() => selectedElement.value ? builderThemeElementLabel(selectedElement.value) : '')

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const fieldSample = (field: BuilderThemeBusinessField | undefined): string => {
  if (!field) return ''
  return BUILDER_THEME_FIELD_DEFINITIONS.find(item => item.field === field)?.sample || ''
}

const resolveAssetUrl = (value: string | null | undefined): string => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/api/') || raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `/api/storage/p?key=${encodeURIComponent(raw)}`
}

const backgroundImageUrl = computed(() => resolveAssetUrl(props.backgroundImage || composition.value.background.image))
const hasBackgroundImage = computed(() => !!backgroundImageUrl.value)
const safeBackgroundColor = computed(() => props.backgroundColor || composition.value.background.color || '#ffffff')
const safeColor = (value: string | undefined, fallback = '#111827'): string => {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? String(value) : fallback
}

const canvasStyle = computed(() => ({
  aspectRatio: `${props.previewFormat.width} / ${props.previewFormat.height}`,
  // O preview precisa compor PNGs transparentes como o canvas final: preto
  // evita que uma área destinada a ser escura vire branca apenas no Builder.
  backgroundColor: backgroundImageUrl.value ? '#000000' : safeBackgroundColor.value,
  backgroundImage: backgroundImageUrl.value ? `url("${backgroundImageUrl.value.replaceAll('"', '%22')}")` : undefined,
  backgroundSize: composition.value.background.fit === 'stretch' ? '100% 100%' : (composition.value.background.fit || 'cover'),
  backgroundPosition: 'center',
  containerType: 'inline-size' as const,
}))

const elementStyle = (element: BuilderThemeElement) => {
  const style = element.style || {}
  const revealBackground = shouldRevealBackgroundThroughProductZone(element, hasBackgroundImage.value)
  return {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    zIndex: element.zIndex ?? 1,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    backgroundColor: revealBackground ? 'transparent' : style.backgroundColor,
    color: style.color,
    border: revealBackground ? undefined : (style.borderWidth ? `${style.borderWidth}px solid ${style.borderColor || 'rgba(148, 163, 184, .7)'}` : undefined),
    borderRadius: `${style.borderRadius ?? 0}px`,
    fontSize: `${style.fontSize ?? 2}cqw`,
    fontWeight: style.fontWeight || 600,
    fontFamily: style.fontFamily || undefined,
    textAlign: style.textAlign || 'left',
    opacity: revealBackground ? 1 : (style.opacity ?? 1),
    padding: `${style.padding ?? 0.5}cqw`,
    boxShadow: revealBackground ? undefined : style.boxShadow,
  }
}

const updateComposition = (mutator: (value: BuilderThemeComposition) => void) => {
  const next = normalizeBuilderThemeComposition(props.modelValue)
  next.elements = next.elements.map(element => ({ ...element, style: { ...(element.style || {}) } }))
  mutator(next)
  emit('update:modelValue', next)
}

const updateElement = (id: string, patch: Partial<BuilderThemeElement>) => {
  updateComposition((next) => {
    const element = next.elements.find(item => item.id === id)
    if (element) Object.assign(element, patch)
  })
}

const updateSelectedStyle = (patch: Partial<BuilderThemeElementStyle>) => {
  if (!selectedElement.value) return
  updateComposition((next) => {
    const element = next.elements.find(item => item.id === selectedElement.value?.id)
    if (element) element.style = { ...(element.style || {}), ...patch }
  })
}

const updateSelectedNumber = (key: 'x' | 'y' | 'width' | 'height' | 'rotation', event: Event) => {
  if (!selectedElement.value) return
  const rawValue = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(rawValue)) return

  const selected = selectedElement.value
  const value = key === 'x'
    ? clamp(rawValue, 0, 100 - selected.width)
    : key === 'y'
      ? clamp(rawValue, 0, 100 - selected.height)
      : key === 'width'
        ? clamp(rawValue, 1, 100 - selected.x)
        : key === 'height'
          ? clamp(rawValue, 1, 100 - selected.y)
          : clamp(rawValue, -180, 180)
  updateElement(selected.id, { [key]: Math.round(value * 10) / 10 } as Partial<BuilderThemeElement>)
}

const updateSelectedContent = (event: Event) => {
  if (!selectedElement.value) return
  updateElement(selectedElement.value.id, { content: (event.target as HTMLTextAreaElement | HTMLInputElement).value.slice(0, 1000) })
}

const addField = (field: BuilderThemeBusinessField) => {
  const definition = BUILDER_THEME_FIELD_DEFINITIONS.find(item => item.field === field)
  if (!definition) return

  const existing = composition.value.elements.find(element => element.kind === 'business_field' && element.field === field)
  if (existing) {
    selectedId.value = existing.id
    return
  }

  const index = composition.value.elements.length
  const element: BuilderThemeElement = {
    id: createBuilderThemeElementId(),
    kind: 'business_field',
    field,
    x: clamp(8 + (index % 3) * 5, 0, 70),
    y: clamp(23 + (index % 5) * 8, 0, 90),
    width: definition.width,
    height: definition.height,
    zIndex: 4,
    visible: true,
    style: {
      color: '#111827',
      fontSize: definition.fontSize,
      fontWeight: field === 'company_name' || field === 'title' ? 800 : 600,
      textAlign: field === 'payments' ? 'center' : 'left',
      objectFit: field === 'logo' ? 'contain' : undefined,
      borderRadius: field === 'logo' ? 8 : 0,
    },
  }
  updateComposition((next) => { next.elements.push(element) })
  selectedId.value = element.id
}

const addProductZone = () => {
  const existing = composition.value.elements.find(element => element.kind === 'product_zone')
  if (existing) {
    selectedId.value = existing.id
    return
  }

  const element: BuilderThemeElement = {
    id: createBuilderThemeElementId('product-zone'),
    kind: 'product_zone',
    x: 6,
    y: 24,
    width: 88,
    height: 60,
    zIndex: 2,
    visible: true,
    style: {
      backgroundColor: 'transparent',
      borderColor: '#cbd5e1',
      borderWidth: 1,
      borderRadius: 8,
      opacity: 1,
      padding: 0.8,
    },
  }
  updateComposition((next) => { next.elements.push(element) })
  selectedId.value = element.id
}

const addText = () => {
  const element: BuilderThemeElement = {
    id: createBuilderThemeElementId(),
    kind: 'text',
    content: 'Texto livre',
    x: 12,
    y: 42,
    width: 42,
    height: 8,
    zIndex: 5,
    visible: true,
    style: { color: '#111827', fontSize: 2.4, fontWeight: 700, textAlign: 'left' },
  }
  updateComposition((next) => { next.elements.push(element) })
  selectedId.value = element.id
}

const addShape = () => {
  const element: BuilderThemeElement = {
    id: createBuilderThemeElementId(),
    kind: 'shape',
    x: 10,
    y: 40,
    width: 30,
    height: 8,
    zIndex: 1,
    visible: true,
    style: { backgroundColor: '#e2e8f0', borderRadius: 8, opacity: 0.9 },
  }
  updateComposition((next) => { next.elements.push(element) })
  selectedId.value = element.id
}

const addImage = () => {
  const element: BuilderThemeElement = {
    id: createBuilderThemeElementId(),
    kind: 'image',
    content: '',
    x: 12,
    y: 28,
    width: 24,
    height: 18,
    zIndex: 4,
    visible: true,
    style: { objectFit: 'contain', borderRadius: 8, opacity: 1 },
  }
  updateComposition((next) => { next.elements.push(element) })
  selectedId.value = element.id
}

const removeSelected = () => {
  const selected = selectedElement.value
  if (!selected) return
  if (selected.kind === 'product_zone' && productZoneCount.value <= 1) return
  updateComposition((next) => { next.elements = next.elements.filter(element => element.id !== selected.id) })
  selectedId.value = null
}

const duplicateSelected = () => {
  const selected = selectedElement.value
  if (!selected || selected.kind === 'product_zone') return
  const copy: BuilderThemeElement = {
    ...selected,
    id: createBuilderThemeElementId(),
    x: clamp(selected.x + 3, 0, 100 - selected.width),
    y: clamp(selected.y + 3, 0, 100 - selected.height),
    style: { ...(selected.style || {}) },
  }
  updateComposition((next) => { next.elements.push(copy) })
  selectedId.value = copy.id
}

const resetComposition = () => {
  const next = createDefaultBuilderThemeComposition()
  emit('update:modelValue', next)
  selectedId.value = next.elements.find(element => element.kind === 'product_zone')?.id || null
}

const toggleLock = () => {
  if (!selectedElement.value) return
  updateElement(selectedElement.value.id, { locked: !selectedElement.value.locked })
}

const toggleVisibility = () => {
  if (!selectedElement.value) return
  if (selectedElement.value.kind === 'product_zone' && productZoneCount.value <= 1) return
  updateElement(selectedElement.value.id, { visible: selectedElement.value.visible === false })
}

const bringToFront = () => {
  if (!selectedElement.value) return
  const maxZ = Math.max(0, ...composition.value.elements.map(element => element.zIndex || 0))
  updateElement(selectedElement.value.id, { zIndex: maxZ + 1 })
}

const sendToBack = () => {
  if (!selectedElement.value) return
  const minZ = Math.min(0, ...composition.value.elements.map(element => element.zIndex || 0))
  updateElement(selectedElement.value.id, { zIndex: minZ - 1 })
}

type Interaction = {
  mode: 'move' | 'resize'
  elementId: string
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  startWidth: number
  startHeight: number
}
const interaction = ref<Interaction | null>(null)

const stopInteraction = () => {
  interaction.value = null
  if (typeof window === 'undefined') return
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stopInteraction)
}

const onPointerMove = (event: PointerEvent) => {
  const active = interaction.value
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!active || !rect || !rect.width || !rect.height) return
  const deltaX = ((event.clientX - active.startClientX) / rect.width) * 100
  const deltaY = ((event.clientY - active.startClientY) / rect.height) * 100
  const selected = composition.value.elements.find(element => element.id === active.elementId)
  if (!selected || selected.locked) return

  if (active.mode === 'move') {
    updateElement(active.elementId, {
      x: Math.round(clamp(active.startX + deltaX, 0, 100 - active.startWidth) * 10) / 10,
      y: Math.round(clamp(active.startY + deltaY, 0, 100 - active.startHeight) * 10) / 10,
    })
  } else {
    updateElement(active.elementId, {
      width: Math.round(clamp(active.startWidth + deltaX, 1, 100 - active.startX) * 10) / 10,
      height: Math.round(clamp(active.startHeight + deltaY, 1, 100 - active.startY) * 10) / 10,
    })
  }
}

const onPointerDown = (event: PointerEvent, element: BuilderThemeElement, mode: 'move' | 'resize') => {
  event.preventDefault()
  selectedId.value = element.id
  if (element.locked) return
  interaction.value = {
    mode,
    elementId: element.id,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: element.x,
    startY: element.y,
    startWidth: element.width,
    startHeight: element.height,
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stopInteraction)
}

const onCanvasKeydown = (event: KeyboardEvent) => {
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedElement.value) {
    event.preventDefault()
    removeSelected()
  }
}

const selectedColor = (key: 'color' | 'backgroundColor' | 'borderColor'): string => {
  const fallback = key === 'color' ? '#111827' : key === 'backgroundColor' ? '#ffffff' : '#cbd5e1'
  return safeColor(selectedStyle.value[key], fallback)
}

onBeforeUnmount(stopInteraction)
</script>

<template>
  <section class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wider text-zinc-100">Composição visual do tema</h3>
        <p class="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-400">
          Monte o encarte como um modelo: arraste o fundo, os elementos, os dados da loja e a zona de produtos.
          Os posicionamentos são percentuais e se adaptam ao formato selecionado pelo cliente.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white"
        @click="resetComposition"
      >
        <RotateCcw class="h-3.5 w-3.5" />
        Usar composição inicial
      </button>
    </div>

    <div class="mt-4 grid gap-4 xl:grid-cols-[190px_minmax(0,1fr)_230px]">
      <aside class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Adicionar informação</p>
        <div class="mt-2 grid grid-cols-2 gap-1.5 xl:grid-cols-1">
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-left text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
            @click="addProductZone"
          >
            <Plus class="h-3.5 w-3.5 shrink-0" />
            Zona de produtos
          </button>
          <button
            v-for="definition in BUILDER_THEME_FIELD_DEFINITIONS"
            :key="definition.field"
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:border-zinc-600 hover:text-white"
            @click="addField(definition.field)"
          >
            <Plus class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            {{ definition.label }}
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:border-zinc-600 hover:text-white"
            @click="addText"
          >
            <Plus class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            Texto livre
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:border-zinc-600 hover:text-white"
            @click="addShape"
          >
            <Plus class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            Retângulo
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-left text-[11px] text-zinc-300 hover:border-zinc-600 hover:text-white"
            @click="addImage"
          >
            <Plus class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            Imagem decorativa
          </button>
        </div>
        <p class="mt-3 text-[10px] leading-relaxed text-zinc-600">
          Campos como logo, WhatsApp, validade, endereço e cartões serão preenchidos com os dados salvos do cliente.
        </p>
      </aside>

      <div class="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-medium text-zinc-200">Prévia editável</p>
            <p class="text-[10px] text-zinc-500">{{ previewFormat.label || 'Formato' }} · {{ previewFormat.width }} × {{ previewFormat.height }} px</p>
          </div>
          <span class="rounded-full bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400">
            {{ elements.length }} elementos
          </span>
        </div>

        <div class="max-h-[70vh] overflow-auto rounded-lg bg-zinc-900/80 p-3">
          <div class="mx-auto w-full max-w-[460px]">
            <div
              ref="canvasRef"
              tabindex="0"
              class="relative w-full overflow-hidden rounded-md outline-none ring-1 ring-zinc-700 focus:ring-2 focus:ring-emerald-500"
              :style="canvasStyle"
              @pointerdown.self="selectedId = null"
              @keydown="onCanvasKeydown"
            >
              <template v-for="element in elements" :key="element.id">
                <div
                  v-if="element.visible !== false"
                  class="absolute select-none overflow-hidden transition-[box-shadow]"
                  :class="selectedId === element.id ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-zinc-950' : 'hover:ring-1 hover:ring-emerald-300/70'"
                  :style="elementStyle(element)"
                  @pointerdown.stop="onPointerDown($event, element, 'move')"
                  @click.stop="selectedId = element.id"
                >
                  <div v-if="element.kind === 'product_zone'" class="flex h-full w-full flex-col justify-between p-[1.5%]">
                    <div class="grid min-h-0 flex-1 grid-cols-3 gap-[2%] opacity-70">
                      <div v-for="cell in 6" :key="cell" class="rounded border border-slate-200 bg-slate-50 p-[4%]">
                        <div class="aspect-square rounded bg-slate-200/80" />
                        <div class="mt-[5%] h-[8%] w-4/5 rounded bg-slate-300" />
                        <div class="mt-[5%] h-[12%] w-1/2 rounded bg-emerald-500/70" />
                      </div>
                    </div>
                    <span class="mt-[1%] text-center text-[1.6cqw] font-semibold uppercase tracking-wider text-emerald-700/80">
                      Zona de produtos
                    </span>
                  </div>

                  <template v-else-if="element.kind === 'shape'">
                    <span class="sr-only">Elemento decorativo</span>
                  </template>

                  <template v-else-if="element.kind === 'image'">
                    <img
                      v-if="resolveAssetUrl(element.content)"
                      :src="resolveAssetUrl(element.content)"
                      alt=""
                      class="h-full w-full"
                      :style="{ objectFit: element.style?.objectFit || 'contain' }"
                    />
                    <span v-else class="flex h-full w-full items-center justify-center border border-dashed border-slate-400/70 text-[2cqw] font-semibold text-slate-500">
                      IMAGEM
                    </span>
                  </template>

                  <template v-else-if="element.kind === 'business_field' && element.field === 'logo'">
                    <span class="flex h-full w-full items-center justify-center rounded border border-dashed border-current/40 text-[2cqw] font-extrabold tracking-wider opacity-70">
                      LOGO
                    </span>
                  </template>

                  <span v-else class="block truncate whitespace-pre-wrap break-words leading-tight">
                    {{ element.kind === 'text' ? (element.content || 'Texto livre') : fieldSample(element.field) }}
                  </span>

                  <button
                    v-if="selectedId === element.id && !element.locked"
                    type="button"
                    class="absolute bottom-0 right-0 z-20 h-3 w-3 cursor-se-resize rounded-sm bg-emerald-400 shadow"
                    aria-label="Redimensionar elemento"
                    @pointerdown.stop.prevent="onPointerDown($event, element, 'resize')"
                  />
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
          <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-400" /> arraste para posicionar</span>
          <span>·</span>
          <span>alça no canto para redimensionar</span>
          <span>·</span>
          <span>{{ productZoneCount ? 'zona de produtos definida' : 'adicione uma zona de produtos' }}</span>
        </div>
      </div>

      <aside class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <div class="border-b border-zinc-800 pb-3">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fundo</p>
          <div class="mt-2 flex items-center gap-2">
            <input
              type="color"
              :value="safeColor(backgroundColor, '#ffffff')"
              class="h-8 w-10 cursor-pointer rounded border border-zinc-700 bg-zinc-900"
              aria-label="Cor do fundo"
              @input="emit('update:backgroundColor', ($event.target as HTMLInputElement).value)"
            />
            <input
              type="text"
              :value="backgroundColor"
              class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500"
              placeholder="#ffffff"
              @input="emit('update:backgroundColor', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <p class="mt-2 text-[10px] leading-relaxed text-zinc-600">
            A imagem de fundo é escolhida no campo de upload acima e fica atrás de toda a composição.
          </p>
        </div>

        <div v-if="selectedElement" class="pt-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Elemento selecionado</p>
              <p class="mt-1 text-xs font-semibold text-zinc-100">{{ selectedLabel }}</p>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white" title="Duplicar" @click="duplicateSelected">
                <Copy class="h-3.5 w-3.5" />
              </button>
              <button type="button" class="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white" :title="selectedElement.locked ? 'Desbloquear' : 'Bloquear'" @click="toggleLock">
                <UnlockKeyhole v-if="selectedElement.locked" class="h-3.5 w-3.5" />
                <LockKeyhole v-else class="h-3.5 w-3.5" />
              </button>
              <button type="button" class="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-300" title="Excluir" :disabled="selectedElement.kind === 'product_zone' && productZoneCount <= 1" @click="removeSelected">
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2">
            <label v-for="field in [['x', 'X'], ['y', 'Y'], ['width', 'Largura'], ['height', 'Altura']]" :key="field[0]" class="text-[10px] text-zinc-500">
              {{ field[1] }} (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                :value="(selectedElement as any)[field[0] as 'x' | 'y' | 'width' | 'height']"
                class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500"
                @change="updateSelectedNumber(field[0] as 'x' | 'y' | 'width' | 'height', $event)"
              />
            </label>
          </div>

          <label class="mt-2 block text-[10px] text-zinc-500">
            Rotação (graus)
            <input
              type="number"
              min="-180"
              max="180"
              step="1"
              :value="selectedElement.rotation || 0"
              class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500"
              @change="updateSelectedNumber('rotation', $event)"
            />
          </label>

          <label v-if="selectedElement.kind === 'text' || (selectedElement.kind === 'image')" class="mt-2 block text-[10px] text-zinc-500">
            {{ selectedElement.kind === 'image' ? 'Chave ou URL da imagem' : 'Texto' }}
            <textarea
              v-if="selectedElement.kind === 'text'"
              :value="selectedElement.content || ''"
              rows="2"
              maxlength="1000"
              class="mt-1 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500"
              @input="updateSelectedContent"
            />
            <input
              v-else
              type="text"
              :value="selectedElement.content || ''"
              class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500"
              @input="updateSelectedContent"
            />
          </label>

          <div class="mt-3 grid grid-cols-2 gap-2">
            <label class="text-[10px] text-zinc-500">
              Cor do texto
              <div class="mt-1 flex gap-1">
                <input type="color" :value="selectedColor('color')" class="h-7 w-8 cursor-pointer rounded border border-zinc-700 bg-zinc-900" @input="updateSelectedStyle({ color: ($event.target as HTMLInputElement).value })" />
                <input type="text" :value="selectedStyle.color || ''" class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-[10px] text-white outline-none" @input="updateSelectedStyle({ color: ($event.target as HTMLInputElement).value })" />
              </div>
            </label>
            <label class="text-[10px] text-zinc-500">
              Fundo do elemento
              <div class="mt-1 flex gap-1">
                <input type="color" :value="selectedColor('backgroundColor')" class="h-7 w-8 cursor-pointer rounded border border-zinc-700 bg-zinc-900" @input="updateSelectedStyle({ backgroundColor: ($event.target as HTMLInputElement).value })" />
                <input type="text" :value="selectedStyle.backgroundColor || ''" class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 text-[10px] text-white outline-none" @input="updateSelectedStyle({ backgroundColor: ($event.target as HTMLInputElement).value })" />
              </div>
            </label>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2">
            <label class="text-[10px] text-zinc-500">
              Tamanho (cqw)
              <input type="number" min="0.4" max="20" step="0.1" :value="selectedStyle.fontSize || 2" class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500" @change="updateSelectedStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })" />
            </label>
            <label class="text-[10px] text-zinc-500">
              Peso
              <select :value="selectedStyle.fontWeight || 600" class="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-emerald-500" @change="updateSelectedStyle({ fontWeight: ($event.target as HTMLSelectElement).value })">
                <option value="400">Normal</option>
                <option value="600">Semibold</option>
                <option value="700">Bold</option>
                <option value="800">Extra bold</option>
              </select>
            </label>
          </div>

          <div class="mt-3 flex gap-1.5">
            <button type="button" class="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-300 hover:text-white" @click="sendToBack">Enviar para trás</button>
            <button type="button" class="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[10px] text-zinc-300 hover:text-white" @click="bringToFront">Trazer para frente</button>
          </div>
          <button type="button" class="mt-2 w-full rounded-md border border-zinc-800 px-2 py-1.5 text-[10px] text-zinc-500 hover:text-zinc-200" @click="toggleVisibility">
            {{ selectedElement.visible === false ? 'Exibir elemento' : 'Ocultar elemento' }}
          </button>
          <p v-if="selectedElement.kind === 'product_zone' && productZoneCount <= 1" class="mt-2 text-[10px] text-emerald-300/80">
            A zona de produtos é obrigatória para ativar a composição no cliente.
          </p>
        </div>
        <div v-else class="flex min-h-48 items-center justify-center text-center text-[11px] leading-relaxed text-zinc-600">
          Selecione um elemento<br />para ajustar posição e estilo.
        </div>
      </aside>
    </div>
  </section>
</template>
