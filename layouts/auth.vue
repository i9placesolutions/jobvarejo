<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

// Color mode
const colorMode = useColorMode()

// Check if dark mode is active
const isDark = computed(() => colorMode.value === 'dark')

// Background gradient based on theme
const backgroundStyle = computed(() => {
  if (isDark.value) {
    return {
      background: `
        radial-gradient(circle at 15% 50%, rgba(124, 58, 237, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 85% 30%, rgba(124, 58, 237, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 50% 80%, rgba(124, 58, 237, 0.08) 0%, transparent 50%),
        hsl(240 10% 4%)
      `,
    }
  }

  return {
    background: `
      radial-gradient(circle at 15% 50%, rgba(124, 58, 237, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 85% 30%, rgba(124, 58, 237, 0.05) 0%, transparent 50%),
      radial-gradient(circle at 50% 80%, rgba(124, 58, 237, 0.03) 0%, transparent 50%),
      hsl(0 0% 100%)
    `,
  }
})
</script>

<template>
  <div
    class="min-h-screen w-full relative overflow-hidden"
    :style="backgroundStyle"
  >
    <!-- Decorative Grid Pattern -->
    <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]">
      <div class="w-full h-full" style="background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 40px 40px;"></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 min-h-screen flex flex-col">
      <!-- Top Bar with Logo -->
      <header class="w-full p-6">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-3 group"
          >
            <div class="w-10 h-10 bg-primary/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
              <Sparkles class="w-5 h-5 text-primary" />
            </div>
            <span class="text-lg font-bold">Studio PRO</span>
          </NuxtLink>

          <!-- Theme Toggle (optional, if you have it) -->
          <!-- <ColorModeToggle /> -->
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 flex items-center justify-center px-4 pb-12">
        <slot />
      </main>

      <!-- Footer -->
      <footer class="w-full p-6 text-center text-sm text-muted-foreground">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2025 Studio PRO. Todos os direitos reservados.</p>
          <div class="flex items-center gap-6">
            <NuxtLink to="/terms" class="hover:text-foreground transition-colors">Termos</NuxtLink>
            <NuxtLink to="/privacy" class="hover:text-foreground transition-colors">Privacidade</NuxtLink>
            <a href="mailto:support@studio.pro" class="hover:text-foreground transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </div>

    <!-- Ambient Light Effect (follows mouse) -->
    <ClientOnly>
      <div
        class="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
        :class="isDark ? 'opacity-30' : 'opacity-20'"
      >
        <div
          class="absolute w-[600px] h-[600px] rounded-full blur-3xl bg-primary/20"
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
