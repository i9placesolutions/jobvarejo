<script setup lang="ts">
import { Plus, FileText, Trash2, Calendar, Clock, Filter, LayoutGrid, Archive, Send, Loader2 } from 'lucide-vue-next'
import type { BuilderFlyerStatus } from '~/types/builder'

definePageMeta({
  layout: 'builder',
  middleware: 'builder-auth',
  ssr: false,
})

const auth = useBuilderAuth()

// ── State ──────────────────────────────────────────────────────────────────────
const isLoading = ref(true)
const isCreating = ref(false)
const deletingId = ref<string | null>(null)
const confirmDeleteId = ref<string | null>(null)
const activeFilter = ref<'ALL' | BuilderFlyerStatus>('ALL')

interface FlyerCard {
  id: string
  title: string
  status: BuilderFlyerStatus
  start_date: string | null
  end_date: string | null
  category: string | null
  snapshot_url: string | null
  created_at: string
  updated_at: string
}

const flyers = ref<FlyerCard[]>([])

// ── Filters ────────────────────────────────────────────────────────────────────
const tabs = [
  { key: 'ALL' as const, label: 'Todos' },
  { key: 'DRAFT' as const, label: 'Rascunhos' },
  { key: 'PUBLISHED' as const, label: 'Publicados' },
  { key: 'ARCHIVED' as const, label: 'Arquivados' },
]

const filteredFlyers = computed(() => {
  if (activeFilter.value === 'ALL') return flyers.value
  return flyers.value.filter(f => f.status === activeFilter.value)
})

// ── Fetch flyers ───────────────────────────────────────────────────────────────
const fetchFlyers = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<{ flyers: FlyerCard[] }>('/api/builder/flyers')
    flyers.value = data.flyers || []
  } catch (err: any) {
    console.error('Erro ao carregar encartes:', err)
  } finally {
    isLoading.value = false
  }
}

// ── Create flyer ───────────────────────────────────────────────────────────────
const createFlyer = async () => {
  if (isCreating.value) return
  isCreating.value = true
  try {
    const data = await $fetch<{ flyer: { id: string } }>('/api/builder/flyers', {
      method: 'POST',
      body: { title: 'Novo Encarte' },
    })
    if (data.flyer?.id) {
      await navigateTo(`/builder/${data.flyer.id}`)
    }
  } catch (err: any) {
    console.error('Erro ao criar encarte:', err)
    alert('Erro ao criar encarte. Tente novamente.')
  } finally {
    isCreating.value = false
  }
}

// ── Delete flyer ───────────────────────────────────────────────────────────────
const requestDelete = (id: string) => {
  confirmDeleteId.value = id
}

const cancelDelete = () => {
  confirmDeleteId.value = null
}

