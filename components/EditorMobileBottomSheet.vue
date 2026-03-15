<script setup lang="ts">
/**
 * Bottom sheet genérico para editor mobile.
 * 3 alturas: peek (40vh), half (60vh), full (90vh).
 * Drag handle para resize, swipe-down para fechar, backdrop fecha.
 */

const props = defineProps<{
  title?: string
}>()

const emit = defineEmits<{
  close: []
}>()

type SheetLevel = 'peek' | 'half' | 'full'
const level = ref<SheetLevel>('half')

const heights: Record<SheetLevel, number> = { peek: 40, half: 60, full: 90 }
const sheetHeight = computed(() => `${heights[level.value]}vh`)

// Drag state
let startY = 0
let startHeight = 0
const isDragging = ref(false)
const dragOffset = ref(0)

const onDragStart = (e: TouchEvent) => {
  isDragging.value = true
  startY = e.touches[0].clientY
  startHeight = heights[level.value]
  dragOffset.value = 0
}

const onDragMove = (e: TouchEvent) => {
  if (!isDragging.value) return
  const deltaY = e.touches[0].clientY - startY
  const deltaPct = (deltaY / window.innerHeight) * 100
  dragOffset.value = deltaPct
}

const onDragEnd = () => {
  if (!isDragging.value) return
  isDragging.value = false

  const finalPct = heights[level.value] - dragOffset.value

  if (dragOffset.value > 15) {
    // Swiped down
    if (level.value === 'full') level.value = 'half'
    else if (level.value === 'half') level.value = 'peek'
    else emit('close')
  } else if (dragOffset.value < -15) {
    // Swiped up
    if (level.value === 'peek') level.value = 'half'
    else if (level.value === 'half') level.value = 'full'
  }

  dragOffset.value = 0
}

const currentHeight = computed(() => {
  if (isDragging.value) {
    const h = heights[level.value] - dragOffset.value
    return `${Math.max(10, Math.min(95, h))}vh`
  }
  return sheetHeight.value
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="backdrop">
      <div
        class="fixed inset-0 z-[9998] bg-black/50"
        @click="emit('close')"
      />
    </Transition>

    <!-- Sheet -->
    <Transition name="bottom-sheet">
      <div
        class="fixed bottom-0 left-0 right-0 z-[9999] flex flex-col bg-[#18181b] rounded-t-2xl overflow-hidden safe-bottom"
        :style="{ height: currentHeight, transition: isDragging ? 'none' : 'height 0.28s cubic-bezier(0.32,0.72,0,1)' }"
      >
        <!-- Drag handle -->
        <div
          class="flex-shrink-0 flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
          @touchstart.passive="onDragStart"
          @touchmove.passive="onDragMove"
          @touchend="onDragEnd"
        >
          <div class="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <!-- Header -->
        <div v-if="props.title" class="flex-shrink-0 px-4 pb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white/80">{{ props.title }}</h3>
          <button
            class="touch-target flex items-center justify-center text-white/40 hover:text-white/70"
            @click="emit('close')"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <!-- Content slot -->
        <div class="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
