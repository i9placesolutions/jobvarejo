<script setup lang="ts">
import { formatHistoryDateTime, formatHistoryRelative } from '~/utils/dateTimeFormat'
import { getHistoryRestoreKey, historyItemIsLatest as historyItemIsLatestHelper } from '~/utils/pageHistoryHelpers'
import type { PageHistoryItem } from '~/utils/pageHistoryHelpers'

const props = defineProps<{
  show: boolean
  loading: boolean
  error: string
  items: PageHistoryItem[]
  restoringKey: string
}>()

const emit = defineEmits<{
  close: []
  restore: [item: PageHistoryItem]
}>()

const isLatest = (idx: number) => historyItemIsLatestHelper(idx, props.items)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 z-(--z-modal) flex items-center justify-center">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="emit('close')" />

        <div class="relative w-[min(520px,92vw)] max-h-[85vh] flex flex-col rounded-2xl border border-white/8 bg-zinc-900/95 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.7)] overflow-hidden">
          <div class="flex items-center gap-3 px-5 pt-5 pb-4">
            <div class="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/15 shrink-0">
              <svg class="w-4.5 h-4.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-[15px] font-semibold text-white/95 leading-tight tracking-[-0.01em]">Historico da pagina</h3>
              <p class="text-[12px] text-white/45 mt-0.5">Restaure uma versao anterior</p>
            </div>
            <button
              type="button"
              class="flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/6 transition-all duration-150"
              @click="emit('close')"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-5 pb-5 min-h-0">
            <div v-if="loading" class="flex flex-col items-center justify-center py-12 gap-3">
              <div class="w-8 h-8 rounded-full border-2 border-white/10 border-t-violet-400 animate-spin" />
              <p class="text-[13px] text-white/50">Carregando versoes...</p>
            </div>

            <div v-else-if="error" class="flex flex-col items-center justify-center py-10 gap-2">
              <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
                <svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p class="text-[13px] text-red-300/90 text-center max-w-70">{{ error }}</p>
            </div>

            <div v-else-if="!items.length" class="flex flex-col items-center justify-center py-10 gap-2">
              <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-white/4">
                <svg class="w-5 h-5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <p class="text-[13px] text-white/40">Nenhuma versao salva ainda</p>
              <p class="text-[11px] text-white/25 max-w-60 text-center">Versoes sao salvas automaticamente quando voce edita o projeto.</p>
            </div>

            <div v-else class="flex flex-col gap-2">
              <div
                v-for="(it, idx) in items"
                :key="`${it.source}:${it.key}:${it.versionId || ''}:${it.lastModified}`"
                class="group relative flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-all duration-150"
                :class="((it as any).source === 'current' || isLatest(idx)) ? 'bg-violet-500/[0.07] border-violet-500/20 hover:border-violet-500/35' : 'bg-white/2 border-white/6 hover:bg-white/4 hover:border-white/12'"
              >
                <div class="flex flex-col items-center self-stretch shrink-0">
                  <div
                    class="w-2.5 h-2.5 rounded-full mt-0.5 ring-[3px] shrink-0"
                    :class="((it as any).source === 'current' || isLatest(idx)) ? 'bg-violet-400 ring-violet-400/20' : 'bg-white/20 ring-white/6'"
                  />
                  <div v-if="idx < items.length - 1" class="w-px flex-1 mt-1 bg-white/6" />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-[13px] font-medium text-white/90 leading-tight">
                      {{ formatHistoryDateTime(it.lastModified) }}
                    </p>
                    <span
                      v-if="(it as any).source === 'current'"
                      class="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 leading-relaxed"
                    >Versao atual</span>
                    <span
                      v-else-if="isLatest(idx)"
                      class="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium bg-violet-500/20 text-violet-300 leading-relaxed"
                    >Mais recente</span>
                  </div>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span class="text-[11px] text-white/35">{{ formatHistoryRelative(it.lastModified) }}</span>
                    <span v-if="it.objectCount != null" class="text-[11px] text-white/20">&#183;</span>
                    <span v-if="it.objectCount != null" class="text-[11px] text-white/35">{{ it.objectCount }} objetos</span>
                    <span v-if="it.size != null" class="text-[11px] text-white/20">&#183;</span>
                    <span v-if="it.size != null" class="text-[11px] text-white/35">{{ Math.max(1, Math.round((it.size || 0) / 1024)) }} KB</span>
                  </div>
                </div>

                <button
                  type="button"
                  class="shrink-0 flex items-center gap-1.5 text-[12px] font-medium px-3.5 py-2 rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  :class="restoringKey === getHistoryRestoreKey(it as any)
                    ? 'bg-violet-500/20 text-violet-300 cursor-wait'
                    : 'bg-white/6 text-white/70 hover:bg-violet-500/15 hover:text-violet-200 active:scale-[0.97]'"
                  :disabled="!!restoringKey"
                  @click="emit('restore', it as any)"
                >
                  <svg v-if="restoringKey === getHistoryRestoreKey(it as any)" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {{ restoringKey === getHistoryRestoreKey(it as any) ? 'Restaurando...' : 'Restaurar' }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="!loading && !error && items.length" class="px-5 py-3 border-t border-white/6 bg-white/2">
            <p class="text-[11px] text-white/30 text-center">
              Ate {{ 3 }} versoes salvas automaticamente por pagina
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
