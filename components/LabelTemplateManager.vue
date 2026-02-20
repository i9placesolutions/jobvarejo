<script setup lang="ts">
import type { LabelTemplate } from '~/types/label-template'
import LabelTemplateMiniEditor from './LabelTemplateMiniEditor.vue'

const props = defineProps<{
  templates: LabelTemplate[]
  selectedTemplateId?: string
  canSaveFromSelection?: boolean
}>()

type TemplateSaveResult = {
  ok: boolean
  message?: string
}

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'create-from-selection', name: string): void
  (e: 'create-default', name: string): void
  (e: 'edit-selection'): void
  (e: 'update-from-selection', templateId: string): void
  (e: 'insert-to-canvas', templateId: string): void
  (e: 'update-template', templateId: string, updates: { group: any; previewDataUrl?: string; name?: string }, done?: (result: TemplateSaveResult) => void): void
  (e: 'duplicate', templateId: string): void
  (e: 'delete', templateId: string): void
  (e: 'apply-to-zone', templateId?: string): void
  (e: 'set-splash-image', templateId: string, file: File): void
}>()

const name = ref('Nova Etiqueta')
const pendingDeleteId = ref<string | null>(null)
const hoveredTemplateId = ref<string | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)
const imageTargetId = ref<string | null>(null)
const editingTemplateId = ref<string | null>(null)
const showCreateSection = ref(false)

const openImagePicker = (templateId: string) => {
  imageTargetId.value = templateId
  fileInput.value?.click()
}

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  const templateId = imageTargetId.value
  if (file && templateId) emit('set-splash-image', templateId, file)
  if (input) input.value = ''
  imageTargetId.value = null
}

