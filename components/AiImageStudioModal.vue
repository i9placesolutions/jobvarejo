<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import Dialog from './ui/Dialog.vue'
import Button from './ui/Button.vue'
import Input from './ui/Input.vue'
import { Sparkles, Wand2, Scissors, Paintbrush, Link as LinkIcon, Upload as UploadIcon } from 'lucide-vue-next'
import { toWasabiProxyUrl } from '~/utils/storageProxy'

type Mode = 'generate' | 'similar' | 'edit'

const props = defineProps<{
  modelValue: boolean
  // Use existing uploads as quick references
  uploads: Array<{ id: string; name: string; url: string }>
  initial?: Partial<{
    mode: Mode
    prompt: string
    negativePrompt: string
    extraInstructions: string
    filenameBase: string
    siteUrl: string
    transparent: boolean
    removeBg: boolean
    size: '1024x1024' | '1024x1536' | '1536x1024'
    modelImageUrl: string
    baseImageUrl: string
    refUrls: string[]
  }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'created', asset: { id: string; name: string; url: string }): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})
const { getApiAuthHeaders } = useApiAuth()

const mode = ref<Mode>('generate')

// Prompt
const prompt = ref('')
const negativePrompt = ref('')
const extraInstructions = ref('')
const filenameBase = ref('ai-image')

// References
const siteUrl = ref('')
const siteNotes = ref<string>('')
const siteLoading = ref(false)
const siteError = ref<string>('')
const siteOgImage = ref<string>('')

const selectedRefUrls = ref<string[]>([])
const refUrlsText = ref<string>('')
const refFiles = ref<File[]>([])
const modelImageUrl = ref<string>('')
const baseImageUrl = ref<string>('')
const modelFile = ref<File | null>(null)
const baseFile = ref<File | null>(null)

const transparent = ref(true)
const removeBg = ref(false)
const size = ref<'1024x1024' | '1024x1536' | '1536x1024'>('1024x1024')

// Edit mask
const maskEnabled = computed(() => mode.value === 'edit')
const imagePreviewUrl = ref<string>('')
const imagePreviewObjectUrl = ref<string>('')
const maskCanvas = ref<HTMLCanvasElement | null>(null)
const maskCtx = ref<CanvasRenderingContext2D | null>(null)
const imgEl = ref<HTMLImageElement | null>(null)
const brushSize = ref(40)
const isDrawing = ref(false)
const lastPt = ref<{ x: number; y: number } | null>(null)
const maskReady = ref(false)

const processing = ref(false)
const error = ref<string>('')
const resultUrl = ref<string>('')

const uploadsForPick = computed(() => (props.uploads || []).slice(0, 80))

const revokeImagePreviewObjectUrl = () => {
  const objectUrl = imagePreviewObjectUrl.value
  if (!objectUrl) return
  URL.revokeObjectURL(objectUrl)
  imagePreviewObjectUrl.value = ''
}

const setImagePreviewFromFile = (file: File) => {
  revokeImagePreviewObjectUrl()
  const objectUrl = URL.createObjectURL(file)
  imagePreviewObjectUrl.value = objectUrl
  imagePreviewUrl.value = objectUrl
}

const setImagePreviewFromUrl = (url: string) => {
  revokeImagePreviewObjectUrl()
  imagePreviewUrl.value = url
}

const resetAll = () => {
  prompt.value = ''
  negativePrompt.value = ''
  extraInstructions.value = ''
  filenameBase.value = 'ai-image'
  siteUrl.value = ''
  siteNotes.value = ''
  siteOgImage.value = ''
  selectedRefUrls.value = []
  refUrlsText.value = ''
  refFiles.value = []
  modelFile.value = null
  baseFile.value = null
  transparent.value = true
  removeBg.value = false
  size.value = '1024x1024'
  revokeImagePreviewObjectUrl()
  imagePreviewUrl.value = ''
  maskReady.value = false
  resultUrl.value = ''
  error.value = ''
}

