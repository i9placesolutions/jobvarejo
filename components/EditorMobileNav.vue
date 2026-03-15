<script setup lang="ts">
/**
 * Barra de navegação fixa no fundo para editor mobile.
 * 5 botões: Ferramentas, Camadas, Propriedades, Páginas, Mais.
 */
import { MousePointer2, Layers, SlidersHorizontal, FileText, MoreHorizontal } from 'lucide-vue-next'

const emit = defineEmits<{
  'open-panel': [panel: string]
}>()

const activePanel = ref<string | null>(null)

const toggle = (panel: string) => {
  if (activePanel.value === panel) {
    activePanel.value = null
    return
  }
  activePanel.value = panel
  emit('open-panel', panel)
}

const buttons = [
  { id: 'tools', label: 'Ferramentas', icon: MousePointer2 },
  { id: 'layers', label: 'Camadas', icon: Layers },
  { id: 'properties', label: 'Propriedades', icon: SlidersHorizontal },
  { id: 'pages', label: 'Páginas', icon: FileText },
  { id: 'more', label: 'Mais', icon: MoreHorizontal }
]

// Limpar active quando o painel fecha externamente
defineExpose({
  clearActive: () => { activePanel.value = null }
})
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 z-[9990] bg-[#18181b]/95 backdrop-blur-md border-t border-white/10 safe-bottom">
    <nav class="flex items-center justify-around h-14">
      <button
        v-for="btn in buttons"
        :key="btn.id"
        class="touch-target flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors"
        :class="activePanel === btn.id ? 'text-violet-400' : 'text-white/50 active:text-white/80'"
        @click="toggle(btn.id)"
      >
        <component :is="btn.icon" :size="20" :stroke-width="1.8" />
        <span class="text-[10px] leading-tight">{{ btn.label }}</span>
      </button>
    </nav>
  </div>
</template>
