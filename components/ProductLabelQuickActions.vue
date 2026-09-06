<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, ChevronDown, ListChecks, MousePointer2, Move, Tag } from 'lucide-vue-next'

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
  (e: 'template', templateId: string): void
  (e: 'manage-templates'): void
}>()

const templateMenuOpen = ref(false)

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
  top: `${Math.max(4, Math.round((Number(props.top) || 0) - 2))}px`,
  left: `${Math.round(Number(props.left) || 0)}px`
}))

const selectTemplate = (templateId: string) => {
  templateMenuOpen.value = false
  if (templateId) emit('template', templateId)
}

watch(() => props.visible, (visible) => {
  if (!visible) templateMenuOpen.value = false
})
</script>

<template>
  <div
    v-if="visible"
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
      class="pointer-events-auto absolute w-60 max-w-[calc(100vw-20px)] overflow-hidden rounded-lg border border-white/15 bg-[#18181b]/98 p-1.5 shadow-2xl backdrop-blur-md"
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
