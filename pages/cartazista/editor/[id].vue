<script setup lang="ts">
import { ArrowLeft, Download, FileDown, Layers, Lock, Printer, Redo2, Save, Sparkles, Trash2, Undo2, Unlock } from 'lucide-vue-next'
import ArtCanvas from '~/components/art-studio/ArtCanvas.client.vue'
import CartazistaShell from '~/components/cartazista/CartazistaShell.vue'
import CartazistaSheetPreview from '~/components/cartazista/CartazistaSheetPreview.vue'
import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import {
  CARTAZISTA_FORMATS,
  CARTAZISTA_THEMES,
  type CartazistaDocument,
  type CartazistaFormatId,
  type CartazistaModelKey,
  type CartazistaProduct,
  type CartazistaThemeId
} from '~/types/cartazista'
import { normalizeBusinessProfile } from '~/utils/businessProfile'
import {
  applyCartazistaProduct,
  applySettingsToCartazistaComposition,
  cartazistaPrintableCompositions,
  cloneCartazista,
  createCartazistaDocument,
  formatCartazistaPrice,
  parseCartazistaProductList,
  rebuildCartazistaComposition
} from '~/utils/cartazista/composition'
import { getCartazistaModel } from '~/utils/cartazista/catalog'
import { CARTAZISTA_STARTER_MODELS } from '~/utils/cartazista/catalog'

definePageMeta({ layout: false, middleware: 'auth', ssr: false, key: (route) => route.fullPath })
useHead({ title: 'Editor de cartazes • JobVarejo' })

const route = useRoute()
const doc = ref<CartazistaDocument>(createCartazistaDocument({ modelId: (String(route.query.model || 'standard') as CartazistaModelKey) }))
const selectedId = ref<string | null>(null)
const activePanel = ref<'setup' | 'review' | 'layers'>('setup')
const listInput = ref('')
const logoSrc = ref('')
const brandName = ref('SUA LOJA')
const designId = ref('')
const revision = ref(0)
const creationId = crypto.randomUUID()
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const saveState = ref('Rascunho local')
const printDialog = ref<HTMLDialogElement>()
const canvas = ref<{ exportPng: () => Promise<string>; refreshImages: () => Promise<void> }>()
const historyPast = ref<string[]>([])
const historyFuture = ref<string[]>([])
const draftKey = computed(() => `jobvarejo:cartazista:${String(route.params.id)}:${creationId}`)

const model = computed(() => getCartazistaModel(doc.value.modelId))
const format = computed(() => CARTAZISTA_FORMATS.find((item) => item.id === doc.value.formatId) || CARTAZISTA_FORMATS[2]!)
const theme = computed(() => CARTAZISTA_THEMES.find((item) => item.id === doc.value.themeId) || CARTAZISTA_THEMES[0])
const activeProduct = computed(() => doc.value.products.find((item) => item.id === doc.value.activeProductId) || doc.value.products[0])
const selectedLayer = computed(() => doc.value.composition.layers.find((item) => item.id === selectedId.value))
const printableCompositions = computed(() => cartazistaPrintableCompositions(doc.value, logoSrc.value).map((composition) => hydrateComposition(composition)))
const dirty = computed(() => saveState.value !== 'Salvo' && saveState.value !== 'Salvo como cópia')

const documentFingerprint = (value: CartazistaDocument) => JSON.stringify(value)
const saveDraft = () => {
  if (!import.meta.client) return
  try { localStorage.setItem(draftKey.value, JSON.stringify({ document: doc.value, revision: revision.value, at: Date.now() })) } catch { /* armazenamento local é apenas fallback */ }
}

const hydrateComposition = (source: ArtComposition): ArtComposition => {
  const composition = cloneCartazista(source)
  const company = composition.layers.find((layer) => layer.id === 'cartaz-company')
  const logo = composition.layers.find((layer) => layer.id === 'cartaz-logo')
  if (company) company.text = brandName.value
  if (logo) logo.src = doc.value.settings.showLogo ? logoSrc.value : ''
  return composition
}

const replaceDocument = (next: CartazistaDocument, record = true) => {
  if (record) {
    historyPast.value = [...historyPast.value, JSON.stringify(doc.value)].slice(-60)
    historyFuture.value = []
  }
  doc.value = cloneCartazista(next)
  saveState.value = 'Alterações pendentes'
  saveDraft()
}

