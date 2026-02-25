<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import type { LabelTemplate } from '~/types/label-template'

type ImportTargetMode = 'zone' | 'multi-frame'
type FrameAssignment = { productId: string; frameId: string | null }
type ProductImportOptions = {
  mode?: 'replace' | 'append'
  labelTemplateId?: string
  targetMode?: ImportTargetMode
  selectedFrameIds?: string[]
  frameAssignments?: FrameAssignment[]
  countRule?: 'min'
  cardsPerFrame?: 1
}

type AiGeneratePayload = {
  mode: 'replace' | 'newPage'
  pageType: 'RETAIL_OFFER' | 'FREE_DESIGN'
  pageWidth: number
  pageHeight: number
  referenceImageDataUrl?: string | null
  cloneStrength?: number
}

const SaveProjectDialog = defineAsyncComponent(() => import('./SaveProjectDialog.vue'))
const LabelTemplatesDialog = defineAsyncComponent(() => import('./LabelTemplatesDialog.vue'))
const AIPromptDialog = defineAsyncComponent(() => import('./AIPromptDialog.vue'))
const PasteListDialog = defineAsyncComponent(() => import('./PasteListDialog.vue'))
const DeletePageDialog = defineAsyncComponent(() => import('./DeletePageDialog.vue'))
const ProductReviewModal = defineAsyncComponent(() => import('./ProductReviewModal.vue'))
const ExportDialog = defineAsyncComponent(() => import('./ExportDialog.vue'))
const ShareDialog = defineAsyncComponent(() => import('./ShareDialog.vue'))
const PresentationOverlay = defineAsyncComponent(() => import('./PresentationOverlay.vue'))
const FigmaCropOverlay = defineAsyncComponent(() => import('./FigmaCropOverlay.vue'))

defineProps<{
  showSaveModal: boolean
  saveProjectName: string
  showLabelTemplatesModal: boolean
  labelTemplates: LabelTemplate[]
  selectedTemplateId?: string
  canSaveLabelTemplateFromSelection: boolean
  showAIModal: boolean
  aiPrompt: string
  aiReferenceImageDataUrl: string | null
  aiApplyMode: 'replace' | 'newPage'
  aiPageType: 'RETAIL_OFFER' | 'FREE_DESIGN'
  aiPageWidth: number
  aiPageHeight: number
  isProcessing: boolean
  showPasteListModal: boolean
  activePasteTab: string
  pasteListText: string
  pastedImage: string | null
  isAnalyzingImage: boolean
  showDeletePageModal: boolean
  showProductReviewModal: boolean
  reviewProducts: any[]
  showImportMode: boolean
  productImportExistingCount: number
  importZoneLabelTemplateId: string
  showExportModal: boolean
  exportSettings: any
  availableFramesForExport: any[]
  hasExportableSelectedObject: boolean
  availableFramesForImport: any[]
  showShareModal: boolean
  shareSettings: any
  showPresentationModal: boolean
  presentationImage: string
  presentationHotspots: any[]
  figmaCropActive: boolean
  cropFrameRect: any
  cropFrameName: string
  cropCanvasOffset: { x: number; y: number }
}>()

const emit = defineEmits<{
  (e: 'update:showSaveModal', value: boolean): void
  (e: 'update:saveProjectName', value: string): void
  (e: 'save'): void
  (e: 'update:showLabelTemplatesModal', value: boolean): void
  (e: 'edit-selection'): void
  (e: 'create-from-selection', name: string): void
  (e: 'create-default', name: string): void
  (e: 'update-from-selection', templateId: string): void
  (e: 'insert-to-canvas', id: string): void
  (e: 'update-template', id: string, payload: any, done?: (result: { ok: boolean; message?: string }) => void): void
  (e: 'duplicate-template', id: string): void
  (e: 'delete-template', id: string): void
  (e: 'apply-template-to-zone', id?: string): void
  (e: 'set-template-splash-image', id: string, file: File): void
  (e: 'update:showAIModal', value: boolean): void
  (e: 'update:aiPrompt', value: string): void
  (e: 'update:aiReferenceImageDataUrl', value: string | null): void
  (e: 'update:aiApplyMode', value: 'replace' | 'newPage'): void
  (e: 'update:aiPageType', value: 'RETAIL_OFFER' | 'FREE_DESIGN'): void
  (e: 'update:aiPageWidth', value: number): void
  (e: 'update:aiPageHeight', value: number): void
  (e: 'generate-ai', payload: AiGeneratePayload): void
  (e: 'update:showPasteListModal', value: boolean): void
  (e: 'update:activePasteTab', value: string): void
  (e: 'update:pasteListText', value: string): void
  (e: 'update:pastedImage', value: string | null): void
  (e: 'update:isAnalyzingImage', value: boolean): void
  (e: 'submit-paste-list'): void
  (e: 'update:showDeletePageModal', value: boolean): void
  (e: 'confirm-delete-page'): void
  (e: 'update:showProductReviewModal', value: boolean): void
  (e: 'import-products', products: any[], opts?: ProductImportOptions): void
  (e: 'update:showExportModal', value: boolean): void
  (e: 'export'): void
  (e: 'update:showShareModal', value: boolean): void
  (e: 'toggle-share-frame', frameId: string): void
  (e: 'select-all-share-frames'): void
  (e: 'share'): void
  (e: 'update:showPresentationModal', value: boolean): void
  (e: 'hotspot-click', target: any): void
  (e: 'update:figmaCropActive', value: boolean): void
  (e: 'update:cropFrameRect', rect: { x: number; y: number; width: number; height: number }): void
  (e: 'crop-complete', rect: { x: number; y: number; width: number; height: number }): void
}>()
</script>

