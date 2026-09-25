<script setup lang="ts">
import { REDESIGN_VERSION } from '~/shared/pageEnhancementVersion'
import { latestReadyEnhancements } from '~/utils/pageEnhancementResults'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { Check, ChevronLeft, ChevronRight, Expand, FileArchive, FileImage, FileText, LoaderCircle, Pause, RefreshCw, ShieldCheck, Sparkles, WandSparkles, X } from 'lucide-vue-next'

type EnhancementMode = 'finish' | 'redesign'
type Quality = 'medium' | 'high'
type Page = { id: string; name: string; width: number; height: number }
type Prepared = { guide?: string; pipelineVersion?: string; overlay?: string; redesignArea?: { left: number; top: number; width: number; height: number }; productCount?: number; protectedFraction?: number; original: string; mask: string; width: number; height: number; protectedCount: number }
type Receipt = {
  pipelineVersion?: string; mode?: EnhancementMode;
  id: string; pageId: string; status: 'processing' | 'completed' | 'failed' | 'uncertain'
  originalUrl?: string; resultUrl?: string; width: number; height: number
  sourceHash: string; error?: string; quality: Quality; createdAt: string
}
const props = defineProps<{ projectId: string; pages: Page[]; preparePage: (id: string, mode?: EnhancementMode) => Promise<Prepared> }>()
const emit = defineEmits<{ close: [] }>()
const titleId = useId()
const dialog = ref<HTMLElement>()
const configured = ref(false)
const scope = ref<'selected' | 'all'>('selected')
const selectedPageIds = ref<string[]>(props.pages[0]?.id ? [props.pages[0].id] : [])
const mode: EnhancementMode = 'redesign'
const quality: Quality = 'high'
const pageId = ref(props.pages[0]?.id || '')
const receipts = ref<Receipt[]>([])
const receiptId = ref('')
const busy = ref(false)
const loading = ref(true)
const ready = ref(false)
const exporting = ref(false)
const preparingLayout = ref(false)
const localPreview = ref<{ pageId: string; original: string; productCount: number } | null>(null)
const pause = ref(false)
const batchTotal = ref(0)
const batchDone = ref(0)
const message = ref('')
const error = ref('')
const zoom = ref(100)
const imageView = ref<{ url: string; label: string } | null>(null)
const historyOpen = ref(false)
const historyPage = ref(0)
const pickerPage = ref(0)
const selectionOpen = ref(false)
const compareSide = ref<'original' | 'result'>('result')
const resultGallery = ref<HTMLElement>()
const resultRevision = ref(Date.now())
const freshResultUrl = (url: string) => `${url}${url.includes('?') ? '&' : '?'}preview=${resultRevision.value}`
// Never repeat a generation automatically when the POST result is ambiguous.
const unconfirmedPages = ref<string[]>([])
const sourceHashes = ref<Record<string, string>>({})
const controller = new AbortController()
let disposed = false
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
const locked = computed(() => busy.value || loading.value || exporting.value || preparingLayout.value)
const matching = computed(() => receipts.value.filter(r => r.quality === quality && (r.mode || 'finish') === mode && (mode !== 'redesign' || r.pipelineVersion === REDESIGN_VERSION)))
const pageReceipts = computed(() => receipts.value.filter(r => r.pageId === pageId.value))
const readyResults = computed(() => latestReadyEnhancements(props.pages, receipts.value))
const pickerPageCount = computed(() => Math.max(1, Math.ceil(props.pages.length / 3)))
const visiblePickerPages = computed(() => props.pages.slice(pickerPage.value * 3, pickerPage.value * 3 + 3))
const historyPageCount = computed(() => Math.max(1, Math.ceil(receipts.value.length / 5)))
const visibleHistory = computed(() => receipts.value.slice(historyPage.value * 5, historyPage.value * 5 + 5))
const previewErrors = ref<Record<string, boolean>>({})
const selected = computed(() => pageReceipts.value.find(r => r.id === receiptId.value))
const completed = computed(() => matching.value.filter(r => r.status === 'completed' && r.resultUrl))
const completedFor = (id: string) => completed.value.find(r => r.pageId === id && !!sourceHashes.value[id] && r.sourceHash === sourceHashes.value[id])
const stale = (r: Receipt) => !!sourceHashes.value[r.pageId] && r.sourceHash !== sourceHashes.value[r.pageId]
const remaining = computed(() => props.pages.filter(p => !completedFor(p.id)))
const targetPages = computed(() => scope.value === 'all' ? props.pages : props.pages.filter(p => selectedPageIds.value.includes(p.id)))
const actionablePages = computed(() => targetPages.value.filter(p => !completedFor(p.id) && !pendingFor(p.id)))
const pendingFor = (id: string) => unconfirmedPages.value.includes(id) || receipts.value.some(r => r.pageId === id && (r.status === 'processing' || r.status === 'uncertain'))
const canRun = computed(() => ready.value && configured.value && !locked.value)
const hasAllReceipts = computed(() => props.pages.length > 0 && props.pages.every(p => completed.value.some(r => r.pageId === p.id)))
const canExportAll = computed(() => props.pages.length > 0 && remaining.value.length === 0)
const formatDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
const responseStatus = (e: unknown): number | null => {
  const error = e as { response?: { status?: unknown }; statusCode?: unknown; status?: unknown } | null
  const status = Number(error?.response?.status ?? error?.statusCode ?? error?.status)
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null
}
const statusLabel = (status: Receipt['status']) => ({ processing: 'Processando', completed: 'Concluída', failed: 'Falhou', uncertain: 'Resultado incerto' })[status]
const pageName = (id: string) => props.pages.find(p => p.id === id)?.name || id
const failure = (e: any) => String(e?.data?.statusMessage || e?.statusMessage || e?.message || 'Não foi possível concluir a operação.')
function upsert(receipt: Receipt) {
  receipts.value = [receipt, ...receipts.value.filter(r => r.id !== receipt.id)]
  if (receipt.pageId === pageId.value && receipt.status === 'completed') {
    localPreview.value = null
    receiptId.value = receipt.id
    resultRevision.value = Date.now()
  }
}
async function showResult(receipt: Receipt) {
  localPreview.value = null
  pageId.value = receipt.pageId
  await nextTick()
  receiptId.value = receipt.id
  zoom.value = 100
  compareSide.value = 'result'
  historyOpen.value = false
}
function moveGallery(direction: -1 | 1) { resultGallery.value?.scrollBy({ left: direction * 216, behavior: 'smooth' }) }
function close() {
  if (imageView.value) { imageView.value = null; return }
  if (historyOpen.value) { historyOpen.value = false; return }
  if (selectionOpen.value) { selectionOpen.value = false; return }
  if (!locked.value) emit('close')
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  if (event.key !== 'Tab') return
  const focusRoot = imageView.value ? dialog.value?.querySelector('.image-viewer') : historyOpen.value ? dialog.value?.querySelector('.history-viewer') : dialog.value
  const nodes = Array.from(focusRoot?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"]') || [])
  const first = nodes[0], last = nodes[nodes.length - 1]
  if (!first || !last) { event.preventDefault(); dialog.value?.focus(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.value)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.value)) { event.preventDefault(); first.focus() }
}
watch(pageId, () => { localPreview.value = null; receiptId.value = matching.value.find(r => r.pageId === pageId.value)?.id || ''; zoom.value = 100 })
watch(imageView, async value => { if (value) { await nextTick(); dialog.value?.querySelector<HTMLElement>('.image-viewer button')?.focus() } })
watch(historyOpen, async value => { if (value) { await nextTick(); dialog.value?.querySelector<HTMLElement>('.history-viewer button')?.focus() } })
watch(() => props.pages.map(p => p.id), ids => {
  if (!ids.includes(pageId.value)) pageId.value = ids[0] || ''
  selectedPageIds.value = selectedPageIds.value.filter(id => ids.includes(id))
  if (!selectedPageIds.value.length && ids[0]) selectedPageIds.value = [ids[0]]
  pickerPage.value = Math.min(pickerPage.value, Math.max(0, Math.ceil(ids.length / 3) - 1))
})
function togglePage(id: string) {
  selectedPageIds.value = selectedPageIds.value.includes(id)
    ? selectedPageIds.value.filter(value => value !== id)
    : [...selectedPageIds.value, id]
}

