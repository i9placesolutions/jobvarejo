<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from './ui/Button.vue'
import { Sparkles, Wand2, Upload, X } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  aiPrompt: string
  aiReferenceImageDataUrl?: string | null
  applyMode: 'replace' | 'newPage'
  pageType: 'RETAIL_OFFER' | 'FREE_DESIGN'
  pageWidth: number
  pageHeight: number
  processing?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:aiPrompt', value: string): void
  (e: 'update:aiReferenceImageDataUrl', value: string | null): void
  (e: 'update:applyMode', value: 'replace' | 'newPage'): void
  (e: 'update:pageType', value: 'RETAIL_OFFER' | 'FREE_DESIGN'): void
  (e: 'update:pageWidth', value: number): void
  (e: 'update:pageHeight', value: number): void
  (e: 'generate', payload: {
    mode: 'replace' | 'newPage'
    pageType: 'RETAIL_OFFER' | 'FREE_DESIGN'
    pageWidth: number
    pageHeight: number
    referenceImageDataUrl?: string | null
    cloneStrength?: number
  }): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const prompt = computed({
  get: () => props.aiPrompt,
  set: (v: string) => emit('update:aiPrompt', v)
})

const referenceImageDataUrl = computed({
  get: () => props.aiReferenceImageDataUrl || null,
  set: (v: string | null) => emit('update:aiReferenceImageDataUrl', v)
})

const applyMode = computed({
  get: () => props.applyMode,
  set: (v: 'replace' | 'newPage') => emit('update:applyMode', v)
})

const pageType = computed({
  get: () => props.pageType,
  set: (v: 'RETAIL_OFFER' | 'FREE_DESIGN') => emit('update:pageType', v)
})

const pageWidth = computed({
  get: () => props.pageWidth,
  set: (v: number) => emit('update:pageWidth', Number(v) || 1080)
})

const pageHeight = computed({
  get: () => props.pageHeight,
  set: (v: number) => emit('update:pageHeight', Number(v) || 1920)
})

const referenceImageInput = ref<HTMLInputElement | null>(null)
const referenceUploadError = ref('')

const triggerReferenceUpload = () => {
  referenceUploadError.value = ''
  referenceImageInput.value?.click()
}

const handleReferenceImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    referenceUploadError.value = 'Selecione um arquivo de imagem valido.'
    return
  }

  const maxBytes = 8 * 1024 * 1024
  if (file.size > maxBytes) {
    referenceUploadError.value = 'A imagem de referencia deve ter no maximo 8MB.'
    return
  }
  referenceUploadError.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    referenceImageDataUrl.value = (e.target?.result as string) || null
  }
  reader.readAsDataURL(file)

  if ((event.target as HTMLInputElement).value) {
    ;(event.target as HTMLInputElement).value = ''
  }
}

const canGenerate = computed(() => {
  const hasPrompt = !!prompt.value.trim()
  const hasReference = !!referenceImageDataUrl.value
  return (hasPrompt || hasReference) && Number(pageWidth.value) > 0 && Number(pageHeight.value) > 0 && !props.processing
})

const emitGenerate = () => {
  const hasReferenceImage = !!referenceImageDataUrl.value
  emit('generate', {
    mode: applyMode.value,
    pageType: pageType.value,
    pageWidth: Math.max(1, Math.round(Number(pageWidth.value || 1080))),
    pageHeight: Math.max(1, Math.round(Number(pageHeight.value || 1920))),
    referenceImageDataUrl: hasReferenceImage ? referenceImageDataUrl.value : null,
    cloneStrength: hasReferenceImage ? 100 : undefined
  })
}
</script>

<template>
  <UiDialog v-model="open" title="Gerar Com IA" @close="open = false" width="520px">
    <template #default>
      <div class="space-y-5 py-3">
        <div class="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <div class="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Sparkles class="w-4 h-4 text-violet-300" />
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-violet-200">Descreva seu design</p>
            <p class="text-[11px] text-violet-100/80">A IA vai montar uma página Fabric editável</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Aplicar em</label>
            <select
              v-model="applyMode"
              class="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="replace">Substituir página atual</option>
              <option value="newPage">Criar nova página</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Tipo da página</label>
            <select
              v-model="pageType"
              class="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="RETAIL_OFFER">RETAIL_OFFER</option>
              <option value="FREE_DESIGN">FREE_DESIGN</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Largura</label>
            <input
              v-model.number="pageWidth"
              min="64"
              max="5000"
              type="number"
              class="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Altura</label>
            <input
              v-model.number="pageHeight"
              min="64"
              max="5000"
              type="number"
              class="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Tema / Estilo</label>
          <textarea
            v-model="prompt"
            rows="5"
            class="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none"
            placeholder="Ex: Encarte de supermercado com destaque para ofertas de fim de semana..."
          />
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Imagem para Clonar (100%)</label>
          <div v-if="!referenceImageDataUrl" class="border border-dashed border-violet-400/30 rounded-xl p-4 bg-violet-500/5">
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-violet-500/30 text-violet-100 hover:bg-violet-500/10 transition-colors text-xs font-semibold uppercase tracking-widest"
              @click="triggerReferenceUpload"
            >
              <Upload class="w-4 h-4" />
              Enviar imagem de referencia
            </button>
            <p class="mt-2 text-[10px] text-violet-100/70">
              A IA tenta reproduzir o layout da imagem com fidelidade maxima.
            </p>
          </div>

          <div v-else class="relative border border-border rounded-xl p-2 bg-background">
            <div class="h-32 rounded-lg overflow-hidden bg-black/10 flex items-center justify-center">
              <img :src="referenceImageDataUrl" class="max-w-full max-h-full object-contain" />
            </div>
            <button
              type="button"
              class="absolute top-3 right-3 bg-black/55 hover:bg-black/75 text-white p-1.5 rounded-full transition-colors"
              title="Remover imagem"
              @click="referenceImageDataUrl = null"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="mt-2 w-full px-3 py-2 rounded-lg border border-border text-[10px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors"
              @click="triggerReferenceUpload"
            >
              Trocar imagem
            </button>
          </div>
          <input ref="referenceImageInput" type="file" hidden accept="image/*" @change="handleReferenceImageUpload" />
          <p v-if="referenceUploadError" class="text-[10px] text-red-300">{{ referenceUploadError }}</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button @click="prompt = 'Encarte de Supermercado, cores vibrantes, estilo varejo popular'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Varejo Popular</button>
          <button @click="prompt = 'Banner minimalista de eletrônicos, cores dark, neon azul'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Tech Dark</button>
          <button @click="prompt = 'Folheto de padaria, tons pastéis, estilo artesanal'" class="px-3 py-1.5 rounded-full border border-border text-[9px] font-bold uppercase tracking-widest hover:bg-black/5 transition-colors">Artesanal</button>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <button @click="open = false" class="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Fechar</button>
        <Button variant="default" class="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8 h-10 text-xs font-black uppercase tracking-[0.15em] shadow-lg shadow-violet-500/20 active:scale-95 transition-all" :disabled="!canGenerate" @click="emitGenerate">
          <Wand2 class="w-4 h-4 mr-2" />
          {{ processing ? 'Gerando...' : 'Gerar' }}
        </Button>
      </div>
    </template>
  </UiDialog>
</template>
