<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, ChevronDown, DollarSign, ListChecks, MousePointer2, Move, Tag } from 'lucide-vue-next'

type LabelInteractionMode = 'move' | 'edit'

type TemplateOption = {
  id: string
  name: string
  previewDataUrl?: string
}

const props = withDefaults(defineProps<{
  visible: boolean
  top: number
  left: number
  width: number
  height: number
  mode?: LabelInteractionMode
  templates?: TemplateOption[]
  selectedTemplateId?: string
}>(), {
  mode: 'move',
  templates: () => [],
  selectedTemplateId: ''
})

const emit = defineEmits<{
  (e: 'mode', mode: LabelInteractionMode): void
  (e: 'select-all'): void
  (e: 'edit-price'): void
  (e: 'template', templateId: string): void
  (e: 'manage-templates'): void
}>()

const rootEl = ref<HTMLElement | null>(null)
const templateMenuEl = ref<HTMLElement | null>(null)
const templateMenuOpen = ref(false)
const templateMenuReady = ref(false)
const templateMenuPlacement = ref({
  top: 4,
  left: 4,
  maxHeight: 320
})

const MENU_EDGE_GAP = 8
const MENU_MIN_HEIGHT = 160
const TOOLBAR_WIDTH = 132
const TOOLBAR_OFFSET_TOP = 34

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

const repositionTemplateMenu = async () => {
  if (!templateMenuOpen.value || !rootEl.value) {
    templateMenuReady.value = false
    return
  }

  await nextTick()

  const host = rootEl.value
  const menu = templateMenuEl.value
  if (!menu) return

  const hostRect = host.getBoundingClientRect()
  const hostWidth = Math.max(0, Number(host.clientWidth || hostRect.width || 0))
  const hostHeight = Math.max(0, Number(host.clientHeight || hostRect.height || 0))
  if (hostWidth <= 0 || hostHeight <= 0) return

  const menuWidth = Math.min(
    Math.max(180, Number(menu.offsetWidth || 240)),
    Math.max(180, hostWidth - (MENU_EDGE_GAP * 2))
  )
  const menuHeight = Math.max(MENU_MIN_HEIGHT, Number(menu.offsetHeight || 320))
  const selectionLeft = Number(props.left) || 0
  const selectionTop = Number(props.top) || 0
  const selectionWidth = Math.max(0, Number(props.width) || 0)
  const selectionHeight = Math.max(0, Number(props.height) || 0)
  const toolbarLeft = selectionLeft + Math.max(0, (selectionWidth - TOOLBAR_WIDTH) / 2)
  const toolbarTop = Math.max(MENU_EDGE_GAP, selectionTop - TOOLBAR_OFFSET_TOP)

  type Candidate = {
    top: number
    left: number
    availableHeight: number
  }

  const candidates: Candidate[] = [
    // Keep the menu beside the selected label whenever possible. This avoids
    // hiding the label and the next product card, which was the reported bug.
    {
      top: toolbarTop,
      left: selectionLeft + selectionWidth + MENU_EDGE_GAP,
      availableHeight: hostHeight - toolbarTop - MENU_EDGE_GAP
    },
    {
      top: toolbarTop,
      left: toolbarLeft - menuWidth - MENU_EDGE_GAP,
      availableHeight: hostHeight - toolbarTop - MENU_EDGE_GAP
    },
    {
      top: selectionTop + selectionHeight + MENU_EDGE_GAP,
      left: selectionLeft,
      availableHeight: hostHeight - selectionTop - selectionHeight - (MENU_EDGE_GAP * 2)
    },
    {
      top: selectionTop - menuHeight - MENU_EDGE_GAP,
      left: selectionLeft,
      availableHeight: selectionTop - (MENU_EDGE_GAP * 2)
    }
  ]

  const fitsHorizontally = (candidate: Candidate) => (
    candidate.left >= MENU_EDGE_GAP && candidate.left + menuWidth <= hostWidth - MENU_EDGE_GAP
  )
  const hasUsefulHeight = (candidate: Candidate) => candidate.availableHeight >= MENU_MIN_HEIGHT
  const chosen: Candidate = candidates.find((candidate) => fitsHorizontally(candidate) && hasUsefulHeight(candidate))
    || candidates.find((candidate) => fitsHorizontally(candidate))
    || candidates[0]!

  const maxLeft = Math.max(MENU_EDGE_GAP, hostWidth - menuWidth - MENU_EDGE_GAP)
  const maxHeight = Math.max(MENU_MIN_HEIGHT, Math.min(menuHeight, chosen.availableHeight))
  templateMenuPlacement.value = {
    top: clamp(chosen.top, MENU_EDGE_GAP, Math.max(MENU_EDGE_GAP, hostHeight - maxHeight - MENU_EDGE_GAP)),
    left: clamp(chosen.left, MENU_EDGE_GAP, maxLeft),
    maxHeight
  }
  templateMenuReady.value = true
}

const toolbarStyle = computed(() => {
  const toolbarWidth = 132
  const width = Math.max(0, Number(props.width) || 0)
  const left = Number(props.left) || 0
  const top = Number(props.top) || 0
  return {
    top: `${Math.max(4, Math.round(top - 34))}px`,
    left: `${Math.round(left + Math.max(0, (width - toolbarWidth) / 2))}px`
  }
})