const updateComposition = (composition: ArtComposition) => {
  const next = cloneCartazista(doc.value)
  next.composition = hydrateComposition(composition)
  replaceDocument(next)
}

const rebuild = (next: CartazistaDocument) => {
  next.composition = hydrateComposition(rebuildCartazistaComposition(next, logoSrc.value).composition)
  replaceDocument(next)
}

const updateSetting = (key: 'validity' | 'limitPerCustomer' | 'nearExpiryLabel', event: Event) => {
  const next = cloneCartazista(doc.value)
  next.settings[key] = (event.target as HTMLInputElement).value
  next.composition = hydrateComposition(applySettingsToCartazistaComposition(next.composition, next))
  replaceDocument(next)
}

const toggleSetting = (key: 'highlightNearExpiry' | 'showLogo') => {
  const next = cloneCartazista(doc.value)
  next.settings[key] = !next.settings[key]
  next.composition = hydrateComposition(applySettingsToCartazistaComposition(next.composition, next))
  replaceDocument(next)
}

const changeModel = (event: Event) => {
  const next = cloneCartazista(doc.value)
  next.modelId = (event.target as HTMLSelectElement).value as CartazistaModelKey
  if (next.modelId === 'landscape') next.settings.orientation = 'landscape'
  rebuild(next)
}

const changeFormat = (event: Event) => {
  const next = cloneCartazista(doc.value)
  next.formatId = (event.target as HTMLSelectElement).value as CartazistaFormatId
  rebuild(next)
}

const changeTheme = (event: Event) => {
  const next = cloneCartazista(doc.value)
  next.themeId = (event.target as HTMLSelectElement).value as CartazistaThemeId
  rebuild(next)
}

const changeOrientation = (orientation: 'portrait' | 'landscape') => {
  const next = cloneCartazista(doc.value)
  next.settings.orientation = orientation
  rebuild(next)
}

const importProducts = () => {
  const parsed = parseCartazistaProductList(listInput.value)
  if (!parsed.length) { error.value = 'Não encontrei produtos com preço. Use uma linha por item, por exemplo: ARROZ CAMIL 5KG 29,99.'; return }
  error.value = ''
  const next = cloneCartazista(doc.value)
  next.products = parsed
  next.activeProductId = parsed[0]!.id
  next.composition = hydrateComposition(applyCartazistaProduct(next.composition, next.modelId, parsed[0]!, next.settings, next.themeId))
  replaceDocument(next)
  activePanel.value = 'review'
}

const selectProduct = (product: CartazistaProduct) => {
  const next = cloneCartazista(doc.value)
  next.activeProductId = product.id
  next.composition = hydrateComposition(applyCartazistaProduct(next.composition, next.modelId, product, next.settings, next.themeId))
  replaceDocument(next, false)
}

const updateProduct = (product: CartazistaProduct, key: keyof CartazistaProduct, value: string) => {
  const next = cloneCartazista(doc.value)
  const target = next.products.find((item) => item.id === product.id)
  if (!target) return
  if (key === 'name' || key === 'unit') target[key] = value as never
  else if (key === 'nearExpiry') target.nearExpiry = value === 'true'
  else {
    const numberValue = Number(value.replace(',', '.'))
    if (Number.isFinite(numberValue)) target[key] = numberValue as never
  }
  next.composition = hydrateComposition(applyCartazistaProduct(next.composition, next.modelId, target, next.settings, next.themeId))
  replaceDocument(next)
}

const addProduct = () => {
  const next = cloneCartazista(doc.value)
  const product: CartazistaProduct = { id: crypto.randomUUID(), name: 'NOVO PRODUTO', price: 0, unit: 'un' }
  next.products.push(product)
  next.activeProductId = product.id
  next.composition = hydrateComposition(applyCartazistaProduct(next.composition, next.modelId, product, next.settings, next.themeId))
  replaceDocument(next)
}

