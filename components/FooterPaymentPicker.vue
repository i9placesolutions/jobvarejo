<script setup lang="ts">
import { footerPaymentImageUrl, MAX_FOOTER_PAYMENT_IMAGES } from '~/utils/footerPaymentImages'
const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const { getApiAuthHeaders } = useApiAuth()
const search = ref('cartão')
const items = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const cursor = ref<string | null>(null)
let request = 0
async function load(more = false) {
  const token = ++request
  loading.value = true; error.value = ''
  try {
    const result = await $fetch<any>('/api/assets', { headers: await getApiAuthHeaders(), query: { paginated: 1, source: 'uploads', ai: 0, limit: 60, q: search.value, ...(more && cursor.value ? { cursor: cursor.value } : {}) } })
    if (token !== request) return
    const next = Array.isArray(result) ? result : result.items || []
    items.value = more ? [...items.value, ...next] : next
    cursor.value = result.nextCursor || null
  } catch { if (token === request) error.value = 'Não foi possível carregar as imagens. Tente novamente.' }
  finally { if (token === request) loading.value = false }
}
function toggle(key: string) {
  if (props.modelValue.includes(key)) emit('update:modelValue', props.modelValue.filter(v => v !== key))
  else if (props.modelValue.length < MAX_FOOTER_PAYMENT_IMAGES) emit('update:modelValue', [...props.modelValue, key])
}
onMounted(() => load())
</script>
<template>
  <section class="footer-payment-picker">
    <h3>Cartões aceitos no rodapé <small>{{ modelValue.length }}/5</small></h3>
    <p>Escolha até cinco imagens da biblioteca. A seleção será reutilizada nos encartes.</p>
    <div class="selected-cards"><button v-for="key in modelValue" :key="key" type="button" aria-label="Remover cartão" @click="toggle(key)"><img :src="footerPaymentImageUrl(key)" alt="Cartão selecionado" /><span>×</span></button></div>
    <div class="search"><input v-model="search" placeholder="Buscar bandeira ou cartão" aria-label="Buscar imagens de cartões" @keydown.enter.prevent="load()" /><button type="button" @click="load()">Buscar</button></div>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="catalog"><button v-for="item in items" :key="item.key || item.id" type="button" :aria-pressed="modelValue.includes(item.key || item.url)" :disabled="!modelValue.includes(item.key || item.url) && modelValue.length >= 5" @click="toggle(item.key || item.url)"><img :src="item.url" :alt="item.name" loading="lazy" /><span>{{ item.name }}</span></button></div>
    <p v-if="loading">Carregando imagens…</p><p v-else-if="!items.length">Nenhuma imagem encontrada. Busque pelo nome da bandeira.</p>
    <button v-if="cursor" type="button" :disabled="loading" @click="load(true)">Carregar mais</button>
  </section>
</template>
<style scoped>
.footer-payment-picker { padding:16px; border:1px solid #94a3b855; border-radius:12px; min-width:0; }h3 { font-size:14px; font-weight:800; }p { font-size:12px; margin:8px 0; }small { float:right; }.search { display:flex; gap:8px; margin:10px 0; }.search input { min-width:0; flex:1; padding:8px; border:1px solid #94a3b8; border-radius:6px; color:#172033; background:white; }button { cursor:pointer; padding:6px; border:1px solid #94a3b855; border-radius:8px; }button:disabled { opacity:.4; cursor:default; }button[aria-pressed=true] { border:2px solid #7c3aed; }.catalog { display:grid; grid-template-columns:repeat(auto-fill,minmax(80px,1fr)); gap:8px; max-height:240px; overflow:auto; }.catalog img { width:100%; height:42px; object-fit:contain; }.catalog span { display:block; font-size:10px; overflow-wrap:anywhere; }.selected-cards { display:flex; gap:6px; }.selected-cards button { position:relative; }.selected-cards img { width:52px; height:32px; object-fit:contain; }.selected-cards span { position:absolute; right:0; top:-5px; }
</style>
