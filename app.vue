<script setup lang="ts">
const staleEditorVersion = ref(false)
const nuxtApp = useNuxtApp()
nuxtApp.hook('app:chunkError', () => { staleEditorVersion.value = true })
const handlePreloadError = () => { staleEditorVersion.value = true }
onMounted(() => window.addEventListener('vite:preloadError', handlePreloadError))
onBeforeUnmount(() => window.removeEventListener('vite:preloadError', handlePreloadError))
const reloadEditor = () => window.location.reload()
</script>
<template>
  <div v-if="staleEditorVersion" role="alert" class="version-notice">
    <strong>O editor foi atualizado</strong>
    <span>Salve as alterações antes de atualizar esta aba para carregar as novas ferramentas.</span>
    <button type="button" @click="reloadEditor">Já salvei, atualizar</button>
  </div>
  <NuxtLayout>
    <NuxtPage :page-key="(route) => route.fullPath" />
  </NuxtLayout>
</template>

<style>
.version-notice { position:fixed; z-index:20000; left:12px; right:12px; top:calc(12px + env(safe-area-inset-top)); max-width:520px; margin:auto; display:grid; gap:8px; padding:16px; border:1px solid #9a773a; border-radius:14px; background:#30281b; color:#fff0cd; font-size:14px; box-shadow:0 8px 32px #0007; }
.version-notice button { min-height:44px; border-radius:8px; background:#f5d28b; color:#231c10; font-weight:600; }

:root {
  --primary-rgb: 124, 58, 237; /* Base violet */
}

/* Global scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.3);
}
</style>
