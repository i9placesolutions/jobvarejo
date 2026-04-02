<script setup lang="ts">
import { Search, Loader2, Image, ExternalLink, Clock, Layers, RefreshCw, ChevronDown } from 'lucide-vue-next'

definePageMeta({
  layout: 'canva',
  middleware: 'builder-auth',
})

const canva = useCanva()
const searchInput = ref('')
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Busca com debounce
const onSearchInput = () => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    canva.searchQuery.value = searchInput.value.trim()
    canva.fetchDesigns(searchInput.value.trim() || undefined)
  }, 400)
}

const loadMore = () => {
  canva.fetchDesigns(canva.searchQuery.value || undefined, true)
}

const refresh = () => {
  canva.fetchDesigns(canva.searchQuery.value || undefined)
}

const formatDate = (timestamp: number): string => {
  try {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / 3600000)
    if (diffHours < 1) return 'agora'
    if (diffHours < 24) return `${diffHours}h atras`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d atras`
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return '--'
  }
}

onMounted(() => {
  canva.fetchDesigns()
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Meus Templates Canva</h1>
        <p class="text-sm text-zinc-500 mt-1">Selecione um design do Canva para aplicar produtos automaticamente</p>
      </div>
      <button
        @click="refresh"
        :disabled="canva.isLoadingDesigns.value"
        class="inline-flex items-center justify-center gap-2 h-10 px-5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all border border-violet-400/20 disabled:opacity-50 shrink-0"
      >
        <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': canva.isLoadingDesigns.value }" />
        <span>Atualizar</span>
      </button>
    </div>

    <!-- Search -->
    <div class="mb-6">
      <div class="relative max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          v-model="searchInput"
          @input="onSearchInput"
          placeholder="Buscar design por nome..."
          class="w-full h-11 pl-10 pr-4 bg-[#18181b]/60 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="canva.isLoadingDesigns.value && canva.designs.value.length === 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="i in 8"
        :key="i"
        class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden animate-pulse"
      >
        <div class="aspect-square bg-white/5" />
        <div class="p-4 space-y-2">
          <div class="h-4 bg-white/5 rounded w-3/4" />
          <div class="h-3 bg-white/5 rounded w-1/2" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!canva.isLoadingDesigns.value && canva.designs.value.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <div class="w-20 h-20 bg-[#18181b]/80 border border-white/5 rounded-2xl flex items-center justify-center mb-6">
        <Image class="w-10 h-10 text-zinc-600" />
      </div>
      <h2 class="text-lg font-semibold text-zinc-300 mb-2">
        {{ searchInput ? 'Nenhum design encontrado' : 'Nenhum design disponivel' }}
      </h2>
      <p class="text-sm text-zinc-500 max-w-md">
        {{ searchInput
          ? 'Tente outro termo de busca ou limpe o filtro.'
          : 'Crie designs no Canva e eles apareceram aqui automaticamente.' }}
      </p>
    </div>

    <!-- Design Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="design in canva.designs.value"
        :key="design.id"
        class="group bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden hover:border-violet-500/30 hover:bg-[#18181b] transition-all duration-300 cursor-pointer"
        @click="navigateTo(`/canva/${design.id}`)"
      >
        <!-- Thumbnail -->
        <div class="aspect-square bg-[#09090b] relative overflow-hidden">
          <img
            v-if="design.thumbnail?.url"
            :src="design.thumbnail.url"
            :alt="design.title"
            class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Image class="w-12 h-12 text-zinc-700" />
          </div>

          <!-- Overlay com acoes -->
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span class="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg shadow-lg">
              Aplicar Produtos
            </span>
          </div>

          <!-- Badge paginas -->
          <div v-if="design.page_count > 1" class="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-[10px] text-white/80">
            <Layers class="w-3 h-3" />
            {{ design.page_count }} pag.
          </div>
        </div>

        <!-- Info -->
        <div class="p-4">
          <h3 class="text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">
            {{ design.title || 'Sem titulo' }}
          </h3>
          <div class="flex items-center gap-2 mt-2">
            <Clock class="w-3 h-3 text-zinc-600" />
            <span class="text-[11px] text-zinc-500">{{ formatDate(design.updated_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Load More -->
    <div v-if="canva.hasMore.value" class="flex justify-center mt-8">
      <button
        @click="loadMore"
        :disabled="canva.isLoadingDesigns.value"
        class="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-sm text-zinc-300 rounded-xl transition-colors disabled:opacity-50"
      >
        <Loader2 v-if="canva.isLoadingDesigns.value" class="w-4 h-4 animate-spin" />
        <ChevronDown v-else class="w-4 h-4" />
        <span>Carregar mais</span>
      </button>
    </div>
  </div>
</template>
