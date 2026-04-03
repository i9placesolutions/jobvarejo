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

// Opcoes extras de exportacao (paridade QROfertas)
const onlyCurrentPage = ref(false)
const lightMode = ref(false)

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
    const exportScale = lightMode.value ? Math.min(scale.value, 2) : scale.value
    const blob = await exportAsPng(props.canvasElement, { scale: exportScale })
    const suffix = lightMode.value ? '-leve' : ''
    const pageSuffix = onlyCurrentPage.value ? `-pag${flyer.value?.current_page || 1}` : ''
    const filename = `${flyer.value?.title || 'encarte'}${pageSuffix}${suffix}-${exportScale}x.png`
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
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-gray-200">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-5 pb-3">
            <h2 class="text-lg font-semibold text-gray-900">
              Exportar Encarte
            </h2>
            <button
              class="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              @click="handleClose"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Preview -->
          <div class="px-6 pb-4">
            <div class="bg-gray-50 rounded-xl p-3 flex items-center justify-center min-h-40 border border-gray-200">
              <img
                v-if="previewUrl"
                :src="previewUrl"
                alt="Preview do encarte"
                class="max-h-50 max-w-full object-contain rounded"
              />
              <div v-else class="text-gray-400 text-sm">
                Carregando preview...
              </div>
            </div>
          </div>

          <!-- Opcoes de exportacao -->
          <div class="px-6 pb-3">
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="onlyCurrentPage"
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 bg-gray-50 text-emerald-500 accent-emerald-500"
                />
                <span class="text-sm text-gray-700">So esta pagina</span>
                <span class="text-xs text-gray-400 ml-1">(baixa apenas a pagina atual)</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  v-model="lightMode"
                  type="checkbox"
                  class="w-4 h-4 rounded border-gray-300 bg-gray-50 text-emerald-500 accent-emerald-500"
                />
                <span class="text-sm text-gray-700">Modo Leve</span>
                <span class="text-xs text-gray-400 ml-1">(arquivo menor, ideal p/ WhatsApp)</span>
              </label>
            </div>
          </div>

          <!-- Scale selector -->
          <div class="px-6 pb-4">
            <label class="block text-sm text-gray-500 mb-2">Qualidade da imagem</label>
            <div class="flex gap-2">
              <button
                v-for="opt in scaleOptions"
                :key="opt.value"
                class="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                :class="scale === opt.value
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'"
                @click="scale = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-1.5">
              {{ scale === 1 ? 'Tamanho original' : `${scale}x o tamanho original (${scale === 2 ? 'recomendado' : 'alta resolucao'})` }}
            </p>
          </div>

          <!-- Status message -->
          <div v-if="statusMessage" class="px-6 pb-3">
            <div
              class="text-sm px-3 py-2 rounded-lg"
              :class="{
                'bg-blue-50 text-blue-700 border border-blue-200': statusType === 'info',
                'bg-emerald-50 text-emerald-700 border border-emerald-200': statusType === 'success',
                'bg-red-50 text-red-700 border border-red-200': statusType === 'error',
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
              class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all bg-gray-100 hover:bg-gray-200 text-gray-700"
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
