<script setup lang="ts">
import { Check, X, AlertTriangle, Image, Search, Loader2, Pencil, Camera } from 'lucide-vue-next'

interface ReviewProduct {
  name: string
  offer_price: number | null
  unit: string
  image: string | null
  image_wasabi_key: string | null
}

const props = defineProps<{
  open: boolean
  products: ReviewProduct[]
  pageIndex: number
  totalSlots: number
  tenantId: string
  designType: 'offer' | 'institutional' | 'mixed'
}>()

const emit = defineEmits<{
  close: []
  confirm: [products: ReviewProduct[]]
}>()

// Lista editável local (cópia dos produtos recebidos)
const localProducts = ref<ReviewProduct[]>([])
const isLoadingImages = ref(false)
const autoFilledIndexes = ref<Set<number>>(new Set())
const imageEditorOpen = ref(false)
const editingProductIndex = ref<number | null>(null)

// Unidades disponíveis
const unitOptions = ['KG', 'UN', 'PCT', 'CX', 'LT', 'ML', 'GR', 'DZ', 'BD', 'FD', 'SC', 'GL', 'PT', 'TB', 'LTA', 'CP']

// Resolve URL de imagem (padrão do projeto)
const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

// Contadores computados
const productsWithImage = computed(() =>
  localProducts.value.filter(p => p.image || p.image_wasabi_key).length
)

const productsWithoutImage = computed(() =>
  localProducts.value.filter(p => !p.image && !p.image_wasabi_key).length
)

const totalProducts = computed(() => localProducts.value.length)

const slotsDiff = computed(() => totalProducts.value - props.totalSlots)

const isSlotCountValid = computed(() => slotsDiff.value === 0)

const canConfirm = computed(() => isSlotCountValid.value && !isLoadingImages.value)

