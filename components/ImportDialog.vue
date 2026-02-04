<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Upload, FileImage, Loader2, CheckCircle2, AlertCircle, X, FileText } from 'lucide-vue-next'
import { useFileImport } from '~/composables/useFileImport'
import type { ImportStatus } from '~/composables/useFileImport'
import Button from './ui/Button.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported', data: { project: any; canvasJson: any }): void
}>()

const { importPSD, saveAsDesign, status, error, progress, reset, importAndSave } = useFileImport()

const droppedFile = ref<File | null>(null)
const designName = ref('')
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const importedProject = ref<any | null>(null)
const importedCanvasJson = ref<any | null>(null)
// Estado local de erro para evitar warning de readonly
const localError = ref<string | null>(null)
// Opção para centralizar conteúdo no canvas
const autoCenter = ref(false)

// Computed para mostrar erro local ou do composable
const displayError = computed(() => localError.value || error.value)

const statusMessage = computed(() => {
  if (localError.value) return localError.value
  switch (status.value) {
    case 'idle': return ''
    case 'uploading': return 'Enviando arquivo...'
    case 'converting': return 'Convertendo camadas PSD...'
    case 'saving': return 'Salvando no dashboard...'
    case 'success': return 'Arquivo importado com sucesso!'
    case 'error': return error.value || 'Erro na importação'
    default: return ''
  }
})

const statusIcon = computed(() => {
  if (localError.value) return AlertCircle
  switch (status.value) {
    case 'idle': return null
    case 'uploading':
    case 'converting':
    case 'saving': return Loader2
    case 'success': return CheckCircle2
    case 'error': return AlertCircle
    default: return null
  }
})

const canImport = computed(() => {
  return droppedFile.value && designName.value.trim().length > 0 && status.value === 'idle'
})

const isProcessing = computed(() => {
  return ['uploading', 'converting', 'saving'].includes(status.value)
})

// Resetar estado quando o dialog fecha
watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    // Pequeno delay para evitar flicker
    setTimeout(() => {
      reset()
      droppedFile.value = null
      designName.value = ''
      importedProject.value = null
      importedCanvasJson.value = null
      localError.value = null
      autoCenter.value = false
    }, 300)
  } else {
    // Limpar erros ao abrir
    localError.value = null
    reset()
  }
})

// Auto-preencher nome do design
watch(droppedFile, (file) => {
  if (file && !designName.value) {
    designName.value = file.name.replace(/\.(psd|pdf|ai)$/i, '')
  }
})

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false

  const file = e.dataTransfer?.files?.[0]
  if (file) {
    validateAndSetFile(file)
  }
}

const handleFileSelect = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    validateAndSetFile(file)
  }
}

