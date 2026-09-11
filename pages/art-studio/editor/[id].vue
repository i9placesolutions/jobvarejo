<script setup lang="ts">
import {
  ArrowLeft,
  Download,
  Save,
  Undo2,
  Redo2,
  Type,
  ImagePlus,
  Shapes,
  Heart,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  X,
  Upload,
  Settings2,
  Layers,
  Store
} from 'lucide-vue-next'
import ArtShell from '~/components/art-studio/ArtShell.vue'
import {
  ART_FONTS,
  ART_CATEGORIES,
  ART_ICONS,
  ART_FORMATS,
  type ArtComposition,
  type ArtDesign,
  type ArtLayer,
  type ArtTemplate
} from '~/types/art-studio'
import {
  artError,
  blankArt,
  cloneArt,
  newArtLayer,
  personalizeArt,
  resizeArt,
  stableArtString
} from '~/utils/art-studio/composition'
import { normalizeBusinessProfile } from '~/utils/businessProfile'
const ArtCanvas = defineAsyncComponent(
  () => import('~/components/art-studio/ArtCanvas.client.vue')
)
definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false,
  key: (route) => route.fullPath
})
useHead({ title: 'Editor de Artes • JobVarejo' })
const route = useRoute(),
  auth = useAuth()
const doc = ref<ArtComposition>(blankArt()),
  name = ref('Minha nova arte'),
  selectedId = ref<string | null>(null)
const formatBusy = ref(false),
  batchSizes = ref<string[]>(ART_FORMATS.map((f) => `${f.width}x${f.height}`)),
  formatDialog = ref<HTMLDialogElement>(),
  generatorDialog = ref<HTMLDialogElement>()
const brief = ref({
  title: 'VOCÊ FAZ PARTE DA NOSSA HISTÓRIA.',
  message: 'Obrigado por escolher estar com a gente.',
  theme: 'DIA DO CLIENTE',
  background: '#173f35',
  color: '#eff8cb'
})
const allFormats = computed(() => [doc.value, ...(doc.value.alternates || [])])
const selected = computed(() =>
  doc.value.layers.find((l) => l.id === selectedId.value)
)
const ready = ref(false),
  loading = ref(true),
  error = ref(''),
  saveState = ref(''),
  busy = ref(false),
  conflict = ref(false)
const designId = ref<string>(''),
  revision = ref(0),
  templateId = ref<string | null>(null)
const canvas = ref<{ exportPng: () => Promise<string>; refreshImages: () => Promise<void> }>(),
  uploadInput = ref<HTMLInputElement>(),
  uploading = ref(false),
  imageTarget = ref<string | null>(null)
const jsonInput = ref<HTMLInputElement>()
const importComposition = async (event: Event) => {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  try {
    if (file.size > 2 * 1024 * 1024)
      throw new Error('Composição muito grande. Limite de 2 MB.')
    const validated = await $fetch<ArtComposition>('/api/art-studio/validate', {
      method: 'POST',
      body: JSON.parse(await file.text())
    })
    doc.value = validated
    selectedId.value = null
  } catch (e) {
    error.value = artError(e)
  } finally {
    input.value = ''
  }
}
const mobilePanel = ref<'layers' | 'properties'>('properties')
const profile = ref<Record<string, string>>({}),
  hasLogo = ref(false)
const history = ref<string[]>([]),
  historyIndex = ref(-1),
  restoring = ref(false)
const templateDialog = ref<HTMLDialogElement>(),
  templateName = ref(''),
  templateCategory = ref<string>('Divulgação'),
  templateCollection = ref(''),
  templateTags = ref(''),
  publish = ref(true),
  editingTemplate = ref<ArtTemplate | null>(null)
const managing = computed(
  () => auth.isSuperAdmin.value && route.query.manage === '1'
)
let autoSave: ReturnType<typeof setTimeout> | undefined,
  savedFingerprint = '',
  stopped = false,
  creationId = '',
  queued = false
const recovery = ref<{
  name: string
  composition: ArtComposition
  revision: number
} | null>(null)
const draftKey = computed(
  () =>
    `jobvarejo:art-studio:${auth.user.value?.id}:${String(route.params.id)}:${String(route.query.template || 'blank')}:${managing.value ? 'template' : 'design'}`
)
const fingerprint = () =>
  stableArtString({
    name: name.value.trim() || 'Minha arte',
    composition: doc.value
  })
