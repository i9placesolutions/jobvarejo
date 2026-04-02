<script setup lang="ts">
/**
 * Drawer lateral esquerdo para navegação do dashboard no mobile.
 * Swipe-left para fechar + backdrop.
 */

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const close = () => emit('update:open', false)

// Swipe-to-close
let startX = 0
const onTouchStart = (e: TouchEvent) => { startX = e.touches[0]?.clientX ?? 0 }
const onTouchEnd = (e: TouchEvent) => {
  const deltaX = (e.changedTouches[0]?.clientX ?? 0) - startX
  if (deltaX < -60) close()
}
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="backdrop">
      <div
        v-if="props.open"
        class="fixed inset-0 z-[9998] bg-black/60"
        @click="close"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="drawer-left">
      <div
        v-if="props.open"
        class="fixed inset-y-0 left-0 z-[9999] w-[300px] max-w-[85vw] bg-white flex flex-col safe-top safe-bottom shadow-2xl"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <!-- Header -->
        <div class="h-14 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <span class="text-sm font-semibold text-slate-800">Studio PRO</span>
          <button class="touch-target flex items-center justify-center text-slate-400 hover:text-slate-600" @click="close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <!-- Navigation slot -->
        <div class="flex-1 overflow-y-auto overscroll-contain">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
