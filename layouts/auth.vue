<script setup lang="ts">
const route = useRoute()
const isLoginPage = computed(() => route.path === '/auth/login')

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

if (import.meta.client) {
  onMounted(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseleave', handleMouseLeave)
    if (rafId) cancelAnimationFrame(rafId)
  })
}
</script>

<template>
  <div
    class="h-screen w-full relative overflow-hidden bg-[#f8f9fb] text-slate-800 flex flex-col"
    :class="{ 'auth-layout--login': isLoginPage }"
  >
    <!-- Decorative Grid Pattern -->
    <div class="absolute inset-0" :class="isLoginPage ? 'auth-layout__admin-grid' : 'opacity-[0.04]'">
      <div class="w-full h-full auth-layout__dots"></div>
    </div>

    <!-- Main Content -->
    <div class="relative z-10 flex-1 flex flex-col overflow-hidden">
      <!-- Top Bar with Logo -->
      <header class="auth-header w-full p-4 shrink-0">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <NuxtLink
            to="/landing"
            class="auth-brand inline-flex items-center gap-3 group"
            aria-label="JobVarejo"
          >
            <img
              :src="isLoginPage ? '/img/jobvarejo-logo-trim.png' : '/img/jobvarejo-logo.png'"
              alt="JobVarejo"
              class="h-9 w-auto object-contain"
              :width="isLoginPage ? 176 : 160"
              :height="isLoginPage ? 56 : 52"
            >
            <span v-if="isLoginPage" class="auth-brand__copy">
              <strong>Central administrativa</strong>
              <small>Operação JobVarejo</small>
            </span>
          </NuxtLink>
        </div>
      </header>

      <!-- Page Content - Centered in viewport -->
      <main class="auth-main flex-1 flex items-center justify-center px-4 overflow-auto">
        <div class="w-full max-w-md">
          <slot />
        </div>
      </main>

      <!-- Footer -->
      <footer class="auth-footer w-full p-4 text-center text-xs text-slate-400 shrink-0">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <p>© {{ new Date().getFullYear() }} JobVarejo</p>
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

.auth-layout__dots {
  background-image: radial-gradient(circle, #94a3b8 1px, transparent 1px);
  background-size: 40px 40px;
}

.auth-layout--login {
  --jv-navy: #173d70;
  --jv-blue: #2160b4;
  --jv-sky: #eaf3ff;
  --jv-ink: #172b45;
  --jv-muted: #60758f;
  --jv-line: #d7e4f1;
  height: auto;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--jv-ink);
  background:
    radial-gradient(circle at 8% -12%, rgba(58, 131, 213, .18), transparent 31rem),
    radial-gradient(circle at 104% 24%, rgba(72, 157, 128, .12), transparent 27rem),
    linear-gradient(180deg, #f8fbff 0%, #f3f7fb 100%);
  font-family: "Plus Jakarta Sans", "Barlow", ui-sans-serif, system-ui, sans-serif;
}

.auth-layout--login > .relative.z-10 {
  min-height: 100vh;
  min-height: 100dvh;
  overflow: visible;
}

.auth-layout__admin-grid { opacity: .32; }

.auth-layout--login .auth-layout__dots {
  background-image: radial-gradient(rgba(62, 121, 184, .17) .75px, transparent .75px);
  background-size: 18px 18px;
}

.auth-layout--login .auth-header {
  position: relative;
  z-index: 2;
  min-height: 72px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(190, 211, 233, .76);
  background: rgba(255, 255, 255, .84);
  box-shadow: 0 8px 28px rgba(26, 68, 113, .045);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.auth-layout--login .auth-header > div { max-width: 1920px; }

.auth-brand__copy {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.auth-brand__copy strong {
  color: #16375f;
  font-size: 13px;
}

.auth-brand__copy small {
  margin-top: 3px;
  color: #5b7ea8;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.auth-layout--login .auth-main {
  overflow: visible;
  padding-top: 28px;
  padding-bottom: 28px;
}

.auth-layout--login .auth-main > div { max-width: 480px; }

.auth-layout--login .auth-footer {
  position: relative;
  z-index: 1;
  color: #60758f;
}

.auth-layout--login .auth-footer a:hover { color: #2160b4; }

@media (max-width: 520px) {
  .auth-layout--login .auth-header { min-height: 64px; padding-inline: 16px; }
  .auth-layout--login .auth-main { align-items: flex-start; padding: 22px 16px; }
  .auth-layout--login .auth-main > div { max-width: 420px; }
  .auth-layout--login .auth-footer { padding: 14px 12px; }
}

@media (max-height: 800px) {
  .auth-layout--login {
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }

  .auth-layout--login > .relative.z-10 {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .auth-layout--login .auth-header {
    height: 58px;
    min-height: 58px;
    padding-inline: 16px;
  }

  .auth-layout--login .auth-main {
    min-height: 0;
    overflow: hidden;
    padding: 12px 16px;
  }

  .auth-layout--login .auth-footer { padding: 8px 12px; }

  .auth-layout--login .auth-footer > div {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
}

@media (max-height: 560px) {
  .auth-layout--login .auth-header { height: 48px; min-height: 48px; }
  .auth-layout--login .auth-header img { max-height: 30px; }
  .auth-layout--login .auth-main { padding-block: 4px; }
  .auth-layout--login .auth-footer { padding-block: 4px; }
}
</style>
