<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false
})
</script>

<template>
  <AdminWorkspaceShell active-nav="cards">
    <ProductCardConfigurationManager />
  </AdminWorkspaceShell>
</template>