async function poll(receipt: Receipt) {
  let current = receipt
  const deadline = Date.now() + 10 * 60 * 1000
  while (current.status === 'processing' && !disposed) {
    if (Date.now() > deadline) throw new Error('A página continua processando. Consulte o andamento antes de iniciar outro trabalho.')
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve() }
      const timer = setTimeout(finish, 2500)
      controller.signal.addEventListener('abort', finish, { once: true })
    })
    if (disposed) break
    current = await $fetch<Receipt>('/api/page-enhancements/status', { query: { projectId: props.projectId, id: current.id }, credentials: 'same-origin', retry: 0, timeout: 30000, signal: controller.signal })
    upsert(current)
  }
  return current
}
async function refresh() {
    if (busy.value || exporting.value) return
  loading.value = true; error.value = ''; ready.value = false
  try {
    const [config, history] = await Promise.all([
      $fetch<{ configured: boolean; available: boolean }>('/api/page-enhancements/config', { credentials: 'same-origin', retry: 0, timeout: 30000, signal: controller.signal }),
      $fetch<{ items: Receipt[] }>('/api/page-enhancements', { query: { projectId: props.projectId }, credentials: 'same-origin', retry: 0, timeout: 30000, signal: controller.signal })
    ])
    configured.value = config.configured && config.available
    receipts.value = [...history.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    resultRevision.value = Date.now()
    receiptId.value = matching.value.find(r => r.pageId === pageId.value)?.id || ''
    ready.value = true
    if (!receiptId.value) {
      const saved = readyResults.value.find(r => r.pageId === pageId.value) || readyResults.value[0]
      if (saved) await showResult(saved)
    }
    for (const r of receipts.value.filter(r => r.status === 'processing' || r.status === 'uncertain')) {
      if (disposed) break
      const updated = await $fetch<Receipt>('/api/page-enhancements/status', { query: { projectId: props.projectId, id: r.id }, credentials: 'same-origin', retry: 0, timeout: 30000, signal: controller.signal })
      upsert(updated)
      if (updated.status === 'processing') await poll(updated)
    }
  } catch (e) { if (!disposed) error.value = failure(e) }
  finally { loading.value = false }
}
async function prepareVerified(id: string) {
  const data = await props.preparePage(id, mode)
  // Hash decoded PNG bytes, never the data-URL text.
  let bytes: ArrayBuffer
  if (data.original.startsWith('data:')) {
    const comma = data.original.indexOf(',')
    const raw = atob(data.original.slice(comma + 1))
    bytes = Uint8Array.from(raw, char => char.charCodeAt(0)).buffer
  } else {
    bytes = await (await imageBlob(data.original)).arrayBuffer()
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  sourceHashes.value[id] = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  return data
}
async function previewLayout() {
  if (locked.value || !pageId.value) return
  preparingLayout.value = true; error.value = ''
  try {
    const data = await props.preparePage(pageId.value, 'redesign')
    if (!data.guide || !data.overlay || !data.productCount) throw new Error('Não foi possível montar a prévia dos produtos.')
    localPreview.value = { pageId: pageId.value, original: data.original, productCount: data.productCount }
    compareSide.value = 'original'
  } catch (e) { error.value = failure(e) }
  finally { preparingLayout.value = false }
}
async function submit(id: string, data: Prepared) {
  if (disposed) throw new Error('Janela encerrada.')
  let receipt: Receipt
  try {
    receipt = await $fetch<Receipt>('/api/page-enhancements', {
      method: 'POST', credentials: 'same-origin', retry: 0, timeout: 60000, signal: controller.signal,
      body: { projectId: props.projectId, pageId: id, mode, pipelineVersion: data.pipelineVersion, guide: data.guide, overlay: data.overlay, redesignArea: data.redesignArea, retryFailed: matching.value.some(r => r.pageId === id && r.status === 'failed'), sourceHash: sourceHashes.value[id], original: data.original, mask: data.mask, quality }
    })
    if (!receipt.id) throw new Error('Resposta sem comprovante.')
  } catch (e) {
    const status = responseStatus(e)
    // Explicit client rejection did not start generation. Keep the page usable
    // for a manual correction; only ambiguous sends need history recovery.
    if (status !== null && status < 500) throw new Error(failure(e))
    if (!unconfirmedPages.value.includes(id)) unconfirmedPages.value.push(id)
    try {
      const history = await $fetch<{ items: Receipt[] }>('/api/page-enhancements', { query: { projectId: props.projectId }, credentials: 'same-origin', retry: 0, timeout: 30000, signal: controller.signal })
      receipts.value = [...history.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const recovered = receipts.value.find(r => r.pageId === id && r.quality === quality && (r.mode || 'finish') === mode && (mode !== 'redesign' || r.pipelineVersion === REDESIGN_VERSION) && r.sourceHash === sourceHashes.value[id])
      if (recovered) {
        unconfirmedPages.value = unconfirmedPages.value.filter(page => page !== id)
        upsert(recovered)
        const result = await poll(recovered)
        if (result.status === 'completed') return result
      }
    } catch { /* Keep the uncertain-send guard; never repeat the POST. */ }
    throw new Error(`A melhoria de ${pageName(id)} não foi confirmada. Consulte o histórico antes de tentar novamente. ${failure(e)}`)
  }
  upsert(receipt)
  const result = await poll(receipt)
  if (result.status !== 'completed') throw new Error(result.error || `Página: ${statusLabel(result.status)}. O lote foi interrompido; não há repetição automática.`)
  return result
}
async function run() {
  if (!canRun.value) return
  const pagesToCheck = [...targetPages.value]
  if (!pagesToCheck.length || !pagesToCheck.some(p => !pendingFor(p.id))) return
  busy.value = true; pause.value = false; error.value = ''
  try {
    // Verify every chosen original before the first paid request, including a single page.
    const prepared = new Map<string, Prepared>()
    message.value = 'Verificando as páginas escolhidas…'
    for (const page of pagesToCheck) {
      prepared.set(page.id, await prepareVerified(page.id))
      if (disposed || pause.value) return
    }
    const queue = pagesToCheck.filter(p => !completedFor(p.id) && !pendingFor(p.id))
    batchTotal.value = queue.length; batchDone.value = 0
    for (const [index, page] of queue.entries()) {
      if (disposed || pause.value) break
      if (matching.value.some(r => r.pageId === page.id && r.status === 'uncertain')) {
        throw new Error(`A melhoria de ${page.name} ainda não foi confirmada. Consulte o histórico antes de tentar novamente.`)
      }
      if (disposed) break
      message.value = `${index + 1}/${queue.length} · Melhorando ${page.name}`
      await submit(page.id, prepared.get(page.id)!)
      batchDone.value = index + 1
    }
    message.value = pause.value ? 'Pausado após a página atual. Resultados salvos no histórico.' : pagesToCheck.some(p => pendingFor(p.id)) ? 'Páginas disponíveis processadas. As páginas com resultado incerto ficaram pendentes, sem novo envio.' : queue.length ? 'Processamento concluído. Resultados salvos no histórico.' : 'As páginas escolhidas já têm resultados para a arte atual.'
  } catch (e) { if (!disposed) error.value = failure(e) }
  finally { busy.value = false }
}
async function imageBlob(url: string): Promise<Blob> {
  if (!url) throw new Error('Imagem indisponível.')
  return await $fetch<Blob>(url, { responseType: 'blob', credentials: 'same-origin', retry: 0, timeout: 60000, signal: controller.signal })
}
async function pngBlob(url: string) {
  const blob = await imageBlob(url)
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível converter a imagem para PNG.')
    context.drawImage(bitmap, 0, 0)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao gerar PNG.')), 'image/png'))
  } finally { bitmap.close() }
}
async function download(kind: 'png' | 'zip' | 'pdf', onlyReady = false) {
  if (locked.value || (kind !== 'png' && !(onlyReady ? readyResults.value.length : hasAllReceipts.value))) return
  const current = selected.value
  if (kind === 'png' && (current?.status !== 'completed' || !current.resultUrl)) return
  exporting.value = true; error.value = ''
  try {
    let blob: Blob
    if (kind === 'png') {
      const resultUrl = current?.resultUrl
      if (!current || !resultUrl) throw new Error('Resultado indisponível para download.')
      if (!props.pages.some(p => p.id === current.pageId)) throw new Error('Página removida do projeto.')
      blob = await pngBlob(freshResultUrl(resultUrl))
    }
    else {
      if (!onlyReady) for (const page of props.pages) await prepareVerified(page.id)
      if (!onlyReady && !canExportAll.value) throw new Error('Há resultados ausentes ou desatualizados. Gere novamente as páginas alteradas antes de exportar.')
      const ordered = onlyReady
        ? readyResults.value.map(receipt => ({ page: { ...props.pages.find(p => p.id === receipt.pageId)! }, receipt }))
        : props.pages.map(p => ({ page: { ...p }, receipt: completedFor(p.id)! }))
      const files = []
      for (const [index, item] of ordered.entries()) {
        if (!item.receipt?.resultUrl || item.page.width <= 0 || item.page.height <= 0) throw new Error('Todas as páginas precisam de resultado e dimensões válidas.')
        files.push({ fileName: `${String(index + 1).padStart(3, '0')}-${item.page.name.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'pagina'}.png`, blob: await pngBlob(freshResultUrl(item.receipt.resultUrl)), page: item.page })
      }
      const { buildPdfBlob, buildZipBlob } = await import('~/utils/editorExportPipeline')
      blob = kind === 'zip' ? await buildZipBlob(files) : await buildPdfBlob(files.map(f => ({ imageBlob: f.blob, pageWidthPx: f.page.width, pageHeightPx: f.page.height })))
    }
    if (disposed) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${onlyReady ? 'encarte-paginas-prontas' : 'encarte-melhorado'}.${kind}`
    document.body.appendChild(anchor); anchor.click(); anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) { if (!disposed) error.value = failure(e) }
  finally { exporting.value = false }
}
onMounted(async () => {
  previousFocus = document.activeElement as HTMLElement
  previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
  await nextTick(); dialog.value?.focus()
  await refresh()
})
onBeforeUnmount(() => { disposed = true; controller.abort(); document.body.style.overflow = previousOverflow; previousFocus?.focus() })
</script>

<template>
  <Teleport to="body">
    <div class="enhancement-overlay fixed inset-0 z-[100000] flex items-center justify-center p-2 backdrop-blur-sm sm:p-6" @click.self="close">
      <section ref="dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" class="enhancement-dialog flex w-full max-w-[1440px] flex-col overflow-hidden" @keydown="keydown">
        <header class="enhancement-header flex items-start gap-4">
          <div class="enhancement-header__mark" aria-hidden="true"><Sparkles :size="25" /></div>
          <div class="min-w-0 flex-1">
            <div class="enhancement-header__eyebrow"><span class="enhancement-pill">Assistente do JobVarejo</span><span>{{ pages.length }} {{ pages.length === 1 ? 'página' : 'páginas' }}</span></div>
            <h2 :id="titleId">Melhorar encarte com IA</h2>
            <p>Escolha as páginas, veja a arte inteira e confira cada resultado antes de baixar.</p>
          </div>
          <button type="button" class="enhancement-close" :disabled="locked" aria-label="Fechar" title="Fechar" @click="close"><X :size="19" /></button>
        </header>

        <div class="enhancement-body">
          <p v-if="error" role="alert" class="enhancement-alert enhancement-alert--error">{{ error }}</p>
          <div v-if="loading || exporting || preparingLayout || busy || message" role="status" aria-live="polite" class="enhancement-status">
            <LoaderCircle v-if="loading || exporting || preparingLayout || busy" :size="17" class="enhancement-spinner" aria-hidden="true" />
            <Check v-else :size="17" aria-hidden="true" />
            <span>{{ loading ? 'Carregando suas melhorias…' : exporting ? 'Preparando seu arquivo…' : preparingLayout ? 'Montando a prévia sem gerar imagem…' : message }}</span>
          </div>
          <p v-if="ready && !configured" class="enhancement-alert enhancement-alert--info">A melhoria com IA está indisponível no momento. Seus resultados salvos continuam disponíveis.</p>

          <button type="button" class="selection-toggle" :aria-expanded="selectionOpen" @click="selectionOpen = !selectionOpen"><WandSparkles :size="16" />Escolher páginas · {{ targetPages.length }}</button>

          <div class="enhancement-layout">
            <aside class="enhancement-sidebar" :class="{ 'is-open': selectionOpen }">
              <section class="panel panel--create">
                <div class="section-heading">
                  <span class="step-number">1</span>
                  <div><p class="eyebrow">ESCOLHA</p><h3>O que melhorar?</h3></div>
                  <button type="button" class="selection-close" aria-label="Fechar seleção" @click="selectionOpen = false"><X :size="18" /></button>
                </div>

                <div v-if="pages.length > 1" class="scope-options" role="group" aria-label="Escolha quais páginas melhorar">
                  <button type="button" class="scope-option" :class="{ 'is-selected': scope === 'selected' }" :aria-pressed="scope === 'selected'" :disabled="locked" @click="scope = 'selected'">
                    <FileImage :size="18" aria-hidden="true" /><span><strong>Selecionadas</strong><small>Escolha uma ou mais</small></span><Check v-if="scope === 'selected'" :size="15" class="scope-option__check" aria-hidden="true" />
                  </button>
                  <button type="button" class="scope-option" :class="{ 'is-selected': scope === 'all' }" :aria-pressed="scope === 'all'" :disabled="locked || !pages.length" @click="scope = 'all'">
                    <WandSparkles :size="18" aria-hidden="true" /><span><strong>Todas</strong><small>{{ pages.length }} páginas do encarte</small></span><Check v-if="scope === 'all'" :size="15" class="scope-option__check" aria-hidden="true" />
                  </button>
                </div>

                <div v-if="pages.length === 1" class="single-page"><FileImage :size="18" aria-hidden="true" /><span>{{ pages[0]?.name }}</span></div>

                <fieldset v-if="pages.length > 1 && scope === 'selected' && !busy" class="page-picker" :disabled="locked">
                  <legend>Selecione as páginas</legend>
                  <label v-for="(p, index) in visiblePickerPages" :key="p.id" class="page-choice" :class="{ 'is-checked': selectedPageIds.includes(p.id) }">
                    <input type="checkbox" :checked="selectedPageIds.includes(p.id)" @change="togglePage(p.id)" />
                    <span class="page-choice__number">{{ String(pickerPage * 3 + index + 1).padStart(2, '0') }}</span>
                    <span class="page-choice__name">{{ p.name }}</span>
                    <span v-if="pendingFor(p.id)" class="page-choice__state">Em andamento</span>
                    <span v-else-if="completed.some(r => r.pageId === p.id)" class="page-choice__state is-ready">Pronta</span>
                  </label>
                  <div v-if="pickerPageCount > 1" class="page-picker__navigation"><button type="button" :disabled="pickerPage === 0" aria-label="Páginas anteriores" @click="pickerPage--"><ChevronLeft :size="15" /></button><span>{{ pickerPage + 1 }} / {{ pickerPageCount }}</span><button type="button" :disabled="pickerPage >= pickerPageCount - 1" aria-label="Próximas páginas" @click="pickerPage++"><ChevronRight :size="15" /></button></div>
                </fieldset>

                <label v-if="pages.length > 1" class="enhancement-field">Página para conferir
                  <select v-model="pageId" :disabled="locked || !pages.length"><option v-for="p in pages" :key="p.id" :value="p.id">{{ p.name }}</option></select>
                </label>

                <p v-if="scope === 'selected' && !selectedPageIds.length" class="enhancement-alert enhancement-alert--warning">Selecione pelo menos uma página.</p>
                <button type="button" class="enhancement-primary w-full" :disabled="!canRun || !targetPages.length || !actionablePages.length" @click="run"><LoaderCircle v-if="busy" :size="18" class="enhancement-spinner" aria-hidden="true" /><Sparkles v-else :size="18" aria-hidden="true" />{{ busy ? 'Criando melhorias…' : targetPages.length === 1 ? 'Melhorar esta página' : `Melhorar ${targetPages.length} páginas` }}</button>
                <button v-if="!busy" type="button" class="enhancement-secondary w-full" :disabled="locked || !pageId" @click="previewLayout"><FileImage :size="16" aria-hidden="true" />Conferir produtos antes</button>

                <div v-if="!busy && (receipts.some(r => r.status === 'uncertain') || unconfirmedPages.length)" class="pending-notice" role="status"><span>Uma página aguarda confirmação.</span><button type="button" :disabled="locked" @click="refresh"><RefreshCw :size="14" />Atualizar</button></div>

                <div v-if="!busy" class="preservation-note"><ShieldCheck :size="17" aria-hidden="true" /><p><strong>Original preservado</strong><span>Revise preços e produtos antes de baixar.</span></p></div>

                <p v-if="!pages.length" class="empty-copy">Este projeto ainda não tem páginas para melhorar.</p>
                <p v-else-if="!busy" class="helper-copy">{{ targetPages.length }} {{ targetPages.length === 1 ? 'página escolhida' : 'páginas escolhidas' }} · {{ readyResults.length }} {{ readyResults.length === 1 ? 'resultado salvo' : 'resultados salvos' }}.</p>
              </section>

              <section v-if="busy" class="panel batch-panel">
                <div class="flex items-center justify-between gap-3"><h3>Andamento</h3><span class="count-pill">{{ batchDone }}/{{ batchTotal }}</span></div>
                <progress v-if="batchTotal" class="enhancement-progress w-full" :value="batchDone" :max="batchTotal" aria-label="Progresso das páginas" />
                <p class="helper-copy">{{ message }}</p>
                <div class="batch-actions">
                  <button type="button" :disabled="pause" @click="pause = true"><Pause :size="16" />{{ pause ? 'Pausa solicitada' : 'Pausar após esta página' }}</button>
                  <button type="button" :disabled="locked" @click="refresh"><RefreshCw :size="16" />Atualizar resultados</button>
                </div>
                <p class="helper-copy">Mantenha esta janela aberta até a página atual terminar.</p>
                <p v-if="receipts.some(r => r.status === 'uncertain') || unconfirmedPages.length" class="enhancement-alert enhancement-alert--warning">Uma página aguarda confirmação. Consulte o histórico antes de iniciar outra melhoria nela.</p>
              </section>
            </aside>

            <main class="enhancement-workspace">
              <section v-if="readyResults.length" class="panel gallery-panel" aria-label="Resultados prontos">
                <div class="gallery-heading">
                  <div><p class="eyebrow">2 · GALERIA</p><h3>{{ readyResults.length > 1 ? 'Páginas melhoradas' : 'Versão pronta' }}</h3></div>
                  <span class="count-pill">{{ readyResults.length }} {{ readyResults.length === 1 ? 'página' : 'páginas' }}</span>
                </div>
                <div ref="resultGallery" class="result-gallery">
                  <button v-for="r in readyResults" :key="r.id" type="button" class="result-card" :class="{ 'is-selected': receiptId === r.id }" :disabled="locked" :aria-label="`Abrir resultado de ${pageName(r.pageId)}`" :aria-pressed="receiptId === r.id" @click="showResult(r)">
                    <span class="result-card__image"><img :src="freshResultUrl(r.resultUrl!)" :alt="`${pageName(r.pageId)} melhorada`" loading="lazy" @error="previewErrors[r.id] = true" @load="previewErrors[r.id] = false" /><span v-if="previewErrors[r.id]" class="result-card__error">Prévia indisponível</span></span>
                    <span class="result-card__label"><strong>{{ pageName(r.pageId) }}</strong><small><Check :size="13" /> Pronta</small></span>
                  </button>
                </div>
                <div v-if="readyResults.length > 1" class="gallery-navigation"><button type="button" aria-label="Resultados anteriores" @click="moveGallery(-1)"><ChevronLeft :size="17" /></button><button type="button" aria-label="Próximos resultados" @click="moveGallery(1)"><ChevronRight :size="17" /></button></div>
              </section>
              <section v-else class="panel empty-results">
                <span class="empty-results__icon"><Sparkles :size="25" /></span>
                <h3>Suas melhorias aparecerão aqui</h3>
                <p>Escolha uma ou mais páginas e comece a criar com IA.</p>
              </section>

              <section class="panel compare-panel">
                <div class="section-heading section-heading--between">
                  <div class="min-w-0"><p class="eyebrow">3 · CONFIRA E BAIXE</p><h3>{{ localPreview ? `Produtos protegidos · ${pageName(localPreview.pageId)}` : selected ? pageName(selected.pageId) : 'Compare sua arte' }}</h3></div>
                  <label v-if="selected" class="zoom-control">{{ zoom === 100 ? 'Ajustar à tela' : `Zoom ${zoom}%` }}<input v-model.number="zoom" type="range" min="100" max="250" step="25" aria-label="Zoom da comparação" /></label>
                </div>
                <div v-if="selected && selected.originalUrl && selected.resultUrl" class="mobile-compare-tabs" role="group" aria-label="Imagem para comparar"><button type="button" :aria-pressed="compareSide === 'original'" :class="{ 'is-selected': compareSide === 'original' }" @click="compareSide = 'original'">Original</button><button type="button" :aria-pressed="compareSide === 'result'" :class="{ 'is-selected': compareSide === 'result' }" @click="compareSide = 'result'">Com IA</button></div>
                <label v-if="pageReceipts.length > 1" class="enhancement-field">Outra versão desta página
                  <select v-model="receiptId"><option v-for="r in pageReceipts" :key="r.id" :value="r.id">{{ formatDate(r.createdAt) }} · {{ statusLabel(r.status) }}</option></select>
                </label>
                <template v-if="localPreview">
                  <p class="enhancement-alert enhancement-alert--info">{{ localPreview.productCount }} produtos identificados. Esta é a arte original; a melhoria de design só aparece após clicar em “Melhorar esta página” e a API concluir.</p>
                  <div class="comparison-grid">
                    <figure class="comparison-frame"><figcaption><span>Original</span><button type="button" class="view-full" aria-label="Ver arte original inteira" @click="imageView = { url: localPreview.original, label: 'Arte original' }"><Expand :size="15" />Ver inteira</button></figcaption><div class="comparison-frame__image"><img :src="localPreview.original" alt="Arte original para comparação" /></div></figure>
                  </div>
                </template>
                <template v-else-if="selected">
                  <p v-if="selected.mode !== 'redesign'" class="enhancement-alert enhancement-alert--info">Esta versão recebeu apenas acabamento leve: a composição, os produtos e os preços ficaram nas mesmas posições. Para mudar o layout, selecione a página e crie uma nova melhoria.</p>
                  <p v-if="stale(selected)" class="enhancement-alert enhancement-alert--warning">A arte original mudou depois desta melhoria. Gere uma nova versão para comparar com o conteúdo atual.</p>
                  <div class="result-meta"><span>{{ selected.mode === 'redesign' ? 'Redesign completo' : 'Acabamento leve' }}</span><span>{{ statusLabel(selected.status) }}</span><span>{{ formatDate(selected.createdAt) }}</span></div>
                  <p v-if="selected.error" class="enhancement-alert enhancement-alert--warning">{{ selected.error }}</p>
                  <div class="comparison-grid">
                    <figure class="comparison-frame" :class="{ 'mobile-hidden': compareSide !== 'original' }"><figcaption><span>Original</span><button v-if="selected.originalUrl" type="button" class="view-full" aria-label="Ver arte original inteira" @click="imageView = { url: selected.originalUrl!, label: `Original · ${pageName(selected.pageId)}` }"><Expand :size="15" />Ver inteira</button></figcaption><div class="comparison-frame__image" :class="{ 'is-zoomed': zoom > 100 }"><img v-if="selected.originalUrl" :src="selected.originalUrl" :alt="`Arte original de ${pageName(selected.pageId)}`" :style="zoom > 100 ? { width: `${zoom}%`, maxWidth: 'none', maxHeight: 'none' } : undefined" /><p v-else>Prévia original indisponível.</p></div></figure>
                    <figure class="comparison-frame" :class="{ 'mobile-hidden': compareSide !== 'result' }"><figcaption><span>{{ selected.mode === 'redesign' ? 'Redesign com IA' : 'Acabamento leve' }}</span><button v-if="selected.status === 'completed' && selected.resultUrl" type="button" class="view-full" aria-label="Ver resultado inteiro" @click="imageView = { url: freshResultUrl(selected.resultUrl!), label: `Melhorada · ${pageName(selected.pageId)}` }"><Expand :size="15" />Ver inteira</button></figcaption><div class="comparison-frame__image" :class="{ 'is-zoomed': zoom > 100 }"><img v-if="selected.status === 'completed' && selected.resultUrl" :src="freshResultUrl(selected.resultUrl)" :alt="`${pageName(selected.pageId)} melhorada com IA`" :style="zoom > 100 ? { width: `${zoom}%`, maxWidth: 'none', maxHeight: 'none' } : undefined" /><p v-else>{{ selected.status === 'processing' ? 'A IA está criando esta versão…' : 'Resultado ainda indisponível.' }}</p></div></figure>
                  </div>
                </template>
                <p v-else class="compare-empty">Selecione uma versão pronta para comparar com a arte original.</p>
                <div class="download-actions">
                  <button type="button" :disabled="locked || selected?.status !== 'completed' || !selected?.resultUrl" @click="download('png')"><FileImage :size="17" />Baixar esta página</button>
                  <button type="button" :disabled="locked || !readyResults.length" @click="download('zip', true)"><FileArchive :size="17" />Baixar páginas prontas · ZIP</button>
                  <button type="button" :disabled="locked || !readyResults.length" @click="download('pdf', true)"><FileText :size="17" />Baixar páginas prontas · PDF</button>
                </div>
              </section>
            </main>
          </div>

          <button v-if="receipts.length" type="button" class="history-trigger" @click="historyOpen = true"><span>Histórico de melhorias</span><span>{{ receipts.length }} {{ receipts.length === 1 ? 'versão' : 'versões' }}</span></button>
        </div>
        <div v-if="historyOpen" class="history-viewer" role="dialog" aria-modal="true" aria-label="Histórico de melhorias">
          <div class="history-viewer__header"><strong>Histórico de melhorias</strong><button type="button" aria-label="Fechar histórico" @click="historyOpen = false"><X :size="19" /></button></div>
          <table class="history-table"><thead><tr><th>Página</th><th>Estilo</th><th>Status</th><th>Data</th><th></th></tr></thead><tbody>
            <tr v-for="r in visibleHistory" :key="r.id"><td>{{ pageName(r.pageId) }}</td><td>{{ r.mode === 'redesign' ? 'Redesign completo' : 'Acabamento leve' }}</td><td><span class="history-status" :class="`is-${r.status}`">{{ stale(r) ? 'Desatualizada' : statusLabel(r.status) }}</span></td><td>{{ formatDate(r.createdAt) }}</td><td><button v-if="r.resultUrl" type="button" :disabled="locked" @click="showResult(r)">Abrir</button><span v-else class="helper-copy">—</span></td></tr>
          </tbody></table>
          <div v-if="historyPageCount > 1" class="history-pagination"><button type="button" :disabled="historyPage === 0" @click="historyPage--"><ChevronLeft :size="16" />Anterior</button><span>{{ historyPage + 1 }} / {{ historyPageCount }}</span><button type="button" :disabled="historyPage >= historyPageCount - 1" @click="historyPage++">Próxima<ChevronRight :size="16" /></button></div>
        </div>
        <div v-if="imageView" class="image-viewer" role="dialog" aria-modal="true" :aria-label="imageView.label" @click.self="imageView = null">
          <div class="image-viewer__bar"><strong>{{ imageView.label }}</strong><button type="button" aria-label="Fechar imagem ampliada" @click="imageView = null"><X :size="20" /></button></div>
          <img :src="imageView.url" :alt="imageView.label" />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
/* The dialog is teleported to body, so keep the admin palette available locally. */
.enhancement-dialog {
  position: relative;
  --jv-navy: #173d70;
  --jv-blue: #2160b4;
  --jv-sky: #eaf3ff;
  --jv-ink: #172b45;
  --jv-muted: #60758f;
  --jv-line: #d7e4f1;
  --jv-surface: #fff;
  color: var(--jv-ink);
  font-family: "Plus Jakarta Sans", "Barlow", ui-sans-serif, system-ui, sans-serif;
  border: 1px solid #d8e5f2;
  border-radius: 22px;
  background: #f5f9fe;
  box-shadow: 0 32px 90px rgba(12, 40, 76, .28);
  height: calc(100dvh - 16px);
  max-height: 100dvh;
}
.enhancement-overlay { background: rgba(12, 32, 58, .63); }
.enhancement-header {
  flex: 0 0 auto;
  padding: 9px 16px;
  border-bottom: 1px solid var(--jv-line);
  background: linear-gradient(105deg, #e9f3ff 0%, #f7fbff 48%, #fff 100%);
}
.enhancement-header__mark, .section-heading__icon, .empty-results__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: #fff;
  background: linear-gradient(145deg, #377dc8, var(--jv-navy));
  box-shadow: 0 7px 18px rgba(33, 96, 180, .19);
}
.enhancement-header__mark { width: 36px; height: 36px; border-radius: 11px; }
.enhancement-header__eyebrow { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 3px; color: var(--jv-muted); font-size: 11px; }
.enhancement-pill, .count-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #c9def4;
  border-radius: 999px;
  background: #eaf3ff;
  color: var(--jv-navy);
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 750;
}
.enhancement-header h2 { margin: 0; color: var(--jv-navy); font-size: clamp(18px, 1.8vw, 22px); font-weight: 800; letter-spacing: -.035em; }
.enhancement-header p { margin: 2px 0 0; max-width: 760px; color: var(--jv-muted); font-size: 11px; line-height: 1.25; }
.enhancement-close { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 auto; border: 1px solid var(--jv-line); border-radius: 12px; background: #fff; color: var(--jv-navy); transition: background .16s, border-color .16s, transform .16s; }
.enhancement-close:hover:not(:disabled) { border-color: #9abde4; background: var(--jv-sky); transform: translateY(-1px); }
.enhancement-body { position: relative; display: flex; flex: 1; flex-direction: column; gap: 7px; min-height: 0; overflow: hidden; padding: 10px; }
.enhancement-layout { display: grid; grid-template-columns: minmax(250px, 290px) minmax(0, 1fr); flex: 1; gap: 9px; min-height: 0; }
.enhancement-sidebar, .enhancement-workspace { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; overflow: hidden; }
.selection-toggle, .selection-close { display: none; }
.enhancement-dialog :is(button, select, input, summary):focus-visible { outline: 2px solid var(--jv-blue); outline-offset: 3px; }
.enhancement-dialog button:disabled { cursor: not-allowed; opacity: .5; }
.enhancement-dialog button { font: inherit; }
.panel { min-width: 0; border: 1px solid var(--jv-line); border-radius: 12px; background: var(--jv-surface); padding: 9px; box-shadow: 0 8px 24px rgba(26, 68, 113, .055); }
.panel--create { display: flex; flex-direction: column; gap: 7px; border-color: #c6dcf3; background: linear-gradient(160deg, #f8fbff, #fff 40%); }
.section-heading { display: flex; align-items: center; gap: 11px; }
.section-heading--between { justify-content: space-between; }
.step-number { display: grid; place-items: center; flex: 0 0 auto; width: 27px; height: 27px; border-radius: 8px; background: #eaf3ff; color: var(--jv-blue); font-size: 13px; font-weight: 800; }
.section-heading__icon { width: 38px; height: 38px; border-radius: 11px; }
.eyebrow { margin: 0 0 2px; color: #437cb7; font-size: 9px; font-weight: 800; letter-spacing: .12em; }
.section-heading h3, .gallery-heading h3, .batch-panel h3, .empty-results h3 { margin: 0; color: var(--jv-ink); font-size: 14px; font-weight: 750; letter-spacing: -.02em; }
.scope-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.scope-option { display: flex; align-items: center; gap: 6px; min-height: 43px; width: 100%; border: 1px solid var(--jv-line); border-radius: 9px; background: #fff; color: #54708e; padding: 5px; text-align: left; transition: background .16s, border-color .16s, transform .16s, box-shadow .16s; }
.scope-option:hover:not(:disabled) { border-color: #9bbfe5; background: #f5faff; transform: translateY(-1px); }
.scope-option.is-selected { border-color: #73a7dc; background: #eaf3ff; color: var(--jv-blue); box-shadow: inset 3px 0 var(--jv-blue), 0 0 0 2px rgba(33, 96, 180, .06); }
.scope-option > span { display: grid; flex: 1; min-width: 0; }
.scope-option strong { color: var(--jv-ink); font-size: 11px; font-weight: 750; }
.scope-option small { color: var(--jv-muted); font-size: 11px; line-height: 1.4; }
.scope-option__check { color: var(--jv-blue); }
.single-page { display: flex; align-items: center; gap: 9px; min-height: 32px; border: 1px solid var(--jv-line); border-radius: 9px; background: #f7fbff; color: var(--jv-ink); padding: 5px 8px; font-size: 11px; font-weight: 700; }
.single-page span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-picker { display: grid; gap: 4px; margin: 0; padding: 0; border: 0; }
.page-picker legend { margin-bottom: 4px; color: var(--jv-ink); font-size: 11px; font-weight: 700; }
.page-choice { display: flex; align-items: center; gap: 7px; min-width: 0; min-height: 30px; border: 1px solid var(--jv-line); border-radius: 8px; background: #fff; padding: 3px 6px; cursor: pointer; }
.page-picker__navigation { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--jv-muted); font-size: 10px; }
.page-picker__navigation button { display: grid; place-items: center; width: 23px; height: 22px; border: 1px solid var(--jv-line); border-radius: 6px; background: #fff; color: var(--jv-blue); cursor: pointer; }
.page-choice.is-checked { border-color: #83b2e5; background: #f1f7ff; }
.page-choice input { flex: 0 0 auto; width: 15px; height: 15px; accent-color: var(--jv-blue); }
.page-choice__number { color: #6f8eaf; font-size: 10px; font-weight: 800; }
.page-choice__name { flex: 1; overflow: hidden; color: var(--jv-ink); font-size: 11px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.page-choice__state { color: #875300; font-size: 10px; white-space: nowrap; }
.page-choice__state.is-ready { color: #087d55; }
.enhancement-field { display: flex; flex-direction: column; gap: 3px; color: var(--jv-ink); font-size: 11px; font-weight: 700; }
.enhancement-field select { min-height: 31px; width: 100%; border: 1px solid var(--jv-line); border-radius: 8px; background: #f7fbff; color: var(--jv-ink); padding: 0 8px; font-size: 11px; }
.preservation-note { display: flex; align-items: flex-start; gap: 7px; border: 1px solid #bfe8d8; border-radius: 9px; background: #f0faf5; color: #087d55; padding: 6px; }
.preservation-note svg { flex: 0 0 auto; margin-top: 1px; }
.preservation-note p { display: grid; gap: 4px; margin: 0; }
.preservation-note strong { color: #126547; font-size: 12px; }
.preservation-note span { color: #426b5a; font-size: 10px; line-height: 1.4; }
.pending-notice { display: flex; align-items: center; justify-content: space-between; gap: 6px; border: 1px solid #f1d6a5; border-radius: 8px; background: #fff8e9; color: #875300; padding: 5px 7px; font-size: 10px; }
.pending-notice button { display: inline-flex; align-items: center; gap: 4px; flex: 0 0 auto; border: 0; background: transparent; color: #875300; font-size: 10px; font-weight: 750; cursor: pointer; }
.enhancement-primary { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 38px; border: 1px solid #1d579f; border-radius: 9px; background: linear-gradient(110deg, #2870bf, #1a4f96); color: #fff; box-shadow: 0 8px 18px rgba(33, 96, 180, .2); font-size: 12px; font-weight: 750; transition: filter .16s, transform .16s, box-shadow .16s; }
.enhancement-secondary { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 31px; border: 1px solid #b8cee8; border-radius: 8px; background: #fff; color: #21548e; font-size: 11px; font-weight: 750; transition: background .16s, border-color .16s; }
.enhancement-secondary:hover:not(:disabled) { background: #eaf3ff; border-color: #70a6e2; }
.enhancement-secondary:disabled { opacity: .55; cursor: not-allowed; }
.enhancement-primary:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 11px 23px rgba(33, 96, 180, .25); }
.helper-copy, .empty-copy { margin: 0; color: var(--jv-muted); font-size: 11px; line-height: 1.5; }
.enhancement-status, .enhancement-alert { display: flex; align-items: flex-start; gap: 9px; border-radius: 11px; padding: 11px 13px; font-size: 12px; line-height: 1.5; }
.enhancement-status { border: 1px solid #c9def4; background: #eaf3ff; color: var(--jv-navy); }
.enhancement-alert { margin: 0; }
.enhancement-alert--error { border: 1px solid #f0b9b9; background: #fff3f3; color: #a32929; }
.enhancement-alert--info { border: 1px solid #c9def4; background: #eaf3ff; color: var(--jv-navy); }
.enhancement-alert--warning { border: 1px solid #f1d6a5; background: #fff8e9; color: #875300; }
.enhancement-spinner { animation: enhancement-spin 1s linear infinite; }
@keyframes enhancement-spin { to { transform: rotate(360deg); } }
.batch-panel h3 { font-size: 13px; }
.count-pill { white-space: nowrap; }
.enhancement-progress { height: 7px; overflow: hidden; border: 0; border-radius: 999px; accent-color: var(--jv-blue); }
.batch-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.batch-actions button, .download-actions button, .history-table button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; border: 1px solid var(--jv-line); border-radius: 10px; background: #f7fbff; color: var(--jv-navy); padding: 0 11px; font-size: 11px; font-weight: 700; transition: background .16s, border-color .16s, color .16s; }
.batch-actions button:hover:not(:disabled), .download-actions button:hover:not(:disabled), .history-table button:hover:not(:disabled) { border-color: #9bbfe5; background: #eaf3ff; color: var(--jv-blue); }
.gallery-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.gallery-heading h3 { margin-bottom: 4px; }
.gallery-heading p:not(.eyebrow) { margin: 0; color: var(--jv-muted); font-size: 12px; }
.gallery-panel { display: flex; align-items: center; flex: 0 0 83px; gap: 8px; padding: 6px 8px; }
.gallery-heading { flex: 0 0 138px; }
.gallery-heading .count-pill { display: none; }
.result-gallery { display: flex; flex: 1; gap: 7px; min-width: 0; overflow: hidden; scroll-snap-type: x proximity; }
.result-card { display: flex; align-items: center; gap: 6px; flex: 0 0 190px; min-width: 0; height: 67px; border: 1px solid var(--jv-line); border-radius: 9px; background: #fff; color: var(--jv-ink); padding: 4px; text-align: left; scroll-snap-align: start; transition: border-color .16s, background .16s, transform .16s, box-shadow .16s; }
.result-card:hover:not(:disabled) { border-color: #9bbfe5; background: #f7fbff; transform: translateY(-2px); }
.result-card.is-selected { border-color: var(--jv-blue); background: #f1f7ff; box-shadow: 0 0 0 2px rgba(33, 96, 180, .12); }
.result-card__image { position: relative; display: grid; place-items: center; flex: 0 0 43px; width: 43px; height: 56px; overflow: hidden; border-radius: 6px; background: #edf3fa; }
.result-card__image img { width: 100%; height: 100%; object-fit: contain; }
.result-card__error { position: absolute; inset: auto 5px 8px; border-radius: 7px; background: #fff3f3; color: #a32929; padding: 5px; text-align: center; font-size: 10px; }
.result-card__label { display: grid; gap: 4px; min-width: 0; }
.result-card__label strong { overflow: hidden; color: var(--jv-ink); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.result-card__label small { display: inline-flex; align-items: center; gap: 3px; color: #087d55; font-size: 10px; white-space: nowrap; }
.gallery-navigation { display: flex; flex: 0 0 auto; gap: 4px; }
.gallery-navigation button { display: grid; place-items: center; width: 27px; height: 27px; border: 1px solid var(--jv-line); border-radius: 7px; background: #f7fbff; color: var(--jv-blue); cursor: pointer; }
.empty-results { display: grid; justify-items: center; align-content: center; flex: 0 0 83px; text-align: center; }
.empty-results__icon { width: 25px; height: 25px; margin-bottom: 2px; border-radius: 7px; }
.empty-results h3 { font-size: 12px; }
.empty-results p, .compare-empty { margin: 2px 0 0; color: var(--jv-muted); font-size: 10px; line-height: 1.25; }
.compare-panel { display: flex; flex: 1; flex-direction: column; gap: 5px; min-height: 0; }
.compare-panel .section-heading h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-compare-tabs { display: none; }
.zoom-control { display: grid; gap: 5px; justify-items: end; color: var(--jv-muted); font-size: 10px; }
.zoom-control input { width: 120px; accent-color: var(--jv-blue); }
.result-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--jv-muted); font-size: 10px; }
.result-meta span { border: 1px solid var(--jv-line); border-radius: 999px; background: #f7fbff; padding: 4px 8px; }
.comparison-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); flex: 1; gap: 7px; min-height: 0; }
.comparison-frame { display: flex; flex-direction: column; min-width: 0; min-height: 0; margin: 0; overflow: hidden; border: 1px solid var(--jv-line); border-radius: 9px; background: #fff; }
.comparison-frame figcaption { display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; gap: 8px; border-bottom: 1px solid var(--jv-line); padding: 5px 8px; color: var(--jv-ink); font-size: 11px; font-weight: 700; }
.comparison-frame figcaption small { color: var(--jv-muted); font-size: 10px; font-weight: 500; }
.view-full { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--jv-blue); padding: 3px 5px; font-size: 11px; font-weight: 700; white-space: nowrap; cursor: pointer; }
.view-full:hover { text-decoration: underline; }
.comparison-frame__image { display: flex; align-items: center; justify-content: center; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: #edf3fa; padding: 7px; }
.comparison-frame__image.is-zoomed { justify-content: flex-start; align-items: flex-start; overflow: auto; }
.comparison-frame__image img { display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 5px; box-shadow: 0 8px 24px rgba(23, 61, 112, .16); }
.comparison-frame__image.is-zoomed img { flex: 0 0 auto; }
.comparison-frame__image p { color: var(--jv-muted); font-size: 12px; text-align: center; }
.image-viewer { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 12px; background: #0b1c34; padding: 16px; }
.image-viewer__bar { display: flex; align-items: center; justify-content: space-between; gap: 20px; width: 100%; color: #fff; font-size: 14px; }
.image-viewer__bar button { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(255,255,255,.4); border-radius: 10px; background: rgba(255,255,255,.12); color: #fff; cursor: pointer; }
.image-viewer img { min-width: 0; min-height: 0; max-width: 100%; max-height: calc(100% - 50px); object-fit: contain; }
.download-actions { display: flex; flex: 0 0 auto; flex-wrap: wrap; gap: 6px; border-top: 1px solid var(--jv-line); padding-top: 5px; }
.download-actions button:first-child { border-color: #a5c8ec; background: #eaf3ff; color: var(--jv-blue); }
.history-trigger { display: flex; align-items: center; justify-content: space-between; flex: 0 0 32px; width: 100%; border: 1px solid var(--jv-line); border-radius: 9px; background: #fff; color: var(--jv-ink); padding: 0 11px; text-align: left; font-size: 11px; font-weight: 700; cursor: pointer; }
.history-trigger span + span { color: var(--jv-muted); font-size: 10px; font-weight: 500; }
.history-viewer { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; gap: 12px; overflow: hidden; background: #f5f9fe; padding: 18px; }
.history-viewer__header { display: flex; justify-content: space-between; align-items: center; color: var(--jv-navy); font-size: 19px; }
.history-viewer__header button { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--jv-line); border-radius: 8px; background: #fff; color: var(--jv-navy); cursor: pointer; }
.history-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 11px; }
.history-table th, .history-table td { overflow: hidden; max-width: 300px; padding: 8px 12px; text-overflow: ellipsis; white-space: nowrap; }
.history-table th { color: var(--jv-muted); background: #f7fbff; font-size: 10px; font-weight: 700; }
.history-table tr + tr { border-top: 1px solid var(--jv-line); }
.history-table td { color: var(--jv-ink); }
.history-status { display: inline-flex; border-radius: 999px; background: #eef3f8; color: var(--jv-muted); padding: 4px 7px; font-size: 10px; }
.history-status.is-completed { background: #e8f8f0; color: #087d55; }
.history-status.is-failed, .history-status.is-uncertain { background: #fff3df; color: #875300; }
.history-pagination { display: flex; justify-content: center; align-items: center; gap: 12px; color: var(--jv-muted); font-size: 11px; }
.history-pagination button { display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--jv-line); border-radius: 7px; background: #fff; color: var(--jv-blue); padding: 5px 8px; cursor: pointer; }
@media (max-width: 900px), (max-height: 650px) {
  .enhancement-layout { display: block; position: relative; }
  .enhancement-workspace { height: 100%; }
  .selection-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 0 0 30px; border: 1px solid #b8cee8; border-radius: 8px; background: #fff; color: var(--jv-blue); font-size: 11px; font-weight: 700; }
  .enhancement-sidebar { display: none; }
  .enhancement-sidebar.is-open { position: absolute; inset: 0; z-index: 1; display: flex; overflow: hidden; border: 1px solid var(--jv-line); border-radius: 10px; background: #f5f9fe; padding: 6px; }
  .selection-close { display: grid; place-items: center; margin-left: auto; width: 26px; height: 26px; border: 1px solid var(--jv-line); border-radius: 7px; background: #fff; color: var(--jv-blue); }
}
@media (max-width: 767px) {
  .enhancement-dialog { height: 100dvh; border-radius: 0; }
  .enhancement-header { align-items: center; gap: 8px; padding: 7px 10px; }
  .enhancement-header__mark { width: 29px; height: 29px; border-radius: 8px; }
  .enhancement-header p, .enhancement-header__eyebrow { display: none; }
  .enhancement-header h2 { font-size: 17px; }
  .enhancement-close { width: 31px; height: 31px; }
  .enhancement-body { padding: 6px; gap: 5px; }
  .gallery-panel { flex-basis: 65px; padding: 4px; }
  .gallery-heading { flex-basis: 78px; }
  .gallery-heading h3 { font-size: 10px; line-height: 1.15; }
  .result-card { flex-basis: 155px; height: 54px; }
  .result-card__image { flex-basis: 31px; width: 31px; height: 43px; }
  .gallery-navigation { flex-direction: column; }
  .gallery-navigation button { width: 20px; height: 20px; }
  .compare-panel { padding: 6px; }
  .compare-panel .section-heading h3 { font-size: 11px; }
  .zoom-control, .result-meta span:last-child { display: none; }
  .mobile-compare-tabs { display: flex; gap: 4px; flex: 0 0 auto; }
  .mobile-compare-tabs button { flex: 1; border: 1px solid var(--jv-line); border-radius: 7px; background: #fff; color: var(--jv-muted); padding: 4px; font-size: 10px; }
  .mobile-compare-tabs button.is-selected { border-color: var(--jv-blue); background: #eaf3ff; color: var(--jv-blue); font-weight: 700; }
  .comparison-grid { grid-template-columns: 1fr; }
  .comparison-frame.mobile-hidden { display: none; }
  .download-actions { flex-wrap: nowrap; }
  .download-actions button { flex: 1; min-width: 0; min-height: 30px; padding: 2px 4px; font-size: 9px; line-height: 1.1; }
  .download-actions button svg { display: none; }
  .history-table th:nth-child(2), .history-table td:nth-child(2), .history-table th:nth-child(4), .history-table td:nth-child(4) { display: none; }
}
@media (max-height: 600px) {
  .enhancement-header p, .preservation-note, .panel--create > .helper-copy { display: none; }
  .enhancement-header { padding-top: 5px; padding-bottom: 5px; }
  .enhancement-body { padding: 5px; gap: 4px; }
  .gallery-panel, .empty-results { flex-basis: 60px; }
  .result-card { height: 50px; }
  .result-card__image { height: 40px; }
}
@media (prefers-reduced-motion: reduce) {
  .enhancement-dialog *, .enhancement-dialog *::before, .enhancement-dialog *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
</style>
