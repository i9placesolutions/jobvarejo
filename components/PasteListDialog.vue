<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from './ui/Button.vue'
import { Upload, X, FileSpreadsheet, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  activePasteTab: string
  pasteListText: string
  pastedImage: string | null
  isAnalyzingImage: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:activePasteTab', value: string): void
  (e: 'update:pasteListText', value: string): void
  (e: 'update:pastedImage', value: string | null): void
  (e: 'update:isAnalyzingImage', value: boolean): void
  (e: 'submit'): void
  (e: 'submit-file', file: File): void
}>()

const { getApiAuthHeaders } = useApiAuth()

const listImageInput = ref<HTMLInputElement | null>(null)
const listFileInput = ref<HTMLInputElement | null>(null)
const analyzeError = ref<string | null>(null)
const uploadedFileName = ref<string | null>(null)
const pendingFile = ref<File | null>(null)

const LIST_FILE_ACCEPT = 'image/*,.csv,.tsv,.xlsx,.xls,.pdf,text/plain'

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const tab = computed({
  get: () => props.activePasteTab,
  set: (v: string) => emit('update:activePasteTab', v)
})

const listText = computed({
  get: () => props.pasteListText,
  set: (v: string) => emit('update:pasteListText', v)
})

const image = computed({
  get: () => props.pastedImage,
  set: (v: string | null) => emit('update:pastedImage', v)
})

const analyzing = computed({
  get: () => props.isAnalyzingImage,
  set: (v: boolean) => emit('update:isAnalyzingImage', v)
})

const triggerListImageUpload = () => {
  listImageInput.value?.click()
}

const triggerFileUpload = () => {
  listFileInput.value?.click()
}

const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/')
}

const isDocumentFile = (file: File): boolean => {
  const docTypes = [
    'application/pdf',
    'text/csv',
    'text/tab-separated-values',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
  const docExts = ['.csv', '.tsv', '.xlsx', '.xls', '.pdf', '.txt']
  return docTypes.includes(file.type) || docExts.some(ext => file.name.toLowerCase().endsWith(ext))
}

const handleFileUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  analyzeError.value = null

  if (isImageFile(file)) {
    // Image: show preview for AI extraction
    const reader = new FileReader()
    reader.onload = (e) => {
      image.value = (e.target?.result as string) || null
      uploadedFileName.value = file.name
      pendingFile.value = null
    }
    reader.readAsDataURL(file)
  } else if (isDocumentFile(file)) {
    // Document (Excel, PDF, CSV): store for direct submission
    pendingFile.value = file
    uploadedFileName.value = file.name
    image.value = null
  } else {
    analyzeError.value = 'Formato de arquivo nao suportado. Use imagem, Excel, PDF ou CSV.'
  }
}

const handleListImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    image.value = (e.target?.result as string) || null
  }
  reader.readAsDataURL(file)
}

const analyzeImageWithAI = async () => {
  if (!image.value) return
  analyzing.value = true
  analyzeError.value = null

  try {
    const headers = await getApiAuthHeaders()

    let result: { products?: any[] } | null = null
    let lastFetchErr: any = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await $fetch<{ products?: any[] }>('/api/parse-products', {
          method: 'POST',
          headers,
          body: { image: image.value },
          timeout: 70_000
        })
        break
      } catch (fetchErr: any) {
        lastFetchErr = fetchErr
        const status = Number(fetchErr?.status || fetchErr?.statusCode || fetchErr?.data?.statusCode || 0)
        const isTransient = status === 502 || status === 503 || status === 504 || status === 408
        if (!isTransient || attempt === 1) throw fetchErr
        await new Promise(r => setTimeout(r, 1500))
      }
    }
    if (!result) throw lastFetchErr || new Error('Falha ao processar imagem')

    if (result?.products && result.products.length > 0) {
      // Convert parsed products to text format for the text tab
      const lines = result.products.map((p: any) => {
        const parts: string[] = []
        const name = String(p.name || '').trim()
        if (!name) return null

        let line = name
        if (p.brand) line = `${p.brand} ${line}`
        if (p.weight) line += ` ${p.weight}`

        const price = p.price || p.pricePack || p.priceUnit || ''
        if (price) line += ` - ${price}`

        return line
      }).filter(Boolean)

      if (lines.length > 0) {
        listText.value = lines.join('\n')
        tab.value = 'text'
      } else {
        analyzeError.value = 'Nenhum produto foi identificado na imagem. Tente uma imagem mais nitida.'
      }
    } else {
      analyzeError.value = 'Nenhum produto foi identificado na imagem. Tente uma imagem mais nitida.'
    }
  } catch (err: any) {
    console.error('[PasteListDialog] AI analysis failed:', err)
    const status = Number(err?.statusCode ?? err?.status ?? err?.response?.status ?? 0)
    if (status === 429) {
      analyzeError.value = 'Muitas tentativas. Aguarde alguns segundos e tente novamente.'
    } else if (status === 413) {
      analyzeError.value = 'A imagem e muito grande. Tente uma imagem menor.'
    } else {
      analyzeError.value = String(err?.data?.message || err?.message || 'Falha ao analisar imagem. Tente novamente.')
    }
  } finally {
    analyzing.value = false
  }
}

