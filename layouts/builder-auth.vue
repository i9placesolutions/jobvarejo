<script setup lang="ts">
import { FileText } from 'lucide-vue-next'

const backgroundStyle = {
  background: `#f8f9fb`,
}
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
            to="/builder/login"
            class="inline-flex items-center gap-3 group"
          >
            <div class="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-200 group-hover:bg-emerald-100 transition-colors">
              <FileText class="w-4 h-4 text-emerald-600" />
            </div>
            <span class="text-base font-bold text-slate-800">Criador de Encartes</span>
          </NuxtLink>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 flex items-center justify-center px-4 overflow-auto">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </main>

      <!-- Footer -->
      <footer class="w-full p-4 text-center text-xs text-slate-400 shrink-0">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <p>&copy; 2025 JobVarejo</p>
          <div class="flex items-center gap-4">
            <NuxtLink to="/terms" class="hover:text-slate-700 transition-colors">Termos</NuxtLink>
            <NuxtLink to="/privacy" class="hover:text-slate-700 transition-colors">Privacidade</NuxtLink>
          </div>
        </div>
      </footer>
    </div>

    <!-- Ambient Light Effect -->
    <ClientOnly>
      <div class="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 opacity-20">
        <div
          class="absolute w-[600px] h-[600px] rounded-full blur-3xl bg-emerald-300/10"
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
const mousePosition = ref<{ x: number; y: number } | null>(null)

if (import.meta.client) {
  let rafId: number
  window.addEventListener('mousemove', (e) => {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      mousePosition.value = { x: e.clientX, y: e.clientY }
    })
  })
  window.addEventListener('mouseleave', () => {
    mousePosition.value = null
  })
}
</script>

<style scoped>
* {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}
</style>
