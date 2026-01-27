<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

// Check authentication on mount - redirect to login if not authenticated
onMounted(() => {
  if (process.client) {
    // Check for auth cookie
    const getCookie = (name: string): string | null => {
      const cookies = document.cookie.split(';').map(c => c.trim())
      const found = cookies.find(c => c.startsWith(`${name}=`))
      return found ? found.split('=')[1] : null
    }

    const authenticated = getCookie('authenticated') === 'true'

    // Redirect if not authenticated and not on auth pages
    if (!authenticated && !window.location.pathname.startsWith('/auth')) {
      window.location.href = '/auth/login'
    }
  }
})
</script>

<template>
  <NuxtPage />
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
