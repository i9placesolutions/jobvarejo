<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { LabelTemplate } from '~/types/label-template'

const LabelTemplateManager = defineAsyncComponent(() => import('./LabelTemplateManager.vue'))

defineProps<{
  modelValue: boolean
  templates: LabelTemplate[]
  selectedTemplateId?: string | null
  canSaveFromSelection: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit-selection'): void
  (e: 'create-from-selection', name: string): void
  (e: 'create-default', name: string): void
  (e: 'update-from-selection', templateId: string): void
  (e: 'insert-to-canvas', id: string): void
  (e: 'update-template', id: string, payload: any, done?: (result: { ok: boolean; message?: string }) => void): void
  (e: 'duplicate', id: string): void
  (e: 'delete', id: string): void
  (e: 'apply-to-zone', id?: string): void
  (e: 'set-splash-image', id: string, file: File): void
}>()
</script>

<template>
  <UiDialog
    v-if="modelValue"
    :model-value="modelValue"
    title="Modelos de Etiqueta"
    width="min(920px, 96vw)"
    @update:model-value="emit('update:modelValue', $event)"
    @close="emit('update:modelValue', false)"
  >
    <template #default>
      <LabelTemplateManager
        :templates="templates"
        :selected-template-id="selectedTemplateId ?? undefined"
        :can-save-from-selection="canSaveFromSelection"
        @close="emit('update:modelValue', false)"
        @edit-selection="emit('edit-selection')"
        @create-from-selection="(name) => emit('create-from-selection', name)"
        @create-default="(name) => emit('create-default', name)"
        @update-from-selection="(templateId) => emit('update-from-selection', templateId)"
        @insert-to-canvas="emit('insert-to-canvas', $event)"
        @update-template="(id, payload, done) => emit('update-template', id, payload, done)"
        @duplicate="emit('duplicate', $event)"
        @delete="emit('delete', $event)"
        @apply-to-zone="emit('apply-to-zone', $event)"
        @set-splash-image="(id, file) => emit('set-splash-image', id, file)"
      />
    </template>
  </UiDialog>
</template>