const validateAndSetFile = (file: File) => {
  const ext = file.name.toLowerCase()
  if (!ext.endsWith('.psd') && !ext.endsWith('.pdf') && !ext.endsWith('.ai')) {
    localError.value = 'Formato não suportado. Use: .psd'
    status.value = 'error'
    return
  }

  if (!ext.endsWith('.psd')) {
    localError.value = 'Por enquanto, apenas arquivos .psd são suportados'
    status.value = 'error'
    return
  }

  // Validar tamanho (400MB max)
  const maxSize = 400 * 1024 * 1024
  if (file.size > maxSize) {
    localError.value = 'Arquivo muito grande. Máximo: 400MB'
    status.value = 'error'
    return
  }

  droppedFile.value = file
  localError.value = null
  // Não chamar reset() aqui para não limpar o status durante validação
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleRemoveFile = () => {
  droppedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const handleImport = async () => {
  if (!droppedFile.value || !canImport.value) return

  // Limpar erros locais antes de começar
  localError.value = null

  const result = await importAndSave(droppedFile.value, designName.value, {
    autoCenter: autoCenter.value
  })

  if (result?.success && result.project) {
    importedProject.value = result.project
    importedCanvasJson.value = result.project.canvas_data

    // Notificar componente pai
    emit('imported', {
      project: result.project,
      canvasJson: result.project.canvas_data
    })

    // Fechar dialog após breve delay
    setTimeout(() => {
      emit('close')
    }, 1500)
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-background/80 backdrop-blur-md" @click="emit('close')"></div>

      <!-- Modal Content -->
      <div class="relative bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden">

        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload class="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-foreground">Importar Arquivo</h2>
              <p class="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">PSD para Canvas Editável</p>
            </div>
          </div>
          <button
            @click="emit('close')"
            :disabled="isProcessing"
            class="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground disabled:opacity-50"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-5">

          <!-- Drop Zone -->
          <div
            v-if="!droppedFile"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            class="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
            :class="[
              isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-zinc-600 hover:border-zinc-500'
            ]"
            @click="triggerFileInput"
          >
            <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <FileImage class="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p class="text-sm font-medium text-foreground mb-1">
              Arraste seu arquivo .psd aqui
            </p>
            <p class="text-xs text-muted-foreground mb-4">
              ou clique para selecionar
            </p>
            <div class="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <span class="px-2 py-1 bg-muted rounded">PSD</span>
              <span class="text-zinc-600">•</span>
              <span>Máx. 400MB</span>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept=".psd"
              @change="handleFileSelect"
              class="hidden"
            />
          </div>

          <!-- File Selected -->
          <div v-else class="border border-border rounded-xl p-4 bg-muted/20">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileImage class="w-6 h-6 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-foreground truncate">{{ droppedFile.name }}</p>
                <p class="text-xs text-muted-foreground">{{ formatFileSize(droppedFile.size) }}</p>
              </div>
              <button
                v-if="!isProcessing"
                @click="handleRemoveFile"
                class="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Design Name Input -->
          <div class="space-y-2">
            <label class="text-sm font-medium text-foreground">Nome do Design</label>
            <input
              v-model="designName"
              type="text"
              placeholder="Ex: Meu Design Importado"
              :disabled="isProcessing"
              class="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
            />
          </div>

          <!-- Status & Progress -->
          <div v-if="status !== 'idle'" class="space-y-3">
            <!-- Status Message -->
            <div class="flex items-center gap-3 p-3 rounded-lg" :class="{
              'bg-blue-500/10 text-blue-500': ['uploading', 'converting', 'saving'].includes(status),
              'bg-green-500/10 text-green-500': status === 'success',
              'bg-red-500/10 text-red-500': status === 'error'
            }">
              <component v-if="statusIcon" :is="statusIcon" class="w-5 h-5" :class="{ 'animate-spin': statusIcon === Loader2 }" />
              <span class="text-sm font-medium">{{ statusMessage }}</span>
            </div>

            <!-- Progress Bar -->
            <div v-if="['uploading', 'converting', 'saving'].includes(status)" class="h-2 bg-muted rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all duration-500" :style="{ width: `${progress}%` }"></div>
            </div>
          </div>

          <!-- Auto-center Option -->
          <div class="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border">
            <label class="flex items-start gap-3 cursor-pointer">
              <input
                v-model="autoCenter"
                type="checkbox"
                :disabled="isProcessing"
                class="w-4 h-4 mt-0.5 rounded border-border bg-muted text-primary focus:ring-primary/20"
              />
              <div class="text-xs text-muted-foreground space-y-1">
                <p class="font-medium text-foreground">Centralizar conteúdo no canvas</p>
                <p>Move o layout do PSD para o centro do canvas. Desmarque para manter as posições originais.</p>
              </div>
            </label>
          </div>

          <!-- Info Box -->
          <div class="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border">
            <FileText class="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div class="text-xs text-muted-foreground space-y-1">
              <p>As camadas do PSD serão convertidas para objetos editáveis:</p>
              <ul class="ml-4 list-disc space-y-0.5">
                <li>Camadas de imagem → objetos de imagem</li>
                <li>Camadas de texto → texto editável</li>
                <li>Grupos preservados</li>
                <li>Todas as camadas importadas (mesmo invisíveis)</li>
              </ul>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-border bg-muted/10 flex justify-end gap-3">
          <Button
            variant="ghost"
            @click="emit('close')"
            :disabled="isProcessing"
            class="rounded-xl h-10 px-6"
          >
            Cancelar
          </Button>
          <Button
            @click="handleImport"
            :disabled="!canImport"
            class="rounded-xl h-10 px-6"
          >
            <Loader2 v-if="isProcessing" class="w-4 h-4 mr-2 animate-spin" />
            {{ isProcessing ? 'Processando...' : 'Importar' }}
          </Button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.fade-enter-active div.relative, .fade-leave-active div.relative {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-enter-from div.relative {
  transform: scale(0.95) translateY(10px);
}
.fade-leave-to div.relative {
  transform: scale(0.95);
}
</style>
