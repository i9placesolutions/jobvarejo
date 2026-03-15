<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, defineAsyncComponent, watch } from 'vue'
import { useProject } from '~/composables/useProject'
import { useApiAuth } from '~/composables/useApiAuth'
import { useResponsive } from '~/composables/useResponsive'

const EditorCanvas = defineAsyncComponent(() => import('~/components/EditorCanvas.vue'))
const { isMobile } = useResponsive()

// Get project ID from route
const route = useRoute()
const projectId = route.params.id as string
const runtimeConfig = useRuntimeConfig()

// Page config
definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false, // Desabilita SSR para evitar erros no servidor
})

// Use project composable
const {
  project,
  activePage,
  isProjectLoaded,
  loadProjectDB,
  saveProjectDB,
  saveStatus,
  saveLastError,
  saveDebugStage,
  lastSavedAt,
  hasUnsavedChanges,
  triggerAutoSave,
  cancelAutoSave,
  projectServerUpdatedAt,
  realtimeClientId
} = useProject()

const realtimeStatus = ref<'idle' | 'connecting' | 'connected' | 'error'>('idle')
const remoteUpdatePending = ref(false)
const realtimeForcePolling = ref(false)
const { getApiAuthHeaders } = useApiAuth()
let realtimeEventSource: EventSource | null = null
let realtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null
let realtimePollTimer: ReturnType<typeof setTimeout> | null = null
let visibilityHandler: (() => void) | null = null

const isGithubPreviewHost = (): boolean => {
  if (typeof window === 'undefined') return false
  const hostname = String(window.location.hostname || '').trim().toLowerCase()
  return hostname.endsWith('.app.github.dev') || hostname.endsWith('.github.dev')
}

const getConfiguredRealtimeTransport = (): 'auto' | 'sse' | 'poll' => {
  const rawValue = String(runtimeConfig.public?.projectRealtimeTransport || 'auto').trim().toLowerCase()
  if (rawValue === 'sse' || rawValue === 'poll') return rawValue
  return 'auto'
}

const shouldUsePollingRealtime = (): boolean => {
  if (realtimeForcePolling.value) return true
  if (isGithubPreviewHost()) return true
  return getConfiguredRealtimeTransport() === 'poll'
}

const getIsoTimeMs = (value: string | null | undefined): number => {
  const timestamp = Date.parse(String(value || '').trim())
  return Number.isFinite(timestamp) ? timestamp : 0
}

const closeProjectRealtime = () => {
  if (realtimeRefreshTimer) {
    clearTimeout(realtimeRefreshTimer)
    realtimeRefreshTimer = null
  }
  if (realtimePollTimer) {
    clearTimeout(realtimePollTimer)
    realtimePollTimer = null
  }
  if (realtimeEventSource) {
    realtimeEventSource.close()
    realtimeEventSource = null
  }
  realtimeStatus.value = 'idle'
}

const activateRealtimePolling = (id: string, delayMs = 20_000) => {
  const projectId = String(id || '').trim()
  if (!projectId) return
  closeProjectRealtime()
  realtimeStatus.value = 'connected'
  scheduleRealtimePoll(projectId, delayMs)
}

const fetchProjectRevision = async (id: string): Promise<string | null> => {
  const projectId = String(id || '').trim()
  if (!projectId) return null

  try {
    const headers = await getApiAuthHeaders()
    const response = await $fetch<{ updated_at?: string | null }>('/api/projects/revision', {
      headers,
      query: { id: projectId }
    })
    const updatedAt = String(response?.updated_at || '').trim()
    return updatedAt || null
  } catch {
    return null
  }
}

const scheduleRemoteReload = (id: string) => {
  if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer)
  realtimeRefreshTimer = setTimeout(async () => {
    realtimeRefreshTimer = null
    const loaded = await loadProjectDB(id)
    if (loaded) remoteUpdatePending.value = false
  }, 450)
}

const scheduleRealtimePoll = (id: string, delayMs = 20_000) => {
  if (realtimePollTimer) {
    clearTimeout(realtimePollTimer)
    realtimePollTimer = null
  }

  const projectId = String(id || '').trim()
  if (!projectId) return

  realtimePollTimer = setTimeout(async () => {
    realtimePollTimer = null

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      scheduleRealtimePoll(projectId, delayMs)
      return
    }

    const latestUpdatedAt = await fetchProjectRevision(projectId)
    if (latestUpdatedAt) {
      const knownUpdatedAt = getIsoTimeMs(projectServerUpdatedAt.value)
      const remoteUpdatedAt = getIsoTimeMs(latestUpdatedAt)

      if (remoteUpdatedAt > knownUpdatedAt) {
        if (hasUnsavedChanges.value) {
          remoteUpdatePending.value = true
        } else {
          scheduleRemoteReload(projectId)
        }
      }
    }

    scheduleRealtimePoll(projectId, delayMs)
  }, delayMs)
}

