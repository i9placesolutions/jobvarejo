<script setup lang="ts">
import { Search, Loader2, Image, Layers, Copy, X, Wand2, Filter } from 'lucide-vue-next'

definePageMeta({
  layout: 'canva',
  middleware: 'builder-auth',
  ssr: false,
})

// Tipagem do template
interface CanvaTemplate {
  id: string
  canva_design_id: string
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  page_count: number
  products_per_page: Record<string, number> | null
  is_active: boolean
}

// Estado
const templates = ref<CanvaTemplate[]>([])
const isLoading = ref(false)
const isCopying = ref(false)
const selectedCategory = ref<string | null>(null)
const searchQuery = ref('')
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Modal
const showModal = ref(false)
const selectedTemplate = ref<CanvaTemplate | null>(null)
const customTitle = ref('')

// Verificação de dados obrigatórios da empresa
const auth = useBuilderAuth()
const showCompanySetup = ref(false)
const pendingTemplate = ref<CanvaTemplate | null>(null)

// Campos obrigatórios para criar design
const missingFields = computed(() => {
  const missing: string[] = []
  const t = auth.tenant.value
  if (!t) return ['logo', 'address', 'whatsapp']
  if (!t.logo) missing.push('logo')
  if (!t.address) missing.push('address')
  if (!t.whatsapp) missing.push('whatsapp')
  return missing
})

const hasRequiredFields = computed(() => missingFields.value.length === 0)

const modalPages = ref<Array<{ index: number; thumbnail: string | null }>>([])
const isLoadingPages = ref(false)

// Categorias disponíveis para filtro
const categories = [
  { key: null, label: 'Todos' },
  { key: 'carnes', label: 'Carnes' },
  { key: 'hortifruti', label: 'Hortifruti' },
  { key: 'padaria', label: 'Padaria' },
  { key: 'geral', label: 'Geral' },
]

// Buscar templates da API
const fetchTemplates = async () => {
  isLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (selectedCategory.value) params.category = selectedCategory.value

    const data = await $fetch<{ templates: CanvaTemplate[] }>('/api/canva/templates', { query: params })
    templates.value = data.templates || []
  } catch (err: unknown) {
    console.error('Erro ao buscar templates:', err)
    templates.value = []
  } finally {
    isLoading.value = false
  }
}

// Templates filtrados por busca local
const filteredTemplates = computed(() => {
  if (!searchQuery.value.trim()) return templates.value
  const q = searchQuery.value.toLowerCase().trim()
  return templates.value.filter(t =>
    t.title.toLowerCase().includes(q) ||
    (t.description && t.description.toLowerCase().includes(q)) ||
    (t.category && t.category.toLowerCase().includes(q))
  )
})

// Debounce na busca
const onSearchInput = () => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    // Busca local, sem chamada API
  }, 300)
}

// Trocar categoria
const selectCategory = (key: string | null) => {
  selectedCategory.value = key
  fetchTemplates()
}

// Abrir modal de confirmação
const openUseModal = async (template: CanvaTemplate) => {
  // Verificar dados obrigatórios antes de abrir modal
  if (!hasRequiredFields.value) {
    pendingTemplate.value = template
    showCompanySetup.value = true
    return
  }

  // Dados ok, prosseguir normalmente
  selectedTemplate.value = template
  customTitle.value = template.title
  modalPages.value = [{ index: 1, thumbnail: template.thumbnail_url }]
  showModal.value = true

  // Se tem mais de 1 página, carregar thumbnails
  if (template.page_count > 1) {
    isLoadingPages.value = true
    try {
      const data = await $fetch<any>(`/api/canva/designs/${template.canva_design_id}/pages`)
      if (data?.pages && Array.isArray(data.pages)) {
        modalPages.value = data.pages.map((p: any) => ({
          index: p.index || p.page_index || 1,
          thumbnail: p.thumbnail || null,
        }))
      }
    } catch {
      // Manter só a thumbnail principal
    } finally {
      isLoadingPages.value = false
    }
  }
}

// Callback quando dados obrigatórios são salvos
const onCompanySetupSaved = () => {
  showCompanySetup.value = false
  // Re-abrir o modal do template que estava pendente
  if (pendingTemplate.value) {
    const template = pendingTemplate.value
    pendingTemplate.value = null
    openUseModal(template)
  }
}