const dirty = computed(
  () =>
    ready.value &&
    saveState.value !== 'Salvo' &&
    saveState.value !== 'Modelo salvo'
)
const keepDraft = () => {
  try {
    localStorage.setItem(
      draftKey.value,
      JSON.stringify({
        name: name.value,
        composition: doc.value,
        revision: revision.value,
        at: Date.now()
      })
    )
  } catch {
    saveState.value = 'Alterações pendentes; armazenamento local indisponível'
  }
}
const snapshot = () => {
  if (!ready.value || restoring.value) return
  const state = JSON.stringify(doc.value)
  if (history.value[historyIndex.value] !== state) {
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(state)
    if (history.value.length > 60) history.value.shift()
    historyIndex.value = history.value.length - 1
  }
  keepDraft()
  saveState.value = 'Alterações pendentes'
  clearTimeout(autoSave)
  if (!managing.value && !conflict.value)
    autoSave = setTimeout(() => void save(), 2000)
}
watch(doc, snapshot, { deep: true })
watch(name, snapshot)
const apply = (value: ArtComposition) => {
  doc.value = value
}
const patch = (updates: Partial<ArtLayer>) => {
  if (!selected.value) return
  const next = cloneArt(doc.value)
  Object.assign(
    next.layers.find((l) => l.id === selectedId.value)!,
    updates
  )
  doc.value = next
}
const numeric = (
  key:
    | 'x'
    | 'y'
    | 'width'
    | 'height'
    | 'rotation'
    | 'fontSize'
    | 'opacity'
    | 'cropX'
    | 'cropY',
  event: Event
) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  const bounds: Record<string, [number, number]> = {
    x: [-8192, 8192],
    y: [-8192, 8192],
    width: [1, 8192],
    height: [1, 8192],
    rotation: [-360, 360],
    fontSize: [6, 1000],
    opacity: [0, 1],
    cropX: [0, 1],
    cropY: [0, 1]
  }
  const [min, max] = bounds[key]!
  patch({ [key]: Math.min(max, Math.max(min, value)) })
}
const add = (kind: ArtLayer['kind']) => {
  const layer = newArtLayer(kind)
  doc.value = { ...cloneArt(doc.value), layers: [...doc.value.layers, layer] }
  selectedId.value = layer.id
  mobilePanel.value = 'properties'
}
const remove = () => {
  if (!selected.value) return
  doc.value = {
    ...doc.value,
    layers: doc.value.layers.filter((l) => l.id !== selectedId.value)
  }
  selectedId.value = null
}
const duplicate = () => {
  if (!selected.value) return
  const layer = {
    ...cloneArt(selected.value),
    id: crypto.randomUUID(),
    x: selected.value.x + 30,
    y: selected.value.y + 30,
    name: `${selected.value.name} (cópia)`
  }
  doc.value = { ...doc.value, layers: [...doc.value.layers, layer] }
  selectedId.value = layer.id
}
const reorder = (direction: number) => {
  const layers = [...doc.value.layers],
    i = layers.findIndex((l) => l.id === selectedId.value),
    j = i + direction
  if (i < 0 || j < 0 || j >= layers.length) return
  ;[layers[i], layers[j]] = [layers[j]!, layers[i]!]
  doc.value = { ...doc.value, layers }
}
const historyMove = async (direction: number) => {
  const target = historyIndex.value + direction
  if (target < 0 || target >= history.value.length) return
  restoring.value = true
  historyIndex.value = target
  doc.value = JSON.parse(history.value[target]!)
  selectedId.value = null
  await nextTick()
  restoring.value = false
  snapshot()
}
async function save(asCopy = false) {
  if (!ready.value || stopped) return
  if (busy.value) {
    queued = true
    return
  }
  if (managing.value && !asCopy) {
    await openTemplateDialog()
    return
  }
  if (conflict.value && !asCopy) return
  clearTimeout(autoSave)
  busy.value = true
  error.value = ''
  const stamp = fingerprint(),
    body = {
      name: name.value.trim() || 'Minha arte',
      composition: cloneArt(doc.value),
      template_id: templateId.value
    }
  const id = asCopy ? '' : designId.value
  try {
    const result = id
      ? await $fetch<ArtDesign>(`/api/art-studio/designs/${id}`, {
          method: 'PUT',
          body: { ...body, revision: revision.value }
        })
      : await $fetch<ArtDesign>('/api/art-studio/designs', {
          method: 'POST',
          body: { ...body, id: asCopy ? crypto.randomUUID() : creationId }
        })
    if (stopped) return
    designId.value = result.id
    revision.value = result.revision
    conflict.value = false
    // Um POST repetido pode recuperar uma criação anterior após timeout. Não tratar novos dados como salvos.
    const resultFingerprint = stableArtString({
      name: result.name,
      composition: result.composition
    })
    savedFingerprint = resultFingerprint
    if (fingerprint() === resultFingerprint) {
      saveState.value = 'Salvo'
      localStorage.removeItem(draftKey.value)
    } else {
      saveState.value = 'Alterações pendentes'
      keepDraft()
      queued = true
    }
    if (asCopy && fingerprint() === resultFingerprint) {
      await navigateTo(`/art-studio/editor/${result.id}`)
    }
  } catch (e: any) {
    error.value = artError(e)
    conflict.value = e?.status === 409 || e?.statusCode === 409
    saveState.value = conflict.value
      ? 'Conflito · rascunho preservado'
      : 'Falha ao salvar · rascunho local'
    keepDraft()
  } finally {
    busy.value = false
    if (queued && !stopped && !conflict.value) {
      queued = false
      autoSave = setTimeout(() => void save(), 500)
    }
  }
}
const restoreDraft = () => {
  if (!recovery.value) return
  name.value = recovery.value.name
  doc.value = cloneArt(recovery.value.composition)
  if (recovery.value.revision && recovery.value.revision !== revision.value) {
    conflict.value = true
    error.value =
      'Há uma versão mais recente no servidor. Salve este rascunho como cópia para preservar as duas.'
  }
  recovery.value = null
  snapshot()
}
const dismissDraft = () => {
  recovery.value = null
  localStorage.removeItem(draftKey.value)
}
const chooseImage = (id?: string) => {
  imageTarget.value = id || null
  uploadInput.value?.click()
}
const uploadImage = async (event: Event) => {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    error.value = 'Envie uma imagem de até 10 MB.'
    input.value = ''
    return
  }
  uploading.value = true
  error.value = ''
  try {
    const body = new FormData()
    body.append('file', file)
    const result = await $fetch<{ src: string }>('/api/art-studio/assets', {
      method: 'POST',
      body
    })
    const next = cloneArt(doc.value)
    let layer = next.layers.find((l) => l.id === imageTarget.value)
    if (!layer) {
      layer = newArtLayer('image')
      next.layers.push(layer)
    }
    layer.src = result.src
    layer.kind = 'image'
    layer.name = file.name.slice(0, 100)
    layer.binding = ''
    doc.value = next
    selectedId.value = layer.id
  } catch (e) {
    error.value = artError(e)
  } finally {
    uploading.value = false
    input.value = ''
  }
}
const loadBrand = async () => {
  const data = await $fetch<{ business_profile: unknown }>('/api/profile')
  const business = normalizeBusinessProfile(data.business_profile)
  hasLogo.value = !!business.logo
  profile.value = {
    companyName: business.companyName,
    logo: business.logo ? '/api/art-studio/brand-logo' : '',
    phone: business.whatsapp || business.phone,
    address: business.address,
    instagram: business.instagram,
    date: new Date().toLocaleDateString('pt-BR')
  }
}
const applyBrand = async () => {
  try {
    await loadBrand()
    doc.value = personalizeArt(doc.value, profile.value)
    await nextTick(); await canvas.value?.refreshImages()
    saveState.value = 'Alterações pendentes'
  } catch (e) {
    error.value = artError(e)
  }
}
const addLogo = () => {
  const next = cloneArt(doc.value),
    layer = newArtLayer('image')
  layer.name = 'Logo da loja'
  layer.binding = 'logo'
  layer.src = managing.value
    ? ''
    : hasLogo.value
      ? '/api/art-studio/brand-logo'
      : ''
  next.layers.push(layer)
  doc.value = next
  selectedId.value = layer.id
}
const setBinding = (event: Event) => {
  const binding = (event.target as HTMLSelectElement)
    .value as ArtLayer['binding']
  if (!selected.value) return
  const updates: Partial<ArtLayer> = { binding }
  if (selected.value.kind === 'image' && binding === 'logo')
    updates.fit = 'contain'
  if (selected.value.kind === 'image' && binding === 'logo')
    updates.src = managing.value
      ? ''
      : hasLogo.value
        ? '/api/art-studio/brand-logo'
        : ''
  else if (
    binding &&
    selected.value.kind === 'text' &&
    profile.value[binding] &&
    !managing.value
  )
    updates.text = profile.value[binding]
  patch(updates)
}
const exportPng = async () => {
  error.value = ''
  try {
    const href = await canvas.value?.exportPng()
    if (!href) throw new Error('Aguarde o editor carregar.')
    const link = document.createElement('a')
    link.href = href
    link.download = `${name.value.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 100) || 'arte'}.png`
    link.click()
  } catch (e) {
    error.value = artError(e)
  }
}
const downloadJson = () => {
  const blob = new Blob([JSON.stringify(doc.value, null, 2)], {
      type: 'application/json'
    }),
    url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = 'composicao-arte.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const switchFormat = (width: number, height: number) => {
  const pages = allFormats.value.map((p) => {
      const copy = cloneArt(p)
      delete copy.alternates
      return copy
    }),
    chosen = pages.find((p) => p.width === width && p.height === height)
  if (!chosen) return
  doc.value = { ...chosen, alternates: pages.filter((p) => p !== chosen) }
  selectedId.value = null
}
const requestedFormats = () =>
  batchSizes.value.map((size) => {
    const [width, height] = size.split('x').map(Number)
    return { width: width!, height: height! }
  })
