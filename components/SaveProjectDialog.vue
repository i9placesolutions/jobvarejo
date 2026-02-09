<script setup lang="ts">
import { computed } from 'vue'
import Button from './ui/Button.vue'

const props = defineProps<{
  modelValue: boolean
  saveProjectName: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:saveProjectName', value: string): void
  (e: 'save'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const projectName = computed({
  get: () => props.saveProjectName,
  set: (v: string) => emit('update:saveProjectName', v)
})
</script>

<template>
  <UiDialog v-model="open" title="Salvar Projeto" @close="open = false">
    <template #default>
      <div class="space-y-4 py-2">
        <p class="text-sm text-muted-foreground">Escolha um nome para identificar seu projeto na galeria.</p>
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome do Projeto</label>
          <input
            v-model="projectName"
            type="text"
            placeholder="Ex: Ofertas de Verão 2024"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            @keyup.enter="emit('save')"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <Button variant="ghost" @click="open = false">Cancelar</Button>
        <Button variant="default" :disabled="!saveProjectName" @click="emit('save')">Salvar Alterações</Button>
      </div>
    </template>
  </UiDialog>
</template>