// Fechar modal
const closeModal = () => {
  showModal.value = false
  selectedTemplate.value = null
  customTitle.value = ''
  modalPages.value = []
}

// Confirmar cópia do template
const confirmCopy = async () => {
  if (!selectedTemplate.value || !customTitle.value.trim()) return

  isCopying.value = true
  try {
    const result = await $fetch<{ design: { id: string } }>(`/api/canva/templates/${selectedTemplate.value.id}/copy`, {
      method: 'POST',
      body: { title: customTitle.value.trim() },
      credentials: 'include',
    })

    closeModal()
    // Redireciona para o design copiado usando o id do canva_designs
    await navigateTo(`/canva/${result.design?.id || result.id}`)
  } catch (err: unknown) {
    console.error('Erro ao copiar template:', err)
  } finally {
    isCopying.value = false
  }
}

// Fechar modal com ESC
const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showModal.value) closeModal()
}

onMounted(() => {
  fetchTemplates()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex flex-col gap-1 mb-8">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-violet-600/20 border border-violet-500/20 rounded-xl flex items-center justify-center">
          <Wand2 class="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight">Templates Disponíveis</h1>
          <p class="text-sm text-zinc-500 mt-0.5">Escolha um modelo pronto e personalize com seus produtos</p>
        </div>
      </div>
    </div>

    <!-- Filtros e busca -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
      <!-- Tabs de categoria -->
      <div class="flex items-center gap-1 bg-[#18181b]/60 border border-white/5 rounded-xl p-1">
        <button
          v-for="cat in categories"
          :key="cat.key ?? 'todos'"
          @click="selectCategory(cat.key)"
          :class="[
            'px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
            selectedCategory === cat.key
              ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          ]"
        >
          {{ cat.label }}
        </button>
      </div>

      <!-- Busca -->
      <div class="relative sm:ml-auto max-w-xs w-full">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          placeholder="Buscar template..."
          class="w-full h-10 pl-10 pr-4 bg-[#18181b]/60 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
        />
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading && templates.length === 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="i in 8"
        :key="i"
        class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden animate-pulse"
      >
        <div class="aspect-[4/5] bg-white/5" />
        <div class="p-4 space-y-3">
          <div class="h-4 bg-white/5 rounded w-3/4" />
          <div class="h-3 bg-white/5 rounded w-1/2" />
          <div class="flex gap-2">
            <div class="h-5 bg-white/5 rounded-full w-16" />
            <div class="h-5 bg-white/5 rounded-full w-12" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!isLoading && filteredTemplates.length === 0"
      class="flex flex-col items-center justify-center py-24 text-center"
    >
      <div class="w-20 h-20 bg-[#18181b]/80 border border-white/5 rounded-2xl flex items-center justify-center mb-6">
        <Image class="w-10 h-10 text-zinc-700" />
      </div>
      <h2 class="text-lg font-semibold text-zinc-300 mb-2">
        {{ searchQuery ? 'Nenhum template encontrado' : 'Nenhum template disponível' }}
      </h2>
      <p class="text-sm text-zinc-500 max-w-sm">
        {{ searchQuery
          ? 'Tente outro termo de busca ou mude a categoria.'
          : 'Novos templates serão adicionados em breve. Volte mais tarde.' }}
      </p>
    </div>

    <!-- Grid de templates -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="template in filteredTemplates"
        :key="template.id"
        class="group bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden hover:border-violet-500/30 hover:bg-[#18181b] transition-all duration-300 cursor-pointer"
        @click="openUseModal(template)"
      >
        <!-- Thumbnail -->
        <div class="aspect-[4/5] bg-[#09090b] relative overflow-hidden">
          <img
            v-if="template.thumbnail_url"
            :src="template.thumbnail_url"
            :alt="template.title"
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Image class="w-12 h-12 text-zinc-700" />
          </div>

          <!-- Overlay no hover -->
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span class="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg shadow-lg shadow-violet-600/30">
              <Copy class="w-4 h-4" />
              Usar Template
            </span>
          </div>

          <!-- Badge de páginas -->
          <div v-if="template.page_count > 1" class="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-[10px] text-white/80">
            <Layers class="w-3 h-3" />
            {{ template.page_count }} pág.
          </div>

          <!-- Badge de categoria -->
          <div v-if="template.category" class="absolute top-2 left-2 px-2 py-1 bg-violet-600/80 backdrop-blur-sm rounded-md text-[10px] font-medium text-white capitalize">
            {{ template.category }}
          </div>
        </div>

        <!-- Info -->
        <div class="p-4">
          <h3 class="text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">
            {{ template.title || 'Sem título' }}
          </h3>
          <p v-if="template.description" class="text-xs text-zinc-500 mt-1 line-clamp-2">
            {{ template.description }}
          </p>
          <div class="flex items-center gap-3 mt-3">
            <span class="flex items-center gap-1 text-[11px] text-zinc-500">
              <Layers class="w-3 h-3" />
              {{ template.page_count }} {{ template.page_count === 1 ? 'página' : 'páginas' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de confirmação -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeModal" />

          <!-- Conteúdo do modal -->
          <Transition
            enter-active-class="transition-all duration-200"
            leave-active-class="transition-all duration-200"
            enter-from-class="opacity-0 scale-95"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="showModal"
              class="relative w-full max-w-md max-h-[90vh] bg-[#141416] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto"
            >
              <!-- Header do modal -->
              <div class="flex items-center justify-between p-5 border-b border-white/5">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 bg-violet-600/20 rounded-lg flex items-center justify-center">
                    <Copy class="w-4 h-4 text-violet-400" />
                  </div>
                  <h3 class="text-base font-semibold text-white">Usar este template?</h3>
                </div>
                <button
                  @click="closeModal"
                  class="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>

              <!-- Corpo do modal -->
              <div class="p-5 space-y-4">
                <!-- Preview com carrossel -->
                <div v-if="selectedTemplate" class="rounded-xl overflow-hidden bg-[#09090b]">
                  <div class="aspect-[4/5] relative">
                    <CanvaPageCarousel
                      v-if="modalPages.length > 0"
                      :pages="modalPages"
                      :autoplay="true"
                      :interval="3500"
                    />
                    <div v-else-if="isLoadingPages" class="w-full h-full flex items-center justify-center">
                      <Loader2 class="w-6 h-6 text-violet-500 animate-spin" />
                    </div>
                  </div>
                  <div class="p-3 border-t border-white/5">
                    <p class="text-sm font-medium text-white truncate">{{ selectedTemplate.title }}</p>
                    <p class="text-xs text-zinc-500 mt-0.5">
                      {{ selectedTemplate.page_count }} {{ selectedTemplate.page_count === 1 ? 'pagina' : 'paginas' }}
                      <span v-if="selectedTemplate.category"> · {{ selectedTemplate.category }}</span>
                    </p>
                  </div>
                </div>

                <!-- Input de título -->
                <div>
                  <label class="block text-xs font-medium text-zinc-400 mb-1.5">
                    Título do seu design
                  </label>
                  <input
                    v-model="customTitle"
                    placeholder="Ex: Encarte Semana 14"
                    class="w-full h-10 px-3 bg-[#09090b] border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
                    @keydown.enter="confirmCopy"
                  />
                </div>

                <p class="text-xs text-zinc-500">
                  Uma cópia deste template será criada para você personalizar com seus produtos.
                </p>
              </div>

              <!-- Ações do modal -->
              <div class="flex items-center justify-end gap-2 p-5 pt-0">
                <button
                  @click="closeModal"
                  :disabled="isCopying"
                  class="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  @click="confirmCopy"
                  :disabled="isCopying || !(customTitle || '').trim()"
                  class="inline-flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-all border border-violet-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Loader2 v-if="isCopying" class="w-4 h-4 animate-spin" />
                  <Wand2 v-else class="w-4 h-4" />
                  <span>{{ isCopying ? 'Criando...' : 'Criar meu design' }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal de dados obrigatórios da empresa -->
    <ClientOnly>
      <CanvaCompanySetup
        v-if="auth.tenant.value"
        :open="showCompanySetup"
        :tenant="auth.tenant.value"
        :missing-fields="missingFields"
        @close="showCompanySetup = false; pendingTemplate = null"
        @saved="onCompanySetupSaved"
      />
    </ClientOnly>
  </div>
</template>