const handleMiniEditorSave = (
  id: string,
  updates: { group: any; previewDataUrl?: string; name?: string },
  done?: (result: TemplateSaveResult) => void
) => {
  emit('update-template', id, updates, (result) => {
    done?.(result)
    if (result?.ok) {
      editingTemplateId.value = null
    }
  })
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Agora'
  if (diffMins < 60) return `${diffMins}m atrás`
  if (diffHours < 24) return `${diffHours}h atrás`
  if (diffDays < 7) return `${diffDays}d atrás`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
</script>

<template>
  <div class="label-template-manager">
    <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="onFileChange" />

    <!-- Header -->
    <div class="ltm-header">
      <div class="ltm-header-left">
        <div class="ltm-icon-wrapper">
          <svg class="ltm-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </div>
        <div class="ltm-title-section">
          <h2 class="ltm-title">Modelos de Etiqueta</h2>
          <p class="ltm-subtitle">Gerencie e aplique modelos de preços padronizados</p>
        </div>
      </div>
      <button class="ltm-close-btn" @click="emit('close')">
        <svg class="ltm-close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Quick Actions Bar -->
    <div class="ltm-actions-bar">
      <button
        class="ltm-action-btn ltm-action-btn--primary"
        :class="{ 'ltm-action-btn--disabled': !canSaveFromSelection }"
        :disabled="!canSaveFromSelection"
        @click="emit('edit-selection')"
      >
        <svg class="ltm-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span>Editar Selecionada</span>
      </button>

      <button
        class="ltm-action-btn ltm-action-btn--secondary"
        @click="showCreateSection = !showCreateSection"
      >
        <svg class="ltm-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>Novo Modelo</span>
        <svg class="ltm-chevron" :class="{ 'ltm-chevron--open': showCreateSection }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <button
        class="ltm-action-btn ltm-action-btn--tertiary"
        @click="emit('apply-to-zone', undefined)"
      >
        <svg class="ltm-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Resetar para Padrão</span>
      </button>
    </div>

    <!-- Create Section (Collapsible) -->
    <transition name="ltm-slide">
      <div v-if="showCreateSection" class="ltm-create-section">
        <div class="ltm-input-group">
          <label class="ltm-input-label">Nome do Modelo</label>
          <input
            v-model="name"
            class="ltm-input"
            placeholder="Ex: Etiqueta Neon, Oferta Black, etc."
            @keyup.enter="canSaveFromSelection ? emit('create-from-selection', name) : emit('create-default', name)"
          />
        </div>
        <div class="ltm-create-actions">
          <button
            class="ltm-create-btn ltm-create-btn--save"
            :class="{ 'ltm-create-btn--disabled': !canSaveFromSelection }"
            :disabled="!canSaveFromSelection"
            @click="emit('create-from-selection', name)"
          >
            <svg class="ltm-create-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Salvar da Seleção
          </button>
          <button
            class="ltm-create-btn ltm-create-btn--default"
            @click="emit('create-default', name)"
          >
            <svg class="ltm-create-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Criar Padrão
          </button>
        </div>
        <p v-if="!canSaveFromSelection" class="ltm-hint">
          <svg class="ltm-hint-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Selecione um produto no canvas para habilitar "Salvar da Seleção"
        </p>
      </div>
    </transition>

    <!-- Templates Grid -->
    <div class="ltm-templates-section">
      <div class="ltm-section-header">
        <h3 class="ltm-section-title">Seus Modelos</h3>
        <span class="ltm-section-count">{{ templates.length }} modelo{{ templates.length !== 1 ? 's' : '' }}</span>
      </div>

      <div v-if="templates.length === 0" class="ltm-empty-state">
        <div class="ltm-empty-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h4 class="ltm-empty-title">Nenhum modelo ainda</h4>
        <p class="ltm-empty-text">Crie seu primeiro modelo selecionando uma etiqueta no canvas ou começando do zero.</p>
        <button class="ltm-empty-btn" @click="showCreateSection = true">
          Criar Primeiro Modelo
        </button>
      </div>

      <div v-else class="ltm-templates-grid">
        <div
          v-for="tpl in templates"
          :key="tpl.id"
          class="ltm-template-card group"
          :class="{
            'ltm-template-card--selected': tpl.id === selectedTemplateId,
            'ltm-template-card--hovered': hoveredTemplateId === tpl.id
          }"
          @mouseenter="hoveredTemplateId = tpl.id"
          @mouseleave="hoveredTemplateId = null"
        >
          <!-- Preview -->
          <div class="ltm-template-preview">
            <div v-if="tpl.previewDataUrl" class="ltm-template-preview-image">
              <img :src="tpl.previewDataUrl" :alt="tpl.name" loading="lazy" decoding="async" />
            </div>
            <div v-else class="ltm-template-preview-placeholder">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Sem preview</span>
            </div>
            <span v-if="tpl.isBuiltIn" class="ltm-template-badge">Padrão</span>
            <span v-if="tpl.id === selectedTemplateId" class="ltm-template-badge ltm-template-badge--active">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              Em uso
            </span>
          </div>

          <!-- Info -->
          <div class="ltm-template-info">
            <h4 class="ltm-template-name">{{ tpl.name }}</h4>
            <p class="ltm-template-meta">{{ formatDate(tpl.updatedAt) }}</p>
          </div>

          <!-- Actions (shown on hover) -->
          <div class="ltm-template-actions">
            <button
              class="ltm-template-action ltm-template-action--apply"
              @click="emit('apply-to-zone', tpl.id)"
              title="Aplicar na zona selecionada"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              class="ltm-template-action ltm-template-action--insert"
              @click="emit('insert-to-canvas', tpl.id)"
              title="Inserir no canvas"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
            <button
              class="ltm-template-action ltm-template-action--edit"
              @click="editingTemplateId = tpl.id"
              title="Editar modelo"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <div class="ltm-template-divider"></div>
            <button
              class="ltm-template-action ltm-template-action--image"
              @click="openImagePicker(tpl.id)"
              title="Definir imagem de fundo"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              class="ltm-template-action"
              :class="{ 'ltm-template-action--disabled': !canSaveFromSelection }"
              :disabled="!canSaveFromSelection"
              @click="emit('update-from-selection', tpl.id)"
              title="Atualizar com seleção atual"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              class="ltm-template-action"
              @click="emit('duplicate', tpl.id)"
              title="Duplicar modelo"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              v-if="!tpl.isBuiltIn"
              class="ltm-template-action ltm-template-action--delete"
              @click="pendingDeleteId = tpl.id"
              title="Excluir modelo"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <transition name="ltm-fade">
      <div v-if="pendingDeleteId" class="ltm-delete-overlay">
        <div class="ltm-delete-dialog">
          <div class="ltm-delete-icon-wrapper">
            <svg class="ltm-delete-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="ltm-delete-title">Excluir este modelo?</h3>
          <p class="ltm-delete-text">Isso não afeta as etiquetas que já foram aplicadas aos produtos. Você pode recriar este modelo a qualquer momento.</p>
          <div class="ltm-delete-actions">
            <button class="ltm-delete-btn ltm-delete-btn--cancel" @click="pendingDeleteId = null">
              Cancelar
            </button>
            <button
              class="ltm-delete-btn ltm-delete-btn--confirm"
              @click="emit('delete', pendingDeleteId); pendingDeleteId = null"
            >
              Sim, Excluir
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Mini Editor Overlay -->
    <transition name="ltm-slide-up">
      <div v-if="editingTemplateId" class="ltm-editor-overlay">
        <button class="ltm-editor-close" @click="editingTemplateId = null">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <LabelTemplateMiniEditor
          :template="templates.find(t => t.id === editingTemplateId) || null"
          @close="editingTemplateId = null"
          @save="handleMiniEditorSave"
        />
      </div>
    </transition>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.label-template-manager {
  @apply flex flex-col h-full;
}

