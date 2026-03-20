<script setup lang="ts">
import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { addProduct } = useBuilderFlyer()

const text = ref('')
const addedCount = ref<number | null>(null)

interface ParsedProduct {
  name: string
  price: number | null
}

const parseProductList = (raw: string): ParsedProduct[] => {
  const lines = raw.split('\n')
  const results: ParsedProduct[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Try to match: name <separator> [R$] price
    const match = trimmed.match(/^(.+?)[\s\-\u2013\t]+(?:R\$\s*)?(\d+[.,]\d{2})\s*$/)
    if (match) {
      const name = match[1]!.trim()
      const price = parseFloat(match[2]!.replace(',', '.'))
      results.push({ name, price: isNaN(price) ? null : price })
    } else {
      results.push({ name: trimmed, price: null })
    }
  }

  return results
}

const handleAdd = () => {
  const parsed = parseProductList(text.value)
  if (parsed.length === 0) return

  for (const item of parsed) {
    addProduct({
      custom_name: item.name,
      offer_price: item.price,
      price_mode: 'simple',
    })
  }

  addedCount.value = parsed.length

  // Auto-close after a short delay
  setTimeout(() => {
    text.value = ''
    addedCount.value = null
    emit('close')
  }, 1200)
}

const handleClose = () => {
  text.value = ''
  addedCount.value = null
  emit('close')
}

// Close on Escape key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') handleClose()
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="handleClose"
        />

        <!-- Dialog -->
        <div class="relative bg-[#18181b] rounded-2xl border border-white/5 shadow-2xl w-full max-w-lg overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 class="text-sm font-semibold text-white">Colar Lista de Produtos</h2>
            <button
              @click="handleClose"
              class="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Body -->
          <div class="px-5 py-4 space-y-3">
            <p class="text-[11px] text-zinc-400 leading-relaxed">
              Cole sua lista com um produto por linha. Formato: <span class="text-zinc-300">nome do produto - preco</span>
            </p>

            <div class="bg-[#09090b]/50 border border-white/5 rounded-lg px-3 py-2">
              <p class="text-[10px] text-zinc-500 font-mono leading-relaxed">
                Arroz 5kg - 22,90<br />
                Feijao 1kg - 8,49<br />
                Oleo de soja - 5,99
              </p>
            </div>

            <textarea
              v-model="text"
              placeholder="Cole sua lista aqui..."
              rows="8"
              class="w-full bg-[#09090b]/50 text-[12px] text-white placeholder-zinc-600 outline-none
                border border-white/5 focus:border-emerald-500/50 rounded-lg px-3 py-2.5 transition-colors
                resize-none min-h-[200px] font-mono"
            />

            <!-- Success message -->
            <Transition
              enter-active-class="transition-all duration-200"
              leave-active-class="transition-all duration-150"
              enter-from-class="opacity-0 -translate-y-1"
              leave-to-class="opacity-0"
            >
              <p v-if="addedCount !== null" class="text-xs text-emerald-400 font-medium">
                {{ addedCount }} {{ addedCount === 1 ? 'produto adicionado' : 'produtos adicionados' }}!
              </p>
            </Transition>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5">
            <button
              @click="handleClose"
              class="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white
                hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="handleAdd"
              :disabled="!text.trim()"
              class="px-4 py-2 rounded-lg text-xs font-medium transition-all
                bg-emerald-600 hover:bg-emerald-500 text-white
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
