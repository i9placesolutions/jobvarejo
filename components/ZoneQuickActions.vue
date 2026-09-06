<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  top: number
  left: number
  width: number
  height: number
  name: string
  roleLabel: string
  statusLabel: string
  frameLabel?: string
  productCount: number
  isEmpty: boolean
}>()

const emit = defineEmits<{
  (e: 'fill'): void
  (e: 'append'): void
  (e: 'replace'): void
  (e: 'preset'): void
  (e: 'duplicate'): void
}>()

const chipStyle = computed(() => ({
  top: `${Math.round(props.top + 8)}px`,
  left: `${Math.round(props.left + 8)}px`
}))

const onPrimaryClick = () => {
  if (props.isEmpty) emit('fill')
  else emit('append')
}
</script>

<template>
  <button
    v-if="visible"
    type="button"
    class="pointer-events-auto absolute z-[115] inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6d28d9] px-3 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_4px_14px_rgba(109,40,217,0.45)] ring-1 ring-white/20 transition duration-150 hover:bg-[#7c3aed]"
    :style="chipStyle"
    :title="isEmpty ? 'Importar produtos para a zona' : 'Adicionar produtos à zona'"
    @mousedown.stop
    @click.stop="onPrimaryClick"
  >
    <Plus class="h-3.5 w-3.5" />
    Importar
  </button>
</template>
