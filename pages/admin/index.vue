<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

// A Central administrativa (/) já é o painel admin — não há hub separado.
await navigateTo('/', { replace: true })
</script>

<template>
  <div />
</template>