const generateFormats = async () => {
  formatBusy.value = true
  error.value = ''
  try {
    const existing = allFormats.value.map((p) => `${p.width}x${p.height}`),
      missing = requestedFormats().filter(
        (f) => !existing.includes(`${f.width}x${f.height}`)
      )
    if (missing.length) {
      const result = await $fetch<{ compositions: ArtComposition[] }>(
        '/api/art-studio/compose',
        { method: 'POST', body: { composition: doc.value, formats: missing } }
      )
      doc.value = {
        ...doc.value,
        alternates: [...(doc.value.alternates || []), ...result.compositions]
      }
    }
    formatDialog.value?.close()
  } catch (e) {
    error.value = artError(e)
  } finally {
    formatBusy.value = false
  }
}
const removeFormat = () => {
  if (!doc.value.alternates?.length) return
  const [next, ...rest] = doc.value.alternates
  doc.value = { ...cloneArt(next!), alternates: cloneArt(rest) }
  selectedId.value = null
}
const changeFormat = async (event: Event) => {
  const size = (event.target as HTMLSelectElement).value,
    [w, h] = size.split('x').map(Number)
  if (!allFormats.value.some((p) => p.width === w && p.height === h)) {
    batchSizes.value = [size]
    await generateFormats()
  }
  switchFormat(w!, h!)
}
const generateFromBrief = async () => {
  formatBusy.value = true
  error.value = ''
  try {
    const result = await $fetch<{ compositions: ArtComposition[] }>(
      '/api/art-studio/generate',
      { method: 'POST', body: { ...brief.value, formats: requestedFormats() } }
    )
    const [first, ...rest] = result.compositions
    if (!first) throw new Error('Nenhuma composição retornada.')
    doc.value = { ...first, alternates: rest }
    name.value = brief.value.theme || 'Novo modelo'
    selectedId.value = null
    generatorDialog.value?.close()
  } catch (e) {
    error.value = artError(e)
  } finally {
    formatBusy.value = false
  }
}
const exportBatch = async () => {
  formatBusy.value = true
  error.value = ''
  try {
    const compositions = allFormats.value.map((page) => {
      const copy = cloneArt(page)
      delete copy.alternates
      return copy
    })
    const blob = await $fetch<Blob>('/api/art-studio/render', {
      method: 'POST',
      body: { compositions },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(blob),
      link = document.createElement('a')
    link.href = url
    link.download =
      compositions.length > 1 ? 'artes-formatos.zip' : 'arte-python.png'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    error.value = artError(e)
  } finally {
    formatBusy.value = false
  }
}
const openTemplateDialog = async () => {
  templateName.value = editingTemplate.value?.name || name.value
  await nextTick()
  templateDialog.value?.showModal()
}
const saveTemplate = async () => {
  if (!auth.isSuperAdmin.value || busy.value) return
  busy.value = true
  error.value = ''
  const templateStamp = fingerprint()
  const composition = cloneArt(doc.value)
  // Campo dinâmico de logo nunca publica a imagem de uma loja como logo de todos os clientes.
  ;[composition, ...(composition.alternates || [])]
    .flatMap((page) => page.layers)
    .forEach((l) => {
      if (l.binding === 'logo' && l.kind === 'image') l.src = ''
      if (l.binding && l.kind === 'text')
        l.text =
          {
            companyName: 'Sua empresa',
            phone: 'Seu telefone',
            address: 'Seu endereço',
            instagram: '@suaempresa',
            date: 'Sua data',
            logo: ''
          }[l.binding] || l.text
    })
  const body = {
    name: templateName.value,
    category: templateCategory.value,
    collection: templateCollection.value,
    tags: templateTags.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    published: publish.value,
    composition
  }
  try {
    const existing =
      editingTemplate.value && !editingTemplate.value.id.startsWith('starter-')
        ? editingTemplate.value
        : null
    const result = existing
      ? await $fetch<ArtTemplate>(`/api/art-studio/templates/${existing.id}`, {
          method: 'PUT',
          body: { ...body, revision: existing.revision }
        })
      : await $fetch<ArtTemplate>('/api/art-studio/templates', {
          method: 'POST',
          body
        })
    editingTemplate.value = result
    saveState.value =
      fingerprint() === templateStamp ? 'Modelo salvo' : 'Alterações pendentes'
    if (managing.value && fingerprint() === templateStamp) {
      savedFingerprint = templateStamp
      localStorage.removeItem(draftKey.value)
    }
    templateDialog.value?.close()
  } catch (e) {
    error.value = artError(e)
  } finally {
    busy.value = false
  }
}
const keys = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement
  if (
    target.closest('input,textarea,select,[contenteditable=true]') ||
    target.tagName === 'CANVAS'
  )
    return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    remove()
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    void historyMove(event.shiftKey ? 1 : -1)
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save()
  }
}
const unload = (event: BeforeUnloadEvent) => {
  if (ready.value && fingerprint() !== savedFingerprint) {
    keepDraft()
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(() => {
  if (ready.value && fingerprint() !== savedFingerprint) {
    keepDraft()
    return window.confirm(
      'Há alterações não salvas no servidor. O rascunho fica neste navegador. Deseja sair?'
    )
  }
})
onMounted(async () => {
  creationId = crypto.randomUUID()
  try {
    await loadBrand()
  } catch {
    error.value =
      'Não foi possível carregar os dados da loja. Você pode inserir os elementos manualmente.'
  }
  try {
    if (route.params.id !== 'new') {
      const design = await $fetch<ArtDesign>(
        `/api/art-studio/designs/${String(route.params.id)}`
      )
      doc.value = design.composition
      name.value = design.name
      designId.value = design.id
      revision.value = design.revision
      templateId.value = design.template_id || null
      saveState.value = 'Salvo'
    } else if (route.query.template) {
      const result = await $fetch<{ templates: ArtTemplate[] }>(
        '/api/art-studio/templates',
        { query: managing.value ? { admin: '1' } : {} }
      )
      const template = result.templates.find(
        (t) => t.id === route.query.template
      )
      if (!template)
        throw new Error(
          'Modelo não encontrado. Volte ao catálogo e escolha outro.'
        )
      templateId.value = template.id
      doc.value = cloneArt(template.composition)
      name.value = String(route.query.name || template.name)
      if (managing.value) {
        editingTemplate.value = template
        templateCategory.value = template.category
        templateCollection.value = template.collection
        templateTags.value = template.tags.join(', ')
        publish.value = template.published
      } else doc.value = personalizeArt(doc.value, profile.value)
    }

    if (route.params.id === 'new' && route.query.template && !managing.value) {
      const rawSizes = String(
        route.query.sizes ||
          route.query.size ||
          `${doc.value.width}x${doc.value.height}`
      ).split(',')
      const formats = rawSizes
        .filter((size) =>
          ART_FORMATS.some((f) => `${f.width}x${f.height}` === size)
        )
        .map((size) => {
          const [width, height] = size.split('x').map(Number)
          return { width: width!, height: height! }
        })
      if (formats.length) {
        const existing = [doc.value, ...(doc.value.alternates || [])],
          results: ArtComposition[] = []
        for (const format of formats) {
          const source =
            existing.find(
              (p) => p.width === format.width && p.height === format.height
            ) || doc.value
          const assembled = await $fetch<{ compositions: ArtComposition[] }>(
            '/api/art-studio/compose',
            { method: 'POST', body: { composition: source, formats: [format] } }
          )
          results.push(...assembled.compositions)
        }
        if (results[0])
          doc.value = { ...results[0], alternates: results.slice(1) }
      }
    }
    for (const layer of [doc.value, ...(doc.value.alternates || [])].flatMap(
      (page) => page.layers
    ))
      if (layer.kind === 'image' && layer.binding === 'logo')
        layer.src = managing.value ? '' : profile.value.logo || ''
    const raw = localStorage.getItem(draftKey.value)
    if (raw) {
      try {
        const draft = JSON.parse(raw)
        if (
          draft.composition?.version === 1 &&
          Array.isArray(draft.composition.layers) &&
          stableArtString({
            name: draft.name,
            composition: draft.composition
          }) !== fingerprint()
        )
          recovery.value = draft
      } catch {
        /* Ignora rascunho local inválido. */
      }
    }
    await nextTick()
    ready.value = true
    savedFingerprint = fingerprint()
    history.value = [JSON.stringify(doc.value)]
    historyIndex.value = 0
    if (!designId.value)
      saveState.value = managing.value ? 'Editando modelo' : 'Ainda não salva'
    window.addEventListener('keydown', keys)
    window.addEventListener('beforeunload', unload)
  } catch (e) {
    error.value = artError(e)
  } finally {
    loading.value = false
  }
})
onBeforeUnmount(() => {
  stopped = true
  clearTimeout(autoSave)
  window.removeEventListener('keydown', keys)
  window.removeEventListener('beforeunload', unload)
})
</script>
<template>
  <ArtShell>
    <div class="studio-toolbar">
      <NuxtLink
        :to="managing ? '/art-studio?tab=admin' : '/art-studio'"
        class="art-button back-catalog"
        ><ArrowLeft :size="16" /><span>Designs</span></NuxtLink
      >
      <div class="art-name">
        <input v-model="name" maxlength="150" aria-label="Nome da arte" /><small
          role="status"
          >{{ busy ? 'Salvando…' : saveState }}</small
        >
      </div>
      <div class="toolbar-history">
        <button
          class="art-button"
          aria-label="Desfazer"
          :disabled="historyIndex <= 0"
          @click="historyMove(-1)"
        >
          <Undo2 :size="17" /></button
        ><button
          class="art-button"
          aria-label="Refazer"
          :disabled="historyIndex >= history.length - 1"
          @click="historyMove(1)"
        >
          <Redo2 :size="17" />
        </button>
      </div>
      <button
        v-if="auth.isSuperAdmin.value"
        class="art-button template-button"
        :disabled="!ready"
        @click="openTemplateDialog"
      >
        <Settings2 :size="16" /><span>{{
          managing ? 'Publicar modelo' : 'Salvar como modelo'
        }}</span></button
      ><button class="art-button" :disabled="!ready || busy" @click="save()">
        <Save :size="16" /><span>Salvar</span></button
      ><button class="art-button primary" :disabled="!ready" @click="exportPng">
        <Download :size="16" /><span>Baixar PNG</span>
      </button>
    </div>
    <div v-if="managing" class="admin-banner">
      <Settings2 :size="16" /><strong>Editor do super admin</strong
      ><span
        >Defina as camadas e os campos dinâmicos. Publique quando o modelo
        estiver pronto.</span
      >
    </div>
    <div v-if="error" role="alert" class="art-alert editor-alert">
      {{ error }}
      <button v-if="conflict" class="art-button" @click="save(true)">
        Salvar rascunho como cópia</button
      ><button
        class="dismiss-error"
        aria-label="Fechar aviso"
        @click="error = ''"
      >
        <X :size="16" />
      </button>
    </div>
    <div v-if="recovery" class="art-alert recovery" role="status">
      Há um rascunho deste trabalho neste navegador.
      <button class="art-button" @click="restoreDraft">
        Recuperar alterações</button
      ><button class="art-button" @click="dismissDraft">
        Usar versão salva
      </button>
    </div>
    <div v-if="loading" class="art-empty" role="status">
      Preparando seu espaço de criação…
    </div>
    <div v-else-if="ready" class="studio-workspace">
      <aside
        class="studio-layers"
        :class="{ 'mobile-open': mobilePanel === 'layers' }"
      >
        <div class="panel-title">
          <h2>Adicionar à arte</h2>
          <Layers :size="16" />
        </div>
        <div class="add-grid">
          <button @click="add('text')"><Type /><span>Texto</span></button
          ><button :disabled="uploading" @click="chooseImage()">
            <ImagePlus /><span>Imagem</span></button
          ><button @click="add('icon')"><Heart /><span>Ícone</span></button
          ><button @click="add('shape')"><Shapes /><span>Forma</span></button
          ><button class="logo-add" @click="addLogo">
            <Store /><span>Logo da loja</span>
          </button>
        </div>
        <div class="panel-title layers-title">
          <h2>Camadas</h2>
          <small>{{ doc.layers.length }}</small>
        </div>
        <p class="panel-help">Selecione um elemento para editar.</p>
        <div class="layer-list">
          <div
            v-for="layer in [...doc.layers].reverse()"
            :key="layer.id"
            :class="['layer-item', { active: selectedId === layer.id }]"
          >
            <button
              class="layer-select"
              @click="
                selectedId = layer.id;
                mobilePanel = 'properties'
              "
            >
              <Type v-if="layer.kind === 'text'" :size="15" /><ImagePlus
                v-else-if="layer.kind === 'image'"
                :size="15"
              /><Shapes v-else :size="15" /><span>{{ layer.name }}</span
              ><small v-if="layer.binding">DINÂMICO</small></button
            ><button
              :aria-label="layer.visible ? 'Ocultar camada' : 'Mostrar camada'"
              @click="
                selectedId = layer.id;
                patch({ visible: !layer.visible })
              "
            >
              <Eye v-if="layer.visible" :size="13" /><EyeOff
                v-else
                :size="13"
              /></button
            ><button
              :aria-label="
                layer.locked ? 'Desbloquear camada' : 'Bloquear camada'
              "
              @click="
                selectedId = layer.id;
                patch({ locked: !layer.locked })
              "
            >
              <Lock v-if="layer.locked" :size="13" /><Unlock
                v-else
                :size="13"
              />
            </button>
          </div>
          <div v-if="!doc.layers.length" class="panel-help">
            Sua tela está pronta. Adicione o primeiro elemento.
          </div>
        </div>
        <div class="brand-note">
          <Store :size="20" /><strong>A marca do seu cliente</strong>
          <p>
            A logo dinâmica usa o cadastro da loja. A posição e o tamanho são
            definidos aqui.
          </p>
          <NuxtLink to="/business-profile">Abrir cadastro da loja ↗</NuxtLink>
        </div>
      </aside>
      <section class="canvas-section">
        <div class="canvas-topline">
          <span
            >{{ managing ? 'MODELO EDITÁVEL' : 'SUA ARTE' }} <b>·</b>
            {{ doc.width }} × {{ doc.height }} px</span
          ><span>Arraste para mover · Duplo clique para escrever</span>
        </div>
        <div class="canvas-area">
          <ClientOnly
            ><ArtCanvas
              ref="canvas"
              :composition="doc"
              :authoring="managing"
              :selected-id="selectedId"
              @change="apply"
              @select="selectedId = $event"
              @error="error = $event"
          /></ClientOnly>
        </div>
        <div class="format-pages">
          <button
            v-for="page in allFormats"
            :key="`${page.width}x${page.height}`"
            :class="{
              active: page.width === doc.width && page.height === doc.height
            }"
            @click="switchFormat(page.width, page.height)"
          >
            {{
              ART_FORMATS.find(
                (f) => f.width === page.width && f.height === page.height
              )?.label || 'Personalizado'
            }}
            <small>{{ page.width }} × {{ page.height }}</small></button
          ><button @click="formatDialog?.showModal()">
            <Plus :size="15" />Formatos
          </button>
        </div>
        <div class="canvas-bottomline">
          <span>{{
            formatBusy
              ? 'Python está preparando suas artes…'
              : 'Cada formato tem sua própria composição editável.'
          }}</span
          ><button @click="selectedId = null">Configurar página</button>
        </div>
      </section>
      <aside
        class="studio-properties"
        :class="{ 'mobile-open': mobilePanel === 'properties' }"
      >
        <div class="panel-title">
          <h2>{{ selected ? 'Personalizar elemento' : 'Sua composição' }}</h2>
          <Settings2 :size="16" />
        </div>
        <template v-if="selected"
          ><label class="field"
            >Nome da camada<input
              :value="selected.name"
              class="art-input"
              maxlength="100"
              @change="
                patch({ name: ($event.target as HTMLInputElement).value })
              "
          /></label>
          <div class="element-actions">
            <button
              class="art-button"
              title="Duplicar"
              aria-label="Duplicar elemento"
              @click="duplicate"
            >
              <Copy :size="16" /></button
            ><button
              class="art-button"
              title="Trazer para frente"
              aria-label="Trazer para frente"
              @click="reorder(1)"
            >
              <ArrowUp :size="16" /></button
            ><button
              class="art-button"
              title="Enviar para trás"
              aria-label="Enviar para trás"
              @click="reorder(-1)"
            >
              <ArrowDown :size="16" /></button
            ><button
              class="art-button"
              title="Excluir"
              aria-label="Excluir elemento"
              @click="remove"
            >
              <Trash2 :size="16" />
            </button>
          </div>
          <label v-if="selected.kind==='text'" class="field">Largura das letras (%)<input class="art-input" type="number" min="40" max="200" :value="Math.round((selected.fontScaleX || 1)*100)" @input="patch({fontScaleX:Number(($event.target as HTMLInputElement).value)/100})" /></label>
          <label v-if="selected.kind==='text'" class="field">Espaçamento entre linhas<input class="art-input" type="number" min="0.7" max="2.5" step="0.05" :value="selected.lineHeight ?? 1.16" @input="patch({lineHeight:Number(($event.target as HTMLInputElement).value)})" /></label>
          <template v-if="selected.kind === 'text'"
            ><label class="field"
              >Texto<textarea
                :value="selected.text"
                class="art-input"
                rows="4"
                maxlength="2000"
                @input="
                  patch({
                    text: ($event.target as HTMLTextAreaElement).value,
                    binding: ''
                  })
                "
              /></label
            ><label class="field"
              >Fonte<select
                :value="selected.fontFamily"
                class="art-input"
                @change="
                  patch({
                    fontFamily: ($event.target as HTMLSelectElement).value
                  })
                "
              >
                <option v-for="font in ART_FONTS" :key="font">
                  {{ font }}
                </option>
              </select></label
            >
            <div class="field-row">
              <label class="field"
                >Tamanho<input
                  :value="selected.fontSize"
                  type="number"
                  min="6"
                  max="1000"
                  class="art-input"
                  @change="numeric('fontSize', $event)" /></label
              ><label class="field"
                >Peso<select
                  :value="selected.fontWeight"
                  class="art-input"
                  @change="
                    patch({
                      fontWeight: Number(
                        ($event.target as HTMLSelectElement).value
                      )
                    })
                  "
                >
                  <option :value="400">Regular</option>
                  <option :value="600">Semibold</option>
                  <option :value="700">Negrito</option>
                  <option :value="800">Extra bold</option>
                </select></label
              >
            </div>
            <label class="field"
              >Alinhamento<select
                :value="selected.align"
                class="art-input"
                @change="
                  patch({
                    align: ($event.target as HTMLSelectElement)
                      .value as ArtLayer['align']
                  })
                "
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select></label
            >
            <p class="panel-help">
              Textos longos são reduzidos automaticamente para caber na altura
              da caixa.
            </p></template
          >
          <template v-if="selected.kind === 'image'">
            <template v-if="selected.binding === 'logo'">
              <label class="publish-check"
                ><input
                  type="checkbox"
                  :checked="selected.autoTrim !== false"
                  @change="
                    patch({
                      autoTrim: ($event.target as HTMLInputElement).checked
                    })
                  "
                />Auto trim da logo</label
              >
              <p class="panel-help">
                Remove margens transparentes e encaixa a marca inteira no
                espaço, sem distorcer.
              </p>
              <label class="field"
                >Fundo / container<select
                  :value="selected.logoBackdrop || 'none'"
                  class="art-input"
                  @change="
                    patch({
                      logoBackdrop: ($event.target as HTMLSelectElement)
                        .value as ArtLayer['logoBackdrop']
                    })
                  "
                >
                  <option value="none">Sem fundo</option>
                  <option value="square">Quadrado</option>
                  <option value="round">Redondo</option>
                  <option value="oval">Oval</option>
                </select></label
              >
              <label class="publish-check"
                ><input
                  type="checkbox"
                  :checked="selected.logoOutline === true"
                  @change="
                    patch({
                      logoOutline: ($event.target as HTMLInputElement).checked
                    })
                  "
                />Contorno da logo</label
              >
              <template v-if="selected.logoOutline"
                ><label class="field color-field"
                  >Cor do contorno<input
                    type="color"
                    :value="selected.logoOutlineColor || '#ffffff'"
                    @input="
                      patch({
                        logoOutlineColor: ($event.target as HTMLInputElement)
                          .value
                      })
                    " /></label
                ><label class="field"
                  >Espessura do contorno<input
                    type="number"
                    min="1"
                    max="40"
                    :value="selected.logoOutlineWidth || 4"
                    class="art-input"
                    @change="
                      patch({
                        logoOutlineWidth: Math.max(
                          1,
                          Math.min(
                            40,
                            Number(($event.target as HTMLInputElement).value) ||
                              4
                          )
                        )
                      })
                    " /></label
              ></template>
            </template>
            <div v-if="selected.binding === 'logo'" class="dynamic-note">
              <Store :size="17" /> Logo dinâmica do cadastro da loja.
            </div>
            <NuxtLink
              v-if="selected.binding === 'logo'"
              to="/business-profile"
              class="art-button full"
              >Trocar logo no cadastro da loja</NuxtLink
            >
            <button
              v-else
              class="art-button full"
              :disabled="uploading"
              @click="chooseImage(selected.id)"
            >
              <Upload :size="16" />{{
                uploading ? 'Enviando…' : 'Trocar imagem'
              }}</button
            ><label v-if="selected.binding !== 'logo'" class="field"
              >Enquadramento<select
                :value="selected.fit"
                class="art-input"
                @change="
                  patch({
                    fit: ($event.target as HTMLSelectElement)
                      .value as ArtLayer['fit']
                  })
                "
              >
                <option value="contain">Mostrar imagem inteira</option>
                <option value="cover">Preencher e recortar</option>
              </select></label
            ><template
              v-if="selected.fit === 'cover' && selected.binding !== 'logo'"
              ><label class="field"
                >Recorte horizontal<input
                  :value="selected.cropX ?? 0.5"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  @input="numeric('cropX', $event)" /></label
              ><label class="field"
                >Recorte vertical<input
                  :value="selected.cropY ?? 0.5"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  @input="numeric('cropY', $event)" /></label></template
          ></template>
          <label v-if="selected.kind === 'icon'" class="field"
            >Ícone<select
              :value="selected.icon"
              class="art-input"
              @change="
                patch({
                  icon: ($event.target as HTMLSelectElement)
                    .value as ArtLayer['icon']
                })
              "
            >
              <option v-for="(_, key) in ART_ICONS" :key="key" :value="key">
                {{
                  {
                    heart: 'Coração',
                    star: 'Estrela',
                    bolt: 'Raio',
                    check: 'Confirmação',
                    flower: 'Flor'
                  }[key]
                }}
              </option>
            </select></label
          ><button
            v-if="selected.kind === 'icon'"
            class="art-button full"
            @click="chooseImage(selected.id)"
          >
            Substituir por uma imagem
          </button>
          <label v-if="selected.kind === 'shape'" class="field"
            >Forma<select
              :value="selected.shape"
              class="art-input"
              @change="
                patch({
                  shape: ($event.target as HTMLSelectElement)
                    .value as ArtLayer['shape']
                })
              "
            >
              <option value="rect">Retângulo</option>
              <option value="ellipse">Elipse</option>
              <option v-if="selected.pathData" value="path">Curva vetorial</option>
            </select></label
          >
          <label v-if="selected.kind==='shape' && selected.shape==='rect'" class="field">Cantos arredondados<input class="art-input" type="number" min="0" max="500" :value="selected.cornerRadius || 0" @input="patch({cornerRadius:Number(($event.target as HTMLInputElement).value)})" /></label>
          <label v-if="selected.kind !== 'image'" class="field color-field"
            >Cor<input
              :value="selected.fill"
              type="color"
              @input="
                patch({ fill: ($event.target as HTMLInputElement).value })
              "
            /><span>{{ selected.fill }}</span></label
          >
          <template v-if="selected.kind === 'shape' || selected.kind === 'icon'">
            <label class="field">Desfoque da camada<input class="art-input" type="number" min="0" max="150" :value="selected.blur || 0" @input="patch({blur:Number(($event.target as HTMLInputElement).value)})" /></label>
            <label class="field">Preenchimento / efeito<select class="art-input" :value="selected.gradient?.type || 'solid'" @change="patch({gradient: ($event.target as HTMLSelectElement).value === 'solid' ? undefined : {type: ($event.target as HTMLSelectElement).value as 'linear' | 'radial', from: selected.gradient?.from || selected.fill, to: selected.gradient?.to || selected.fill, startOpacity: 1, endOpacity: 0, angle:90}})"><option value="solid">Cor sólida</option><option value="linear">Degradê linear</option><option value="radial">Luz / brilho radial</option></select></label>
            <template v-if="selected.gradient">
              <label class="field color-field">Cor inicial<input type="color" :value="selected.gradient.from" @input="patch({gradient:{...selected.gradient!,from:($event.target as HTMLInputElement).value}})" /></label>
              <label class="field color-field">Cor final<input type="color" :value="selected.gradient.to" @input="patch({gradient:{...selected.gradient!,to:($event.target as HTMLInputElement).value}})" /></label>
              <label class="field">Intensidade inicial<input type="range" min="0" max="1" step=".01" :value="selected.gradient.startOpacity" @input="patch({gradient:{...selected.gradient!,startOpacity:Number(($event.target as HTMLInputElement).value)}})" /></label>
              <label class="field">Intensidade final<input type="range" min="0" max="1" step=".01" :value="selected.gradient.endOpacity" @input="patch({gradient:{...selected.gradient!,endOpacity:Number(($event.target as HTMLInputElement).value)}})" /></label>
              <label v-if="selected.gradient.type==='linear'" class="field">Direção do degradê<input class="art-input" type="number" min="-360" max="360" :value="selected.gradient.angle" @input="patch({gradient:{...selected.gradient!,angle:Number(($event.target as HTMLInputElement).value)}})" /></label>
            </template>
          </template>
          <div class="field-row">
            <label class="field"
              >Posição X<input
                :value="Math.round(selected.x)"
                type="number"
                class="art-input"
                @change="numeric('x', $event)" /></label
            ><label class="field"
              >Posição Y<input
                :value="Math.round(selected.y)"
                type="number"
                class="art-input"
                @change="numeric('y', $event)"
            /></label>
          </div>
          <div class="field-row">
            <label class="field"
              >Largura<input
                :value="Math.round(selected.width)"
                type="number"
                min="1"
                class="art-input"
                @change="numeric('width', $event)" /></label
            ><label class="field"
              >Altura<input
                :value="Math.round(selected.height)"
                type="number"
                min="1"
                class="art-input"
                @change="numeric('height', $event)"
            /></label>
          </div>
          <div class="field-row">
            <label class="field"
              >Rotação<input
                :value="Math.round(selected.rotation)"
                type="number"
                class="art-input"
                @change="numeric('rotation', $event)" /></label
            ><label class="field"
              >Opacidade<input
                :value="selected.opacity"
                type="number"
                min="0"
                max="1"
                step="0.1"
                class="art-input"
                @change="numeric('opacity', $event)"
            /></label>
          </div>
          <label
            v-if="selected.kind === 'text' || selected.kind === 'image'"
            class="field"
            >Dado dinâmico<select
              :value="selected.binding || ''"
              class="art-input"
              @change="setBinding"
            >
              <option value="">Conteúdo livre</option>
              <option v-if="selected.kind === 'image'" value="logo">
                Logo da loja
              </option>
              <template v-else
                ><option value="companyName">Nome da loja</option>
                <option value="phone">Telefone / WhatsApp</option>
                <option value="address">Endereço</option>
                <option value="instagram">Instagram</option>
                <option value="date">Data</option></template
              >
            </select></label
          >
        </template>
        <template v-else
          ><div class="intro-panel">
            <span>✳</span>
            <h3>Faça do seu jeito.</h3>
            <p>
              Selecione um texto, imagem ou ícone para personalizar. Arraste os
              elementos na arte para mudar a posição.
            </p>
          </div>
          <label class="field"
            >Formato<select
              :value="`${doc.width}x${doc.height}`"
              class="art-input"
              @change="changeFormat"
            >
              <option value="1080x1350">Feed vertical · 1080 × 1350</option>
              <option value="1080x1080">Quadrado · 1080 × 1080</option>
              <option value="1080x1920">Stories · 1080 × 1920</option>
              <option value="1920x1080">Horizontal · 1920 × 1080</option>
              <option value="794x1123">A4 · 794 × 1123</option>
            </select></label
          ><label class="field color-field"
            >Cor do fundo<input
              :value="doc.background"
              type="color"
              @input="
                doc = {
                  ...doc,
                  background: ($event.target as HTMLInputElement).value
                }
              " /></label
          ><button
            class="art-button full"
            :disabled="managing"
            @click="applyBrand"
          >
            <Store :size="16" />Atualizar dados da loja
          </button>
          <p class="panel-help">
            Aplica os dados nos campos vinculados. A logo é carregada
            diretamente do cadastro da loja.
          </p>
          <button class="art-button full" @click="save(true)">
            <Copy :size="16" />Salvar como cópia</button
          ><button
            v-if="auth.isSuperAdmin.value"
            class="art-button full"
            @click="jsonInput?.click()"
          >
            Importar composição JSON</button
          ><button
            v-if="auth.isSuperAdmin.value"
            class="art-button full"
            @click="downloadJson"
          >
            Exportar composição JSON</button
          ><button
            v-if="auth.isSuperAdmin.value"
            class="art-button full"
            @click="generatorDialog?.showModal()"
          >
            Montar modelo automaticamente</button
          ><button
            class="art-button full"
            :disabled="formatBusy"
            @click="exportBatch"
          >
            {{
              formatBusy
                ? 'Processando no Python…'
                : 'Baixar todos os formatos (Python)'
            }}</button
          ><button
            v-if="doc.alternates?.length"
            class="art-button full"
            @click="removeFormat"
          >
            Remover formato atual</button
          ><button
            v-if="auth.isSuperAdmin.value"
            class="art-button primary full"
            @click="openTemplateDialog"
          >
            Publicar como modelo
          </button></template
        >
      </aside>
      <div class="mobile-panel-tabs">
        <button
          :class="{ active: mobilePanel === 'layers' }"
          @click="mobilePanel = 'layers'"
        >
          <Layers :size="16" />Elementos</button
        ><button
          :class="{ active: mobilePanel === 'properties' }"
          @click="mobilePanel = 'properties'"
        >
          <Settings2 :size="16" />Personalizar
        </button>
      </div>
    </div>
    <dialog ref="formatDialog" class="publish-dialog">
      <form @submit.prevent="generateFormats">
        <div class="panel-title">
          <h2>Formatos da arte</h2>
          <button
            type="button"
            class="art-button"
            @click="formatDialog?.close()"
          >
            Fechar
          </button>
        </div>
        <p>
          O Python ajusta a composição e o tamanho dos textos. Formatos já
          editados são preservados.
        </p>
        <label v-for="f in ART_FORMATS" :key="f.id" class="publish-check"
          ><input
            v-model="batchSizes"
            type="checkbox"
            :value="`${f.width}x${f.height}`"
          />{{ f.label }} · {{ f.width }} × {{ f.height }}</label
        >
        <p v-if="error" class="art-alert">{{ error }}</p>
        <button
          class="art-button primary full"
          :disabled="formatBusy || !batchSizes.length"
        >
          {{ formatBusy ? 'Montando…' : 'Criar formatos selecionados' }}
        </button>
      </form>
    </dialog>
    <dialog ref="generatorDialog" class="publish-dialog">
      <form @submit.prevent="generateFromBrief">
        <div class="panel-title">
          <h2>Montagem automática</h2>
          <button
            type="button"
            class="art-button"
            @click="generatorDialog?.close()"
          >
            Fechar
          </button>
        </div>
        <p>
          Transforme sua mensagem em um modelo com camadas editáveis e logo
          dinâmica. Depois ajuste livremente.
        </p>
        <label class="field"
          >Tema<input
            v-model="brief.theme"
            maxlength="120"
            class="art-input" /></label
        ><label class="field"
          >Título<textarea
            v-model="brief.title"
            required
            maxlength="300"
            class="art-input"
          /></label
        ><label class="field"
          >Mensagem<textarea
            v-model="brief.message"
            maxlength="1000"
            class="art-input"
          />
        </label>
        <div class="field-row">
          <label class="field"
            >Fundo<input v-model="brief.background" type="color" /></label
          ><label class="field"
            >Cor dos elementos<input v-model="brief.color" type="color"
          /></label>
        </div>
        <label v-for="f in ART_FORMATS" :key="f.id" class="publish-check"
          ><input
            v-model="batchSizes"
            type="checkbox"
            :value="`${f.width}x${f.height}`"
          />{{ f.label }}</label
        >
        <p v-if="error" class="art-alert">{{ error }}</p>
        <button
          class="art-button primary full"
          :disabled="formatBusy || !batchSizes.length"
        >
          {{
            formatBusy
              ? 'Python está montando…'
              : 'Montar nos formatos selecionados'
          }}
        </button>
      </form>
    </dialog>
    <input
      ref="jsonInput"
      class="hidden"
      type="file"
      accept="application/json,.json"
      @change="importComposition"
    />
    <input
      ref="uploadInput"
      class="hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/avif"
      @change="uploadImage"
    />
    <dialog ref="templateDialog" class="publish-dialog">
      <form @submit.prevent="saveTemplate">
        <div class="panel-title">
          <h2>
            {{
              editingTemplate && !editingTemplate.id.startsWith('starter-')
                ? 'Atualizar modelo'
                : 'Novo modelo para o catálogo'
            }}
          </h2>
          <button
            type="button"
            class="art-button"
            aria-label="Fechar publicação"
            @click="templateDialog?.close()"
          >
            <X :size="16" />
          </button>
        </div>
        <p>
          Textos, imagens e ícones continuam editáveis. Os campos dinâmicos
          serão preenchidos com os dados de cada cliente.
        </p>
        <label class="field"
          >Nome do modelo<input
            v-model="templateName"
            required
            maxlength="150"
            class="art-input" /></label
        ><label class="field"
          >Categoria<input
            v-model="templateCategory"
            required
            list="art-category-options"
            maxlength="80"
            class="art-input" /><datalist id="art-category-options">
            <option
              v-for="item in ART_CATEGORIES"
              :key="item"
              :value="item"
            /></datalist></label
        ><label class="field"
          >Coleção<input
            v-model="templateCollection"
            maxlength="80"
            class="art-input"
            placeholder="Ex.: Dia dos Pais" /></label
        ><label class="field"
          >Tags separadas por vírgula<input
            v-model="templateTags"
            class="art-input"
            placeholder="pais, família, agosto" /></label
        ><label class="publish-check"
          ><input v-model="publish" type="checkbox" />Disponível no catálogo dos
          clientes</label
        >
        <p v-if="error" role="alert" class="art-alert">{{ error }}</p>
        <button type="submit" class="art-button primary full" :disabled="busy">
          {{
            busy
              ? 'Salvando…'
              : publish
                ? 'Salvar e publicar modelo'
                : 'Salvar como rascunho'
          }}
        </button>
      </form>
    </dialog>
  </ArtShell>
</template>
<style scoped>
.format-pages {
  display: flex;
  align-items: center;
  overflow: auto;
  gap: 8px;
  padding: 12px 16px;
  background: #f6f8f1;
  border-top: 1px solid #d9e1d2;
}
.format-pages button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #dce2d7;
  border-radius: 7px;
  background: #fff;
  padding: 9px 12px;
  font-size: 11px;
  white-space: nowrap;
}
.format-pages button.active {
  background: #264f38;
  color: #fff;
}
.format-pages small {
  font-size: 8px;
  opacity: 0.6;
}

