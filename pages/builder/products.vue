<script setup lang="ts">
import {
  Search, Plus, Pencil, Trash2, X, Upload, Loader2, Package,
  Camera, List, ClipboardPaste, ImageOff, Wand2, Eraser,
} from 'lucide-vue-next'

definePageMeta({
  layout: 'builder',
  middleware: 'builder-auth',
  ssr: false,
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

// Modal
const showModal = ref(false)
const isEditing = ref(false)
const editingProductId = ref<string | null>(null)
const isSaving = ref(false)
const isUploading = ref(false)
const errorMessage = ref('')

// Delete
const confirmDeleteId = ref<string | null>(null)
const deletingId = ref<string | null>(null)

// Bulk
const showBulkModal = ref(false)
const bulkText = ref('')
const bulkSaving = ref(false)
const bulkError = ref('')

// Form
const form = reactive({
  name: '',
  image: '' as string | null,
})

// ── Helpers ─────────────────────────────────────────────────────────────────────
const resolveImageUrl = (image: string | null): string | null => {
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

const onSearchInput = () => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  searchTimeout.value = setTimeout(() => {
    fetchProducts(searchQuery.value.trim() || undefined)
  }, 400)
}

// ── Modal ───────────────────────────────────────────────────────────────────────
const resetForm = () => {
  form.name = ''
  form.image = null
  errorMessage.value = ''
  imageSearchResults.value = []
  showImageSearch.value = false
}

const openNewProduct = () => {
  resetForm()
  isEditing.value = false
  editingProductId.value = null
  showModal.value = true
}

const openEditProduct = (product: Product) => {
  form.name = product.name || ''
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

// ── Image search (banco de imagens) ─────────────────────────────────────────────
interface SearchImageResult {
  key: string
  url: string
  name: string
}

const imageSearchResults = ref<SearchImageResult[]>([])
const isSearchingImages = ref(false)
const showImageSearch = ref(false)

const searchImages = async () => {
  const name = form.name.trim()
  if (name.length < 2) { errorMessage.value = 'Digite o nome do produto primeiro.'; return }

  isSearchingImages.value = true
  showImageSearch.value = true
  imageSearchResults.value = []

  try {
    const data = await $fetch<{ candidates: Array<{ key: string; url: string; name: string }> }>('/api/builder/search-image', {
      method: 'POST',
      body: { term: name },
    })

    imageSearchResults.value = (data.candidates || []).map(c => ({
      key: c.key,
      url: c.url,
      name: c.name || '',
    }))
  } catch {
    imageSearchResults.value = []
  } finally {
    isSearchingImages.value = false
  }
}

const selectSearchImage = (img: SearchImageResult) => {
  form.image = img.key
  showImageSearch.value = false
  imageSearchResults.value = []
}

// ── Remove background ───────────────────────────────────────────────────────────
const isRemovingBg = ref(false)

const removeBackground = async (s3Key: string) => {
  isRemovingBg.value = true
  try {
    const data = await $fetch<{ url: string; key?: string }>('/api/builder/remove-bg', {
      method: 'POST',
      body: { s3Key },
    })
    if (data.key) {
      form.image = data.key
    }
  } catch {
    errorMessage.value = 'Erro ao remover fundo.'
  } finally {
    isRemovingBg.value = false
  }
}

// ── Upload ──────────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const triggerFileInput = () => fileInput.value?.click()

const handleImageUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMessage.value = 'Selecione uma imagem valida.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'Maximo 5MB.'
    return
  }

  const tenantId = auth.tenant.value?.id
  if (!tenantId) return

  isUploading.value = true
  errorMessage.value = ''

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const key = `builder/${tenantId}/products/product_${Date.now()}.${ext}`
    const contentType = file.type || 'image/png'
    const buffer = await file.arrayBuffer()

    const result = await $fetch<{ key: string }>('/api/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType },
      body: buffer,
      headers: { 'Content-Type': contentType },
    })

    if (result.key) {
      // Auto remove background
      try {
        const bgData = await $fetch<{ url: string; key?: string }>('/api/builder/remove-bg', {
          method: 'POST',
          body: { s3Key: result.key },
        })
        form.image = bgData.key || result.key
      } catch {
        // If bg removal fails, use original
        form.image = result.key
      }
    }
  } catch {
    errorMessage.value = 'Erro ao enviar imagem.'
  } finally {
    isUploading.value = false
    if (input) input.value = ''
  }
}

