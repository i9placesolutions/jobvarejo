<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from './ui/Button.vue'
import { Sparkles, Wand2, Upload, X, Loader2, ArrowRight, CheckCircle2 } from 'lucide-vue-next'

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

const applyModeOptions = [
  {
    value: 'replace' as const,
    label: 'Substituir',
    helper: 'Atualiza a pagina atual.'
  },
  {
    value: 'newPage' as const,
    label: 'Nova pagina',
    helper: 'Cria uma pagina separada.'
  }
]

const pageTypeOptions = [
  {
    value: 'RETAIL_OFFER' as const,
    label: 'Oferta varejo',
    helper: 'Estrutura pronta para cards, preco e destaque.'
  },
  {
    value: 'FREE_DESIGN' as const,
    label: 'Design livre',
    helper: 'Composicao aberta para layouts mais autorais.'
  }
]

const sizePresets = [
  { label: 'Story', width: 1080, height: 1920 },
  { label: 'Post', width: 1080, height: 1350 },
  { label: 'Square', width: 1080, height: 1080 },
  { label: 'Banner', width: 1920, height: 1080 }
]

const promptPresets = [
  {
    label: 'Varejo popular',
    value: 'Encarte de supermercado com comunicacao direta, ofertas fortes, preco em destaque e leitura muito rapida.'
  },
  {
    label: 'Premium clean',
    value: 'Campanha de varejo com visual premium, espacamento refinado, foco no produto e contraste elegante.'
  },
  {
    label: 'Tech promo',
    value: 'Peca promocional de eletronicos com energia visual, hierarquia forte e atmosfera moderna.'
  },
  {
    label: 'Artesanal',
    value: 'Folheto de padaria com clima artesanal, textura suave, destaque para produto e preco acolhedor.'
  }
]

const hasReferenceImage = computed(() => !!referenceImageDataUrl.value)
const promptCharacterCount = computed(() => prompt.value.trim().length)
const pageFormatLabel = computed(() => `${Math.max(1, Math.round(Number(pageWidth.value || 0)))} x ${Math.max(1, Math.round(Number(pageHeight.value || 0)))}`)
const pageOrientationLabel = computed(() => Number(pageWidth.value) > Number(pageHeight.value) ? 'Paisagem' : Number(pageWidth.value) < Number(pageHeight.value) ? 'Retrato' : 'Quadrado')
const activeReferenceModeLabel = computed(() => hasReferenceImage.value ? 'Clonagem guiada ativa' : 'Sem referencia visual')
const generationStatusLabel = computed(() => {
  if (props.processing) return 'Gerando layout'
  if (!prompt.value.trim() && !hasReferenceImage.value) return 'Aguardando instrucoes'
  if (!prompt.value.trim() && hasReferenceImage.value) return 'Geracao guiada por imagem'
  if (prompt.value.trim() && !hasReferenceImage.value) return 'Geracao guiada por briefing'
  return 'Briefing + referencia combinados'
})
const readinessHint = computed(() => {
  if (props.processing) return 'A geracao esta em andamento. Aguarde o layout voltar pronto para edicao.'
  if (!prompt.value.trim() && !hasReferenceImage.value) return 'Descreva o layout desejado ou envie uma imagem para clonar.'
  if (!prompt.value.trim() && hasReferenceImage.value) return 'A IA vai usar a referencia visual como guia principal.'
  if (prompt.value.trim() && !hasReferenceImage.value) return 'A IA vai montar a pagina a partir do briefing textual.'
  return 'A IA vai usar sua descricao para interpretar a referencia com mais contexto.'
})
const generateButtonLabel = computed(() => {
  if (props.processing) return 'Gerando layout'
  if (hasReferenceImage.value && prompt.value.trim()) return 'Gerar com briefing + referencia'
  if (hasReferenceImage.value) return 'Gerar a partir da referencia'
  return 'Gerar layout'
})
const referenceHint = computed(() =>
  hasReferenceImage.value
    ? 'Fidelidade alta ativada. A IA vai preservar a estrutura visual principal.'
    : 'Opcional. Use uma imagem quando quiser clonar composicao e ritmo com mais precisao.'
)

