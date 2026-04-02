<script setup lang="ts">
import {
  ArrowLeft, Loader2, Image, Type, DollarSign, Package, Layers,
  Check, X, Download, ExternalLink, ClipboardPaste, ShoppingCart,
  Wand2, Eye, Save, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-vue-next'
import type { CanvaMappedProduct, CanvaProductMapping } from '~/types/canva'

definePageMeta({
  layout: false,
  middleware: 'builder-auth',
})

const route = useRoute()
const designId = route.params.id as string
const canva = useCanva()

// Estado local
const isLoading = ref(true)
const currentPage = ref(1)
const showCatalogPicker = ref(false)
const showPasteList = ref(false)
const designInfo = ref<any>(null)
const thumbnailUrl = ref<string | null>(null)
const productList = ref<CanvaMappedProduct[]>([])
const step = ref<'loading' | 'mapping' | 'preview' | 'done'>('loading')
const previewUrls = ref<string[]>([])

// Formato de preco
const formatPrice = (price: number | null): string => {
  if (price === null || price === undefined) return '--'
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Resolver URL da imagem do produto
const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

// Carregar informacoes do design
const loadDesign = async () => {
  isLoading.value = true
  step.value = 'loading'
  try {
    // Buscar info do design via API
    const data = await $fetch<any>(`/api/canva/designs/${designId}`)
    designInfo.value = data
    thumbnailUrl.value = data?.thumbnail?.url || null
    step.value = 'mapping'
  } catch (err: any) {
    console.error('Erro ao carregar design:', err)
    canva.error.value = 'Erro ao carregar design do Canva'
  } finally {
    isLoading.value = false
  }
}

// Adicionar produto manual
const addProduct = () => {
  productList.value.push({
    name: '',
    offer_price: null,
    unit: 'UN',
    image: null,
  })
}

// Remover produto
const removeProduct = (index: number) => {
  productList.value.splice(index, 1)
}

// Receber produtos do catalogo
const onCatalogSelect = (products: Array<{ name: string; image: string | null; brand: string | null }>) => {
  for (const p of products) {
    productList.value.push({
      name: p.name,
      offer_price: null,
      unit: 'UN',
      image: p.image,
      image_wasabi_key: p.image,
    })
  }
}

// Receber produtos da lista colada
const onPasteProducts = (items: Array<{ name: string; price: number | null }>) => {
  for (const item of items) {
    productList.value.push({
      name: item.name,
      offer_price: item.price,
      unit: 'UN',
      image: null,
    })
  }
}

// Aplicar produtos no design (via MCP por enquanto)
const applyProducts = async () => {
  if (productList.value.length === 0) return
  step.value = 'preview'
  // TODO: Quando a Canva Connect API estiver integrada,
  // aqui vai iniciar a transacao, detectar slots, mapear e aplicar
}

// Voltar
const goBack = () => {
  navigateTo('/canva')
}

onMounted(() => {
  loadDesign()
})
</script>

<template>
  <div class="min-h-screen bg-[#0f0f0f] text-white">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-white/5 bg-[#0f0f0f]/90 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <button @click="goBack" class="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft class="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <h1 class="text-sm font-semibold text-white truncate max-w-[300px]">
          {{ designInfo?.title || 'Carregando...' }}
        </h1>

        <div class="flex items-center gap-2">
          <a
            v-if="designInfo?.urls?.edit_url"
            :href="designInfo.urls.edit_url"
            target="_blank"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Abrir no Canva</span>
          </a>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-32">
      <div class="text-center">
        <Loader2 class="w-8 h-8 text-violet-500 animate-spin mx-auto mb-4" />
        <p class="text-sm text-zinc-500">Carregando design...</p>
      </div>
    </div>

    <!-- Conteudo Principal -->
    <div v-else class="max-w-7xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Coluna Esquerda: Preview do Design -->
        <div>
          <div class="bg-[#18181b]/80 border border-white/5 rounded-2xl overflow-hidden">
            <!-- Preview -->
            <div class="aspect-square bg-[#09090b] flex items-center justify-center p-4">
              <img
                v-if="thumbnailUrl"
                :src="thumbnailUrl"
                :alt="designInfo?.title"
                class="max-w-full max-h-full object-contain rounded-lg"
              />
              <div v-else class="text-center">
                <Image class="w-16 h-16 text-zinc-700 mx-auto mb-3" />
                <p class="text-sm text-zinc-500">Preview nao disponivel</p>
              </div>
            </div>

            <!-- Info do Design -->
            <div class="p-4 border-t border-white/5">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-sm font-semibold text-white">{{ designInfo?.title || 'Sem titulo' }}</h2>
                  <p class="text-[11px] text-zinc-500 mt-0.5">
                    {{ designInfo?.page_count || 1 }} pagina(s)
                  </p>
                </div>

                <!-- Paginacao se multiplas paginas -->
                <div v-if="designInfo?.page_count > 1" class="flex items-center gap-1">
                  <button
                    @click="currentPage = Math.max(1, currentPage - 1)"
                    :disabled="currentPage === 1"
                    class="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft class="w-4 h-4" />
                  </button>
                  <span class="text-xs text-zinc-400 min-w-[40px] text-center">
                    {{ currentPage }}/{{ designInfo?.page_count }}
                  </span>
                  <button
                    @click="currentPage = Math.min(designInfo?.page_count || 1, currentPage + 1)"
                    :disabled="currentPage === (designInfo?.page_count || 1)"
                    class="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Coluna Direita: Lista de Produtos -->
        <div>
          <div class="bg-[#18181b]/80 border border-white/5 rounded-2xl overflow-hidden">
            <!-- Header da lista -->
            <div class="px-5 py-4 border-b border-white/5">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-base font-semibold text-white">Lista de Produtos</h2>
                <span class="text-[11px] text-zinc-500">{{ productList.length }} produtos</span>
              </div>

              <!-- Botoes de acao -->
              <div class="flex flex-wrap gap-2">
                <button
                  @click="showCatalogPicker = true"
                  class="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-medium rounded-lg transition-colors border border-violet-500/20"
                >
                  <ShoppingCart class="w-3.5 h-3.5" />
                  Catalogo
                </button>
                <button
                  @click="showPasteList = true"
                  class="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-white/5"
                >
                  <ClipboardPaste class="w-3.5 h-3.5" />
                  Colar Lista
                </button>
                <button
                  @click="addProduct"
                  class="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium rounded-lg transition-colors border border-white/5"
                >
                  <Package class="w-3.5 h-3.5" />
                  Manual
                </button>
              </div>
            </div>

            <!-- Lista de produtos -->
            <div class="max-h-[500px] overflow-y-auto">
              <!-- Vazio -->
              <div v-if="productList.length === 0" class="flex flex-col items-center justify-center py-16 text-center px-4">
                <Package class="w-12 h-12 text-zinc-700 mb-3" />
                <p class="text-sm text-zinc-400 mb-1">Nenhum produto adicionado</p>
                <p class="text-[11px] text-zinc-600">Use o catalogo, cole uma lista ou adicione manualmente</p>
              </div>

              <!-- Cards de produto -->
              <div v-else class="divide-y divide-white/5">
                <div
                  v-for="(product, index) in productList"
                  :key="index"
                  class="px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <!-- Numero -->
                    <div class="w-6 h-6 rounded-md bg-violet-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <span class="text-[10px] font-bold text-violet-400">{{ index + 1 }}</span>
                    </div>

                    <!-- Imagem do produto -->
                    <div class="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                      <img
                        v-if="resolveImageUrl(product.image ?? null)"
                        :src="resolveImageUrl(product.image ?? null)!"
                        class="w-full h-full object-contain"
                      />
                      <Image v-else class="w-5 h-5 text-zinc-700" />
                    </div>

                    <!-- Campos editaveis -->
                    <div class="flex-1 min-w-0 space-y-2">
                      <input
                        v-model="product.name"
                        placeholder="Nome do produto"
                        class="w-full h-8 px-2.5 bg-white/5 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
                      />
                      <div class="flex gap-2">
                        <div class="relative flex-1">
                          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">R$</span>
                          <input
                            v-model.number="product.offer_price"
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            class="w-full h-8 pl-8 pr-2.5 bg-white/5 border border-white/5 rounded-lg text-sm text-emerald-400 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition-colors"
                          />
                        </div>
                        <select
                          v-model="product.unit"
                          class="h-8 px-2 bg-white/5 border border-white/5 rounded-lg text-xs text-zinc-300 outline-none focus:border-violet-500/50 transition-colors"
                        >
                          <option value="UN">UN</option>
                          <option value="KG">KG</option>
                          <option value="G">G</option>
                          <option value="L">L</option>
                          <option value="ML">ML</option>
                          <option value="PCT">PCT</option>
                          <option value="CX">CX</option>
                          <option value="DZ">DZ</option>
                        </select>
                      </div>
                    </div>

                    <!-- Remover -->
                    <button
                      @click="removeProduct(index)"
                      class="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    >
                      <X class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer com botao aplicar -->
            <div v-if="productList.length > 0" class="px-5 py-4 border-t border-white/5">
              <button
                @click="applyProducts"
                :disabled="canva.isProcessing.value || productList.every(p => !p.name)"
                class="w-full flex items-center justify-center gap-2 h-11 bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-semibold transition-all shadow-[0_8px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_12px_25px_rgba(139,92,246,0.4)] border border-violet-400/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Loader2 v-if="canva.isProcessing.value" class="w-4 h-4 animate-spin" />
                <Wand2 v-else class="w-4 h-4" />
                <span>{{ canva.isProcessing.value ? 'Aplicando...' : 'Aplicar no Design' }}</span>
              </button>
            </div>
          </div>

          <!-- Card de instrucoes -->
          <div class="mt-4 bg-violet-500/5 border border-violet-500/10 rounded-xl p-4">
            <h3 class="text-xs font-semibold text-violet-300 mb-2">Como funciona</h3>
            <ol class="text-[11px] text-zinc-400 space-y-1.5 list-decimal list-inside">
              <li>Adicione produtos usando o catalogo, colando uma lista ou manualmente</li>
              <li>Preencha nome, preco e selecione a imagem de cada produto</li>
              <li>Clique em "Aplicar no Design" para substituir automaticamente</li>
              <li>Revise o resultado e exporte ou edite no Canva</li>
            </ol>
          </div>
        </div>
      </div>
    </div>

    <!-- Catalog Picker (reutilizado do builder) -->
    <CanvaCatalogPicker
      :open="showCatalogPicker"
      @close="showCatalogPicker = false"
      @select="onCatalogSelect"
    />

    <!-- Paste List Dialog -->
    <CanvaPasteListDialog
      :open="showPasteList"
      @close="showPasteList = false"
      @add="onPasteProducts"
    />
  </div>
</template>
