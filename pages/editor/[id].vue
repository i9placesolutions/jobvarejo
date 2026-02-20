<script setup lang="ts">
import { onUnmounted, computed, defineAsyncComponent, watch } from 'vue'
import { useProject } from '~/composables/useProject'

const EditorCanvas = defineAsyncComponent(() => import('~/components/EditorCanvas.vue'))

// Get project ID from route
const route = useRoute()
const projectId = route.params.id as string

// Page config
definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false, // Desabilita SSR para evitar erros no servidor
})

// Use project composable
const { project, activePage, loadProjectDB, saveStatus, lastSavedAt, hasUnsavedChanges, triggerAutoSave, cancelAutoSave } = useProject()

let pageLoadToken = 0
watch(
  () => route.params.id,
  async (nextId) => {
    const id = String(nextId || '').trim()
    if (!id) return
    const token = ++pageLoadToken
    const loaded = await loadProjectDB(id)
    if (token !== pageLoadToken) return
    if (!loaded) {
      console.error('Failed to load project')
      await navigateTo('/')
    }
  },
  { immediate: true }
)

// Cancel auto-save on unmount
onUnmounted(() => {
  cancelAutoSave()
})

const savedClock = computed(() => {
  if (!lastSavedAt.value) return ''
  return lastSavedAt.value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
})

// Save status icon
const saveIcon = computed(() => {
  switch (saveStatus.value) {
    case 'saving':
      return `<svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>`
    case 'saved':
      return `<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>`
    case 'error':
      return `<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`
    default:
      return ''
  }
})

// Save status text
const saveText = computed(() => {
  switch (saveStatus.value) {
    case 'saving': return 'Salvando...'
    case 'saved': return 'Salvo'
    case 'error': return 'Falha ao salvar'
    default: return hasUnsavedChanges.value ? 'Alterações pendentes' : ''
  }
})

const saveSubtext = computed(() => {
  if (saveStatus.value !== 'saved') return ''
  return savedClock.value ? `as ${savedClock.value}` : ''
})

// Save status color
const saveColor = computed(() => {
  switch (saveStatus.value) {
    case 'saving': return 'text-[#2563eb]'
    case 'saved': return 'text-[#16a34a]'
    case 'error': return 'text-[#dc2626]'
    default: return hasUnsavedChanges.value ? 'text-[#b45309]' : 'text-[#7b6a58]'
  }
})
</script>

<template>
  <div class="h-screen flex flex-col bg-[#f8f5ee]">
    <!-- Project Name Header -->
    <div class="editor-page-topbar h-11 border-b flex items-center justify-between px-3.5 shrink-0">
      <div class="flex items-center gap-2">
        <button
          @click="navigateTo('/')"
          class="topbar-back-btn p-1.5 rounded-lg transition-colors"
          title="Voltar"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="text-sm font-semibold text-[#2f2419]">{{ activePage?.name || 'Sem título' }}</span>
      </div>

      <!-- Save Status Indicator -->
      <div class="flex items-center gap-2">
        <div :class="['save-status-chip flex items-center gap-1.5 text-[10px]', saveColor]">
          <span v-html="saveIcon"></span>
          <span>{{ saveText }}</span>
          <span v-if="saveSubtext" class="text-[#7b6a58]">{{ saveSubtext }}</span>
        </div>
        <span class="text-[10px] text-[#7b6a58]">Job Varejo Editor</span>
      </div>
    </div>

    <!-- Editor Canvas -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <ClientOnly>
        <EditorCanvas @auto-save="triggerAutoSave" />
        <template #fallback>
          <div class="flex items-center justify-center h-full text-[#7b6a58] bg-[#f8f5ee]">
            Carregando editor...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.editor-page-topbar {
  background: linear-gradient(180deg, #fffefb 0%, #fcf8f1 100%);
  border-color: #e8dccb;
}

.topbar-back-btn {
  color: #7b6a58;
}

.topbar-back-btn:hover {
  color: #2f2419;
  background: rgba(179, 38, 30, 0.1);
}

.save-status-chip {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(232, 220, 203, 0.95);
  background: rgba(255, 255, 255, 0.82);
}
</style>
