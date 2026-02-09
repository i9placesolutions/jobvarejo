<script setup lang="ts">
// Keep a client-side safety check for direct URL access.
onMounted(async () => {
  if (!process.client) return
  if (window.location.pathname.startsWith('/auth')) return

  try {
    const supabase = useSupabase()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data?.session) {
      window.location.href = '/auth/login'
    }
  } catch {
    window.location.href = '/auth/login'
  }
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
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
