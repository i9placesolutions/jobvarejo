<script setup lang="ts">
defineOptions({ inheritAttrs: false })
const props = defineProps<{ beforeClose?: () => boolean | Promise<boolean> }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
async function close() {
  if (props.beforeClose && await props.beforeClose() === false) return
  emit('update:modelValue', false)
}
</script>
<template>
  <section class="embedded-product-review video-review-palette" aria-label="Lista e imagens dos produtos">
    <header><div><small>PRODUTOS</small><h2>Envie sua lista</h2></div><button type="button" aria-label="Voltar aos produtos do vídeo" @click="close">Voltar</button></header>
    <div class="embedded-product-review__body"><slot /></div>
    <footer v-if="$slots.footer"><slot name="footer" /></footer>
  </section>
</template>
<style scoped>
.embedded-product-review{height:100%;min-height:0;display:flex;flex-direction:column;background:#fff;color:#203c60}.embedded-product-review header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #dce6f2}.embedded-product-review small{font-size:10px;letter-spacing:.15em;color:#64748b}.embedded-product-review h2{font-size:16px;font-weight:600;color:#203c60}.embedded-product-review header button{font-size:12px;padding:8px;color:#655bab}.embedded-product-review__body{flex:1;min-height:0;overflow:auto;padding:12px}.embedded-product-review footer{padding:12px;border-top:1px solid #dce6f2}.embedded-product-review__body :deep(.qrofertas-review){min-height:0;max-height:none;height:auto}.embedded-product-review__body :deep(.md\:grid-cols-2){grid-template-columns:minmax(0,1fr)}
</style>