watch(open, async (v) => {
  if (!v) {
    resetAll()
    return
  }

  const init = props.initial || {}
  if (init.mode) mode.value = init.mode
  if (typeof init.prompt === 'string') prompt.value = init.prompt
  if (typeof init.negativePrompt === 'string') negativePrompt.value = init.negativePrompt
  if (typeof init.extraInstructions === 'string') extraInstructions.value = init.extraInstructions
  if (typeof init.filenameBase === 'string') filenameBase.value = init.filenameBase
  if (typeof init.siteUrl === 'string') siteUrl.value = init.siteUrl
  if (typeof init.transparent === 'boolean') transparent.value = init.transparent
  if (typeof init.removeBg === 'boolean') removeBg.value = init.removeBg
  if (typeof init.size === 'string') size.value = init.size as any
  if (typeof init.modelImageUrl === 'string') modelImageUrl.value = init.modelImageUrl
  if (typeof init.baseImageUrl === 'string') {
    baseImageUrl.value = init.baseImageUrl
    baseFile.value = null
    setImagePreviewFromUrl(init.baseImageUrl)
    await initMaskFromPreview()
  }
  if (Array.isArray(init.refUrls) && init.refUrls.length) {
    selectedRefUrls.value = Array.from(new Set([...selectedRefUrls.value, ...init.refUrls.map((x) => String(x || '').trim()).filter(Boolean)]))
  }
  await nextTick()
})

const onPickModelFile = (e: Event) => {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] || null
  modelFile.value = f
  modelImageUrl.value = ''
  if (input) input.value = ''
}

const onPickBaseFile = (e: Event) => {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] || null
  baseFile.value = f
  baseImageUrl.value = ''
  if (f) {
    setImagePreviewFromFile(f)
    initMaskFromPreview()
  }
  if (input) input.value = ''
}

const setModelFromLibrary = async (url: string) => {
  modelImageUrl.value = url
  modelFile.value = null
}

const setBaseFromLibrary = async (url: string) => {
  baseImageUrl.value = url
  baseFile.value = null
  setImagePreviewFromUrl(url)
  await initMaskFromPreview()
}

const toggleRefUrl = (url: string) => {
  const list = new Set(selectedRefUrls.value)
  if (list.has(url)) list.delete(url)
  else list.add(url)
  selectedRefUrls.value = Array.from(list)
}

const parseExternalRefUrls = (): string[] => {
  const raw = String(refUrlsText.value || '').trim()
  if (!raw) return []
  return Array.from(
    new Set(
      raw
        .split(/\n|,/g)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  )
}

const onPickRefFiles = (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (files.length) refFiles.value = [...refFiles.value, ...files]
  if (input) input.value = ''
}

const removeRefFile = (idx: number) => {
  refFiles.value = refFiles.value.filter((_, i) => i !== idx)
}

const analyzeSite = async () => {
  siteError.value = ''
  siteNotes.value = ''
  siteOgImage.value = ''
  const u = siteUrl.value.trim()
  if (!u) return
  siteLoading.value = true
  try {
    const headers = await getApiAuthHeaders()
    const res: any = await $fetch('/api/ai/site/describe', {
      method: 'POST',
      headers,
      body: { url: u }
    })
    siteNotes.value = String(res?.styleNotes || '').trim()
    siteOgImage.value = String(res?.ogImage || '').trim()
  } catch (e: any) {
    siteError.value = e?.message || 'Falha ao analisar site'
  } finally {
    siteLoading.value = false
  }
}

const addSiteOgImageAsRef = () => {
  const u = String(siteOgImage.value || '').trim()
  if (!u) return
  selectedRefUrls.value = Array.from(new Set([...selectedRefUrls.value, u]))
}

const initMaskFromPreview = async () => {
  await nextTick()
  if (!maskCanvas.value) return
  if (!imagePreviewUrl.value) return

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = imagePreviewUrl.value
  await new Promise<void>((resolve) => {
    img.onload = () => resolve()
    img.onerror = () => resolve()
  })
  imgEl.value = img

  // Keep mask at a manageable size (max 1024)
  const maxSide = 1024
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale))

  const c = maskCanvas.value
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return
  maskCtx.value = ctx

  // Start with fully opaque (preserve); user erases to create transparent edit region.
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fillRect(0, 0, w, h)
  maskReady.value = true
}

const canvasPoint = (e: PointerEvent) => {
  const c = maskCanvas.value
  if (!c) return { x: 0, y: 0 }
  const rect = c.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * c.width
  const y = ((e.clientY - rect.top) / rect.height) * c.height
  return { x, y }
}

const onMaskPointerDown = (e: PointerEvent) => {
  if (!maskEnabled.value) return
  if (!maskCtx.value || !maskCanvas.value) return
  isDrawing.value = true
  lastPt.value = canvasPoint(e)
  onMaskPointerMove(e)
}

const onMaskPointerMove = (e: PointerEvent) => {
  if (!maskEnabled.value) return
  if (!isDrawing.value) return
  const ctx = maskCtx.value
  if (!ctx) return
  const p = canvasPoint(e)
  const prev = lastPt.value
  lastPt.value = p

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out' // erase -> transparent area = edit region
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(0,0,0,1)'
  ctx.lineWidth = brushSize.value
  ctx.beginPath()
  if (prev) ctx.moveTo(prev.x, prev.y)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  ctx.restore()
}

