<script setup lang="ts">
const route = useRoute()
const routePath = computed(() => route.path.replace(/\/+$/, ''))
const hideBrandHeaderRoutes = new Set(['/auth/login', '/auth/forgot-password', '/auth/register'])
const showBrandHeader = computed(() => !hideBrandHeaderRoutes.has(routePath.value))

// Brand light theme
const backgroundStyle = {
  background: `
    radial-gradient(circle at 14% 22%, rgba(242, 194, 48, 0.24) 0%, transparent 44%),
    radial-gradient(circle at 86% 18%, rgba(179, 38, 30, 0.14) 0%, transparent 42%),
    radial-gradient(circle at 50% 84%, rgba(179, 38, 30, 0.08) 0%, transparent 46%),
    #f8f7f3
  `,
}
</script>

<template>
  <div
    class="h-screen w-full relative overflow-hidden bg-[#f8f7f3] text-zinc-900 flex flex-col"
    :style="backgroundStyle"
  >
    <!-- Decorative Grid Pattern -->
    <div class="absolute inset-0 opacity-[0.05]">
      <div class="w-full h-full" style="background-image: radial-gradient(circle, currentColor 1px, transparent 1px); background-size: 40px 40px;"></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 flex-1 flex flex-col overflow-hidden">
      <!-- Top Bar with Logo -->
      <header v-if="showBrandHeader" class="w-full p-4 shrink-0">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-3 group"
          >
            <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-[#d9d0c2] group-hover:border-[#b3261e]/45 transition-colors overflow-hidden shadow-xs">
              <img
                src="/logo.png"
                alt="Job Varejo"
                class="w-full h-full object-cover"
                loading="eager"
              />
            </div>
            <span class="text-base font-bold text-zinc-900">Job Varejo</span>
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
          <p>© 2025 Job Varejo</p>
          <div class="flex items-center gap-4">
            <NuxtLink to="/terms" class="hover:text-zinc-900 transition-colors">Termos</NuxtLink>
            <NuxtLink to="/privacy" class="hover:text-zinc-900 transition-colors">Privacidade</NuxtLink>
          </div>
        </div>
      </footer>
    </div>

    <!-- Ambient Light Effect (follows mouse) -->
    <ClientOnly>
      <div
        class="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 opacity-50"
      >
        <div
          class="absolute w-[560px] h-[560px] rounded-full blur-3xl"
          style="transform: translate(-50%, -50%);"
          :style="{
            background: 'radial-gradient(circle, rgba(242,194,48,0.20) 0%, rgba(179,38,30,0.08) 45%, transparent 70%)',
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
