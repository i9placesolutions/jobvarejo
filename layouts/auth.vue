<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

// Fixed dark theme - same as dashboard
const backgroundStyle = {
  background: `
    radial-gradient(circle at 15% 50%, rgba(124, 58, 237, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 85% 30%, rgba(124, 58, 237, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 50% 80%, rgba(124, 58, 237, 0.08) 0%, transparent 50%),
    #0f0f0f
  `,
}
</script>

<template>
  <div
    class="h-screen w-full relative overflow-hidden bg-[#0f0f0f] text-white flex flex-col"
    :style="backgroundStyle"
  >
    <!-- Decorative Grid Pattern -->
    <div class="absolute inset-0 opacity-[0.02]">
      <div class="w-full h-full" style="background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 40px 40px;"></div>
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
            <div class="w-8 h-8 bg-violet-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-violet-500/30 group-hover:bg-violet-500/30 transition-colors">
              <Sparkles class="w-4 h-4 text-violet-400" />
            </div>
            <span class="text-base font-bold text-white">Studio PRO</span>
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
      <footer class="w-full p-4 text-center text-xs text-zinc-500 shrink-0">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <p>© 2025 Studio PRO</p>
          <div class="flex items-center gap-4">
            <NuxtLink to="/terms" class="hover:text-white transition-colors">Termos</NuxtLink>
            <NuxtLink to="/privacy" class="hover:text-white transition-colors">Privacidade</NuxtLink>
          </div>
        </div>
      </footer>
    </div>

    <!-- Ambient Light Effect (follows mouse) -->
    <ClientOnly>
      <div
        class="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 opacity-30"
      >
        <div
          class="absolute w-[600px] h-[600px] rounded-full blur-3xl bg-violet-500/20"
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

<script lang="ts">
// Mouse tracking for ambient effect
const mousePosition = ref<{ x: number; y: number } | null>(null)

if (process.client) {
  let rafId: number

  window.addEventListener('mousemove', (e) => {
    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      mousePosition.value = { x: e.clientX, y: e.clientY }
    })
  })

  // Reset when mouse leaves window
  window.addEventListener('mouseleave', () => {
    mousePosition.value = null
  })
}
</script>

<style scoped>
/* Smooth transitions */
* {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}
</style>
