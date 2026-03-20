<script setup lang="ts">
import {
  Search, Plus, Pencil, Trash2, X, Upload, Image, Loader2, Package,
  Camera, Barcode, Tag, ShoppingBag,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'builder',
  middleware: 'builder-auth',
})

const auth = useBuilderAuth()

// ── Types ───────────────────────────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  image: string | null
  barcode: string | null
  brand: string | null
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── State ───────────────────────────────────────────────────────────────────────
const isLoading = ref(true)
const products = ref<Product[]>([])
const searchQuery = ref('')
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Modal state
const showModal = ref(false)
const isEditing = ref(false)
const editingProductId = ref<string | null>(null)
const isSaving = ref(false)
const isUploading = ref(false)
const errorMessage = ref('')

// Delete state
const confirmDeleteId = ref<string | null>(null)
const deletingId = ref<string | null>(null)

// Form
const form = reactive({
  name: '',
  brand: '',
  category: '',
  barcode: '',
  image: '' as string | null,
})

const categoryOptions = [
  'Alimentos',
  'Bebidas',
  'Limpeza',
  'Higiene',
  'Hortifruti',
  'Carnes',
  'Laticinios',
  'Padaria',
  'Congelados',
  'Pet',
  'Outros',
]

// ── Image preview URL ───────────────────────────────────────────────────────────
const imagePreviewUrl = computed(() => {
  if (!form.image) return null
  if (form.image.startsWith('http') || form.image.startsWith('/api/')) return form.image
  return `/api/storage/p?key=${encodeURIComponent(form.image)}`
})

const productImageUrl = (image: string | null): string | null => {
  if (!image) return null
  if (image.startsWith('http') || image.startsWith('/api/')) return image
  return `/api/storage/p?key=${encodeURIComponent(image)}`
}

// ── Fetch products ──────────────────────────────────────────────────────────────
const fetchProducts = async (query?: string) => {
  isLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (query) params.q = query
    const data = await $fetch<{ products: Product[] }>('/api/builder/products', { query: params })
    products.value = data.products || []
  } catch (err: any) {
    console.error('Erro ao carregar produtos:', err)
  } finally {
    isLoading.value = false
  }
}

// ── Search (debounced) ──────────────────────────────────────────────────────────
const onSearchInput = () => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    fetchProducts(searchQuery.value.trim() || undefined)
  }, 400)
}

// ── Modal helpers ───────────────────────────────────────────────────────────────
const resetForm = () => {
  form.name = ''
  form.brand = ''
  form.category = ''
  form.barcode = ''
  form.image = null
  errorMessage.value = ''
}

const openNewProduct = () => {
  resetForm()
  isEditing.value = false
  editingProductId.value = null
  showModal.value = true
}

const openEditProduct = (product: Product) => {
  form.name = product.name || ''
  form.brand = product.brand || ''
  form.category = product.category || ''
  form.barcode = product.barcode || ''
  form.image = product.image || null
  errorMessage.value = ''
  isEditing.value = true
  editingProductId.value = product.id
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  isEditing.value = false
  editingProductId.value = null
  resetForm()
}

// ── Image upload ────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleImageUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Por favor, selecione uma imagem valida.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'A imagem deve ter no maximo 5MB.'
    return
  }

  const tenantId = auth.tenant.value?.id
  if (!tenantId) return

  isUploading.value = true
  errorMessage.value = ''

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filename = `product_${Date.now()}.${ext}`
    const key = `builder/${tenantId}/products/${filename}`
    const contentType = file.type || 'image/png'

    const buffer = await file.arrayBuffer()

    const result = await $fetch<{ key: string }>('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType },
      body: buffer,
      headers: { 'Content-Type': contentType },
    })

    if (result.key) {
      form.image = result.key
    }
  } catch (err: any) {
    console.error('Erro no upload:', err)
    errorMessage.value = 'Erro ao enviar imagem. Tente novamente.'
  } finally {
    isUploading.value = false
    if (input) input.value = ''
  }
}