const handleRealtimeProjectChange = (rawPayload: string) => {
  try {
    const payload = JSON.parse(String(rawPayload || '{}')) as Record<string, any>
    const changedProjectId = String(payload?.projectId || payload?.project_id || '').trim()
    const activeRouteProjectId = String(route.params.id || '').trim()
    if (!changedProjectId || !activeRouteProjectId || changedProjectId !== activeRouteProjectId) return

    if (hasUnsavedChanges.value) {
      remoteUpdatePending.value = true
      return
    }

    scheduleRemoteReload(changedProjectId)
  } catch {
    // ignore malformed payloads
  }
}

const openProjectRealtime = (id: string) => {
  if (typeof window === 'undefined') return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  const projectId = String(id || '').trim()
  if (!projectId) return

  closeProjectRealtime()
  realtimeStatus.value = 'connecting'

  if (shouldUsePollingRealtime()) {
    activateRealtimePolling(projectId)
    return
  }

  const params = new URLSearchParams({
    id: projectId,
    client_id: String(realtimeClientId.value || '')
  })
  const es = new EventSource(`/api/projects/realtime?${params.toString()}`)

  es.onopen = () => {
    realtimeStatus.value = 'connected'
  }
  es.onerror = () => {
    realtimeStatus.value = 'error'
    realtimeForcePolling.value = true
    activateRealtimePolling(projectId, 10_000)
  }
  es.addEventListener('connected', () => {
    realtimeStatus.value = 'connected'
  })
  es.addEventListener('project-change', (evt) => {
    const data = (evt as MessageEvent).data
    handleRealtimeProjectChange(typeof data === 'string' ? data : '')
  })

  realtimeEventSource = es
}

const applyRemoteUpdate = async () => {
  const id = String(route.params.id || '').trim()
  if (!id) return
  const loaded = await loadProjectDB(id)
  if (loaded) {
    remoteUpdatePending.value = false
  }
}

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
      closeProjectRealtime()
      console.error('Failed to load project')
      await navigateTo('/')
      return
    }
    openProjectRealtime(id)
  },
  { immediate: true }
)

// Cancel auto-save on unmount
onUnmounted(() => {
  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
  if (_savingTimer) { clearInterval(_savingTimer); _savingTimer = null }
  closeProjectRealtime()
  cancelAutoSave()
})

onMounted(() => {
  visibilityHandler = () => {
    const id = String(route.params.id || '').trim()
    if (!id) return
    if (document.visibilityState === 'hidden') {
      closeProjectRealtime()
      return
    }
    openProjectRealtime(id)
  }
  document.addEventListener('visibilitychange', visibilityHandler)
})

const savedClock = computed(() => {
  if (!lastSavedAt.value) return ''
  return lastSavedAt.value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
})

// Elapsed seconds counter while saving
const savingSeconds = ref(0)
let _savingTimer: ReturnType<typeof setInterval> | null = null

watch(saveStatus, (status) => {
  if (status === 'saving') {
    savingSeconds.value = 0
    if (!_savingTimer) {
      _savingTimer = setInterval(() => { savingSeconds.value++ }, 1000)
    }
  } else {
    if (_savingTimer) { clearInterval(_savingTimer); _savingTimer = null }
    savingSeconds.value = 0
  }
})

const retryingSave = ref(false)
const retrySave = async () => {
  if (retryingSave.value) return
  retryingSave.value = true
  saveLastError.value = null
  try { await saveProjectDB() } finally { retryingSave.value = false }
}

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
    case 'saving':
      if (savingSeconds.value >= 8) {
        return saveStageLabel.value && savingSeconds.value >= 12
          ? `Salvando... ${savingSeconds.value}s · ${saveStageLabel.value}`
          : `Salvando... ${savingSeconds.value}s`
      }
      return saveStageLabel.value && savingSeconds.value >= 4
        ? `Salvando... ${saveStageLabel.value}`
        : 'Salvando...'
    case 'saved': return 'Salvo'
    case 'error': return 'Falha ao salvar'
    default: return hasUnsavedChanges.value ? 'Não salvo' : ''
  }
})

const saveStageLabel = computed(() => {
  const raw = String(saveDebugStage.value || '').trim()
  if (!raw || raw === 'idle') return ''
  if (raw.startsWith('upload-thumbnail:')) return 'miniatura'
  if (raw.startsWith('upload-canvas:')) return 'canvas'
  if (raw.startsWith('persist-project:')) return 'banco'
  if (raw === 'prepare-db-payload') return 'preparando'
  if (raw === 'prepare-request') return 'autenticando'
  if (raw === 'finalize') return 'finalizando'
  if (raw === 'preflight') return 'iniciando'
  return raw
})

