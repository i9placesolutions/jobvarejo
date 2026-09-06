<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, Copy, ImagePlus, Minus, Plus, Tag } from 'lucide-vue-next'

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
  templates?: TemplateOption[]
  selectedTemplateId?: string
  fillCount?: number
  fillDirection?: string
}>(), {
  templates: () => [],
  selectedTemplateId: ''
})

const emit = defineEmits<{
  (e: 'duplicate'): void
  (e: 'replace'): void
  (e: 'fill', count: number, direction?: string): void
  (e: 'resize', direction: 'smaller' | 'larger'): void
  (e: 'template', templateId: string): void
  (e: 'manage-templates'): void
}>()

const templateMenuOpen = ref(false)

const toolbarStyle = computed(() => {
  const toolbarWidth = 340
  const width = Math.max(0, Number(props.width) || 0)
  const left = Number(props.left) || 0
  const top = Number(props.top) || 0
  const centeredLeft = left + Math.max(0, (width - toolbarWidth) / 2)
  return {
    // Keep the image controls visibly attached to the top edge of the image,
    // matching the label controls and avoiding a toolbar hidden over the card.
    top: `${Math.round(Math.max(4, top - 34))}px`,
    left: `${Math.round(Math.max(4, centeredLeft))}px`
  }
})

const templateMenuStyle = computed(() => ({
  top: `${Math.round((Number(props.top) || 0) + 34)}px`,
  left: `${Math.round((Number(props.left) || 0) + 6)}px`
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
    class="pointer-events-none absolute inset-0 z-[116]"
    @keydown.esc="templateMenuOpen = false"
  >
    <div
      class="pointer-events-auto absolute inline-flex items-center gap-0.5 rounded-lg border border-white/15 bg-[#18181b]/95 p-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.42)] backdrop-blur-md"
      :style="toolbarStyle"
      @mousedown.stop
      @click.stop
    >
      <button type="button" class="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-white hover:bg-white/10"
        title="Trocar imagem e suas cópias neste produto" @click="emit('replace')">
        <ImagePlus class="h-3.5 w-3.5" /> Substituir imagem
      </button>
      <select aria-label="Preenchimento de imagens" :value="fillCount ?? 1" class="max-w-28 rounded bg-zinc-800 text-white text-[10px] p-1" @change="emit('fill', Number(($event.target as HTMLSelectElement).value), fillDirection)">
        <option value="0">Automático</option>
        <option value="1">Só 1 imagem</option>
        <option value="2">2 imagens</option>
        <option value="3">3 imagens</option>
        <option value="4">4 imagens</option>
      </select>
      <select aria-label="Disposição das imagens" :value="fillDirection || 'auto'"
        class="max-w-28 rounded bg-zinc-800 text-white text-[10px] p-1"
        @change="emit('fill', fillCount === 1 ? 0 : (fillCount ?? 0), ($event.target as HTMLSelectElement).value)">
        <option value="auto">Disposição auto</option>
        <option value="horizontal">Lado a lado</option>
        <option value="vertical">Empilhado</option>
      </select>
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/75 transition hover:bg-violet-500/25 hover:text-white active:bg-violet-500/40"
        title="Duplicar imagem"
        aria-label="Duplicar imagem"
        @click="emit('duplicate')"
      >
        <Copy class="h-3 w-3" />
      </button>

      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/75 transition hover:bg-violet-500/25 hover:text-white active:bg-violet-500/40"
        title="Trocar etiqueta de preço"
        aria-label="Trocar etiqueta de preço"
        :aria-expanded="templateMenuOpen"
        @click="templateMenuOpen = !templateMenuOpen"
      >
        <Tag class="h-3 w-3" />
        <ChevronDown class="-ml-1 h-2 w-2" />
      </button>

      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/75 transition hover:bg-white/10 hover:text-white active:bg-white/20"
        title="Reduzir imagem"
        aria-label="Reduzir imagem"
        @click="emit('resize', 'smaller')"
      >
        <Minus class="h-3 w-3" />
      </button>

      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded-md text-white/75 transition hover:bg-white/10 hover:text-white active:bg-white/20"
        title="Aumentar imagem"
        aria-label="Aumentar imagem"
        @click="emit('resize', 'larger')"
      >
        <Plus class="h-3 w-3" />
      </button>
    </div>

    <div
      v-if="templateMenuOpen"
      class="pointer-events-auto absolute w-64 max-w-[calc(100vw-20px)] overflow-hidden rounded-xl border border-white/15 bg-[#18181b]/98 p-1.5 shadow-2xl backdrop-blur-md"
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
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-white/75 transition hover:bg-white/10 hover:text-white"
        :class="template.id === selectedTemplateId ? 'bg-violet-500/20 text-violet-100' : ''"
        role="menuitem"
        @click="selectTemplate(template.id)"
      >
        <span class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/10">
          <img
            v-if="template.previewDataUrl"
            :src="template.previewDataUrl"
            :alt="`Prévia da etiqueta ${template.name}`"
            class="h-full w-full object-contain"
          >
          <Tag v-else class="h-3.5 w-3.5 text-white/45" />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ template.name }}</span>
        <span v-if="template.id === selectedTemplateId" class="text-[10px] text-violet-300">Atual</span>
      </button>

      <button
        v-if="!templates.length"
        type="button"
        class="mt-1 flex w-full items-center justify-center rounded-lg border border-white/10 px-2 py-2 text-[11px] text-white/65 transition hover:bg-white/10 hover:text-white"
        @click="emit('manage-templates')"
      >
        Abrir biblioteca de etiquetas
      </button>
    </div>
  </div>
</template>