// ── Save ────────────────────────────────────────────────────────────────────────
const saveProduct = async () => {
  if (isSaving.value) return
  if (!form.name.trim()) {
    errorMessage.value = 'O nome do produto e obrigatorio.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''

  try {
    if (isEditing.value && editingProductId.value) {
      const data = await $fetch<{ product: Product }>(`/api/builder/products/${editingProductId.value}`, {
        method: 'PUT',
        body: { name: form.name.trim(), image: form.image || null },
      })
      const idx = products.value.findIndex(p => p.id === editingProductId.value)
      if (idx !== -1 && data.product) products.value[idx] = data.product
    } else {
      const data = await $fetch<{ product: Product }>('/api/builder/products', {
        method: 'POST',
        body: { name: form.name.trim(), image: form.image || null },
      })
      if (data.product) {
        products.value.unshift(data.product)
        products.value.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      }
    }
    closeModal()
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || 'Erro ao salvar produto.'
  } finally {
    isSaving.value = false
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────────
const requestDelete = (id: string) => { confirmDeleteId.value = id }
const cancelDelete = () => { confirmDeleteId.value = null }

const confirmDelete = async () => {
  const id = confirmDeleteId.value
  if (!id) return
  confirmDeleteId.value = null
  deletingId.value = id
  try {
    await $fetch(`/api/builder/products/${id}`, { method: 'DELETE' })
    products.value = products.value.filter(p => p.id !== id)
  } catch {
    // silently fail
  } finally {
    deletingId.value = null
  }
}

// ── Bulk ────────────────────────────────────────────────────────────────────────
const bulkParsedProducts = computed(() => {
  if (!bulkText.value.trim()) return []
  return bulkText.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(line => {
      for (const sep of [' - ', ' | ', ' ; ', '\t']) {
        const idx = line.indexOf(sep)
        if (idx > 0) return { name: line.slice(0, idx).trim() }
      }
      return { name: line }
    })
})

const openBulkModal = () => { bulkText.value = ''; bulkError.value = ''; showBulkModal.value = true }
const closeBulkModal = () => { showBulkModal.value = false; bulkText.value = ''; bulkError.value = '' }

const saveBulkProducts = async () => {
  if (bulkSaving.value) return
  const items = bulkParsedProducts.value
  if (items.length === 0) { bulkError.value = 'Insira pelo menos um produto.'; return }
  if (items.length > 200) { bulkError.value = 'Maximo 200 por vez.'; return }

  bulkSaving.value = true
  bulkError.value = ''
  try {
    const data = await $fetch<{ products: Product[] }>('/api/builder/products/bulk', {
      method: 'POST',
      body: { products: items },
    })
    if (data.products) {
      products.value.push(...data.products)
      products.value.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    }
    closeBulkModal()
  } catch (err: any) {
    bulkError.value = err?.data?.statusMessage || 'Erro ao importar.'
  } finally {
    bulkSaving.value = false
  }
}

// ── Init ────────────────────────────────────────────────────────────────────────
onMounted(() => fetchProducts())
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-6">

    <!-- Explicacao -->
    <div class="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
      <p class="text-sm text-gray-600 leading-relaxed">
        Cadastre aqui os produtos da sua loja. Depois, ao criar um encarte, voce pode puxar esses produtos direto do catalogo sem precisar digitar tudo de novo.
      </p>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Meus Produtos</h1>
        <p class="text-xs text-gray-500 mt-0.5">{{ products.length }} produtos cadastrados</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="openBulkModal" class="inline-flex items-center gap-1.5 h-9 px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-lg text-xs font-medium transition-all border border-gray-200">
          <List class="w-3.5 h-3.5" />
          Cadastrar Lista
        </button>
        <button @click="openNewProduct" class="inline-flex items-center gap-1.5 h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all">
          <Plus class="w-3.5 h-3.5" />
          Novo Produto
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="mb-4">
      <div class="relative max-w-sm">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          type="text"
          placeholder="Buscar produto..."
          class="w-full h-9 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500/50 transition-colors"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div v-for="i in 8" :key="i" class="bg-gray-100 rounded-xl animate-pulse h-40"></div>
    </div>

    <!-- Empty -->
    <div v-else-if="products.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
      <Package class="w-12 h-12 text-gray-400 mb-3" />
      <p class="text-sm text-gray-600 mb-1">{{ searchQuery.trim() ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado' }}</p>
      <p class="text-xs text-gray-400 mb-4">{{ searchQuery.trim() ? 'Tente outro termo.' : 'Cadastre seus produtos para usar nos encartes.' }}</p>
      <div v-if="!searchQuery.trim()" class="flex gap-2">
        <button @click="openBulkModal" class="inline-flex items-center gap-1.5 h-9 px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium border border-gray-200 transition-all">
          <List class="w-3.5 h-3.5" />
          Cadastrar Lista
        </button>
        <button @click="openNewProduct" class="inline-flex items-center gap-1.5 h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all">
          <Plus class="w-3.5 h-3.5" />
          Novo Produto
        </button>
      </div>
    </div>

    <!-- Products grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div
        v-for="product in products"
        :key="product.id"
        class="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-all shadow-sm"
      >
        <!-- Image -->
        <div class="relative h-32 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer" @click="openEditProduct(product)">
          <img
            v-if="resolveImageUrl(product.image)"
            :src="resolveImageUrl(product.image)!"
            :alt="product.name"
            class="w-full h-full object-contain p-2"
          />
          <Package v-else class="w-8 h-8 text-gray-300" />
        </div>

        <!-- Info -->
        <div class="p-3 flex items-start justify-between gap-2">
          <h3 class="text-xs font-semibold text-gray-900 truncate flex-1 group-hover:text-emerald-600 transition-colors cursor-pointer" @click="openEditProduct(product)">
            {{ product.name }}
          </h3>
          <div class="flex items-center gap-0.5 shrink-0">
            <button @click="openEditProduct(product)" class="p-1 text-gray-400 hover:text-emerald-600 rounded transition-colors" title="Editar">
              <Pencil class="w-3 h-3" />
            </button>
            <button @click="requestDelete(product.id)" :disabled="deletingId === product.id" class="p-1 text-gray-400 hover:text-red-500 rounded transition-colors disabled:opacity-50" title="Excluir">
              <Loader2 v-if="deletingId === product.id" class="w-3 h-3 animate-spin" />
              <Trash2 v-else class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Form Modal -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="showModal" class="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeModal"></div>
          <div class="relative bg-white border border-gray-200 rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-base font-semibold text-gray-900">{{ isEditing ? 'Editar Produto' : 'Novo Produto' }}</h2>
              <button @click="closeModal" class="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <X class="w-4 h-4" />
              </button>
            </div>

            <div v-if="errorMessage" class="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p class="text-xs text-red-400">{{ errorMessage }}</p>
            </div>

            <form @submit.prevent="saveProduct" class="space-y-4">
              <!-- Name -->
              <input
                v-model="form.name"
                type="text"
                placeholder="Nome do produto (ex: Arroz Tio Joao 1kg)"
                required
                class="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />

              <!-- Image selected -->
              <div v-if="resolveImageUrl(form.image)" class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <img :src="resolveImageUrl(form.image)!" alt="" class="w-16 h-16 object-contain rounded-lg bg-gray-100 p-1" />
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] text-gray-500">Imagem selecionada</p>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button type="button" @click="removeBackground(form.image!)" :disabled="isRemovingBg" class="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50" title="Remover fundo">
                    <Loader2 v-if="isRemovingBg" class="w-3.5 h-3.5 animate-spin" />
                    <Eraser v-else class="w-3.5 h-3.5" />
                  </button>
                  <button type="button" @click="triggerFileInput" class="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="Trocar imagem">
                    <Camera class="w-3.5 h-3.5" />
                  </button>
                  <button type="button" @click="form.image = null" class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remover imagem">
                    <ImageOff class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- No image: actions -->
              <div v-else class="space-y-3">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="searchImages"
                    :disabled="isSearchingImages || form.name.trim().length < 2"
                    class="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Loader2 v-if="isSearchingImages" class="w-3.5 h-3.5 animate-spin" />
                    <Wand2 v-else class="w-3.5 h-3.5" />
                    Buscar no banco
                  </button>
                  <button
                    type="button"
                    @click="triggerFileInput"
                    :disabled="isUploading"
                    class="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Loader2 v-if="isUploading" class="w-3.5 h-3.5 animate-spin" />
                    <Upload v-else class="w-3.5 h-3.5" />
                    {{ isUploading ? 'Enviando e removendo fundo...' : 'Enviar minha foto' }}
                  </button>
                </div>
                <p class="text-[10px] text-gray-400 ml-0.5">Ao enviar sua foto, o fundo e removido automaticamente.</p>

                <!-- Image search results -->
                <div v-if="showImageSearch" class="bg-gray-50 border border-gray-200 rounded-xl p-2.5">
                  <div v-if="isSearchingImages" class="flex items-center justify-center py-6">
                    <Loader2 class="w-5 h-5 text-blue-400 animate-spin" />
                  </div>
                  <div v-else-if="imageSearchResults.length === 0" class="py-4 text-center">
                    <p class="text-[11px] text-gray-500">Nenhuma imagem encontrada para "{{ form.name }}"</p>
                  </div>
                  <div v-else>
                    <p class="text-[10px] text-gray-500 mb-2">{{ imageSearchResults.length }} resultados — clique para selecionar</p>
                    <div class="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                      <button
                        v-for="(img, i) in imageSearchResults"
                        :key="i"
                        type="button"
                        @click="selectSearchImage(img)"
                        class="flex flex-col bg-white rounded-lg overflow-hidden border border-gray-200 hover:border-emerald-500/50 hover:ring-1 hover:ring-emerald-500/30 transition-all"
                      >
                        <div class="aspect-square p-1 flex items-center justify-center">
                          <img :src="img.url" class="w-full h-full object-contain" loading="lazy" />
                        </div>
                        <div class="px-1.5 pb-1.5 pt-0.5">
                          <p class="text-[9px] text-gray-500 leading-tight line-clamp-2 text-center">{{ img.name }}</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="handleImageUpload" />

              <div class="flex items-center justify-end gap-2 pt-1">
                <button type="button" @click="closeModal" class="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" :disabled="isSaving || isUploading" class="inline-flex items-center gap-1.5 h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-40">
                  <Loader2 v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
                  {{ isSaving ? 'Salvando...' : (isEditing ? 'Salvar' : 'Cadastrar') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Bulk Modal -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="showBulkModal" class="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeBulkModal"></div>
          <div class="relative bg-white border border-gray-200 rounded-2xl p-5 max-w-xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="text-base font-semibold text-gray-900">Cadastrar Lista</h2>
                <p class="text-[11px] text-gray-500">Um produto por linha</p>
              </div>
              <button @click="closeBulkModal" class="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <X class="w-4 h-4" />
              </button>
            </div>

            <div v-if="bulkError" class="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p class="text-xs text-red-400">{{ bulkError }}</p>
            </div>

            <div class="mb-2 p-2 bg-gray-50 rounded-lg text-[10px] text-gray-500 font-mono leading-relaxed">
              Arroz Integral 1kg<br/>Feijao Carioca 1kg<br/>Leite Integral 1L
            </div>

            <textarea
              v-model="bulkText"
              placeholder="Cole a lista de produtos aqui..."
              class="flex-1 min-h-40 max-h-[40vh] w-full bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 p-3 focus:outline-none focus:border-emerald-500/50 transition-all resize-none font-mono leading-relaxed"
            ></textarea>

            <div class="flex items-center justify-between mt-3">
              <span v-if="bulkParsedProducts.length > 0" class="text-xs font-medium px-2 py-0.5 rounded-md" :class="bulkParsedProducts.length > 200 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'">
                {{ bulkParsedProducts.length }} produtos
              </span>
              <div v-else></div>
              <div class="flex items-center gap-2">
                <button @click="closeBulkModal" class="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900 rounded-lg transition-colors">Cancelar</button>
                <button @click="saveBulkProducts" :disabled="bulkSaving || bulkParsedProducts.length === 0 || bulkParsedProducts.length > 200" class="inline-flex items-center gap-1.5 h-8 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40">
                  <Loader2 v-if="bulkSaving" class="w-3.5 h-3.5 animate-spin" />
                  <ClipboardPaste v-else class="w-3.5 h-3.5" />
                  {{ bulkSaving ? 'Cadastrando...' : 'Cadastrar todos' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="confirmDeleteId" class="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="cancelDelete"></div>
          <div class="relative bg-white border border-gray-200 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 class="text-base font-semibold text-gray-900 mb-2">Excluir produto?</h3>
            <p class="text-sm text-gray-500 mb-5">O produto sera removido permanentemente.</p>
            <div class="flex items-center justify-end gap-2">
              <button @click="cancelDelete" class="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 rounded-lg transition-colors">Cancelar</button>
              <button @click="confirmDelete" class="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