const removeProduct = (product: CartazistaProduct) => {
  if (doc.value.products.length <= 1) return
  const next = cloneCartazista(doc.value)
  next.products = next.products.filter((item) => item.id !== product.id)
  if (next.activeProductId === product.id) next.activeProductId = next.products[0]!.id
  const current = next.products.find((item) => item.id === next.activeProductId)!
  next.composition = hydrateComposition(applyCartazistaProduct(next.composition, next.modelId, current, next.settings, next.themeId))
  replaceDocument(next)
}

const patchLayer = (key: 'text' | 'fill' | 'fontSize' | 'opacity' | 'visible' | 'locked', value: string | number | boolean) => {
  if (!selectedId.value) return
  const next = cloneCartazista(doc.value)
  const layer = next.composition.layers.find((item) => item.id === selectedId.value)
  if (!layer) return
  ;(layer as any)[key] = value
  replaceDocument(next)
}

const undo = () => {
  const previous = historyPast.value.at(-1)
  if (!previous) return
  historyPast.value = historyPast.value.slice(0, -1)
  historyFuture.value = [...historyFuture.value, JSON.stringify(doc.value)]
  doc.value = JSON.parse(previous) as CartazistaDocument
  saveState.value = 'Alterações pendentes'
  saveDraft()
}

const redo = () => {
  const future = historyFuture.value.at(-1)
  if (!future) return
  historyFuture.value = historyFuture.value.slice(0, -1)
  historyPast.value = [...historyPast.value, JSON.stringify(doc.value)]
  doc.value = JSON.parse(future) as CartazistaDocument
  saveState.value = 'Alterações pendentes'
  saveDraft()
}

const download = (href: string, filename: string) => {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
}

const exportPng = async () => {
  try {
    error.value = ''
    const href = await canvas.value?.exportPng()
    if (!href) throw new Error('Aguarde o canvas terminar de carregar.')
    download(href, `${doc.value.name.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 90) || 'cartaz'}.png`)
  } catch (cause: any) { error.value = cause?.message || 'Não foi possível exportar o PNG.' }
}

const openPrint = async () => {
  printDialog.value?.showModal()
  await nextTick()
  window.setTimeout(() => window.print(), 100)
}

const save = async (asCopy = false) => {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const body = { id: asCopy ? crypto.randomUUID() : (designId.value || creationId), name: doc.value.name.trim() || `${model.value.name} · novo cartaz`, state: cloneCartazista(doc.value), ...(asCopy ? {} : { revision: revision.value || undefined }) }
    const result = designId.value && !asCopy
      ? await $fetch<any>(`/api/cartazista/designs/${designId.value}`, { method: 'PUT', body })
      : await $fetch<any>('/api/cartazista/designs', { method: 'POST', body })
    designId.value = result.id
    revision.value = Number(result.revision || 1)
    saveState.value = asCopy ? 'Salvo como cópia' : 'Salvo'
    localStorage.removeItem(draftKey.value)
    if (asCopy) await navigateTo(`/cartazista/editor/${result.id}`)
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || cause?.statusMessage || cause?.message || 'Não foi possível salvar o cartaz.'
    saveState.value = 'Rascunho local'
    saveDraft()
  } finally { busy.value = false }
}

const hydrateBrand = async () => {
  try {
    const response = await $fetch<{ business_profile: unknown }>('/api/profile')
    const profile = normalizeBusinessProfile(response.business_profile)
    logoSrc.value = profile.logo ? '/api/art-studio/brand-logo' : ''
    brandName.value = profile.companyName || 'SUA LOJA'
    const next = cloneCartazista(doc.value)
    next.composition = hydrateComposition(next.composition)
    doc.value = next
    await nextTick()
    await canvas.value?.refreshImages()
  } catch { /* o editor continua funcional sem dados de marca */ }
}