// Formata preço para exibição
const formatPrice = (price: number | null): string => {
  if (price === null || price === undefined) return ''
  return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Busca automática de imagens em batch para produtos sem imagem
const batchSearchImages = async () => {
  const termsMap: { index: number; term: string }[] = []
  localProducts.value.forEach((p, i) => {
    if (!p.image && !p.image_wasabi_key) {
      termsMap.push({ index: i, term: p.name })
    }
  })

  if (termsMap.length === 0) return

  isLoadingImages.value = true
  autoFilledIndexes.value = new Set()

  try {
    const res = await $fetch<{ results: Record<string, { image: string; image_wasabi_key: string } | null> }>(
      '/api/builder/batch-search-images',
      {
        method: 'POST',
        body: { terms: termsMap.map(t => t.term) }
      }
    )

    if (res?.results) {
      const filled = new Set<number>()
      termsMap.forEach(({ index, term }) => {
        const match = res.results[term]
        if (match) {
          localProducts.value[index].image = match.image
          localProducts.value[index].image_wasabi_key = match.image_wasabi_key || null
          filled.add(index)
        }
      })
      autoFilledIndexes.value = filled
    }
  } catch (err) {
    // Falha silenciosa - as imagens ficam sem preencher
    console.warn('Falha ao buscar imagens em batch:', err)
  } finally {
    isLoadingImages.value = false
  }
}

// Abre editor de imagem para um produto
const openImageEditor = (index: number) => {
  editingProductIndex.value = index
  imageEditorOpen.value = true
}

// Callback quando imagem é selecionada no editor
const onImageSelected = (data: { image: string; image_wasabi_key: string | null }) => {
  if (editingProductIndex.value !== null) {
    localProducts.value[editingProductIndex.value].image = data.image
    localProducts.value[editingProductIndex.value].image_wasabi_key = data.image_wasabi_key
  }
  imageEditorOpen.value = false
  editingProductIndex.value = null
}

// Confirma e emite produtos finais
const confirmAndSend = () => {
  if (!canConfirm.value) return
  emit('confirm', localProducts.value.map(p => ({ ...p })))
}

// Watch para inicializar ao abrir
watch(() => props.open, (val) => {
  if (val) {
    // Cria cópia profunda dos produtos
    localProducts.value = props.products.map(p => ({ ...p }))
    autoFilledIndexes.value = new Set()
    imageEditorOpen.value = false
    editingProductIndex.value = null
    // Busca imagens automaticamente
    batchSearchImages()
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

        <div class="relative bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <h2 class="text-base font-semibold text-white">
                Conferência — Página {{ pageIndex }}
              </h2>
              <p class="text-[11px] text-zinc-500 mt-0.5">
                {{ totalSlots }} produtos necessários nesta página
              </p>
            </div>
            <button
              @click="emit('close')"
              class="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Status bar -->
          <div class="px-5 py-3 border-b border-white/5 space-y-1.5">
            <!-- Validação de quantidade -->
            <div
              v-if="!isSlotCountValid"
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
              :class="slotsDiff < 0 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'"
            >
              <AlertTriangle class="w-4 h-4 shrink-0" />
              <span>
                Esta página precisa de exatamente {{ totalSlots }} produtos.
                Você tem {{ totalProducts }}.
              </span>
            </div>

            <div v-else class="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium">
              <Check class="w-4 h-4 shrink-0" />
              <span>Quantidade de produtos correta ({{ totalProducts }}/{{ totalSlots }})</span>
            </div>

            <!-- Aviso de imagens faltantes -->
            <div
              v-if="productsWithoutImage > 0"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium"
            >
              <Camera class="w-4 h-4 shrink-0" />
              <span>
                {{ productsWithoutImage }} produto{{ productsWithoutImage > 1 ? 's' : '' }} sem imagem. Clique para adicionar.
              </span>
            </div>

            <!-- Loading de busca de imagens -->
            <div
              v-if="isLoadingImages"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-medium"
            >
              <Loader2 class="w-4 h-4 shrink-0 animate-spin" />
              <span>Buscando imagens automaticamente...</span>
            </div>

            <!-- Imagens preenchidas automaticamente -->
            <div
              v-if="autoFilledIndexes.size > 0 && !isLoadingImages"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-medium"
            >
              <Search class="w-4 h-4 shrink-0" />
              <span>
                {{ autoFilledIndexes.size }} imagem{{ autoFilledIndexes.size > 1 ? 'ns' : '' }}
                preenchida{{ autoFilledIndexes.size > 1 ? 's' : '' }} automaticamente
              </span>
            </div>
          </div>

          <!-- Lista de produtos -->
          <div class="flex-1 overflow-y-auto px-5 py-3 min-h-0 space-y-2">
            <div
              v-for="(product, idx) in localProducts"
              :key="idx"
              class="flex gap-3 p-3 rounded-xl border transition-all"
              :class="[
                !product.image && !product.image_wasabi_key
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : autoFilledIndexes.has(idx)
                    ? 'border-violet-500/20 bg-violet-500/5'
                    : 'border-white/5 bg-white/[0.02]'
              ]"
            >
              <!-- Imagem / Placeholder -->
              <button
                @click="openImageEditor(idx)"
                class="relative w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0 group cursor-pointer hover:ring-2 hover:ring-violet-500/40 transition-all"
              >
                <img
                  v-if="resolveImageUrl(product.image) || resolveImageUrl(product.image_wasabi_key)"
                  :src="(resolveImageUrl(product.image) || resolveImageUrl(product.image_wasabi_key))!"
                  class="w-full h-full object-contain"
                />
                <div v-else class="flex flex-col items-center gap-1">
                  <Image class="w-6 h-6 text-zinc-600" />
                  <span class="text-[8px] text-zinc-600">sem img</span>
                </div>

                <!-- Overlay ao hover -->
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera class="w-5 h-5 text-white" />
                </div>

                <!-- Badge auto-preenchido -->
                <div
                  v-if="autoFilledIndexes.has(idx)"
                  class="absolute -top-1 -right-1 w-4 h-4 bg-violet-600 rounded-full flex items-center justify-center"
                >
                  <Search class="w-2.5 h-2.5 text-white" />
                </div>
              </button>

              <!-- Dados editáveis -->
              <div class="flex-1 min-w-0 space-y-2">
                <!-- Número + Nome -->
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-zinc-600 font-mono shrink-0 w-5 text-right">
                    {{ idx + 1 }}.
                  </span>
                  <div class="relative flex-1">
                    <input
                      v-model="product.name"
                      class="w-full h-8 px-3 pr-8 bg-white/5 border border-white/5 rounded-lg text-sm text-white font-medium uppercase outline-none focus:border-violet-500/50 transition-colors truncate"
                      placeholder="Nome do produto"
                    />
                    <Pencil class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
                  </div>
                </div>

                <!-- Preço + Unidade -->
                <div class="flex items-center gap-2 ml-7">
                  <div class="relative flex-1 max-w-[140px]">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">R$</span>
                    <input
                      :value="formatPrice(product.offer_price)"
                      @input="(e: Event) => {
                        const val = (e.target as HTMLInputElement).value.replace(/[^\d,\.]/g, '').replace(',', '.')
                        product.offer_price = val ? parseFloat(val) : null
                      }"
                      class="w-full h-7 pl-8 pr-3 bg-white/5 border border-white/5 rounded-lg text-xs text-white outline-none focus:border-violet-500/50 transition-colors"
                      placeholder="0,00"
                    />
                  </div>

                  <select
                    v-model="product.unit"
                    class="h-7 px-2 bg-white/5 border border-white/5 rounded-lg text-xs text-white outline-none focus:border-violet-500/50 transition-colors appearance-none cursor-pointer"
                  >
                    <option v-for="u in unitOptions" :key="u" :value="u" class="bg-zinc-900 text-white">
                      {{ u }}
                    </option>
                  </select>

                  <!-- Botão trocar/buscar imagem -->
                  <button
                    @click="openImageEditor(idx)"
                    class="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors"
                    :class="product.image || product.image_wasabi_key
                      ? 'text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10'
                      : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'"
                  >
                    <Camera class="w-3 h-3" />
                    {{ product.image || product.image_wasabi_key ? 'trocar' : 'buscar img' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Estado vazio -->
            <div v-if="localProducts.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle class="w-10 h-10 text-zinc-700 mb-3" />
              <p class="text-sm text-zinc-500">Nenhum produto para conferir</p>
              <p class="text-xs text-zinc-600 mt-1">Adicione produtos antes de enviar ao Canva</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 border-t border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-2 text-[11px] text-zinc-500">
              <span
                class="font-medium"
                :class="isSlotCountValid ? 'text-emerald-400' : 'text-red-400'"
              >
                {{ totalProducts }}/{{ totalSlots }} produtos
              </span>
              <span class="text-zinc-700">·</span>
              <span>{{ productsWithImage }} com imagem</span>
            </div>

            <div class="flex items-center gap-2">
              <button
                @click="emit('close')"
                class="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium"
              >
                Voltar
              </button>
              <button
                @click="confirmAndSend"
                :disabled="!canConfirm"
                class="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check class="w-4 h-4" />
                Confirmar e Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Editor de imagem (lazy) -->
  <LazyCanvaImageEditor
    v-if="imageEditorOpen && editingProductIndex !== null"
    :open="imageEditorOpen"
    :product-name="localProducts[editingProductIndex]?.name || ''"
    :current-image="localProducts[editingProductIndex]?.image || null"
    :tenant-id="tenantId"
    @close="imageEditorOpen = false; editingProductIndex = null"
    @select="onImageSelected"
  />
</template>
