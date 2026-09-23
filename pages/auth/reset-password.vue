<script setup lang="ts">
definePageMeta({ layout: 'auth' })

// Redefinições antigas por link não são mais aceitas: o fluxo oficial é OTP no WhatsApp.
await navigateTo('/auth/forgot-password', { replace: true })
</script>

<template>
  <p class="text-center text-sm text-slate-500">Redirecionando para a recuperação pelo WhatsApp…</p>
</template>
