<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  pages: Array<{ index: number; thumbnail: string | null }>
  autoplay?: boolean
  interval?: number
}>(), {
  autoplay: true,
  interval: 3000,
})

const currentIndex = ref(0)
const isHovering = ref(false)
const timerRef = ref<ReturnType<typeof setInterval> | null>(null)

const totalPages = computed(() => props.pages.length)
const hasMultiple = computed(() => totalPages.value > 1)

const currentPage = computed(() => props.pages[currentIndex.value])

// Navegação
const goTo = (index: number) => {
  currentIndex.value = index
  restartTimer()
}

const next = () => {
  currentIndex.value = (currentIndex.value + 1) % totalPages.value
  restartTimer()
}

const prev = () => {
  currentIndex.value = (currentIndex.value - 1 + totalPages.value) % totalPages.value
  restartTimer()
}

// Autoplay
const startTimer = () => {
  if (!props.autoplay || !hasMultiple.value) return
  stopTimer()
  timerRef.value = setInterval(() => {
    if (!isHovering.value) {
      currentIndex.value = (currentIndex.value + 1) % totalPages.value
    }
  }, props.interval)
}

const stopTimer = () => {
  if (timerRef.value) {
    clearInterval(timerRef.value)
    timerRef.value = null
  }
}

const restartTimer = () => {
  stopTimer()
  startTimer()
}

const onMouseEnter = () => {
  isHovering.value = true
}

const onMouseLeave = () => {
  isHovering.value = false
}

// Resetar quando as páginas mudarem
watch(() => props.pages, () => {
  currentIndex.value = 0
  restartTimer()
}, { deep: true })

onMounted(() => {
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div
    class="relative w-full h-full overflow-hidden group"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- Imagem atual -->
    <div class="relative w-full h-full">
      <TransitionGroup name="carousel-fade">
        <img
          v-for="(page, idx) in pages"
          v-show="idx === currentIndex"
          :key="page.index"
          :src="page.thumbnail || ''"
          :alt="`Página ${page.index + 1}`"
          class="absolute inset-0 w-full h-full object-contain transition-all duration-500 ease-in-out"
          :class="{
            'opacity-100 scale-100': idx === currentIndex,
            'opacity-0 scale-95': idx !== currentIndex,
          }"
        />
      </TransitionGroup>

      <!-- Placeholder se não tiver thumbnail -->
      <div
        v-if="!currentPage?.thumbnail"
        class="absolute inset-0 flex items-center justify-center bg-zinc-800/50"
      >
        <span class="text-zinc-500 text-sm">Sem prévia</span>
      </div>
    </div>

    <!-- Badge página atual / total -->
    <div
      v-if="hasMultiple"
      class="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs font-medium z-10 pointer-events-none"
    >
      {{ currentIndex + 1 }}/{{ totalPages }}
    </div>

    <!-- Seta esquerda -->
    <button
      v-if="hasMultiple"
      class="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60 cursor-pointer"
      @click.stop.prevent="prev"
      aria-label="Página anterior"
    >
      <ChevronLeft class="w-4 h-4" />
    </button>

    <!-- Seta direita -->
    <button
      v-if="hasMultiple"
      class="absolute right-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60 cursor-pointer"
      @click.stop.prevent="next"
      aria-label="Próxima página"
    >
      <ChevronRight class="w-4 h-4" />
    </button>

    <!-- Indicadores (dots) -->
    <div
      v-if="hasMultiple"
      class="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5"
    >
      <button
        v-for="(page, idx) in pages"
        :key="`dot-${page.index}`"
        class="w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer"
        :class="idx === currentIndex ? 'bg-violet-500 scale-125' : 'bg-zinc-600 hover:bg-zinc-400'"
        @click.stop.prevent="goTo(idx)"
        :aria-label="`Ir para página ${idx + 1}`"
      />
    </div>
  </div>
</template>