const canGenerate = computed(() => {
  const hasPrompt = !!prompt.value.trim()
  const hasReference = !!referenceImageDataUrl.value
  return (hasPrompt || hasReference) && Number(pageWidth.value) > 0 && Number(pageHeight.value) > 0 && !props.processing
})

const triggerReferenceUpload = () => {
  if (props.processing) return
  referenceUploadError.value = ''
  referenceImageInput.value?.click()
}

const clearReferenceImage = () => {
  referenceImageDataUrl.value = null
  referenceUploadError.value = ''
}

const applySizePreset = (width: number, height: number) => {
  if (props.processing) return
  pageWidth.value = width
  pageHeight.value = height
}

const usePromptPreset = (value: string) => {
  if (props.processing) return
  prompt.value = value
}

const handleReferenceImageUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    referenceUploadError.value = 'Envie uma imagem valida em JPG, PNG ou WEBP.'
    return
  }

  const maxBytes = 8 * 1024 * 1024
  if (file.size > maxBytes) {
    referenceUploadError.value = 'A imagem de referencia deve ter no maximo 8 MB.'
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

const emitGenerate = () => {
  const hasReference = !!referenceImageDataUrl.value
  emit('generate', {
    mode: applyMode.value,
    pageType: pageType.value,
    pageWidth: Math.max(1, Math.round(Number(pageWidth.value || 1080))),
    pageHeight: Math.max(1, Math.round(Number(pageHeight.value || 1920))),
    referenceImageDataUrl: hasReference ? referenceImageDataUrl.value : null,
    cloneStrength: hasReference ? 100 : undefined
  })
}
</script>

<template>
  <UiDialog
    v-model="open"
    title="Studio IA"
    @close="open = false"
    width="1080px"
    content-class="w-full"
  >
    <template #default>
      <div class="space-y-6 py-1">
        <section class="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(8,145,178,0.08)_42%,rgba(12,12,15,0.98)_100%)] px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div class="max-w-2xl">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  Direcao criativa
                </span>
                <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-300">
                  {{ generationStatusLabel }}
                </span>
              </div>
              <h2 class="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-white">
                Descreva a intencao ou envie uma referencia. A IA monta a pagina editavel sem deixar o fluxo opaco.
              </h2>
              <p class="mt-3 max-w-xl text-[13px] leading-relaxed text-zinc-300/85">
                Briefing textual define tom, hierarquia e atmosfera. Referencia visual define composicao com mais fidelidade.
                Voce pode usar um dos dois ou combinar ambos.
              </p>
            </div>

            <div class="grid grid-cols-2 gap-2 lg:w-[340px]">
              <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div class="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Aplicacao</div>
                <div class="mt-1 text-[13px] font-semibold text-white">
                  {{ applyMode === 'replace' ? 'Substitui a pagina atual' : 'Cria uma nova pagina' }}
                </div>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div class="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Saida</div>
                <div class="mt-1 text-[13px] font-semibold text-white">
                  {{ pageType === 'RETAIL_OFFER' ? 'Oferta varejo' : 'Design livre' }}
                </div>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div class="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Formato</div>
                <div class="mt-1 text-[13px] font-semibold text-white">{{ pageFormatLabel }}</div>
              </div>
              <div class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div class="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Referencia</div>
                <div class="mt-1 text-[13px] font-semibold text-white">{{ activeReferenceModeLabel }}</div>
              </div>
            </div>
          </div>
        </section>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <div class="space-y-5">
            <section class="rounded-[24px] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Briefing</div>
                  <h3 class="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">Direcao criativa da pagina</h3>
                  <p class="mt-1 text-[12px] leading-relaxed text-zinc-400">
                    Seja especifico sobre clima, composicao, hierarquia e o que precisa ficar em destaque.
                  </p>
                </div>
                <div class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-zinc-300">
                  {{ promptCharacterCount }} caracteres
                </div>
              </div>

              <div class="mt-4">
                <label for="ai-prompt-textarea" class="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Tema e estilo
                </label>
                <textarea
                  id="ai-prompt-textarea"
                  v-model="prompt"
                  rows="8"
                  :disabled="processing"
                  class="w-full resize-none rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-4 py-4 text-[15px] leading-7 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Ex.: Encartes de supermercado com energia promocional, preco em destaque, tipografia forte, produtos bem recortados e leitura instantanea para mobile."
                />
              </div>

              <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-[11px] leading-relaxed text-zinc-400">
                  {{ readinessHint }}
                </p>
                <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-zinc-300">
                  <CheckCircle2 class="h-3.5 w-3.5 text-emerald-300" />
                  Quanto melhor o briefing, menos retrabalho depois.
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  v-for="preset in promptPresets"
                  :key="preset.label"
                  type="button"
                  :disabled="processing"
                  class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-200 transition-all hover:border-emerald-400/25 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                  @click="usePromptPreset(preset.value)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </section>

            <section class="rounded-[24px] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Referencia visual</div>
                  <h3 class="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">Imagem para clonar composicao</h3>
                  <p class="mt-1 text-[12px] leading-relaxed text-zinc-400">
                    Use quando quiser aproximar layout, ritmo e distribuicao visual com mais fidelidade.
                  </p>
                </div>
                <div class="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-medium text-sky-100/90">
                  {{ hasReferenceImage ? 'Referencia carregada' : 'Opcional' }}
                </div>
              </div>

              <div
                v-if="!hasReferenceImage"
                class="mt-4 rounded-[24px] border border-dashed border-sky-400/25 bg-[linear-gradient(180deg,rgba(14,165,233,0.06),rgba(255,255,255,0.01))] p-5"
              >
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div class="text-sm font-semibold text-white">Enviar arte de referencia</div>
                    <p class="mt-1 max-w-md text-[12px] leading-relaxed text-zinc-400">
                      Aceita JPG, PNG e WEBP ate 8 MB. Ideal para clonar um material pronto ou guiar a composicao inicial.
                    </p>
                  </div>
                  <button
                    type="button"
                    :disabled="processing"
                    class="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/12 px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100 transition-colors hover:bg-sky-400/18 disabled:cursor-not-allowed disabled:opacity-40"
                    @click="triggerReferenceUpload"
                  >
                    <Upload class="h-4 w-4" />
                    Enviar referencia
                  </button>
                </div>
              </div>

              <div v-else class="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                <div class="relative flex h-64 items-center justify-center bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-4">
                  <img :src="referenceImageDataUrl || undefined" class="max-h-full max-w-full rounded-xl object-contain shadow-[0_16px_60px_rgba(0,0,0,0.28)]" alt="Imagem de referencia" />
                  <button
                    type="button"
                    :disabled="processing"
                    class="absolute right-3 top-3 rounded-full border border-white/10 bg-black/55 p-2 text-white transition-colors hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Remover imagem"
                    @click="clearReferenceImage"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
                </div>
                <div class="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p class="text-[12px] leading-relaxed text-zinc-400">
                    {{ referenceHint }}
                  </p>
                  <button
                    type="button"
                    :disabled="processing"
                    class="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-100 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                    @click="triggerReferenceUpload"
                  >
                    <Upload class="h-3.5 w-3.5" />
                    Trocar imagem
                  </button>
                </div>
              </div>

              <input ref="referenceImageInput" type="file" hidden accept="image/*" @change="handleReferenceImageUpload" />
              <div v-if="referenceUploadError" class="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
                {{ referenceUploadError }}
              </div>
            </section>
          </div>

          <div class="space-y-5">
            <section class="rounded-[24px] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
              <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Destino e saida</div>
              <h3 class="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">Como a geracao entra no projeto</h3>

              <div class="mt-4 space-y-3">
                <div>
                  <label class="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Aplicar em</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      v-for="option in applyModeOptions"
                      :key="option.value"
                      type="button"
                      :disabled="processing"
                      class="rounded-2xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40"
                      :class="applyMode === option.value ? 'border-emerald-400/30 bg-emerald-400/12 text-white' : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]'"
                      @click="applyMode = option.value"
                    >
                      <div class="text-[11px] font-semibold uppercase tracking-[0.16em]">{{ option.label }}</div>
                      <div class="mt-1 text-[11px] leading-relaxed text-zinc-400">{{ option.helper }}</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Tipo da pagina</label>
                  <div class="space-y-2">
                    <button
                      v-for="option in pageTypeOptions"
                      :key="option.value"
                      type="button"
                      :disabled="processing"
                      class="w-full rounded-2xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40"
                      :class="pageType === option.value ? 'border-sky-400/30 bg-sky-400/10 text-white' : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]'"
                      @click="pageType = option.value"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <div class="text-[11px] font-semibold uppercase tracking-[0.16em]">{{ option.label }}</div>
                        <ArrowRight class="h-3.5 w-3.5 text-zinc-500" />
                      </div>
                      <div class="mt-1 text-[11px] leading-relaxed text-zinc-400">{{ option.helper }}</div>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section class="rounded-[24px] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
              <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Formato</div>
              <h3 class="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">Resolucao de saida</h3>
              <p class="mt-1 text-[12px] leading-relaxed text-zinc-400">
                Comece com um preset e refine medidas so quando realmente precisar.
              </p>

              <div class="mt-4 grid grid-cols-2 gap-2">
                <button
                  v-for="preset in sizePresets"
                  :key="preset.label"
                  type="button"
                  :disabled="processing"
                  class="rounded-2xl border px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40"
                  :class="pageWidth === preset.width && pageHeight === preset.height ? 'border-amber-400/30 bg-amber-400/10 text-white' : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]'"
                  @click="applySizePreset(preset.width, preset.height)"
                >
                  <div class="text-[11px] font-semibold uppercase tracking-[0.16em]">{{ preset.label }}</div>
                  <div class="mt-1 text-[11px] text-zinc-400">{{ preset.width }} x {{ preset.height }}</div>
                </button>
              </div>

              <div class="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label for="ai-page-width" class="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Largura</label>
                  <input
                    id="ai-page-width"
                    v-model.number="pageWidth"
                    :disabled="processing"
                    min="64"
                    max="5000"
                    type="number"
                    class="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/25 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
                <div>
                  <label for="ai-page-height" class="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Altura</label>
                  <input
                    id="ai-page-height"
                    v-model.number="pageHeight"
                    :disabled="processing"
                    min="64"
                    max="5000"
                    type="number"
                    class="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/25 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
              </div>

              <div class="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-[12px] text-zinc-300">
                {{ pageFormatLabel }} · {{ pageOrientationLabel }}
              </div>
            </section>

            <section class="rounded-[24px] border border-white/10 bg-zinc-950/80 p-5 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
              <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Resumo operacional</div>
              <h3 class="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">O que vai acontecer agora</h3>

              <div class="mt-4 space-y-2">
                <div class="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                  <div class="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Acao principal</div>
                  <div class="mt-1 text-[13px] font-semibold text-white">{{ generateButtonLabel }}</div>
                </div>
                <div class="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                  <div class="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Fonte criativa</div>
                  <div class="mt-1 text-[12px] leading-relaxed text-zinc-300">
                    {{ readinessHint }}
                  </div>
                </div>
                <div class="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                  <div class="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Saida esperada</div>
                  <div class="mt-1 text-[12px] leading-relaxed text-zinc-300">
                    {{ applyMode === 'replace' ? 'A pagina ativa sera atualizada com o novo layout.' : 'Uma nova pagina sera criada sem mexer na atual.' }}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="text-[11px] leading-relaxed text-zinc-400">
          {{ readinessHint }}
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="ghost"
            class="h-11 rounded-full px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300 hover:bg-white/[0.05] hover:text-white"
            :disabled="processing"
            @click="open = false"
          >
            Fechar
          </Button>
          <Button
            variant="default"
            class="h-12 rounded-full bg-emerald-400 px-6 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-950 shadow-[0_18px_38px_rgba(16,185,129,0.22)] transition-all hover:bg-emerald-300"
            :disabled="!canGenerate"
            @click="emitGenerate"
          >
            <Loader2 v-if="processing" class="mr-2 h-4 w-4 animate-spin" />
            <Wand2 v-else class="mr-2 h-4 w-4" />
            {{ generateButtonLabel }}
          </Button>
        </div>
      </div>
    </template>
  </UiDialog>
</template>
