<script setup lang="ts">
import { Check, X, AlertTriangle, Sparkles, Image as ImageIcon, Package } from 'lucide-vue-next'

interface Product {
  name: string
  offer_price: number | null
  unit: string
  image: string | null
}

const props = defineProps<{
  open: boolean
  products: Product[]
  maxSlots: number
  minSlots: number
  companionTitle: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [selectedProducts: Product[]]
}>()

const selectedIndexes = ref<Set<number>>(new Set())

// Quando abre o modal, pré-seleciona produtos
watch(() => props.open, (val) => {
  if (val) {
    if (props.products.length <= props.maxSlots) {
      // Todos cabem, pré-seleciona todos
      selectedIndexes.value = new Set(props.products.map((_, i) => i))
    } else {
      // Mais produtos que slots, começa sem seleção
      selectedIndexes.value = new Set()
    }
  }
})

const needsSelection = computed(() => props.products.length > props.maxSlots)

const selectedCount = computed(() => selectedIndexes.value.size)

const isValid = computed(() => selectedCount.value === props.maxSlots)

const remaining = computed(() => props.maxSlots - selectedCount.value)

// Mensagem de status
const statusMessage = computed(() => {
  if (!needsSelection.value) {
    return 'Todos os produtos serão incluídos.'
  }
  if (selectedCount.value < props.maxSlots) {
    return `Este design precisa de exatamente ${props.maxSlots} produtos. Selecione mais ${remaining.value}.`
  }
  if (selectedCount.value === props.maxSlots) {
    return 'Seleção completa! Confirme para continuar.'
  }
  return ''
})

// Cor do contador
const counterClass = computed(() => {
  if (selectedCount.value === props.maxSlots) return 'text-emerald-400'
  return 'text-red-400'
})

const resolveImageUrl = (img: string | null): string | null => {
  if (!img) return null
  if (img.startsWith('/api/') || img.startsWith('http')) return img
  return `/api/storage/p?key=${encodeURIComponent(img)}`
}

const formatPrice = (price: number | null): string => {
  if (price === null || price === undefined) return ''
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const toggleProduct = (index: number) => {
  const s = new Set(selectedIndexes.value)
  if (s.has(index)) {
    s.delete(index)
  } else {
    // Não permite selecionar mais que o máximo
    if (s.size >= props.maxSlots) return
    s.add(index)
  }
  selectedIndexes.value = s
}

const isSelected = (index: number) => selectedIndexes.value.has(index)

// Verifica se atingiu o máximo e o item não está selecionado (para desabilitar visualmente)
const isDisabled = (index: number) => {
  return selectedIndexes.value.size >= props.maxSlots && !selectedIndexes.value.has(index)
}

const confirmSelection = () => {
  const selected = props.products.filter((_, i) => selectedIndexes.value.has(i))
  emit('confirm', selected)
  emit('close')
}
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

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div class="relative bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div class="flex items-center gap-3 min-w-0">
                <div class="p-2 bg-violet-500/10 rounded-lg shrink-0">
                  <Sparkles class="w-4 h-4 text-violet-400" />
                </div>
                <div class="min-w-0">
                  <h2 class="text-base font-semibold text-white truncate">{{ companionTitle }}</h2>
                  <p class="text-[11px] text-zinc-500 mt-0.5">Selecione os produtos para este design</p>
                </div>
              </div>
              <button
                @click="emit('close')"
                class="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors shrink-0"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Mensagem de alerta quando precisa selecionar -->
            <div
              v-if="needsSelection"
              class="mx-5 mt-3 flex items-start gap-2.5 px-4 py-3 rounded-xl border"
              :class="isValid
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-amber-500/5 border-amber-500/20'
              "
            >
              <AlertTriangle
                v-if="!isValid"
                class="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
              />
              <Check
                v-else
                class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
              />
              <p class="text-xs leading-relaxed" :class="isValid ? 'text-emerald-300' : 'text-amber-300'">
                {{ statusMessage }}
              </p>
            </div>

            <!-- Lista de produtos -->
            <div class="flex-1 overflow-y-auto px-5 py-3 min-h-0">
              <div v-if="products.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
                <Package class="w-10 h-10 text-zinc-700 mb-3" />
                <p class="text-sm text-zinc-500">Nenhum produto disponível</p>
              </div>

              <div v-else class="space-y-1">
                <button
                  v-for="(p, index) in products"
                  :key="index"
                  @click="toggleProduct(index)"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                  :class="[
                    isSelected(index)
                      ? 'bg-violet-500/10 ring-1 ring-violet-500/30'
                      : isDisabled(index)
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-white/5'
                  ]"
                  :disabled="isDisabled(index)"
                >
                  <!-- Checkbox -->
                  <div
                    class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                    :class="isSelected(index) ? 'bg-violet-600 border-violet-600 scale-110' : 'border-white/20'"
                  >
                    <Transition
                      enter-active-class="transition duration-150 ease-out"
                      enter-from-class="opacity-0 scale-50"
                      enter-to-class="opacity-100 scale-100"
                      leave-active-class="transition duration-100 ease-in"
                      leave-from-class="opacity-100 scale-100"
                      leave-to-class="opacity-0 scale-50"
                    >
                      <Check v-if="isSelected(index)" class="w-3 h-3 text-white" />
                    </Transition>
                  </div>

                  <!-- Imagem -->
                  <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      v-if="resolveImageUrl(p.image)"
                      :src="resolveImageUrl(p.image)!"
                      :alt="p.name"
                      class="w-full h-full object-contain"
                    />
                    <ImageIcon v-else class="w-5 h-5 text-zinc-700" />
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-white truncate">{{ p.name }}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span v-if="p.offer_price !== null" class="text-[11px] font-semibold text-violet-400">
                        {{ formatPrice(p.offer_price) }}
                      </span>
                      <span v-if="p.unit" class="text-[10px] text-zinc-500">
                        {{ p.unit }}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-5 py-3 border-t border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-medium" :class="counterClass">
                  {{ selectedCount }} de {{ maxSlots }} selecionados
                </span>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="emit('close')"
                  class="px-4 py-2 text-zinc-400 hover:text-white hover:bg-white/5 text-sm font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  @click="confirmSelection"
                  :disabled="!isValid"
                  class="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  :title="!isValid ? `Selecione exatamente ${maxSlots} produtos` : ''"
                >
                  Confirmar {{ selectedCount > 0 ? `${selectedCount} produtos` : '' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
