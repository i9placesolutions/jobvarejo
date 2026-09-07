<script setup lang="ts">
import { useEditorVisualViewport } from '~/composables/useEditorVisualViewport'
/**
 * Bottom sheet genérico para editor mobile.
 * 3 alturas: peek (40vh), half (60vh), full (90vh).
 * Drag handle para resize, swipe-down para fechar, backdrop fecha.
 */

const props = defineProps<{
  title?: string
  fillContent?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { height: viewportHeight, bottomInset: keyboardInset } = useEditorVisualViewport()
type SheetLevel = 'peek' | 'half' | 'full'
const level = ref<SheetLevel>('half')
const sheetEl = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
const handleKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') { event.stopPropagation(); emit('close'); return }
  if (event.key !== 'Tab') return
  const elements = Array.from(sheetEl.value?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || []).filter(el => el.getClientRects().length)
  const first = elements[0], last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(() => { previousFocus = document.activeElement as HTMLElement; sheetEl.value?.focus() })
onBeforeUnmount(() => { previousFocus?.focus?.() })

const heights: Record<SheetLevel, number> = { peek: 42, half: 64, full: 92 }
const sheetHeight = computed(() => viewportHeight.value ? `${viewportHeight.value * heights[level.value] / 100}px` : `${heights[level.value]}dvh`)

// Drag state
let startY = 0
const isDragging = ref(false)
const dragOffset = ref(0)

const onDragStart = (e: TouchEvent) => {
  e.preventDefault()
  isDragging.value = true
  startY = e.touches[0]?.clientY ?? 0
  dragOffset.value = 0
}

const onDragMove = (e: TouchEvent) => {
  if (!isDragging.value) return
  e.preventDefault()
  const deltaY = (e.touches[0]?.clientY ?? 0) - startY
  const deltaPct = (deltaY / Math.max(1, viewportHeight.value || window.innerHeight)) * 100
  dragOffset.value = deltaPct
}

const onDragEnd = () => {
  if (!isDragging.value) return
  isDragging.value = false

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
    const percent = Math.max(18, Math.min(94, h))
    return viewportHeight.value ? `${viewportHeight.value * percent / 100}px` : `${percent}dvh`
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
        ref="sheetEl" role="dialog" aria-modal="true" :aria-label="props.title || 'Opções do editor'" tabindex="-1" @keydown="handleKey"
        class="editor-mobile-sheet fixed bottom-0 left-0 right-0 z-[9999] flex flex-col bg-[#18181b] rounded-t-[28px] overflow-hidden border-t border-white/10 shadow-2xl shadow-black/40"
        :style="{ height: currentHeight, bottom: `${keyboardInset}px`, maxHeight: viewportHeight ? `${viewportHeight - 12}px` : 'calc(100dvh - env(safe-area-inset-top, 0px))', transition: isDragging ? 'none' : 'height 0.28s cubic-bezier(0.32,0.72,0,1)' }"
      >
        <!-- Drag handle -->
        <div
          class="flex-shrink-0 flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
          @touchstart="onDragStart"
          @touchmove="onDragMove"
          @touchend="onDragEnd"
          @touchcancel="isDragging = false; dragOffset = 0"
        >
          <div class="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <!-- Header -->
        <div v-if="props.title" class="flex-shrink-0 px-4 pb-3 flex items-center justify-between">
          <h3 class="min-w-0 flex-1 truncate text-base font-semibold text-white">{{ props.title }}</h3>
          <button type="button" class="px-3 min-h-11 text-xs text-violet-200" @click="level = level === 'full' ? 'half' : 'full'">{{ level === 'full' ? 'Recolher' : 'Expandir' }}</button>
          <button aria-label="Fechar painel" type="button"
            class="touch-target min-w-11 min-h-11 flex items-center justify-center text-white/40 hover:text-white/70"
            @click="emit('close')"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <!-- Content slot -->
        <div :class="props.fillContent ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'" class="min-h-0 flex-1 overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.editor-mobile-sheet { outline:none; }
.editor-mobile-sheet :deep(input:not([type=checkbox]):not([type=range])), .editor-mobile-sheet :deep(textarea), .editor-mobile-sheet :deep(select) { font-size:16px; min-height:44px; }
.editor-mobile-sheet :deep(button) { min-height:44px; }
.editor-mobile-sheet :deep(:focus-visible) { outline:2px solid #a78bfa; outline-offset:2px; }
@media (prefers-reduced-motion: reduce) { .editor-mobile-sheet { transition:none !important; } }
</style>