const handleSubmit = () => {
  if (pendingFile.value) {
    emit('submit-file', pendingFile.value)
  } else {
    emit('submit')
  }
}

const clearFile = () => {
  pendingFile.value = null
  uploadedFileName.value = null
  image.value = null
  analyzeError.value = null
}

const canSubmit = computed(() => {
  if (tab.value === 'text') return !!listText.value
  return !!pendingFile.value || !!image.value
})

const handleImagePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.indexOf('image') === -1) continue
    const blob = item.getAsFile()
    if (!blob) continue
    const reader = new FileReader()
    reader.onload = (e) => {
      image.value = (e.target?.result as string) || null
      tab.value = 'image'
      pendingFile.value = null
      uploadedFileName.value = null
    }
    reader.readAsDataURL(blob)
  }
}
</script>

<template>
  <UiDialog v-model="open" title="Importar Lista de Produtos" @close="open = false" width="500px">
    <template #default>
      <div class="space-y-4 py-3" @paste="handleImagePaste">
        <div class="flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
          <button
            @click="tab = 'text'"
            :class="['flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all', tab === 'text' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200']"
          >
            Texto/Lista
          </button>
          <button
            @click="tab = 'image'"
            :class="['flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded transition-all', tab === 'image' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200']"
          >
            Arquivo/Imagem
          </button>
        </div>

        <div v-if="tab === 'text'" class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div class="space-y-2">
            <label class="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Cole a lista de produtos</label>
            <textarea
              v-model="listText"
              rows="8"
              class="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
              placeholder="Ex:\nPicanha - 69.90\nCerveja Heineken - 5.99\nCarvão 5kg - 15.00"
            />
            <p class="text-[10px] text-muted-foreground">
              Formato flexivel: nome - preco, nome preco, ou com ponto/virgula. A IA interpreta automaticamente.
            </p>
          </div>
        </div>

        <div v-else class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <!-- Error message -->
          <div v-if="analyzeError" class="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle class="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p class="text-[12px] text-red-400">{{ analyzeError }}</p>
          </div>

          <!-- Upload area when no file/image selected -->
          <div
            v-if="!image && !pendingFile"
            class="relative border-2 border-dashed border-violet-400/40 rounded-2xl p-6 bg-gradient-to-br from-violet-500/5 to-pink-500/5 hover:border-violet-400/70 hover:bg-violet-500/10 transition-all duration-300 cursor-pointer group flex flex-col items-center gap-3"
            @click="triggerFileUpload"
          >
            <div class="w-14 h-14 rounded-full bg-violet-500/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-violet-500/20 transition-all duration-500">
              <Upload class="w-7 h-7 text-violet-400" />
            </div>
            <div class="text-center">
              <p class="text-[13px] font-bold text-white">Clique para Upload ou Cole (Ctrl+V)</p>
              <p class="text-[11px] text-zinc-400 mt-1">Suporta Excel, PDF, CSV, Imagens e Texto</p>
            </div>
            <input ref="listFileInput" type="file" hidden :accept="LIST_FILE_ACCEPT" @change="handleFileUpload" />
            <input ref="listImageInput" type="file" hidden accept="image/*" @change="handleListImageUpload" />
          </div>

          <!-- Document file preview (Excel, PDF, CSV) -->
          <div v-else-if="pendingFile && !image" class="relative rounded-2xl overflow-hidden border border-border bg-black/2 p-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                <FileSpreadsheet class="w-6 h-6 text-violet-400" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">{{ uploadedFileName }}</p>
                <p class="text-[11px] text-zinc-400 mt-0.5">Pronto para importar. A IA vai extrair os produtos automaticamente.</p>
              </div>
              <button @click="clearFile" class="bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all shrink-0">
                <X class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Image preview -->
          <div v-else-if="image" class="relative rounded-2xl overflow-hidden border border-border bg-black/2 p-2">
            <div class="aspect-video w-full rounded-xl overflow-hidden bg-black/5 flex items-center justify-center relative group">
              <img :src="image" class="max-w-full max-h-full object-contain shadow-2xl" />
              <button @click="clearFile" class="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all">
                <X class="w-4 h-4" />
              </button>
            </div>
            <Button class="w-full mt-2" :disabled="analyzing" @click="analyzeImageWithAI">
              <span v-if="analyzing" class="flex items-center gap-2"><div class="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin"></div> Analisando com IA...</span>
              <span v-else>Extrair Produtos com IA</span>
            </Button>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center w-full pt-2">
        <Button variant="ghost" class="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground" @click="open = false">Cancelar</Button>
        <Button variant="default" class="bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-6 h-9 text-xs font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all" :disabled="!canSubmit" @click="handleSubmit">
          {{ pendingFile ? 'Importar Arquivo' : 'Adicionar ao Palco' }}
        </Button>
      </div>
    </template>
  </UiDialog>
</template>
