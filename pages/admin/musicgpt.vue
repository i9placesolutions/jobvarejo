<script setup lang="ts">
definePageMeta({ layout: false, middleware: ['auth', 'admin'], ssr: false })
await navigateTo('/admin/voices', { replace: true })
</script>

<template><div /></template>