/* Header */
.ltm-header {
  @apply flex items-center justify-between pb-6 border-b border-white/10;
}

.ltm-header-left {
  @apply flex items-center gap-4;
}

.ltm-icon-wrapper {
  @apply w-12 h-12 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20;
}

.ltm-icon {
  @apply w-6 h-6 text-white;
}

.ltm-title-section {
  @apply flex flex-col;
}

.ltm-title {
  @apply text-lg font-semibold text-white;
}

.ltm-subtitle {
  @apply text-xs text-zinc-500 mt-0.5;
}

.ltm-close-btn {
  @apply w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center transition-colors;
}

.ltm-close-icon {
  @apply w-5 h-5 text-zinc-500;
}

/* Actions Bar */
.ltm-actions-bar {
  @apply flex items-center gap-3 py-5;
}

.ltm-action-btn {
  @apply flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200;
}

.ltm-action-icon {
  @apply w-4 h-4;
}

.ltm-action-btn--primary {
  @apply bg-linear-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:from-violet-500 hover:to-indigo-500;
}

.ltm-action-btn--primary.ltm-action-btn--disabled {
  @apply from-zinc-700 to-zinc-700 text-zinc-500 cursor-not-allowed shadow-none;
}

.ltm-action-btn--secondary {
  @apply bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700;
}

.ltm-action-btn--tertiary {
  @apply text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50;
}

.ltm-chevron {
  @apply w-4 h-4 transition-transform duration-200;
}

.ltm-chevron--open {
  @apply rotate-180;
}

/* Create Section */
.ltm-create-section {
  @apply p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 mb-5;
}

.ltm-input-group {
  @apply mb-4;
}

.ltm-input-label {
  @apply block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2;
}

.ltm-input {
  @apply w-full bg-zinc-950/50 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10 transition-all;
}

.ltm-create-actions {
  @apply flex items-center gap-3;
}

.ltm-create-btn {
  @apply flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200;
}

.ltm-create-icon {
  @apply w-4 h-4;
}

.ltm-create-btn--save {
  @apply bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:from-emerald-500 hover:to-teal-500;
}

.ltm-create-btn--save.ltm-create-btn--disabled {
  @apply from-zinc-700 to-zinc-700 text-zinc-500 cursor-not-allowed shadow-none;
}

.ltm-create-btn--default {
  @apply bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700;
}

.ltm-hint {
  @apply flex items-center gap-2 mt-3 text-xs text-zinc-500;
}

.ltm-hint-icon {
  @apply w-4 h-4 text-amber-500 shrink-0;
}

/* Templates Section */
.ltm-templates-section {
  @apply flex-1 flex flex-col min-h-0;
}

.ltm-section-header {
  @apply flex items-center justify-between mb-4;
}

.ltm-section-title {
  @apply text-sm font-semibold text-zinc-300;
}

.ltm-section-count {
  @apply text-xs text-zinc-600 font-medium px-2 py-1 rounded-lg bg-zinc-900;
}

/* Empty State */
.ltm-empty-state {
  @apply flex flex-col items-center justify-center py-16 px-4;
}

.ltm-empty-icon {
  @apply w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mb-4;
}

.ltm-empty-icon svg {
  @apply w-8 h-8 text-zinc-700;
}

.ltm-empty-title {
  @apply text-sm font-semibold text-zinc-400 mb-2;
}

.ltm-empty-text {
  @apply text-xs text-zinc-600 text-center max-w-xs mb-6;
}

.ltm-empty-btn {
  @apply px-5 py-2.5 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all;
}

/* Templates Grid */
.ltm-templates-grid {
  @apply grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pr-1 pb-2;
}

.ltm-template-card {
  @apply relative bg-zinc-900/50 rounded-2xl border border-zinc-800/50 overflow-hidden transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80;
}

.ltm-template-card--selected {
  @apply border-amber-500/30 bg-amber-500/5;
}

.ltm-template-preview {
  @apply relative aspect-2/1 bg-zinc-950/50 flex items-center justify-center overflow-hidden;
}

.ltm-template-preview-image {
  @apply w-full h-full flex items-center justify-center p-2;
}