const onMaskPointerUp = () => {
  isDrawing.value = false
  lastPt.value = null
}

const clearMask = () => {
  const c = maskCanvas.value
  const ctx = maskCtx.value
  if (!c || !ctx) return
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fillRect(0, 0, c.width, c.height)
}

const maskToFile = async () => {
  const c = maskCanvas.value
  if (!c) return null
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), 'image/png'))
  if (!blob) return null
  return new File([blob], 'mask.png', { type: 'image/png' })
}

const run = async () => {
  error.value = ''
  resultUrl.value = ''
  if (!prompt.value.trim()) {
    error.value = 'Descreva o que você quer gerar.'
    return
  }

  processing.value = true
  try {
    const headers = await getApiAuthHeaders()
    const form = new FormData()
    form.append('prompt', prompt.value.trim())
    if (negativePrompt.value.trim()) form.append('negativePrompt', negativePrompt.value.trim())
    if (extraInstructions.value.trim()) form.append('extraInstructions', extraInstructions.value.trim())
    if (filenameBase.value.trim()) form.append('filenameBase', filenameBase.value.trim())
    if (siteUrl.value.trim()) form.append('siteUrl', siteUrl.value.trim())
    const externalRefUrls = parseExternalRefUrls()
    const allRefUrls = Array.from(new Set([...(selectedRefUrls.value || []), ...externalRefUrls]))
    if (allRefUrls.length) form.append('refUrls', JSON.stringify(allRefUrls))
    for (const f of refFiles.value) form.append('refFiles[]', f)
    form.append('transparent', String(transparent.value))
    form.append('removeBg', String(removeBg.value))
    form.append('size', size.value)

    if (mode.value === 'generate') {
      form.append('mode', 'generate')
      const res: any = await $fetch('/api/ai/image/generate', { method: 'POST', headers, body: form })
      resultUrl.value = toWasabiProxyUrl(res?.url) || res?.url
      emit('created', { id: String(res?.key || ''), name: filenameBase.value || 'AI', url: resultUrl.value })
    } else if (mode.value === 'similar') {
      form.append('mode', 'similar')
      if (modelFile.value) form.append('modelFile', modelFile.value)
      if (modelImageUrl.value) form.append('modelImageUrl', modelImageUrl.value)
      const res: any = await $fetch('/api/ai/image/generate', { method: 'POST', headers, body: form })
      resultUrl.value = toWasabiProxyUrl(res?.url) || res?.url
      emit('created', { id: String(res?.key || ''), name: filenameBase.value || 'AI', url: resultUrl.value })
    } else {
      // edit
      if (baseFile.value) form.append('baseFile', baseFile.value)
      if (baseImageUrl.value) form.append('baseImageUrl', baseImageUrl.value)
      const mask = await maskToFile()
      if (mask) form.append('maskFile', mask)
      const res: any = await $fetch('/api/ai/image/edit', { method: 'POST', headers, body: form })
      resultUrl.value = toWasabiProxyUrl(res?.url) || res?.url
      emit('created', { id: String(res?.key || ''), name: filenameBase.value || 'AI', url: resultUrl.value })
    }

    if (!resultUrl.value) throw new Error('Falha ao gerar imagem')
  } catch (e: any) {
    console.error('[AiImageStudio] Erro:', e)
    const msg = e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || 'Erro ao gerar'
    error.value = msg
  } finally {
    processing.value = false
  }
}

onUnmounted(() => {
  revokeImagePreviewObjectUrl()
})
</script>