const confirmDelete = async () => {
  const id = confirmDeleteId.value
  if (!id) return
  confirmDeleteId.value = null
  deletingId.value = id
  try {
    await $fetch(`/api/builder/flyers/${id}`, { method: 'DELETE' })
    flyers.value = flyers.value.filter(f => f.id !== id)
  } catch (err: any) {
    console.error('Erro ao excluir encarte:', err)
    alert('Erro ao excluir encarte. Tente novamente.')
  } finally {
    deletingId.value = null
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const statusConfig: Record<BuilderFlyerStatus, { label: string; classes: string }> = {
  DRAFT: { label: 'Rascunho', classes: 'bg-gray-100 text-gray-600 border-gray-300' },
  PUBLISHED: { label: 'Publicado', classes: 'bg-emerald-50 text-emerald-600 border-emerald-300' },
  ARCHIVED: { label: 'Arquivado', classes: 'bg-amber-50 text-amber-600 border-amber-300' },
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '--'
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return '--'
  }
}

const formatRelativeTime = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return 'agora'
    if (diffMinutes < 60) return `${diffMinutes}min atrás`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h atrás`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return '--'
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────
onMounted(() => {
  fetchFlyers()
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Meus Encartes</h1>
        <p class="text-sm text-gray-500 mt-1">Crie e gerencie seus encartes promocionais</p>
      </div>
      <button
        @click="createFlyer"
        :disabled="isCreating"
        class="inline-flex items-center justify-center gap-2 h-11 px-6 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.4)] border border-emerald-400/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 shrink-0"
      >
        <Loader2 v-if="isCreating" class="w-4 h-4 animate-spin" />
        <Plus v-else class="w-4 h-4" />
        <span>{{ isCreating ? 'Criando...' : 'Novo Encarte' }}</span>
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="flex items-center gap-1 mb-6 p-1 bg-gray-100 rounded-xl border border-gray-200 w-fit">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeFilter = tab.key"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200"
        :class="activeFilter === tab.key
          ? 'bg-emerald-500/15 text-emerald-600 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="i in 6"
        :key="i"
        class="bg-white border border-gray-200 rounded-xl p-5 animate-pulse"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="h-5 bg-gray-100 rounded-lg w-40"></div>
          <div class="h-5 bg-gray-100 rounded-full w-20"></div>
        </div>
        <div class="space-y-3">
          <div class="h-4 bg-gray-100 rounded w-32"></div>
          <div class="h-4 bg-gray-100 rounded w-24"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredFlyers.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <div class="w-20 h-20 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center mb-6">
        <FileText class="w-10 h-10 text-gray-400" />
      </div>
      <h2 class="text-lg font-semibold text-gray-700 mb-2">
        {{ activeFilter === 'ALL' ? 'Nenhum encarte ainda' : 'Nenhum encarte nesta categoria' }}
      </h2>
      <p class="text-sm text-gray-500 max-w-md mb-6">
        {{ activeFilter === 'ALL'
          ? 'Comece criando seu primeiro encarte promocional. É rápido e fácil!'
          : 'Não há encartes com o filtro selecionado. Tente outro filtro ou crie um novo encarte.' }}
      </p>
      <button
        v-if="activeFilter === 'ALL'"
        @click="createFlyer"
        :disabled="isCreating"
        class="inline-flex items-center gap-2 h-11 px-6 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.4)] border border-emerald-400/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <Plus class="w-4 h-4" />
        <span>Criar primeiro encarte</span>
      </button>
    </div>

    <!-- Flyer Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="flyer in filteredFlyers"
        :key="flyer.id"
        class="group bg-white border border-gray-200 rounded-xl p-5 hover:border-emerald-500/30 hover:bg-gray-50 transition-all duration-300 cursor-pointer relative shadow-sm"
        @click="navigateTo(`/builder/${flyer.id}`)"
      >
        <!-- Card Header -->
        <div class="flex items-start justify-between mb-4">
          <h3 class="text-sm font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors truncate pr-3 max-w-[70%]">
            {{ flyer.title || 'Sem título' }}
          </h3>
          <span
            class="inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full border shrink-0"
            :class="statusConfig[flyer.status]?.classes || statusConfig.DRAFT.classes"
          >
            {{ statusConfig[flyer.status]?.label || 'Rascunho' }}
          </span>
        </div>

        <!-- Card Body -->
        <div class="space-y-2.5">
          <!-- Date range -->
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <Calendar class="w-3.5 h-3.5 shrink-0" />
            <span v-if="flyer.start_date || flyer.end_date">
              {{ formatDate(flyer.start_date) }} — {{ formatDate(flyer.end_date) }}
            </span>
            <span v-else>Sem período definido</span>
          </div>

          <!-- Updated at -->
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <Clock class="w-3.5 h-3.5 shrink-0" />
            <span>Atualizado {{ formatRelativeTime(flyer.updated_at) }}</span>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="flex items-center justify-end mt-4 pt-3 border-t border-gray-100">
          <button
            @click.stop="requestDelete(flyer.id)"
            :disabled="deletingId === flyer.id"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <Loader2 v-if="deletingId === flyer.id" class="w-3.5 h-3.5 animate-spin" />
            <Trash2 v-else class="w-3.5 h-3.5" />
            <span>Excluir</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="confirmDeleteId"
          class="fixed inset-0 z-100 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="cancelDelete"></div>

          <!-- Modal -->
          <div class="relative bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Excluir encarte?</h3>
            <p class="text-sm text-gray-500 mb-6">
              Esta ação não pode ser desfeita. O encarte e todos os seus produtos serão removidos permanentemente.
            </p>
            <div class="flex items-center justify-end gap-3">
              <button
                @click="cancelDelete"
                class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                @click="confirmDelete"
                class="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