const templateMenuStyle = computed(() => ({
  top: `${Math.round(templateMenuPlacement.value.top)}px`,
  left: `${Math.round(templateMenuPlacement.value.left)}px`,
  maxHeight: `${Math.round(templateMenuPlacement.value.maxHeight)}px`,
  visibility: templateMenuReady.value ? ('visible' as const) : ('hidden' as const)
}))

const selectTemplate = (templateId: string) => {
  templateMenuOpen.value = false
  templateMenuReady.value = false
  if (templateId) emit('template', templateId)
}

watch(() => props.visible, (visible) => {
  if (!visible) {
    templateMenuOpen.value = false
    templateMenuReady.value = false
  }
})

watch(
  [templateMenuOpen, () => props.top, () => props.left, () => props.width, () => props.height, () => props.templates?.length || 0],
  () => {
    if (!templateMenuOpen.value) return
    templateMenuReady.value = false
    void repositionTemplateMenu()
  },
  { flush: 'post' }
)
</script>

<template>
  <div
    v-if="visible"
    ref="rootEl"
    class="pointer-events-none absolute inset-0 z-[117]"
    @keydown.esc="templateMenuOpen = false"
  >
    <div
      class="pointer-events-auto absolute inline-flex items-center gap-0.5 rounded-lg border border-white/15 bg-[#18181b]/95 p-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.42)] backdrop-blur-md"
      :style="toolbarStyle"
      @mousedown.stop
      @click.stop
    >
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/65 transition hover:bg-violet-500/25 hover:text-white active:bg-violet-500/40"
        :class="mode === 'move' ? 'bg-violet-500/30 text-violet-100' : ''"
        title="Mover a etiqueta inteira"
        aria-label="Mover a etiqueta inteira"
        :aria-pressed="mode === 'move'"
        @click="emit('mode', 'move')"
      >
        <Move class="h-3 w-3" />
      </button>

      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/65 transition hover:bg-violet-500/25 hover:text-white active:bg-violet-500/40"
        :class="mode === 'edit' ? 'bg-violet-500/30 text-violet-100' : ''"
        title="Editar elementos da etiqueta"
        aria-label="Editar elementos da etiqueta"
        :aria-pressed="mode === 'edit'"
        @click="emit('mode', 'edit')"
      >
        <MousePointer2 class="h-3 w-3" />
      </button>

      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/65 transition hover:bg-emerald-500/25 hover:text-emerald-100 active:bg-emerald-500/40"
        title="Selecionar tudo na etiqueta"
        aria-label="Selecionar tudo na etiqueta"
        @click="emit('select-all')"
      >
        <ListChecks class="h-3 w-3" />
      </button>

      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/65 transition hover:bg-emerald-500/25 hover:text-emerald-100 active:bg-emerald-500/40"
        title="Editar preços deste produto"
        aria-label="Editar preços deste produto"
        @click="emit('edit-price')"
      >
        <DollarSign class="h-3 w-3" />
      </button>

      <span class="mx-0.5 h-4 w-px bg-white/10" aria-hidden="true" />

      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/65 transition hover:bg-amber-500/25 hover:text-amber-100 active:bg-amber-500/40"
        title="Trocar etiqueta de preço"
        aria-label="Trocar etiqueta de preço"
        :aria-expanded="templateMenuOpen"
        @click="templateMenuOpen = !templateMenuOpen"
      >
        <Tag class="h-3 w-3" />
        <ChevronDown class="-ml-1 h-2 w-2" />
      </button>
    </div>

    <div
      v-if="templateMenuOpen"
      ref="templateMenuEl"
      class="pointer-events-auto absolute w-60 max-w-[calc(100vw-20px)] overflow-y-auto overflow-x-hidden rounded-lg border border-white/15 bg-[#18181b]/98 p-1.5 shadow-2xl backdrop-blur-md"
      :style="templateMenuStyle"
      role="menu"
      @mousedown.stop
      @click.stop
    >
      <div class="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
        Etiqueta do card
      </div>

      <button
        v-for="template in templates"
        :key="template.id"
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-white/75 transition hover:bg-white/10 hover:text-white"
        :class="template.id === selectedTemplateId ? 'bg-violet-500/20 text-violet-100' : ''"
        role="menuitem"
        @click="selectTemplate(template.id)"
      >
        <span class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/10">
          <img
            v-if="template.previewDataUrl"
            :src="template.previewDataUrl"
            :alt="`Prévia da etiqueta ${template.name}`"
            class="h-full w-full object-contain"
          >
          <Tag v-else class="h-3 w-3 text-white/45" />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ template.name }}</span>
        <Check v-if="template.id === selectedTemplateId" class="h-3 w-3 shrink-0 text-violet-300" />
      </button>

      <button
        v-if="!templates.length"
        type="button"
        class="mt-1 flex w-full items-center justify-center rounded-md border border-white/10 px-2 py-2 text-[11px] text-white/65 transition hover:bg-white/10 hover:text-white"
        @click="emit('manage-templates')"
      >
        Abrir biblioteca de etiquetas
      </button>
    </div>
  </div>
</template>
