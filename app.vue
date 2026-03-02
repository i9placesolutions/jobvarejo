<script setup lang="ts">
// Keep a client-side safety check for direct URL access.
onMounted(async () => {
  if (!process.client) return
  if (window.location.pathname.startsWith('/auth')) return

  const auth = useAuth()
  await auth.getSession()
  if (!auth.isAuthenticated.value) {
    window.location.href = '/auth/login'
  }
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage :page-key="(route) => route.fullPath" />
  </NuxtLayout>
</template>

<style>
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
