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
    <p class="py-4 text-sm text-muted-foreground">Tem certeza que deseja excluir esta página? Esta ação não pode ser desfeita.</p>
    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <Button variant="ghost" @click="open = false">Cancelar</Button>
        <Button variant="destructive" @click="emit('confirm')">Sim, Excluir</Button>
      </div>
    </template>
  </UiDialog>
</template>
