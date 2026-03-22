<script setup lang="ts">
import { Search, Loader2, X, Package, Check } from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  close: []
  select: [products: Array<{ name: string; image: string | null; brand: string | null }>]
}>()

interface CatalogProduct {
  id: string
  name: string
  image: string | null
  brand: string | null
  category: string | null
}

const isLoading = ref(false)
const searchQuery = ref('')
const catalogProducts = ref<CatalogProduct[]>([])
const selectedIds = ref<Set<string>>(new Set())
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

const fetchProducts = async (query?: string) => {
  isLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (query) params.q = query
    const data = await $fetch<{ products: CatalogProduct[] }>('/api/builder/products', { query: params })
    catalogProducts.value = data.products || []
  } catch {
    catalogProducts.value = []
  } finally {
    isLoading.value = false
  }
}

const onSearchInput = () => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    fetchProducts(searchQuery.value.trim() || undefined)
  }, 300)
}

const toggleProduct = (id: string) => {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

const isSelected = (id: string) => selectedIds.value.has(id)

const selectAll = () => {
  selectedIds.value = new Set(catalogProducts.value.map(p => p.id))
}

const clearSelection = () => {
  selectedIds.value = new Set()
}

const confirmSelection = () => {
  const selected = catalogProducts.value
    .filter(p => selectedIds.value.has(p.id))
    .map(p => ({ name: p.name, image: p.image, brand: p.brand }))
  emit('select', selected)
  emit('close')
  selectedIds.value = new Set()
}

watch(() => props.open, (val) => {
  if (val) {
    selectedIds.value = new Set()
    searchQuery.value = ''
    fetchProducts()
  }
})
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
      <div v-if="open" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />

        <div class="relative bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <h2 class="text-base font-semibold text-white">Selecionar do Catalogo</h2>
              <p class="text-[11px] text-zinc-500 mt-0.5">Escolha os produtos para adicionar ao encarte</p>
            </div>
            <button @click="emit('close')" class="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Search -->
          <div class="px-5 py-3 border-b border-white/5">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                v-model="searchQuery"
                @input="onSearchInput"
                placeholder="Buscar produto..."
                class="w-full h-10 pl-10 pr-4 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          <!-- Product list -->
          <div class="flex-1 overflow-y-auto px-5 py-3 min-h-0">
            <div v-if="isLoading" class="flex items-center justify-center py-12">
              <Loader2 class="w-6 h-6 text-emerald-500 animate-spin" />
            </div>

            <div v-else-if="catalogProducts.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
              <Package class="w-10 h-10 text-zinc-700 mb-3" />
              <p class="text-sm text-zinc-500">Nenhum produto encontrado</p>
              <p class="text-xs text-zinc-600 mt-1">Cadastre produtos em Meus Produtos</p>
            </div>

            <div v-else class="space-y-1">
              <button
                v-for="p in catalogProducts"
                :key="p.id"
                @click="toggleProduct(p.id)"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                :class="isSelected(p.id) ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'hover:bg-white/5'"
              >
                <!-- Checkbox -->
                <div
                  class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                  :class="isSelected(p.id) ? 'bg-emerald-600 border-emerald-600' : 'border-white/20'"
                >
                  <Check v-if="isSelected(p.id)" class="w-3 h-3 text-white" />
                </div>

                <!-- Image -->
                <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                  <img v-if="resolveImageUrl(p.image)" :src="resolveImageUrl(p.image)!" class="w-full h-full object-contain" />
                  <Package v-else class="w-5 h-5 text-zinc-700" />
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-white truncate">{{ p.name }}</p>
                  <p v-if="p.brand || p.category" class="text-[10px] text-zinc-500 truncate">
                    {{ [p.brand, p.category].filter(Boolean).join(' · ') }}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 border-t border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <button @click="selectAll" class="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium">Todos</button>
              <button @click="clearSelection" class="text-[11px] text-zinc-500 hover:text-zinc-300">Limpar</button>
              <span class="text-[11px] text-zinc-600">{{ selectedIds.size }} selecionados</span>
            </div>
            <button
              @click="confirmSelection"
              :disabled="selectedIds.size === 0"
              class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Adicionar {{ selectedIds.size > 0 ? `(${selectedIds.size})` : '' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
