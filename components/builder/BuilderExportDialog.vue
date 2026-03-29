<script setup lang="ts">
const props = defineProps<{
  open: boolean
  canvasElement: HTMLElement | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { exportAsPng, downloadPng, uploadSnapshot, isExporting } = useBuilderExport()
const { flyer, updateFlyer } = useBuilderFlyer()
const { generateSocialText } = useBuilderSocialText()

const scale = ref(2)
const scaleOptions = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '3x', value: 3 },
  { label: '4x', value: 4 },
]

const statusMessage = ref('')
const statusType = ref<'info' | 'success' | 'error'>('info')
const copiedText = ref(false)

const previewUrl = ref<string | null>(null)

// Generate preview when dialog opens
watch(() => props.open, async (isOpen) => {
  if (isOpen && props.canvasElement) {
    try {
      const blob = await exportAsPng(props.canvasElement, { scale: 1 })
      previewUrl.value = URL.createObjectURL(blob)
    } catch {
      previewUrl.value = null
    }
  } else {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = null
    }
  }
})

const handleDownload = async () => {
  if (!props.canvasElement) return
  isExporting.value = true
  statusMessage.value = 'Gerando imagem...'
  statusType.value = 'info'

  try {
    const blob = await exportAsPng(props.canvasElement, { scale: scale.value })
    const filename = `${flyer.value?.title || 'encarte'}-${scale.value}x.png`
    downloadPng(blob, filename.replace(/\s+/g, '-').toLowerCase())
    statusMessage.value = 'Download concluido!'
    statusType.value = 'success'
  } catch (err: any) {
    statusMessage.value = err.message || 'Erro ao gerar imagem'
    statusType.value = 'error'
  } finally {
    isExporting.value = false
  }
}

const handleUpload = async () => {
  if (!props.canvasElement || !flyer.value?.id) return
  isExporting.value = true
  statusMessage.value = 'Gerando e enviando imagem...'
  statusType.value = 'info'

  try {
    const blob = await exportAsPng(props.canvasElement, { scale: scale.value })
    const url = await uploadSnapshot(blob, flyer.value.id)
    updateFlyer({ snapshot_url: url })
    statusMessage.value = 'Imagem salva no servidor!'
    statusType.value = 'success'
  } catch (err: any) {
    statusMessage.value = err.message || 'Erro ao salvar no servidor'
    statusType.value = 'error'
  } finally {
    isExporting.value = false
  }
}

const handleCopySocialText = async () => {
  const text = generateSocialText()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedText.value = true
    setTimeout(() => { copiedText.value = false }, 2000)
  } catch {
    // Fallback
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    copiedText.value = true
    setTimeout(() => { copiedText.value = false }, 2000)
  }
}

const handleClose = () => {
  statusMessage.value = ''
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="handleClose"
      >
        <div class="bg-[#18181b] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-zinc-800">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 class="text-lg font-semibold text-zinc-100">
              Exportar Encarte
            </h2>
            <button
              class="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-800"
              @click="handleClose"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Preview -->
          <div class="px-6 pb-4">
            <div class="bg-zinc-900 rounded-xl p-3 flex items-center justify-center min-h-40 border border-zinc-800">
              <img
                v-if="previewUrl"
                :src="previewUrl"
                alt="Preview do encarte"
                class="max-h-50 max-w-full object-contain rounded"
              />
              <div v-else class="text-zinc-500 text-sm">
                Carregando preview...
              </div>
            </div>
          </div>

          <!-- Scale selector -->
          <div class="px-6 pb-4">
            <label class="block text-sm text-zinc-400 mb-2">Qualidade da imagem</label>
            <div class="flex gap-2">
              <button
                v-for="opt in scaleOptions"
                :key="opt.value"
                class="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                :class="scale === opt.value
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'"
                @click="scale = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            <p class="text-xs text-zinc-500 mt-1.5">
              {{ scale === 1 ? 'Tamanho original' : `${scale}x o tamanho original (${scale === 2 ? 'recomendado' : 'alta resolucao'})` }}
            </p>
          </div>

          <!-- Status message -->
          <div v-if="statusMessage" class="px-6 pb-3">
            <div
              class="text-sm px-3 py-2 rounded-lg"
              :class="{
                'bg-blue-900/30 text-blue-300 border border-blue-800/50': statusType === 'info',
                'bg-emerald-900/30 text-emerald-300 border border-emerald-800/50': statusType === 'success',
                'bg-red-900/30 text-red-300 border border-red-800/50': statusType === 'error',
              }"
            >
              {{ statusMessage }}
            </div>
          </div>

          <!-- Action buttons -->
          <div class="px-6 pb-5 flex flex-col gap-2.5">
            <button
              class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isExporting || !canvasElement"
              @click="handleDownload"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span v-if="isExporting">Processando...</span>
              <span v-else>Baixar PNG</span>
            </button>

            <button
              class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isExporting || !canvasElement || !flyer?.id"
              @click="handleUpload"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span v-if="isExporting">Enviando...</span>
              <span v-else>Salvar no servidor</span>
            </button>

            <button
              class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
              @click="handleCopySocialText"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span v-if="copiedText">Copiado!</span>
              <span v-else>Copiar texto para redes sociais</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