<template>
  <Dialog v-model="open" title="IA • Gerador de Imagens" width="min(980px, 96vw)">
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          :class="mode === 'generate' ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-white/10 text-zinc-300 hover:bg-white/5'"
          @click="mode = 'generate'"
        >
          <Wand2 class="w-4 h-4" /> Gerar
        </button>
        <button
          class="px-3 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          :class="mode === 'similar' ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-white/10 text-zinc-300 hover:bg-white/5'"
          @click="mode = 'similar'"
        >
          <Sparkles class="w-4 h-4" /> Parecido
        </button>
        <button
          class="px-3 py-2 rounded-lg border text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
          :class="mode === 'edit' ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-white/10 text-zinc-300 hover:bg-white/5'"
          @click="mode = 'edit'"
        >
          <Paintbrush class="w-4 h-4" /> Editar (Máscara)
        </button>
        <div class="ml-auto flex items-center gap-2">
          <label class="flex items-center gap-2 text-[11px] text-zinc-300">
            <input type="checkbox" v-model="transparent" />
            Sem fundo (transparente)
          </label>
          <label class="flex items-center gap-2 text-[11px] text-zinc-300">
            <input type="checkbox" v-model="removeBg" />
            Remover fundo (pós)
          </label>
          <select v-model="size" class="h-9 bg-zinc-800 border border-white/10 rounded px-2 text-[11px] text-zinc-200">
            <option value="1024x1024">1024×1024</option>
            <option value="1536x1024">1536×1024</option>
            <option value="1024x1536">1024×1536</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-3">
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Prompt</label>
            <textarea v-model="prompt" rows="5" class="w-full bg-zinc-800 border border-white/10 rounded-lg p-3 text-xs text-white focus:outline-none"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Evitar</label>
              <input v-model="negativePrompt" class="w-full h-9 bg-zinc-800 border border-white/10 rounded px-3 text-xs text-white focus:outline-none" placeholder="ex: baixa qualidade, borrado" />
            </div>
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Nome (Upload)</label>
              <input v-model="filenameBase" class="w-full h-9 bg-zinc-800 border border-white/10 rounded px-3 text-xs text-white focus:outline-none" placeholder="ai-oferta" />
            </div>
          </div>

          <div class="space-y-1.5">
            <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Instruções extras</label>
            <input v-model="extraInstructions" class="w-full h-9 bg-zinc-800 border border-white/10 rounded px-3 text-xs text-white focus:outline-none" placeholder="ex: estilo atacarejo, tipografia bold" />
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Site referência</label>
              <button class="text-[10px] text-violet-300 hover:text-violet-200" :disabled="siteLoading" @click="analyzeSite">
                <span v-if="siteLoading">Analisando…</span>
                <span v-else>Analisar</span>
              </button>
            </div>
            <div class="flex items-center gap-2">
              <LinkIcon class="w-4 h-4 text-zinc-500" />
              <input v-model="siteUrl" class="w-full h-9 bg-zinc-800 border border-white/10 rounded px-3 text-xs text-white focus:outline-none" placeholder="https://..." />
            </div>
            <p v-if="siteError" class="text-[10px] text-red-300">{{ siteError }}</p>
            <textarea v-if="siteNotes" v-model="siteNotes" rows="3" class="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-[11px] text-zinc-200"></textarea>
            <div v-if="siteOgImage" class="flex items-center gap-2">
              <button type="button" class="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-[11px] text-zinc-200" @click="addSiteOgImageAsRef">
                Usar imagem do site como referência
              </button>
              <a :href="siteOgImage" target="_blank" class="text-[11px] text-zinc-400 hover:text-white truncate">og:image</a>
            </div>
          </div>

          <div v-if="mode === 'similar'" class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Modelo (arquivo)</label>
              <span class="text-[10px] text-zinc-500">{{ modelFile?.name || '—' }}</span>
            </div>
            <input type="file" accept="image/*" class="hidden" id="ai-model-file" @change="onPickModelFile" />
            <label for="ai-model-file" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-zinc-200 cursor-pointer">
              <UploadIcon class="w-4 h-4" /> Selecionar modelo
            </label>
            <div class="text-[10px] text-zinc-500">Ou selecione um upload como modelo:</div>
            <div class="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1">
              <button
                v-for="a in uploadsForPick"
                :key="a.id"
                type="button"
                class="aspect-square rounded-lg overflow-hidden border transition-all relative"
                :class="modelImageUrl === a.url ? 'border-violet-500' : 'border-white/10 hover:border-white/20'"
                @click="setModelFromLibrary(a.url)"
                :title="a.name"
              >
                <img :src="a.url" class="w-full h-full object-cover" />
              </button>
            </div>
          </div>

          <div v-if="mode === 'edit'" class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Base para editar</label>
              <span class="text-[10px] text-zinc-500">{{ baseFile?.name || '—' }}</span>
            </div>
            <input type="file" accept="image/*" class="hidden" id="ai-base-file" @change="onPickBaseFile" />
            <label for="ai-base-file" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-zinc-200 cursor-pointer">
              <UploadIcon class="w-4 h-4" /> Selecionar base
            </label>
            <div class="text-[10px] text-zinc-500">Ou selecione um upload como base:</div>
            <div class="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1">
              <button
                v-for="a in uploadsForPick"
                :key="a.id"
                type="button"
                class="aspect-square rounded-lg overflow-hidden border transition-all relative"
                :class="baseImageUrl === a.url ? 'border-violet-500' : 'border-white/10 hover:border-white/20'"
                @click="setBaseFromLibrary(a.url)"
                :title="a.name"
              >
                <img :src="a.url" class="w-full h-full object-cover" />
              </button>
            </div>
            <div v-if="imagePreviewUrl" class="text-[10px] text-zinc-500">
              Pinte para “apagar” a área que a IA deve alterar (área transparente = editar).
            </div>
            <div v-if="imagePreviewUrl" class="grid grid-cols-2 gap-2 items-start">
              <div class="rounded-lg border border-white/10 overflow-hidden bg-black/20">
                <img :src="imagePreviewUrl" class="w-full h-auto block" />
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-[10px] text-zinc-400">Pincel</label>
                  <span class="text-[10px] text-zinc-500">{{ brushSize }}px</span>
                </div>
                <input type="range" min="8" max="140" v-model="brushSize" class="w-full" />
                <div class="flex items-center gap-2">
                  <button class="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs text-zinc-200 inline-flex items-center gap-2" @click="clearMask">
                    <Scissors class="w-4 h-4" /> Limpar máscara
                  </button>
                </div>
                <div class="rounded-lg border border-white/10 overflow-hidden bg-black/20">
                  <canvas
                    ref="maskCanvas"
                    class="w-full h-auto block touch-none"
                    @pointerdown="onMaskPointerDown"
                    @pointermove="onMaskPointerMove"
                    @pointerup="onMaskPointerUp"
                    @pointercancel="onMaskPointerUp"
                    @pointerleave="onMaskPointerUp"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Referências (clique para selecionar)</div>
          <div class="grid grid-cols-4 gap-2 max-h-90 overflow-y-auto pr-1">
            <button
              v-for="a in uploadsForPick"
              :key="a.id"
              type="button"
              class="aspect-square rounded-lg overflow-hidden border transition-all relative"
              :class="selectedRefUrls.includes(a.url) ? 'border-violet-500' : 'border-white/10 hover:border-white/20'"
              @click="toggleRefUrl(a.url)"
              :title="a.name"
            >
              <img :src="a.url" class="w-full h-full object-cover" />
              <div v-if="selectedRefUrls.includes(a.url)" class="absolute inset-0 bg-violet-500/10"></div>
            </button>
          </div>

          <div class="rounded-lg border border-white/10 bg-zinc-900/30 p-3 space-y-2">
            <div class="flex items-center justify-between">
              <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Referências por arquivo</div>
              <input id="ai-ref-files" type="file" accept="image/*" multiple class="hidden" @change="onPickRefFiles" />
              <label for="ai-ref-files" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-[11px] text-zinc-200 cursor-pointer">
                <UploadIcon class="w-4 h-4" /> Adicionar
              </label>
            </div>
            <div v-if="refFiles.length" class="space-y-1">
              <div v-for="(f, idx) in refFiles" :key="idx" class="flex items-center justify-between text-[11px] text-zinc-300 bg-zinc-800/40 border border-white/10 rounded px-2 py-1">
                <span class="truncate pr-2">{{ f.name }}</span>
                <button type="button" class="text-zinc-400 hover:text-red-300" @click="removeRefFile(idx)">Remover</button>
              </div>
            </div>
            <div v-else class="text-[11px] text-zinc-500">Envie imagens de referência (logos, layout, textura, etc).</div>
          </div>

          <div class="rounded-lg border border-white/10 bg-zinc-900/30 p-3 space-y-2">
            <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">URLs externas (1 por linha)</div>
            <textarea v-model="refUrlsText" rows="3" class="w-full bg-zinc-800 border border-white/10 rounded-lg p-2 text-[11px] text-white focus:outline-none" placeholder="https://..."></textarea>
            <div class="text-[10px] text-zinc-500">Cole links diretos de imagens (PNG/JPG/WebP).</div>
          </div>

          <div class="space-y-2">
            <div class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Resultado</div>
            <div class="rounded-xl border border-white/10 bg-zinc-950/30 p-3 min-h-50 flex items-center justify-center">
              <div v-if="processing" class="text-xs text-zinc-400">Gerando…</div>
              <div v-else-if="resultUrl" class="w-full">
                <img :src="resultUrl" class="w-full max-h-80 object-contain bg-black/20 rounded-lg" />
                <div class="mt-2 text-[10px] text-zinc-500 break-all">{{ resultUrl }}</div>
              </div>
              <div v-else class="text-xs text-zinc-500">Sem preview ainda</div>
            </div>
            <p v-if="error" class="text-[11px] text-red-300">{{ error }}</p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" @click="open = false">Fechar</Button>
      <Button :disabled="processing" @click="run">
        <template v-if="processing">Processando…</template>
        <template v-else>Gerar e Salvar</template>
      </Button>
    </template>
  </Dialog>
</template>