.studio-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #dde2d8;
  padding: 14px 22px;
}
.art-name {
  flex: 1;
  min-width: 80px;
}
.art-name input {
  width: 100%;
  max-width: 370px;
  border: 0;
  background: transparent;
  color: #234230;
  font-weight: 600;
  font-size: 16px;
}
.art-name small {
  display: block;
  font-size: 10px;
  color: #88947f;
  margin-top: 4px;
}
.toolbar-history {
  display: flex;
  gap: 6px;
}
.studio-workspace {
  display: grid;
  grid-template-columns: 245px minmax(200px, 1fr) 280px;
  height: calc(100vh - 166px);
  min-height: 650px;
}
.studio-layers,
.studio-properties {
  background: #fff;
  padding: 22px 18px;
  overflow-y: auto;
}
.studio-layers {
  border-right: 1px solid #dde2d8;
}
.studio-properties {
  border-left: 1px solid #dde2d8;
}
.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.panel-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.panel-title > svg {
  color: #8a977f;
}
.panel-title small {
  font-size: 10px;
  color: #87927e;
}
.add-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  margin-top: 18px;
}
.add-grid button {
  border: 1px solid #e1e7dc;
  border-radius: 9px;
  padding: 15px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: #fafbf7;
  color: #436044;
  font-size: 11px;
}
.add-grid button:hover {
  background: #e9f0df;
}
.add-grid svg {
  width: 20px;
  height: 20px;
}
.add-grid .logo-add {
  grid-column: span 2;
  flex-direction: row;
  justify-content: center;
  padding: 12px;
}
.layers-title {
  margin-top: 28px;
}
.panel-help {
  font-size: 11px;
  line-height: 1.6;
  color: #89917f;
  margin: 10px 0 16px;
}
.layer-list {
  margin: 0 -8px;
}
.layer-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 9px 7px;
  border-radius: 8px;
  margin-bottom: 4px;
  border: 1px solid transparent;
}
.layer-item.active {
  background: #edf3e7;
  border-color: #d6e2cc;
}
.layer-item button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #75836f;
  display: flex;
  align-items: center;
  gap: 7px;
}
.layer-select {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.layer-select span {
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}
.layer-select svg {
  flex-shrink: 0;
}
.layer-select small {
  font-size: 6px;
  letter-spacing: 0.3px;
  color: #53804c;
}
.brand-note {
  margin-top: 35px;
  padding: 18px;
  background: #f3f6ec;
  border-radius: 10px;
  color: #718464;
}
.brand-note strong {
  font-size: 12px;
  display: block;
  margin-top: 10px;
}
.brand-note p {
  font-size: 11px;
  line-height: 1.6;
  margin: 8px 0;
}
.brand-note a {
  font-size: 10px;
  color: #3f6745;
}
.canvas-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.canvas-topline,
.canvas-bottomline {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 22px;
  color: #819079;
  background: #edf0e9;
  font-size: 9px;
}
.canvas-topline b {
  margin: 0 6px;
}
.canvas-topline span:first-child {
  letter-spacing: 0.7px;
}
.canvas-area {
  flex: 1;
  min-height: 0;
}
.canvas-bottomline button {
  border: 0;
  background: transparent;
  color: #527049;
  text-decoration: underline;
}
.field {
  display: block;
  font-size: 11px;
  font-weight: 500;
  margin: 17px 0 0;
  color: #67785e;
}
.field .art-input {
  display: block;
  margin-top: 7px;
  font-size: 12px;
  padding: 9px 10px;
}
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field-row input {
  min-width: 0;
}
.color-field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
}
.color-field input {
  width: 34px;
  height: 28px;
  border: 0;
  padding: 0;
  margin-left: auto;
  background: none;
}
.color-field span {
  font-size: 10px;
}
.element-actions {
  display: flex;
  gap: 8px;
  margin-top: 15px;
}
.element-actions button {
  flex: 1;
  padding: 8px;
}
.full {
  width: 100%;
  margin-top: 14px;
  font-size: 12px;
}
.intro-panel {
  padding: 30px 4px 20px;
  border-bottom: 1px solid #e4e8dd;
  text-align: center;
}
.intro-panel > span {
  font-size: 43px;
  color: #8b9e65;
}
.intro-panel h3 {
  font-size: 19px;
  margin: 12px 0;
  font-weight: 600;
}
.intro-panel p {
  font-size: 12px;
  line-height: 1.7;
  color: #8c9681;
}
.dynamic-note {
  margin-top: 18px;
  padding: 11px;
  background: #edf5e6;
  border-radius: 8px;
  font-size: 11px;
  display: flex;
  gap: 7px;
  color: #59774a;
}
.field input[type='range'] {
  display: block;
  width: 100%;
  margin-top: 9px;
  accent-color: #315d42;
}
.admin-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 22px;
  background: #e8eedc;
  font-size: 12px;
  color: #4d6542;
}
.editor-alert {
  margin: 8px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.dismiss-error {
  margin-left: auto;
  border: 0;
  background: transparent;
}
.recovery {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 16px;
}
.mobile-panel-tabs {
  display: none;
}
.publish-dialog {
  border: 0;
  border-radius: 18px;
  background: #fff;
  color: #24412f;
  width: 480px;
  max-width: 92vw;
  max-height: 90vh;
  padding: 28px;
}
.publish-dialog::backdrop {
  background: #17291e99;
  backdrop-filter: blur(3px);
}
.publish-dialog form > p {
  font-size: 13px;
  color: #7b8974;
  line-height: 1.7;
  margin-top: 15px;
}
.publish-check {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  margin: 22px 0;
}
.publish-check input {
  accent-color: #305d40;
}
@media (max-width: 1150px) {
  .studio-workspace {
    grid-template-columns: 195px minmax(200px, 1fr) 245px;
  }
  .studio-layers,
  .studio-properties {
    padding: 18px 12px;
  }
  .template-button span {
    display: none;
  }
  .canvas-topline span:last-child {
    display: none;
  }
}
@media (max-width: 850px) {
  .studio-toolbar {
    padding: 10px;
    gap: 6px;
    flex-wrap: wrap;
  }
  .art-name {
    min-width: 120px;
  }
  .studio-toolbar button span,
  .back-catalog span {
    display: none;
  }
  .studio-toolbar .art-button {
    padding: 9px;
  }
  .studio-workspace {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 0;
  }
  .canvas-section {
    order: 1;
    height: 58vh;
    min-height: 400px;
  }
  .studio-layers,
  .studio-properties {
    display: none;
    order: 3;
    overflow: visible;
    border: 0;
    padding: 24px;
    min-height: 270px;
  }
  .studio-layers.mobile-open,
  .studio-properties.mobile-open {
    display: block;
  }
  .mobile-panel-tabs {
    display: flex;
    order: 2;
    background: #fff;
    border-bottom: 1px solid #dce3d7;
  }
  .mobile-panel-tabs button {
    flex: 1;
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    background: white;
    border: 0;
    border-bottom: 2px solid transparent;
    color: #839079;
    font-size: 13px;
  }
  .mobile-panel-tabs button.active {
    border-color: #315d42;
    color: #315d42;
  }
  .add-grid {
    grid-template-columns: repeat(4, 1fr);
  }
  .brand-note {
    margin-top: 18px;
  }
  .admin-banner span {
    display: none;
  }
  .recovery {
    flex-wrap: wrap;
  }
  .studio-toolbar .toolbar-history {
    margin-left: auto;
  }
  .field input[type='color'] {
    width: 46px;
  }
  .canvas-topline,
  .canvas-bottomline {
    padding: 10px 15px;
  }
  .layer-select span {
    max-width: none;
  }
}
</style>