// ── Save product (create or update) ─────────────────────────────────────────────
const saveProduct = async () => {
  if (isSaving.value) return

  if (!form.name.trim()) {
    errorMessage.value = 'O nome do produto e obrigatorio.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''

  const payload = {
    name: form.name.trim(),
    brand: form.brand.trim() || null,
    category: form.category || null,
    barcode: form.barcode.trim() || null,
    image: form.image || null,
  }

  try {
    if (isEditing.value && editingProductId.value) {
      // Update
      const data = await $fetch<{ product: Product }>(`/api/builder/products/${editingProductId.value}`, {
        method: 'PUT',
        body: payload,
      })
      // Update in local list
      const idx = products.value.findIndex(p => p.id === editingProductId.value)
      if (idx !== -1 && data.product) {
        products.value[idx] = data.product
      }
    } else {
      // Create
      const data = await $fetch<{ product: Product }>('/api/builder/products', {
        method: 'POST',
        body: payload,
      })
      if (data.product) {
        products.value.unshift(data.product)
        // Re-sort by name
        products.value.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      }
    }
    closeModal()
  } catch (err: any) {
    console.error('Erro ao salvar produto:', err)
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Erro ao salvar produto. Tente novamente.'
  } finally {
    isSaving.value = false
  }
}

// ── Delete product ──────────────────────────────────────────────────────────────
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
    await $fetch(`/api/builder/products/${id}`, { method: 'DELETE' })
    products.value = products.value.filter(p => p.id !== id)
  } catch (err: any) {
    console.error('Erro ao excluir produto:', err)
    alert('Erro ao excluir produto. Tente novamente.')
  } finally {
    deletingId.value = null
  }
}

