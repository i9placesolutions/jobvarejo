<script setup lang="ts">
// Redireciona para a pagina de produtos do builder
// Reusa a mesma pagina ja que os produtos sao compartilhados

definePageMeta({
  layout: 'canva',
  middleware: 'builder-auth',
})

// Importa os mesmos icones e logica da pagina de produtos do builder
import {
  Search, Plus, Pencil, Trash2, X, Upload, Loader2, Package,
  Camera, List, ClipboardPaste, ImageOff, Wand2, Eraser,
} from 'lucide-vue-next'

const auth = useBuilderAuth()

// Estado
const isLoading = ref(true)
const products = ref<any[]>([])
const searchQuery = ref('')
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const showAddModal = ref(false)
const showBulkModal = ref(false)
const editingProduct = ref<any>(null)
const deletingId = ref<string | null>(null)

// Form
const form = ref({
  name: '',
  image: '',
  brand: '',
  category: '',
})

const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

// Buscar produtos
const fetchProducts = async (query?: string) => {
  isLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (query) params.q = query
    const data = await $fetch<{ products: any[] }>('/api/builder/products', { query: params })
    products.value = data.products || []
  } catch {
    products.value = []
  } finally {
    isLoading.value = false
  }
}

const onSearchInput = () => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    fetchProducts(searchQuery.value.trim() || undefined)
  }, 400)
}

// CRUD
const openAdd = () => {
  editingProduct.value = null
  form.value = { name: '', image: '', brand: '', category: '' }
  showAddModal.value = true
}

const openEdit = (product: any) => {
  editingProduct.value = product
  form.value = {
    name: product.name || '',
    image: product.image || '',
    brand: product.brand || '',
    category: product.category || '',
  }
  showAddModal.value = true
}

const saveProduct = async () => {
  if (!form.value.name.trim()) return
  try {
    if (editingProduct.value) {
      await $fetch(`/api/builder/products/${editingProduct.value.id}`, {
        method: 'PUT',
        body: form.value,
      })
    } else {
      await $fetch('/api/builder/products', {
        method: 'POST',
        body: form.value,
      })
    }
    showAddModal.value = false
    fetchProducts(searchQuery.value.trim() || undefined)
  } catch (err: any) {
    console.error('Erro ao salvar produto:', err)
  }
}

const deleteProduct = async (id: string) => {
  if (deletingId.value) return
  deletingId.value = id
  try {
    await $fetch(`/api/builder/products/${id}`, { method: 'DELETE' })
    products.value = products.value.filter(p => p.id !== id)
  } catch (err: any) {
    console.error('Erro ao excluir produto:', err)
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  fetchProducts()
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Meus Produtos</h1>
        <p class="text-sm text-zinc-500 mt-1">Gerencie seu catalogo de produtos para usar nos templates</p>
      </div>
      <button
        @click="openAdd"
        class="inline-flex items-center justify-center gap-2 h-10 px-5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all border border-violet-400/20 shrink-0"
      >
        <Plus class="w-4 h-4" />
        <span>Novo Produto</span>
      </button>
    </div>

    <!-- Search -->
    <div class="mb-6">
      <div class="relative max-w-md">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          placeholder="Buscar produto..."
          class="w-full h-11 pl-10 pr-4 bg-[#18181b]/60 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="i in 8" :key="i" class="bg-[#18181b]/80 border border-white/5 rounded-xl p-4 animate-pulse">
        <div class="aspect-square bg-white/5 rounded-lg mb-3" />
        <div class="h-4 bg-white/5 rounded w-3/4" />
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="products.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
      <Package class="w-16 h-16 text-zinc-700 mb-4" />
      <h2 class="text-lg font-semibold text-zinc-300 mb-2">Nenhum produto cadastrado</h2>
      <p class="text-sm text-zinc-500 max-w-md mb-6">Adicione produtos ao catalogo para usar nos templates do Canva</p>
      <button @click="openAdd" class="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors">
        <Plus class="w-4 h-4" />
        Adicionar produto
      </button>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="p in products"
        :key="p.id"
        class="group bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden hover:border-violet-500/20 transition-all"
      >
        <div class="aspect-square bg-[#09090b] flex items-center justify-center overflow-hidden">
          <img
            v-if="resolveImageUrl(p.image)"
            :src="resolveImageUrl(p.image)!"
            class="w-full h-full object-contain"
          />
          <Package v-else class="w-10 h-10 text-zinc-700" />
        </div>
        <div class="p-3">
          <p class="text-sm text-white truncate">{{ p.name }}</p>
          <p v-if="p.brand" class="text-[10px] text-zinc-500 truncate">{{ p.brand }}</p>
          <div class="flex items-center gap-1 mt-2">
            <button
              @click="openEdit(p)"
              class="p-1.5 text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
            >
              <Pencil class="w-3.5 h-3.5" />
            </button>
            <button
              @click="deleteProduct(p.id)"
              :disabled="deletingId === p.id"
              class="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Loader2 v-if="deletingId === p.id" class="w-3.5 h-3.5 animate-spin" />
              <Trash2 v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Add/Edit -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showAddModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="showAddModal = false" />
          <div class="relative bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-4">
              {{ editingProduct ? 'Editar Produto' : 'Novo Produto' }}
            </h3>
            <div class="space-y-3">
              <input
                v-model="form.name"
                placeholder="Nome do produto"
                class="w-full h-10 px-3 bg-white/5 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50"
              />
              <input
                v-model="form.brand"
                placeholder="Marca (opcional)"
                class="w-full h-10 px-3 bg-white/5 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50"
              />
              <input
                v-model="form.category"
                placeholder="Categoria (opcional)"
                class="w-full h-10 px-3 bg-white/5 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50"
              />
            </div>
            <div class="flex justify-end gap-3 mt-6">
              <button @click="showAddModal = false" class="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                Cancelar
              </button>
              <button
                @click="saveProduct"
                :disabled="!form.name.trim()"
                class="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
