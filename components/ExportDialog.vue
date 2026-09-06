<script setup lang="ts">
import { computed } from 'vue'
import Button from './ui/Button.vue'

type ExportScope = 'selected-object' | 'selected-frame' | 'all-frames'
type ExportFormat = 'png' | 'jpeg' | 'pdf'
type ExportQualityPreset = 'digital' | 'print-300' | 'ultra-600'
type MultiFileMode = 'zip' | 'separate'

const props = defineProps<{
  modelValue: boolean
  exportSettings: {
    format: ExportFormat | string
    scale: number
    quality: number
    qualityPreset: ExportQualityPreset | string
    multiFileMode: MultiFileMode | string
    exportScope: ExportScope | string
    selectedPageIds: string[]
    selectedFrameId: string
  }
  availablePagesForExport: Array<{ id: string; name: string; width?: number; height?: number }>
  availableFramesForExport: Array<{ id: string; name: string }>
  hasSelectedObject: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'export'): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})
const selectedCount = computed(() => props.exportSettings.exportScope === 'all-pages'
  ? props.availablePagesForExport.length
  : props.exportSettings.exportScope === 'selected-pages'
    ? props.availablePagesForExport.filter(page => props.exportSettings.selectedPageIds.includes(page.id)).length
    : props.exportSettings.exportScope === 'all-frames' ? props.availableFramesForExport.length : 1)
</script>