// ── Init ────────────────────────────────────────────────────────────────────────
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
        <p class="text-sm text-zinc-500 mt-1">Gerencie o catalogo de produtos da sua empresa</p>
      </div>
      <button
        @click="openNewProduct"
        class="inline-flex items-center justify-center gap-2 h-11 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.4)] border border-emerald-400/20 hover:-translate-y-0.5 shrink-0"
      >
        <Plus class="w-4 h-4" />
        <span>Novo Produto</span>
      </button>
    </div>

    <!-- Search Bar -->
    <div class="mb-6">
      <div class="relative group max-w-md">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          type="text"
          placeholder="Buscar produto por nome..."
          class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
        />
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="i in 8"
        :key="i"
        class="bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden animate-pulse"
      >
        <div class="h-40 bg-white/5"></div>
        <div class="p-4 space-y-3">
          <div class="h-4 bg-white/5 rounded-lg w-3/4"></div>
          <div class="h-3 bg-white/5 rounded w-1/2"></div>
          <div class="h-3 bg-white/5 rounded w-1/3"></div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="products.length === 0"
      class="flex flex-col items-center justify-center py-20 text-center"
    >
      <div class="w-20 h-20 bg-[#18181b]/80 border border-white/5 rounded-2xl flex items-center justify-center mb-6">
        <Package class="w-10 h-10 text-zinc-600" />
      </div>
      <h2 class="text-lg font-semibold text-zinc-300 mb-2">
        {{ searchQuery.trim() ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado' }}
      </h2>
      <p class="text-sm text-zinc-500 max-w-md mb-6">
        {{ searchQuery.trim()
          ? 'Nenhum produto corresponde a sua busca. Tente outro termo.'
          : 'Comece cadastrando seus produtos para usa-los nos encartes.' }}
      </p>
      <button
        v-if="!searchQuery.trim()"
        @click="openNewProduct"
        class="inline-flex items-center gap-2 h-11 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.4)] border border-emerald-400/20 hover:-translate-y-0.5"
      >
        <Plus class="w-4 h-4" />
        <span>Cadastrar primeiro produto</span>
      </button>
    </div>

    <!-- Products Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="product in products"
        :key="product.id"
        class="group bg-[#18181b]/80 border border-white/5 rounded-xl overflow-hidden hover:border-emerald-500/20 hover:bg-[#18181b] transition-all duration-300"
      >
        <!-- Product Image -->
        <div class="relative h-40 bg-[#09090b]/50 flex items-center justify-center overflow-hidden">
          <img
            v-if="productImageUrl(product.image)"
            :src="productImageUrl(product.image)!"
            :alt="product.name"
            class="w-full h-full object-contain p-3"
          />
          <Package v-else class="w-12 h-12 text-zinc-700" />
        </div>

        <!-- Product Info -->
        <div class="p-4">
          <h3 class="text-sm font-semibold text-white truncate mb-1.5 group-hover:text-emerald-300 transition-colors">
            {{ product.name }}
          </h3>
          <div class="space-y-1">
            <p v-if="product.brand" class="text-xs text-zinc-500 truncate flex items-center gap-1.5">
              <Tag class="w-3 h-3 shrink-0" />
              {{ product.brand }}
            </p>
            <p v-if="product.category" class="text-xs text-zinc-500 truncate flex items-center gap-1.5">
              <ShoppingBag class="w-3 h-3 shrink-0" />
              {{ product.category }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-white/5">
            <button
              @click="openEditProduct(product)"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
            >
              <Pencil class="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
            <button
              @click="requestDelete(product.id)"
              :disabled="deletingId === product.id"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
            >
              <Loader2 v-if="deletingId === product.id" class="w-3.5 h-3.5 animate-spin" />
              <Trash2 v-else class="w-3.5 h-3.5" />
              <span>Excluir</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Form Modal -->
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
          v-if="showModal"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeModal"></div>

          <!-- Modal Content -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-4"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 translate-y-4"
            appear
          >
            <div class="relative bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <!-- Modal Header -->
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-lg font-semibold text-white">
                  {{ isEditing ? 'Editar Produto' : 'Novo Produto' }}
                </h2>
                <button
                  @click="closeModal"
                  class="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Error Message -->
              <div v-if="errorMessage" class="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p class="text-sm text-red-400">{{ errorMessage }}</p>
              </div>

              <!-- Form -->
              <form @submit.prevent="saveProduct" class="space-y-5">
                <!-- Image Upload -->
                <div>
                  <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1 mb-2 block">
                    Imagem do produto
                  </label>
                  <div class="flex items-center gap-4">
                    <div
                      @click="triggerFileInput"
                      class="relative w-28 h-28 bg-[#09090b]/50 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all group/img overflow-hidden shrink-0"
                    >
                      <img
                        v-if="imagePreviewUrl"
                        :src="imagePreviewUrl"
                        alt="Produto"
                        class="w-full h-full object-contain rounded-xl p-1"
                      />
                      <div v-else class="flex flex-col items-center gap-1.5 text-zinc-600 group-hover/img:text-emerald-400 transition-colors">
                        <Image class="w-8 h-8" />
                        <span class="text-[10px]">Adicionar</span>
                      </div>
                      <!-- Upload overlay -->
                      <div v-if="imagePreviewUrl" class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl">
                        <Camera class="w-5 h-5 text-white" />
                      </div>
                      <!-- Uploading spinner -->
                      <div v-if="isUploading" class="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                        <Loader2 class="w-6 h-6 text-emerald-400 animate-spin" />
                      </div>
                    </div>

                    <div class="flex-1 min-w-0">
                      <p class="text-xs text-zinc-500 mb-2">PNG, JPG ou WebP. Maximo 5MB.</p>
                      <button
                        type="button"
                        @click="triggerFileInput"
                        :disabled="isUploading"
                        class="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Upload class="w-3.5 h-3.5" />
                        {{ isUploading ? 'Enviando...' : 'Enviar imagem' }}
                      </button>
                    </div>
                  </div>

                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="hidden"
                    @change="handleImageUpload"
                  />
                </div>

                <!-- Name -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="product-name">
                    Nome do produto *
                  </label>
                  <div class="relative group">
                    <Package class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
                    <input
                      id="product-name"
                      v-model="form.name"
                      type="text"
                      placeholder="Ex: Arroz Integral 1kg"
                      required
                      class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                <!-- Brand -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="product-brand">
                    Marca
                  </label>
                  <div class="relative group">
                    <Tag class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
                    <input
                      id="product-brand"
                      v-model="form.brand"
                      type="text"
                      placeholder="Ex: Tio Joao"
                      class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                <!-- Category -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="product-category">
                    Categoria
                  </label>
                  <div class="relative group">
                    <ShoppingBag class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400 pointer-events-none" />
                    <select
                      id="product-category"
                      v-model="form.category"
                      class="w-full h-12 pl-12 pr-10 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" class="bg-[#09090b] text-zinc-400">Selecione uma categoria</option>
                      <option
                        v-for="cat in categoryOptions"
                        :key="cat"
                        :value="cat"
                        class="bg-[#09090b] text-white"
                      >
                        {{ cat }}
                      </option>
                    </select>
                    <!-- Custom dropdown arrow -->
                    <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <!-- Barcode -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold uppercase tracking-widest text-zinc-400 ml-1" for="product-barcode">
                    Codigo de barras
                  </label>
                  <div class="relative group">
                    <Barcode class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 transition-colors group-focus-within:text-emerald-400" />
                    <input
                      id="product-barcode"
                      v-model="form.barcode"
                      type="text"
                      placeholder="Ex: 7891234567890"
                      class="w-full h-12 pl-12 pr-4 bg-[#09090b]/50 hover:bg-[#09090b]/80 border border-white/5 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </div>
                </div>

                <!-- Modal Actions -->
                <div class="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    @click="closeModal"
                    class="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    :disabled="isSaving || isUploading"
                    class="inline-flex items-center justify-center gap-2 h-11 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 shadow-[0_8px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.4)] border border-emerald-400/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
                    <span>{{ isSaving ? 'Salvando...' : (isEditing ? 'Salvar alteracoes' : 'Cadastrar produto') }}</span>
                  </button>
                </div>
              </form>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

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
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="cancelDelete"></div>

          <!-- Modal -->
          <div class="relative bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-2">Excluir produto?</h3>
            <p class="text-sm text-zinc-400 mb-6">
              Esta acao nao pode ser desfeita. O produto sera removido permanentemente do seu catalogo.
            </p>
            <div class="flex items-center justify-end gap-3">
              <button
                @click="cancelDelete"
                class="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
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
