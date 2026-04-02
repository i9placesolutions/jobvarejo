<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

// Tema claro
const backgroundStyle = {
  background: `#f8f9fb`,
}

// Mouse tracking para efeito ambient
const mousePosition = ref<{ x: number; y: number } | null>(null)
let rafId: number

const handleMouseMove = (e: MouseEvent) => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    mousePosition.value = { x: e.clientX, y: e.clientY }
  })
}

const handleMouseLeave = () => {
  mousePosition.value = null
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseleave', handleMouseLeave)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseleave', handleMouseLeave)
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div
    class="h-screen w-full relative overflow-hidden bg-[#f8f9fb] text-slate-800 flex flex-col"
    :style="backgroundStyle"
  >
    <!-- Decorative Grid Pattern -->
    <div class="absolute inset-0 opacity-[0.04]">
      <div class="w-full h-full" style="background-image: radial-gradient(circle, #94a3b8 1px, transparent 1px); background-size: 40px 40px;"></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 flex-1 flex flex-col overflow-hidden">
      <!-- Top Bar with Logo -->
      <header class="w-full p-4 shrink-0">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-3 group"
          >
            <div class="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-200 group-hover:bg-indigo-100 transition-colors">
              <Sparkles class="w-4 h-4 text-indigo-500" />
            </div>
            <span class="text-base font-bold text-slate-800">Studio PRO</span>
          </NuxtLink>
        </div>
      </header>

      <!-- Page Content - Centered in viewport -->
      <main class="flex-1 flex items-center justify-center px-4 overflow-auto">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </main>

      <!-- Footer -->
      <footer class="w-full p-4 text-center text-xs text-slate-400 shrink-0">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <p>© 2025 Studio PRO</p>
          <div class="flex items-center gap-4">
            <NuxtLink to="/terms" class="hover:text-slate-700 transition-colors">Termos</NuxtLink>
            <NuxtLink to="/privacy" class="hover:text-slate-700 transition-colors">Privacidade</NuxtLink>
          </div>
        </div>
      </footer>
    </div>

    <!-- Ambient Light Effect (follows mouse) -->
    <ClientOnly>
      <div
        class="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 opacity-20"
      >
        <div
          class="absolute w-150 h-150 rounded-full blur-3xl bg-indigo-300/15"
          style="transform: translate(-50%, -50%);"
          :style="{
            left: mousePosition?.x + 'px' || '50%',
            top: mousePosition?.y + 'px' || '50%',
          }"
        ></div>
      </div>
    </ClientOnly>
  </div>
</template>


<style scoped>
/* Smooth transitions */
* {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}
</style>