const load = async () => {
  try {
    if (String(route.params.id) !== 'new') {
      const result = await $fetch<any>(`/api/cartazista/designs/${String(route.params.id)}`)
      doc.value = result.state as CartazistaDocument
      designId.value = result.id
      revision.value = Number(result.revision || 1)
      saveState.value = 'Salvo'
    } else if (route.query.model) {
      doc.value = createCartazistaDocument({ modelId: String(route.query.model) as CartazistaModelKey })
    }
    listInput.value = doc.value.products.map((product) => `${product.name} ${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n')
    historyPast.value = []
    historyFuture.value = []
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || cause?.statusMessage || 'Não foi possível abrir este cartaz.'
  } finally { loading.value = false }
}

const closePrint = () => printDialog.value?.close()
onMounted(async () => { await load(); await hydrateBrand() })
onBeforeUnmount(() => { window.onafterprint = null })
if (import.meta.client) window.onafterprint = closePrint
</script>

<template>
  <CartazistaShell active="editor">
    <div class="cartazista-editor-page">
      <header class="cartazista-editor-toolbar">
        <NuxtLink to="/cartazista" class="cartazista-back-link"><ArrowLeft :size="17" /> Modelos</NuxtLink>
        <div class="cartazista-title-field"><input v-model="doc.name" aria-label="Nome do cartaz" @change="saveState = 'Alterações pendentes'; saveDraft()" /><span>{{ saveState }}</span></div>
        <div class="cartazista-editor-actions"><button class="cartazista-button ghost" :disabled="!historyPast.length" aria-label="Desfazer" @click="undo"><Undo2 :size="17" /></button><button class="cartazista-button ghost" :disabled="!historyFuture.length" aria-label="Refazer" @click="redo"><Redo2 :size="17" /></button><button class="cartazista-button secondary" :disabled="busy" @click="save(true)"><FileDown :size="17" /> Salvar cópia</button><button class="cartazista-button primary" :disabled="busy" @click="save()"><Save :size="17" /> {{ busy ? 'Salvando…' : 'Salvar' }}</button></div>
      </header>

      <div v-if="error" class="cartazista-editor-error" role="alert">{{ error }} <button @click="error = ''">Fechar</button></div>
      <div v-if="loading" class="cartazista-editor-loading">Montando seu editor de cartazes…</div>

      <div v-else class="cartazista-editor-layout">
        <aside class="cartazista-panel cartazista-controls-panel">
          <div class="cartazista-panel-tabs"><button :class="{ active: activePanel === 'setup' }" @click="activePanel = 'setup'">Configurar</button><button :class="{ active: activePanel === 'review' }" @click="activePanel = 'review'">Produtos <span>{{ doc.products.length }}</span></button><button :class="{ active: activePanel === 'layers' }" @click="activePanel = 'layers'">Camadas</button></div>

          <div v-if="activePanel === 'setup'" class="cartazista-panel-content">
            <section class="cartazista-control-section"><div class="cartazista-control-heading"><span>MODELO</span><Sparkles :size="15" /></div><select class="cartazista-select" :value="doc.modelId" @change="changeModel"><option v-for="item in CARTAZISTA_STARTER_MODELS" :key="item.id" :value="item.id">{{ item.name }}</option></select><p class="cartazista-help">{{ model.description }}</p></section>
            <section class="cartazista-control-section"><div class="cartazista-control-heading"><span>TAMANHO E ORIENTAÇÃO</span></div><select class="cartazista-select" :value="doc.formatId" @change="changeFormat"><option v-for="item in CARTAZISTA_FORMATS" :key="item.id" :value="item.id">{{ item.label }} · {{ item.description }}</option></select><div class="cartazista-segmented"><button :class="{ active: doc.settings.orientation === 'portrait' }" @click="changeOrientation('portrait')">Retrato</button><button :class="{ active: doc.settings.orientation === 'landscape' }" @click="changeOrientation('landscape')">Paisagem</button></div></section>
            <section class="cartazista-control-section"><div class="cartazista-control-heading"><span>TEMA GLOBAL</span></div><select class="cartazista-select" :value="doc.themeId" @change="changeTheme"><option v-for="item in CARTAZISTA_THEMES" :key="item.id" :value="item.id">{{ item.name }}</option></select><div class="cartazista-theme-row"><span v-for="item in CARTAZISTA_THEMES" :key="item.id" :class="['cartazista-theme-dot', { active: doc.themeId === item.id }]" :style="{ background: item.background, borderColor: item.accent }" :title="item.name" @click="changeTheme({ target: { value: item.id } } as unknown as Event)" /></div></section>
            <section class="cartazista-control-section"><div class="cartazista-control-heading"><span>REGRAS DA OFERTA</span></div><label class="cartazista-field-label">Validade<input :value="doc.settings.validity" placeholder="Ex.: até 30/09" @input="updateSetting('validity', $event)" /></label><label class="cartazista-field-label">Limite por cliente<input :value="doc.settings.limitPerCustomer" placeholder="Ex.: 3 unidades por CPF" @input="updateSetting('limitPerCustomer', $event)" /></label><label class="cartazista-toggle"><input type="checkbox" :checked="doc.settings.highlightNearExpiry" @change="toggleSetting('highlightNearExpiry')" /><span>Destacar produto próximo da validade</span></label><label v-if="doc.settings.highlightNearExpiry" class="cartazista-field-label">Texto do destaque<input :value="doc.settings.nearExpiryLabel" @input="updateSetting('nearExpiryLabel', $event)" /></label><label class="cartazista-toggle"><input type="checkbox" :checked="doc.settings.showLogo" @change="toggleSetting('showLogo')" /><span>Usar logo da loja</span></label></section>
          </div>

          <div v-else-if="activePanel === 'review'" class="cartazista-panel-content"><section class="cartazista-control-section"><div class="cartazista-control-heading"><span>COLE A LISTA DE PRODUTOS</span></div><textarea v-model="listInput" class="cartazista-list-input" placeholder="ARROZ CAMIL 5KG 29,99&#10;FEIJÃO KICALDO 1KG 7,99&#10;BANANA PRATA KG 5,99" /><button class="cartazista-button primary cartazista-full-button" @click="importProducts">Importar lista</button><p class="cartazista-help">Aceita preço no fim da linha, separado por espaço, vírgula, ponto e vírgula ou “R$”.</p></section><section class="cartazista-control-section"><div class="cartazista-control-heading"><span>CONFERÊNCIA · {{ doc.products.length }}</span><button class="cartazista-link-button" @click="addProduct">+ adicionar</button></div><article v-for="product in doc.products" :key="product.id" :class="['cartazista-product-row', { selected: product.id === doc.activeProductId }]" @click="selectProduct(product)"><div class="cartazista-product-row-head"><strong>{{ product.name }}</strong><button class="cartazista-remove-button" :disabled="doc.products.length <= 1" aria-label="Remover produto" @click.stop="removeProduct(product)"><Trash2 :size="15" /></button></div><div class="cartazista-product-fields"><label>Nome<input :value="product.name" @change="updateProduct(product, 'name', ($event.target as HTMLInputElement).value)" /></label><label>Preço<input :value="product.price" inputmode="decimal" @change="updateProduct(product, 'price', ($event.target as HTMLInputElement).value)" /></label></div><div class="cartazista-product-fields"><label>De (opcional)<input :value="product.oldPrice || ''" inputmode="decimal" @change="updateProduct(product, 'oldPrice', ($event.target as HTMLInputElement).value)" /></label><label>Unidade<input :value="product.unit || 'un'" @change="updateProduct(product, 'unit', ($event.target as HTMLInputElement).value)" /></label></div><label class="cartazista-toggle compact"><input type="checkbox" :checked="product.nearExpiry" @change="updateProduct(product, 'nearExpiry', String(($event.target as HTMLInputElement).checked))" /><span>Próximo da validade</span></label></article></section></div>

          <div v-else class="cartazista-panel-content"><section class="cartazista-control-section"><div class="cartazista-control-heading"><span>CAMADAS EDITÁVEIS</span><Layers :size="15" /></div><p class="cartazista-help">Arraste textos e formas no canvas. O histórico deste editor é separado dos encartes de oferta.</p><button v-for="layer in doc.composition.layers.slice().reverse()" :key="layer.id" :class="['cartazista-layer-row', { selected: selectedId === layer.id }]" @click="selectedId = layer.id"><span :class="{ muted: !layer.visible }">{{ layer.name.replace(/^cartaz-/, '').replaceAll('-', ' ') }}</span><Lock v-if="layer.locked" :size="13" /><span v-else class="cartazista-layer-kind">{{ layer.kind }}</span></button></section><section v-if="selectedLayer" class="cartazista-control-section"><div class="cartazista-control-heading"><span>INSPECTOR</span></div><label v-if="selectedLayer.kind === 'text'" class="cartazista-field-label">Texto<textarea :value="selectedLayer.text" @change="patchLayer('text', ($event.target as HTMLTextAreaElement).value)" /></label><label class="cartazista-field-label">Cor<input type="color" :value="selectedLayer.fill" @input="patchLayer('fill', ($event.target as HTMLInputElement).value)" /></label><label v-if="selectedLayer.kind === 'text'" class="cartazista-field-label">Tamanho<input type="number" min="6" max="1000" :value="selectedLayer.fontSize || 48" @change="patchLayer('fontSize', Number(($event.target as HTMLInputElement).value))" /></label><div class="cartazista-inspector-actions"><button class="cartazista-button ghost" @click="patchLayer('visible', !selectedLayer.visible)">{{ selectedLayer.visible ? 'Ocultar' : 'Mostrar' }}</button><button class="cartazista-button ghost" @click="patchLayer('locked', !selectedLayer.locked)">{{ selectedLayer.locked ? 'Desbloquear' : 'Bloquear' }}</button></div></section></div>
        </aside>

        <main class="cartazista-canvas-area"><div class="cartazista-canvas-head"><div><span class="cartazista-model-category">{{ model.category }}</span><h1>{{ model.name }}</h1><p>{{ format.label }} · {{ doc.settings.orientation === 'landscape' ? 'paisagem' : 'retrato' }} · {{ doc.products.length }} produto(s)</p></div><div class="cartazista-canvas-head-actions"><button class="cartazista-button secondary" @click="openPrint"><Printer :size="17" /> Imprimir todos</button><button class="cartazista-button primary" @click="exportPng"><Download :size="17" /> PNG atual</button></div></div><div class="cartazista-canvas-frame"><ClientOnly><ArtCanvas ref="canvas" :composition="doc.composition" :selected-id="selectedId" @select="selectedId = $event" @change="updateComposition" @error="error = $event" /></ClientOnly></div><div class="cartazista-canvas-tip"><Sparkles :size="15" /><span>O cartaz atual mostra <b>{{ activeProduct?.name }}</b>. Para gerar todos, use “Imprimir todos”.</span></div></main>
      </div>

      <dialog ref="printDialog" class="cartazista-print-dialog"><CartazistaSheetPreview :compositions="printableCompositions" :format="format" :columns="format.sheetColumns" /><button class="cartazista-print-close cartazista-button ghost" @click="printDialog?.close()">Fechar prévia</button></dialog>
    </div>
  </CartazistaShell>
</template>

<style>
.cartazista-editor-page { min-height: calc(100vh - 76px); background: #f2f6fa; }
.cartazista-editor-toolbar { min-height: 66px; display: flex; align-items: center; gap: 16px; padding: 10px 22px; background: #fff; border-bottom: 1px solid #dce4ec; }.cartazista-back-link { display: inline-flex; align-items: center; gap: 7px; color: #5c6c7e; text-decoration: none; font-size: 13px; font-weight: 800; }.cartazista-title-field { flex: 1; min-width: 0; }.cartazista-title-field input { display: block; width: 100%; max-width: 430px; border: 0; outline: 0; color: #182638; font: inherit; font-size: 16px; font-weight: 800; }.cartazista-title-field span { display: block; margin-top: 3px; color: #8493a2; font-size: 11px; }.cartazista-editor-actions { display: flex; gap: 7px; }.cartazista-editor-actions .cartazista-button { padding: 10px 12px; }.cartazista-editor-error { margin: 14px 22px 0; padding: 11px 14px; border-radius: 10px; background: #fff0f2; color: #a9283c; border: 1px solid #f5c7cf; font-size: 13px; }.cartazista-editor-error button { float: right; border: 0; background: transparent; color: inherit; font-weight: 800; cursor: pointer; }.cartazista-editor-loading { padding: 90px 20px; text-align: center; color: #728296; }
.cartazista-editor-layout { display: grid; grid-template-columns: minmax(280px, 350px) minmax(0, 1fr); min-height: calc(100vh - 142px); }.cartazista-panel { background: #fff; border-right: 1px solid #dce4ec; }.cartazista-panel-tabs { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid #e3e9ee; padding: 0 12px; }.cartazista-panel-tabs button { border: 0; border-bottom: 3px solid transparent; padding: 16px 3px 13px; background: transparent; color: #7a8999; font: inherit; font-size: 11px; font-weight: 900; cursor: pointer; }.cartazista-panel-tabs button.active { color: #1d64bf; border-color: #2b80e9; }.cartazista-panel-tabs span { display: inline-grid; place-items: center; min-width: 17px; height: 17px; margin-left: 3px; padding: 0 4px; border-radius: 99px; background: #eaf3ff; color: #1c67c7; }.cartazista-panel-content { padding: 18px 18px 40px; max-height: calc(100vh - 195px); overflow-y: auto; }.cartazista-control-section { padding-bottom: 21px; margin-bottom: 20px; border-bottom: 1px solid #edf0f3; }.cartazista-control-section:last-child { border-bottom: 0; }.cartazista-control-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; color: #788798; font-size: 10px; font-weight: 900; letter-spacing: .12em; }.cartazista-control-heading svg { color: #2b7de1; }.cartazista-select, .cartazista-field-label input, .cartazista-field-label textarea, .cartazista-product-fields input { display: block; width: 100%; border: 1px solid #d8e1ea; border-radius: 9px; padding: 10px 11px; outline: 0; color: #25374b; background: #fff; font: inherit; font-size: 12px; }.cartazista-select:focus, .cartazista-field-label input:focus, .cartazista-field-label textarea:focus, .cartazista-product-fields input:focus, .cartazista-list-input:focus { border-color: #5c9ff0; box-shadow: 0 0 0 3px #3687ef15; }.cartazista-help { margin: 8px 0 0; color: #8794a3; font-size: 11px; line-height: 1.45; }.cartazista-segmented { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 10px; padding: 4px; background: #eff3f7; border-radius: 10px; }.cartazista-segmented button { border: 0; border-radius: 7px; padding: 8px; color: #738396; background: transparent; font: inherit; font-size: 11px; font-weight: 800; cursor: pointer; }.cartazista-segmented button.active { color: #1e63bc; background: #fff; box-shadow: 0 3px 9px #173a5b10; }.cartazista-theme-row { display: flex; gap: 8px; margin-top: 12px; }.cartazista-theme-dot { display: block; width: 25px; height: 25px; border: 3px solid transparent; outline: 1px solid #d8e0e8; border-radius: 50%; cursor: pointer; }.cartazista-theme-dot.active { outline: 2px solid #2a7de0; outline-offset: 2px; }.cartazista-field-label { display: block; margin-top: 10px; color: #647487; font-size: 11px; font-weight: 800; }.cartazista-field-label input, .cartazista-field-label textarea { margin-top: 5px; }.cartazista-field-label textarea { min-height: 70px; resize: vertical; }.cartazista-toggle { display: flex; align-items: start; gap: 8px; margin-top: 12px; color: #647487; font-size: 11px; line-height: 1.35; cursor: pointer; }.cartazista-toggle input { margin-top: 1px; accent-color: #287be0; }.cartazista-list-input { width: 100%; min-height: 184px; padding: 12px; border: 1px solid #d8e1ea; border-radius: 10px; outline: 0; resize: vertical; color: #25374b; background: #fbfdff; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }.cartazista-full-button { width: 100%; margin-top: 10px; }.cartazista-link-button { border: 0; color: #2476e8; background: transparent; font: inherit; font-size: 11px; font-weight: 800; cursor: pointer; }.cartazista-product-row { margin-top: 10px; padding: 12px; border: 1px solid #e0e7ee; border-radius: 11px; background: #fff; cursor: pointer; }.cartazista-product-row.selected { border-color: #4992e9; box-shadow: 0 0 0 3px #4992e915; }.cartazista-product-row-head { display: flex; justify-content: space-between; align-items: start; gap: 8px; }.cartazista-product-row-head strong { color: #243548; font-size: 12px; line-height: 1.25; }.cartazista-remove-button { border: 0; color: #b64a59; background: transparent; cursor: pointer; }.cartazista-remove-button:disabled { opacity: .35; cursor: not-allowed; }.cartazista-product-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-top: 8px; }.cartazista-product-fields label { color: #8a98a7; font-size: 10px; font-weight: 700; }.cartazista-product-fields input { margin-top: 3px; padding: 7px 8px; font-size: 11px; }.cartazista-toggle.compact { font-size: 10px; }
.cartazista-layer-row { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 8px; margin-top: 4px; padding: 9px 10px; border: 1px solid transparent; border-radius: 8px; color: #516274; background: #f7f9fb; font: inherit; font-size: 11px; text-align: left; cursor: pointer; }.cartazista-layer-row:hover, .cartazista-layer-row.selected { border-color: #b9d6f6; color: #155fb9; background: #edf6ff; }.cartazista-layer-kind { color: #9ba7b3; font-size: 9px; text-transform: uppercase; }.cartazista-layer-row .muted { opacity: .45; }.cartazista-inspector-actions { display: flex; gap: 7px; margin-top: 12px; }.cartazista-inspector-actions .cartazista-button { flex: 1; padding: 9px 8px; font-size: 11px; }
.cartazista-canvas-area { min-width: 0; display: flex; flex-direction: column; padding: 28px clamp(18px, 4vw, 58px) 34px; }.cartazista-canvas-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 20px; }.cartazista-canvas-head h1 { margin: 5px 0 4px; color: #1b2e42; font-size: 25px; letter-spacing: -.04em; }.cartazista-canvas-head p { margin: 0; color: #7e8c9b; font-size: 12px; }.cartazista-canvas-head-actions { display: flex; gap: 8px; }.cartazista-canvas-frame { flex: 1; min-height: 620px; overflow: hidden; border: 1px solid #d7e0e8; border-radius: 18px; background: #e7edf3; box-shadow: 0 18px 50px #122c4910; }.cartazista-canvas-frame :deep(.art-canvas-host) { min-height: 620px; }.cartazista-canvas-tip { display: flex; align-items: center; gap: 8px; margin-top: 12px; color: #718194; font-size: 12px; }.cartazista-canvas-tip svg { color: #287ce0; }.cartazista-canvas-tip b { color: #425b72; }.cartazista-print-dialog { width: min(1100px, calc(100vw - 28px)); height: min(90vh, 900px); padding: 0; border: 0; border-radius: 16px; overflow: auto; box-shadow: 0 30px 100px #10233e45; }.cartazista-print-dialog::backdrop { background: #0d1c2c80; backdrop-filter: blur(4px); }.cartazista-print-close { position: sticky; bottom: 16px; left: calc(100% - 150px); margin: 0 16px 16px auto; display: flex; background: #fff; }.cartazista-print-dialog:focus { outline: 0; }
@media (max-width: 1000px) { .cartazista-editor-layout { grid-template-columns: minmax(260px, 320px) minmax(0,1fr); }.cartazista-editor-actions .cartazista-button { padding: 9px; }.cartazista-editor-actions .cartazista-button svg + * { display: none; }.cartazista-canvas-head { align-items: start; flex-direction: column; }.cartazista-canvas-head-actions { width: 100%; }.cartazista-canvas-head-actions .cartazista-button { flex: 1; } }
@media (max-width: 760px) { .cartazista-editor-toolbar { padding: 9px 12px; gap: 10px; }.cartazista-back-link { font-size: 0; }.cartazista-back-link svg { width: 20px; height: 20px; }.cartazista-title-field input { font-size: 14px; }.cartazista-editor-layout { display: flex; flex-direction: column; }.cartazista-panel { border-right: 0; border-bottom: 1px solid #dce4ec; order: 2; }.cartazista-panel-content { max-height: none; }.cartazista-canvas-area { order: 1; padding: 20px 12px 28px; }.cartazista-canvas-frame, .cartazista-canvas-frame :deep(.art-canvas-host) { min-height: 480px; }.cartazista-editor-actions .cartazista-button { padding: 9px 10px; }.cartazista-editor-actions .cartazista-button:nth-child(3) { display: none; }.cartazista-canvas-head-actions .cartazista-button { font-size: 12px; } }
@media print { :global(body > *) { display: none !important; } :global(body) { background: #fff !important; } .cartazista-shell, .cartazista-editor-page, .cartazista-print-dialog { display: block !important; } .cartazista-editor-page > :not(.cartazista-print-dialog), .cartazista-print-dialog::backdrop { display: none !important; } .cartazista-print-dialog { position: static; width: 100%; height: auto; max-width: none; max-height: none; border-radius: 0; overflow: visible; box-shadow: none; } .cartazista-print-close { display: none !important; } }
</style>
