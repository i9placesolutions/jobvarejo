<script setup lang="ts">
import { Sparkles, X, Image as ImageIcon } from 'lucide-vue-next'

const props = defineProps<{
  companion: {
    id: string
    title: string
    thumbnail_url: string | null
    page_count: number
    products_per_page: Record<string, number> | null
    label: string
  }
  totalProducts: number
}>()

const emit = defineEmits<{
  accept: []
  dismiss: []
}>()

const dismissed = ref(false)

// Calcula total de slots disponíveis somando products_per_page
const totalSlots = computed(() => {
  if (!props.companion.products_per_page) return 0
  return Object.values(props.companion.products_per_page).reduce((sum, v) => sum + v, 0)
})

const handleDismiss = () => {
  dismissed.value = true
  emit('dismiss')
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="!dismissed"
      class="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/60 via-[#18181b] to-purple-950/40 shadow-lg shadow-violet-500/5"
    >
      <!-- Botão fechar -->
      <button
        @click="handleDismiss"
        class="absolute top-3 right-3 p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10"
      >
        <X class="w-4 h-4" />
      </button>

      <div class="px-5 py-4 flex items-center gap-4">
        <!-- Thumbnail do companion -->
        <div class="shrink-0 w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
          <img
            v-if="companion.thumbnail_url"
            :src="companion.thumbnail_url"
            :alt="companion.title"
            class="w-full h-full object-cover"
          />
          <ImageIcon v-else class="w-7 h-7 text-zinc-600" />
        </div>

        <!-- Conteúdo -->
        <div class="flex-1 min-w-0 pr-6">
          <div class="flex items-center gap-2 mb-1">
            <Sparkles class="w-4 h-4 text-violet-400 shrink-0" />
            <p class="text-sm font-semibold text-white truncate">
              Aproveite e faça para {{ companion.label }} também!
            </p>
          </div>
          <p class="text-[11px] text-zinc-400 mb-3">
            {{ companion.title }} · {{ totalSlots }} {{ totalSlots === 1 ? 'slot disponível' : 'slots disponíveis' }}
          </p>

          <!-- Botões -->
          <div class="flex items-center gap-2">
            <button
              @click="emit('accept')"
              class="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Sim, quero!
            </button>
            <button
              @click="handleDismiss"
              class="px-4 py-1.5 text-zinc-400 hover:text-white hover:bg-white/5 text-xs font-medium rounded-lg transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>

      <!-- Detalhe decorativo gradiente -->
      <div class="absolute -bottom-8 -right-8 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl pointer-events-none" />
      <div class="absolute -top-4 -left-4 w-20 h-20 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
    </div>
  </Transition>
</template>