const saveSubtext = computed(() => {
  if (saveStatus.value !== 'saved') return ''
  return savedClock.value ? `às ${savedClock.value}` : ''
})

const showRetryButton = computed(() =>
  saveStatus.value === 'error' || (saveStatus.value === 'saving' && savingSeconds.value >= 45)
)

// Save status color
const saveColor = computed(() => {
  switch (saveStatus.value) {
    case 'saving': return savingSeconds.value >= 20 ? 'text-amber-400' : 'text-blue-400'
    case 'saved': return 'text-emerald-400'
    case 'error': return 'text-red-400'
    default: return hasUnsavedChanges.value ? 'text-amber-400' : 'text-zinc-500'
  }
})

const openPageHistory = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('editor:open-page-history'))
}
</script>

<template>
  <ClientOnly>
  <div class="h-screen flex flex-col bg-[#0f0f0f]">
    <!-- Project Name Header -->
    <div class="h-8 border-b border-white/5 flex items-center justify-between px-3 bg-[#1e1e1e] shrink-0 safe-top">
      <div class="flex items-center gap-2 min-w-0">
        <button
          @click="navigateTo('/')"
          class="p-1 hover:bg-white/5 rounded transition-colors text-zinc-400 hover:text-white shrink-0"
          title="Voltar"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span class="text-xs font-medium text-white truncate">{{ activePage?.name || 'Sem título' }}</span>
      </div>

      <!-- Save Status Indicator -->
      <div class="flex items-center gap-1.5 shrink-0">

        <!-- Status pill -->
        <div :class="['save-pill flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-300', saveColor,
          saveStatus === 'saving' ? 'bg-blue-500/8' : '',
          saveStatus === 'saved' ? 'bg-emerald-500/8' : '',
          saveStatus === 'error' ? 'bg-red-500/8' : '',
          (saveStatus === 'idle' && hasUnsavedChanges) ? 'bg-amber-500/8' : '',
        ]">
          <span v-html="saveIcon" class="shrink-0"></span>
          <span>{{ saveText }}</span>
          <span v-if="saveSubtext && !isMobile" class="text-zinc-500 font-normal">{{ saveSubtext }}</span>
        </div>

        <!-- Retry button — aparece em erro ou saving travado (>45s) -->
        <button
          v-if="showRetryButton"
          type="button"
          :disabled="retryingSave"
          class="save-retry-btn flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-white/5 active:scale-95 transition-all duration-150 disabled:opacity-40"
          :title="saveLastError || 'Tentar salvar novamente'"
          @click="retrySave"
        >
          <svg class="w-2.5 h-2.5 shrink-0" :class="retryingSave ? 'animate-spin' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span v-if="!isMobile">Tentar novamente</span>
        </button>

        <!-- Remote update pending -->
        <button
          v-if="remoteUpdatePending"
          type="button"
          class="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/25 text-amber-300 hover:text-amber-200 hover:border-amber-400/40 hover:bg-amber-500/8 transition-all duration-150"
          @click="applyRemoteUpdate"
        >
          <span v-if="isMobile">Atualizar</span>
          <span v-else>Atualização disponível</span>
        </button>

        <template v-if="!isMobile">
          <div class="w-px h-3 bg-white/8 mx-0.5"></div>

          <button
            type="button"
            class="text-[10px] px-2 py-0.5 rounded-full border border-white/8 text-zinc-500 hover:text-zinc-300 hover:border-white/15 hover:bg-white/4 transition-all duration-150"
            @click="openPageHistory"
          >
            Histórico
          </button>
          <span class="text-[10px] text-zinc-600 pl-0.5">Studio PRO</span>
        </template>
      </div>
    </div>

    <!-- Editor Canvas -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <ClientOnly>
        <template v-if="isProjectLoaded">
          <EditorCanvas @auto-save="triggerAutoSave" />
        </template>
        <template v-else>
          <div class="flex flex-col items-center justify-center h-full gap-3">
            <div class="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
            <span class="text-sm text-zinc-400">Carregando projeto...</span>
          </div>
        </template>
        <template #fallback>
          <div class="flex flex-col items-center justify-center h-full gap-3">
            <div class="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
            <span class="text-sm text-zinc-400">Carregando editor...</span>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
  <template #fallback>
    <div class="h-screen bg-[#0f0f0f] flex flex-col items-center justify-center gap-3">
      <div class="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
    </div>
  </template>
  </ClientOnly>
</template>

<style scoped>
/* Save pill — subtle fade between states */
.save-pill {
  transition: color 0.3s ease, background-color 0.3s ease;
}

/* Retry button — pop in */
.save-retry-btn {
  animation: save-btn-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes save-btn-pop {
  from { opacity: 0; transform: scale(0.85) translateX(4px); }
  to   { opacity: 1; transform: scale(1) translateX(0); }
}
</style>
