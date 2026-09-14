<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Dialog from './ui/Dialog.vue'
import Button from './ui/Button.vue'

const props = defineProps<{ modelValue: boolean; product: Record<string, any> }>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'save', payload: Record<string, any>): void
}>()
const fields = [
  { key: 'pricePack', label: 'Preço avulso da embalagem', placeholder: 'Ex.: 34,38', numeric: true },
  { key: 'priceUnit', label: 'Preço avulso por unidade', placeholder: 'Ex.: 5,73', numeric: true },
  { key: 'priceSpecial', label: 'Preço promocional da embalagem', placeholder: 'Ex.: 31,74', numeric: true },
  { key: 'priceSpecialUnit', label: 'Preço promocional por unidade', placeholder: 'Ex.: 5,29', numeric: true },
  { key: 'packageLabel', label: 'Embalagem', placeholder: 'Ex.: CAIXA, FARDO, SIXPACK', numeric: false },
  { key: 'packQuantity', label: 'Quantidade na embalagem', placeholder: 'Ex.: 6', numeric: true },
  { key: 'specialCondition', label: 'Condição promocional', placeholder: 'Ex.: ACIMA DE 12 UNIDADES', numeric: false }
]
const draft = reactive<Record<string, string>>({})
const priceCount = ref('4')
const showCensored = ref(false)
const alcoholBadgeEnabled = ref(false)
const visibleFields = computed(() => fields.filter(field => !field.key.startsWith('price') || priceCount.value === '4' || field.key === 'pricePack' || (priceCount.value === '2' && field.key === 'priceSpecial')))
const error = reactive({ message: '' })
watch(() => [props.modelValue, props.product], () => {
  if (!props.modelValue) return
  for (const field of fields) draft[field.key] = String(props.product[field.key] ?? '')
  priceCount.value = String(props.product.priceCount || (props.product.priceUnit || props.product.priceSpecialUnit ? 4 : props.product.priceSpecial ? 2 : 1))
  showCensored.value = !!props.product.showCensored
  alcoholBadgeEnabled.value = !!props.product.alcoholBadgeEnabled
  error.message = ''
}, { immediate: true })
const save = () => {
  const quantity = Number(draft.packQuantity)
  if (draft.packQuantity?.trim() && (!Number.isInteger(quantity) || quantity < 1)) {
    error.message = 'Informe uma quantidade inteira maior que zero.'
    return
  }
  for (const field of fields.filter(field => field.key.startsWith('price'))) {
    const value = String(draft[field.key] ?? '').trim()
    if (value && !/^\d+(?:[.,]\d{1,2})?$/.test(value)) {
      error.message = 'Confira o campo ' + field.label.toLowerCase() + '. Use um valor como 16,99.'
      return
    }
  }
  const payload: Record<string, any> = Object.fromEntries(fields.map(field => [field.key, String(draft[field.key] ?? '').trim()]))
  if (priceCount.value !== '4') { payload.priceUnit = ''; payload.priceSpecialUnit = '' }
  if (priceCount.value === '1') payload.priceSpecial = ''
  emit('save', { ...payload, priceCount: Number(priceCount.value), showCensored: showCensored.value, alcoholBadgeEnabled: alcoholBadgeEnabled.value })
}
</script>

<template>
  <Dialog :model-value="modelValue" title="Editar preços e embalagem" width="min(620px, calc(100vw - 2rem))" content-class="p-0" @update:model-value="value => emit('update:modelValue', !!value)">
    <form class="space-y-4 px-6 py-5" @submit.prevent="save">
      <p class="text-sm font-semibold text-white">{{ product.name }}</p>
      <label class="block text-xs text-zinc-300">Quantidade de preços
        <select v-model="priceCount" class="mt-1 h-10 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 text-white">
          <option value="1">1 preço — avulso</option>
          <option value="2">2 preços — avulso e promocional</option>
          <option value="4">4 preços — embalagem e unidade, avulso e promocional</option>
        </select>
      </label>
      <p class="text-xs text-zinc-400">Preencha os valores que devem aparecer nesta etiqueta. Os quatro preços podem ser configurados independentemente.</p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label v-for="field in visibleFields" :key="field.key" class="block text-xs text-zinc-300" :class="{ 'sm:col-span-2': field.key === 'specialCondition' }">
          {{ field.label }}
          <input v-model="draft[field.key]" type="text" :inputmode="field.numeric ? 'decimal' : 'text'" :placeholder="field.placeholder" class="mt-1 h-10 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-violet-400">
        </label>
      </div>
      <label class="flex items-center gap-2 text-sm text-white"><input v-model="showCensored" type="checkbox">Mostrar CENSURADO no lugar do promocional</label>
      <label class="flex items-center gap-2 text-sm text-white"><input v-model="alcoholBadgeEnabled" type="checkbox">Mostrar selo de proibido para menores de 18 anos</label>
      <p v-if="error.message" role="alert" class="text-xs text-red-300">{{ error.message }}</p>
    </form>
    <template #footer>
      <Button variant="ghost" size="sm" @click="emit('update:modelValue', false)">Cancelar</Button>
      <Button size="sm" @click="save">Aplicar na etiqueta</Button>
    </template>
  </Dialog>
</template>