<template>
  <SaveProjectDialog
    v-if="showSaveModal"
    :model-value="showSaveModal"
    :save-project-name="saveProjectName"
    @update:model-value="emit('update:showSaveModal', $event)"
    @update:save-project-name="emit('update:saveProjectName', $event)"
    @save="emit('save')"
  />

  <LabelTemplatesDialog
    v-if="showLabelTemplatesModal"
    :model-value="showLabelTemplatesModal"
    :templates="labelTemplates"
    :selected-template-id="selectedTemplateId"
    :can-save-from-selection="canSaveLabelTemplateFromSelection"
    @update:model-value="emit('update:showLabelTemplatesModal', $event)"
    @edit-selection="emit('edit-selection')"
    @create-from-selection="emit('create-from-selection', $event)"
    @create-default="emit('create-default', $event)"
    @update-from-selection="emit('update-from-selection', $event)"
    @insert-to-canvas="emit('insert-to-canvas', $event)"
    @update-template="(id, payload, done) => emit('update-template', id, payload, done)"
    @duplicate="emit('duplicate-template', $event)"
    @delete="emit('delete-template', $event)"
    @apply-to-zone="emit('apply-template-to-zone', $event)"
    @set-splash-image="(id, file) => emit('set-template-splash-image', id, file)"
  />

  <AIPromptDialog
    v-if="showAIModal"
    :model-value="showAIModal"
    :ai-prompt="aiPrompt"
    :ai-reference-image-data-url="aiReferenceImageDataUrl"
    :apply-mode="aiApplyMode"
    :page-type="aiPageType"
    :page-width="aiPageWidth"
    :page-height="aiPageHeight"
    :processing="isProcessing"
    @update:model-value="emit('update:showAIModal', $event)"
    @update:ai-prompt="emit('update:aiPrompt', $event)"
    @update:ai-reference-image-data-url="emit('update:aiReferenceImageDataUrl', $event)"
    @update:apply-mode="emit('update:aiApplyMode', $event)"
    @update:page-type="emit('update:aiPageType', $event)"
    @update:page-width="emit('update:aiPageWidth', $event)"
    @update:page-height="emit('update:aiPageHeight', $event)"
    @generate="emit('generate-ai', $event)"
  />

  <PasteListDialog
    v-if="showPasteListModal"
    :model-value="showPasteListModal"
    :active-paste-tab="activePasteTab"
    :paste-list-text="pasteListText"
    :pasted-image="pastedImage"
    :is-analyzing-image="isAnalyzingImage"
    @update:model-value="emit('update:showPasteListModal', $event)"
    @update:active-paste-tab="emit('update:activePasteTab', $event)"
    @update:paste-list-text="emit('update:pasteListText', $event)"
    @update:pasted-image="emit('update:pastedImage', $event)"
    @update:is-analyzing-image="emit('update:isAnalyzingImage', $event)"
    @submit="emit('submit-paste-list')"
  />

  <DeletePageDialog
    v-if="showDeletePageModal"
    :model-value="showDeletePageModal"
    @update:model-value="emit('update:showDeletePageModal', $event)"
    @confirm="emit('confirm-delete-page')"
  />

  <ProductReviewModal
    :model-value="showProductReviewModal"
    :initial-products="reviewProducts"
    :show-import-mode="showImportMode"
    :existing-count="productImportExistingCount"
    :label-templates="labelTemplates"
    :initial-label-template-id="importZoneLabelTemplateId"
    :available-frames-for-import="availableFramesForImport"
    @update:model-value="emit('update:showProductReviewModal', $event)"
    @import="(products, opts) => emit('import-products', products, opts)"
  />

  <ExportDialog
    v-if="showExportModal"
    :model-value="showExportModal"
    :export-settings="exportSettings"
    :available-frames-for-export="availableFramesForExport"
    :has-selected-object="hasExportableSelectedObject"
    @update:model-value="emit('update:showExportModal', $event)"
    @export="emit('export')"
  />

  <ShareDialog
    v-if="showShareModal"
    :model-value="showShareModal"
    :share-settings="shareSettings"
    :available-frames-for-export="availableFramesForExport"
    :has-selected-object="hasExportableSelectedObject"
    @update:model-value="emit('update:showShareModal', $event)"
    @toggle-frame="emit('toggle-share-frame', $event)"
    @select-all="emit('select-all-share-frames')"
    @share="emit('share')"
  />

  <PresentationOverlay
    v-if="showPresentationModal"
    :model-value="showPresentationModal"
    :presentation-image="presentationImage"
    :presentation-hotspots="presentationHotspots"
    @update:model-value="emit('update:showPresentationModal', $event)"
    @hotspot-click="emit('hotspot-click', $event)"
  />

  <FigmaCropOverlay
    v-if="figmaCropActive"
    :model-value="figmaCropActive"
    :frame-rect="cropFrameRect"
    :frame-name="cropFrameName"
    :zoom="1"
    :canvas-offset="cropCanvasOffset"
    @update:model-value="emit('update:figmaCropActive', $event)"
    @update:frame-rect="emit('update:cropFrameRect', $event)"
    @crop-complete="emit('crop-complete', $event)"
  />
</template>