.ltm-template-preview-image img {
  @apply max-w-full max-h-full object-contain;
}

.ltm-template-preview-placeholder {
  @apply flex flex-col items-center justify-center gap-2 text-zinc-700;
}

.ltm-template-preview-placeholder svg {
  @apply w-8 h-8;
}

.ltm-template-preview-placeholder span {
  @apply text-[10px];
}

.ltm-template-badge {
  @apply absolute top-2 left-2 px-2 py-1 rounded-md bg-zinc-800/80 backdrop-blur-sm text-[9px] font-semibold uppercase tracking-wider text-zinc-500;
}

.ltm-template-badge--active {
  @apply left-auto right-2 bg-emerald-500/20 text-emerald-400 flex items-center gap-1;
}

.ltm-template-badge--active svg {
  @apply w-3 h-3;
}

.ltm-template-info {
  @apply p-3;
}

.ltm-template-name {
  @apply text-sm font-medium text-white truncate mb-1;
}

.ltm-template-meta {
  @apply text-[10px] text-zinc-600;
}

.ltm-template-actions {
  @apply absolute inset-x-0 bottom-0 p-2 bg-linear-to-t from-zinc-900 via-zinc-900/95 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1;
}

.ltm-template-action {
  @apply w-8 h-8 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all duration-150 backdrop-blur-sm;
}

.ltm-template-action svg {
  @apply w-4 h-4;
}

.ltm-template-action--apply {
  @apply bg-emerald-600/90 hover:bg-emerald-500 text-white;
}

.ltm-template-action--insert {
  @apply bg-blue-600/90 hover:bg-blue-500 text-white;
}

.ltm-template-action--edit {
  @apply bg-amber-600/90 hover:bg-amber-500 text-white;
}

.ltm-template-action--delete {
  @apply hover:bg-red-500/20 hover:text-red-400;
}

.ltm-template-action--disabled {
  @apply opacity-40 cursor-not-allowed;
}

.ltm-template-divider {
  @apply w-px h-5 bg-zinc-700 mx-1;
}

/* Delete Overlay */
.ltm-delete-overlay {
  @apply absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4;
}

.ltm-delete-dialog {
  @apply w-full max-w-sm bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-2xl;
}

.ltm-delete-icon-wrapper {
  @apply w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4;
}

.ltm-delete-icon {
  @apply w-6 h-6 text-red-500;
}

.ltm-delete-title {
  @apply text-base font-semibold text-white text-center mb-2;
}

.ltm-delete-text {
  @apply text-sm text-zinc-400 text-center mb-6 leading-relaxed;
}

.ltm-delete-actions {
  @apply flex items-center gap-3;
}

.ltm-delete-btn {
  @apply flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all;
}

.ltm-delete-btn--cancel {
  @apply bg-zinc-800 text-zinc-300 hover:bg-zinc-700;
}

.ltm-delete-btn--confirm {
  @apply bg-red-500 text-white hover:bg-red-400;
}

/* Editor Overlay - Full viewport */
.ltm-editor-overlay {
  @apply fixed inset-0 bg-zinc-950 overflow-hidden z-50;
}

.ltm-editor-close {
  @apply absolute top-4 right-4 z-50 w-10 h-10 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shadow-lg border border-zinc-800;
}

.ltm-editor-close svg {
  @apply w-5 h-5;
}

/* Animations */
.ltm-slide-enter-active,
.ltm-slide-leave-active {
  @apply transition-all duration-300 ease-out;
}

.ltm-slide-enter-from,
.ltm-slide-leave-to {
  @apply opacity-0 -translate-y-2;
}

.ltm-slide-up-enter-active,
.ltm-slide-up-leave-active {
  @apply transition-all duration-300 ease-out;
}

.ltm-slide-up-enter-from,
.ltm-slide-up-leave-to {
  @apply opacity-0 translate-y-4;
}

.ltm-fade-enter-active,
.ltm-fade-leave-active {
  @apply transition-opacity duration-200;
}

.ltm-fade-enter-from,
.ltm-fade-leave-to {
  @apply opacity-0;
}

/* Scrollbar */
.ltm-templates-grid::-webkit-scrollbar {
  width: 6px;
}

.ltm-templates-grid::-webkit-scrollbar-track {
  @apply bg-transparent;
}

.ltm-templates-grid::-webkit-scrollbar-thumb {
  @apply bg-zinc-800 rounded-full;
}

.ltm-templates-grid::-webkit-scrollbar-thumb:hover {
  @apply bg-zinc-700;
}
</style>
