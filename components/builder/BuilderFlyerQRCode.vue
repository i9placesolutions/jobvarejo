<script setup lang="ts">
import QRCode from 'qrcode'

const { flyer } = useBuilderFlyer()
const { tenant } = useBuilderAuth()

const qrDataUrl = ref<string | null>(null)

const qrUrl = computed(() => {
  const flyerId = flyer.value?.id
  const slug = (tenant.value as any)?.slug
  if (!flyerId) return ''
  // URL publica do encarte no portal
  if (slug) return `${window.location.origin}/portal/${slug}/${flyerId}`
  return `${window.location.origin}/builder/${flyerId}`
})

watch(qrUrl, async (url) => {
  if (!url) { qrDataUrl.value = null; return }
  try {
    qrDataUrl.value = await QRCode.toDataURL(url, {
      width: 120,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch {
    qrDataUrl.value = null
  }
}, { immediate: true })
</script>

<template>
  <img
    v-if="qrDataUrl"
    :src="qrDataUrl"
    alt="QR Code"
    style="width: 60px; height: 60px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.3)"
  />
</template>
