<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false
})
</script>

<template>
  <ProductZoneStructureManager />
</template>
