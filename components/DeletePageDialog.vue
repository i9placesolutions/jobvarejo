<script setup lang="ts">
import { computed } from 'vue'
import Button from './ui/Button.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})
</script>

<template>
  <UiDialog v-model="open" title="Excluir Página?" @close="open = false">
    <p class="py-4 text-sm leading-6 text-zinc-300">Tem certeza que deseja excluir esta página? Esta ação não pode ser desfeita.</p>
    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <Button
          variant="outline"
          class="min-w-28 border-zinc-600 bg-zinc-800 px-5 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus-visible:ring-zinc-400"
          @click="open = false"
        >
          Cancelar
        </Button>
        <Button
          variant="destructive"
          class="min-w-32 bg-red-500 px-5 text-white shadow-lg shadow-red-500/20 hover:bg-red-400 focus-visible:ring-red-400"
          @click="emit('confirm')"
        >
          Sim, Excluir
        </Button>
      </div>
    </template>
  </UiDialog>
</template>