<template>
  <UiDialog v-model="open" title="Exportar Design" @close="open = false" width="450px">
    <template #default>
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que exportar</label>
          <div class="grid grid-cols-2 gap-2">
            <button @click="exportSettings.exportScope = 'all-pages'"
              :aria-pressed="exportSettings.exportScope === 'all-pages'"
              :class="exportSettings.exportScope === 'all-pages' ? 'border-violet-500 bg-violet-500/20 text-violet-200' : 'border-border bg-muted'"
              class="min-h-12 rounded-xl border px-3 py-3 text-sm font-semibold">Todas as páginas</button>
            <button @click="exportSettings.exportScope = 'selected-pages'"
              :aria-pressed="exportSettings.exportScope === 'selected-pages'"
              :class="exportSettings.exportScope === 'selected-pages' ? 'border-violet-500 bg-violet-500/20 text-violet-200' : 'border-border bg-muted'"
              class="min-h-12 rounded-xl border px-3 py-3 text-sm font-semibold">Escolher páginas</button>
          </div>
          <div v-if="exportSettings.exportScope === 'selected-pages'" class="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            <label v-for="(page, index) in availablePagesForExport" :key="page.id" class="flex min-h-14 cursor-pointer items-center gap-3 p-3 hover:bg-muted">
              <input v-model="exportSettings.selectedPageIds" type="checkbox" :value="page.id" class="h-5 w-5 shrink-0 accent-violet-600" />
              <span class="min-w-0 text-sm"><span class="block font-medium">{{ index + 1 }}. {{ page.name }}</span>
                <span class="text-xs text-muted-foreground">{{ page.width }} × {{ page.height }} px</span>
              </span>
            </label>
          </div>
          <p v-if="['all-pages', 'selected-pages'].includes(exportSettings.exportScope)" class="text-xs text-muted-foreground">{{ selectedCount }} de {{ availablePagesForExport.length }} páginas selecionadas. A ordem do projeto será mantida.</p>
          <details class="text-xs text-muted-foreground">
            <summary class="cursor-pointer py-2">Objeto ou frame da página aberta</summary>
            <div class="flex flex-wrap gap-2 py-2">
              <button :disabled="!hasSelectedObject" @click="exportSettings.exportScope = 'selected-object'" class="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Objeto selecionado</button>
              <button @click="exportSettings.exportScope = 'selected-frame'" class="rounded-lg border border-border px-3 py-2">Escolher frame</button>
              <button @click="exportSettings.exportScope = 'all-frames'" class="rounded-lg border border-border px-3 py-2">Todos os frames</button>
            </div>
          </details>
        </div>

        <div v-if="exportSettings.exportScope === 'selected-frame'" class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selecione o Frame</label>
          <select
            v-model="exportSettings.selectedFrameId"
            class="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="">Selecione um frame...</option>
            <option v-for="frame in availableFramesForExport" :key="frame.id" :value="frame.id">
              {{ frame.name }}
            </option>
          </select>
          <p v-if="availableFramesForExport.length === 0" class="text-[10px] text-amber-500">
            Nenhum frame encontrado no canvas. Crie um frame primeiro.
          </p>
        </div>

        <div v-if="exportSettings.exportScope === 'selected-object' && !hasSelectedObject" class="text-[10px] text-amber-500">
          Selecione um objeto no canvas para exportar neste modo.
        </div>

        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formato</label>
          <div class="grid grid-cols-3 gap-2">
            <button @click="exportSettings.format = 'png'" :class="exportSettings.format === 'png' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="py-2 text-xs font-bold rounded border transition-colors">PNG</button>
            <button @click="exportSettings.format = 'jpeg'" :class="exportSettings.format === 'jpeg' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="py-2 text-xs font-bold rounded border transition-colors">JPG</button>
            <button @click="exportSettings.format = 'pdf'" :class="exportSettings.format === 'pdf' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="py-2 text-xs font-bold rounded border transition-colors">PDF</button>
          </div>
          <p v-if="exportSettings.format === 'pdf'" class="text-[10px] text-zinc-500">
            PDF para impressão com páginas proporcionais ao tamanho real dos frames.
          </p>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qualidade</label>
          <div class="flex gap-2">
            <button @click="exportSettings.qualityPreset = 'digital'; exportSettings.format = 'png'" :class="exportSettings.qualityPreset === 'digital' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">Normal · sem perda</button>
            <button @click="exportSettings.qualityPreset = 'print-300'" :class="exportSettings.qualityPreset === 'print-300' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">Tamanho original</button>
            <button @click="exportSettings.qualityPreset = 'ultra-600'" :class="exportSettings.qualityPreset === 'ultra-600' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">Alta resolução</button>
          </div>
          <div class="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
            Normal usa PNG sem perda no tamanho original do design. Alta resolução amplia a imagem e aumenta o arquivo. JPG é uma opção com compressão e sem transparência.
          </div>
        </div>

        <div v-if="selectedCount > 1 && exportSettings.format !== 'pdf'" class="space-y-2">
          <label class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saída de Múltiplos Arquivos</label>
          <div class="flex gap-2">
            <button @click="exportSettings.multiFileMode = 'zip'" :class="exportSettings.multiFileMode === 'zip' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">ZIP Único</button>
            <button @click="exportSettings.multiFileMode = 'separate'" :class="exportSettings.multiFileMode === 'separate' ? 'bg-violet-600 text-white border-violet-600' : 'bg-muted text-muted-foreground border-transparent'" class="flex-1 py-2 text-xs font-bold rounded border transition-colors">Separado</button>
          </div>
        </div>

        <div v-if="selectedCount > 1" class="flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <svg class="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p v-if="exportSettings.format === 'pdf'" class="text-[10px] text-blue-200">
            Um único PDF será gerado com {{ selectedCount }} páginas.
          </p>
          <p v-else-if="exportSettings.multiFileMode === 'zip'" class="text-[10px] text-blue-200">
            Os {{ selectedCount }} itens serão compactados em um único arquivo ZIP.
          </p>
          <p v-else class="text-[10px] text-blue-200">
            Cada item será exportado como arquivo separado. {{ selectedCount }} downloads serão gerados.
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-[10px] text-muted-foreground">
          {{
            selectedCount > 1
              ? exportSettings.format === 'pdf'
                ? '1 arquivo PDF'
                : exportSettings.multiFileMode === 'zip'
                  ? '1 arquivo ZIP'
                  : `${selectedCount} arquivos`
              : '1 arquivo'
          }}
        </span>
        <div class="flex gap-2">
          <Button variant="ghost" @click="open = false">Cancelar</Button>
          <Button
            variant="default"
            @click="emit('export')"
            :disabled="
              selectedCount === 0 ||
              (exportSettings.exportScope === 'selected-frame' && !exportSettings.selectedFrameId) ||
              (exportSettings.exportScope === 'selected-object' && !hasSelectedObject)
            "
          >
            Exportar
          </Button>
        </div>
      </div>
    </template>
  </UiDialog>
</template>
