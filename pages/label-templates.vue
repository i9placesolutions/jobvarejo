<script setup lang="ts">
import { confirmInSystem, alertInSystem } from '~/utils/systemMessages'

import {
  ArrowLeft,
  Check,
  Copy,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X
} from 'lucide-vue-next'
import { onBeforeRouteLeave } from 'vue-router'
import { defineAsyncComponent } from 'vue'
import type { LabelTemplate } from '~/types/label-template'
import {
  BUILTIN_DEFAULT_LABEL_TEMPLATE_ID,
  isBuiltInLabelTemplateId,
  normalizeLabelTemplateName
} from '~/utils/labelTemplateHelpers'
import { createEditableLabelTemplateGroup } from '~/utils/labelTemplateFactory'
import { toWasabiProxyUrl } from '~/utils/storageProxy'

definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false
})

const LabelTemplateMiniEditor = defineAsyncComponent(() => import('~/components/LabelTemplateMiniEditor.vue'))
const miniEditorRef = ref<{ requestClose?: () => boolean } | null>(null)

const route = useRoute()
const resolveInternalReturnPath = (value: unknown): string => {
  const candidate = String(value ?? '').trim()
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('://')) {
    return '/'
  }
  return candidate
}
const returnTo = computed(() => resolveInternalReturnPath(route.query.returnTo))
const returnLabel = computed(() => returnTo.value.startsWith('/editor/') ? 'Voltar ao editor' : 'Voltar para os projetos')

type TemplateSaveResult = {
  ok: boolean
  message?: string
}

const { getApiAuthHeaders } = useApiAuth()
const { uploadFile } = useUpload()

const templates = ref<LabelTemplate[]>([])
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const searchQuery = ref('')
const showCreateDialog = ref(false)
const createName = ref('')
const createImageFile = ref<File | null>(null)
const createImageDataUrl = ref<string | null>(null)
const createImagePreview = ref<string | null>(null)
const createImageInput = ref<HTMLInputElement | null>(null)
const isPreparingTemplate = ref(false)
const editingTemplate = ref<LabelTemplate | null>(null)
const isSaving = ref(false)
const isDuplicating = ref(false)
const deletingTemplateId = ref<string | null>(null)
const failedPreviewIds = ref<Set<string>>(new Set())
const toast = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

const filteredTemplates = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return templates.value
  return templates.value.filter((template) => template.name.toLowerCase().includes(query))
})

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  toast.value = { message, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, 4500)
}

const cloneJson = <T,>(value: T): T => {
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value))
  } catch {
    return JSON.parse(JSON.stringify(value)) as T
  }
}

const mapTemplateRow = (row: any): LabelTemplate | null => {
  if (!row || typeof row !== 'object') return null
  const id = String(row.id || '').trim()
  const group = row.group ?? row['group']
  if (!id || !group || typeof group !== 'object') return null

  const now = new Date().toISOString()
  const createdAt = String(row.created_at || row.createdAt || now)
  const updatedAt = String(row.updated_at || row.updatedAt || createdAt)
  return {
    id,
    name: normalizeLabelTemplateName(row.name, 'Etiqueta sem nome'),
    kind: (String(row.kind || 'priceGroup-v1') || 'priceGroup-v1') as LabelTemplate['kind'],
    group,
    previewDataUrl: row.preview_data_url ?? row.previewDataUrl ?? undefined,
    isBuiltIn: Boolean(row.isBuiltIn || row.is_built_in) || isBuiltInLabelTemplateId(id),
    createdAt,
    updatedAt
  }
}

const sortTemplates = (items: LabelTemplate[]) => [...items].sort((a, b) => {
  const aTime = Date.parse(a.updatedAt || a.createdAt || '') || 0
  const bTime = Date.parse(b.updatedAt || b.createdAt || '') || 0
  return bTime - aTime
})

const upsertLocalTemplate = (template: LabelTemplate) => {
  const failed = new Set(failedPreviewIds.value)
  failed.delete(template.id)
  failedPreviewIds.value = failed
  const index = templates.value.findIndex((item) => item.id === template.id)
  if (index === -1) {
    templates.value = sortTemplates([...templates.value, template])
    return
  }
  const next = [...templates.value]
  next[index] = template
  templates.value = sortTemplates(next)
}

const markPreviewFailed = (templateId: string) => {
  if (failedPreviewIds.value.has(templateId)) return
  failedPreviewIds.value = new Set([...failedPreviewIds.value, templateId])
}

const loadTemplates = async () => {
  isLoading.value = true
  loadError.value = null
  try {
    const headers = await getApiAuthHeaders()
    const response: any = await $fetch('/api/label-templates', { method: 'GET', headers })
    if (response?.success === false) {
      throw new Error(String(response?.message || 'Não foi possível carregar os modelos.'))
    }
    const rows = Array.isArray(response?.templates) ? response.templates : []
    templates.value = sortTemplates(rows.map(mapTemplateRow).filter(Boolean) as LabelTemplate[])
    await ensureStarterTemplate()
  } catch (error: any) {
    loadError.value = String(error?.data?.statusMessage || error?.message || 'Não foi possível carregar os modelos.')
    templates.value = []
  } finally {
    isLoading.value = false
  }
}

const ensureStarterTemplate = async () => {
  if (templates.value.some((template) => template.id === BUILTIN_DEFAULT_LABEL_TEMPLATE_ID)) return

  const now = new Date().toISOString()
  const starter: LabelTemplate = {
    id: BUILTIN_DEFAULT_LABEL_TEMPLATE_ID,
    name: 'Padrão',
    kind: 'priceGroup-v1',
    group: createEditableLabelTemplateGroup(),
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now
  }

  // Keep the menu useful even when an older deployment has not applied the
  // label-template migration yet. The POST below makes this durable whenever
  // the catalog is available, and is idempotent for the built-in key.
  upsertLocalTemplate(starter)
  try {
    const saved = await persistTemplateRecord(starter)
    upsertLocalTemplate(saved)
  } catch (error) {
    showToast('O modelo padrão ficou disponível nesta sessão, mas o catálogo ainda não foi persistido.', 'info')
    console.warn('[label-templates] Não foi possível persistir o modelo padrão', error)
  }
}

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
  reader.readAsDataURL(file)
})

const readImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height })
  image.onerror = () => reject(new Error('A imagem selecionada não pôde ser aberta.'))
  image.src = dataUrl
})

const compactPreview = (dataUrl: string | undefined | null): Promise<string | undefined> => {
  const value = String(dataUrl || '')
  if (!value) return Promise.resolve(undefined)
  if (value.length <= 1_350_000) return Promise.resolve(value)

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const maxWidth = 480
      const maxHeight = 280
      const scale = Math.min(maxWidth / Math.max(1, image.naturalWidth), maxHeight / Math.max(1, image.naturalHeight), 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(value)
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      try {
        resolve(canvas.toDataURL('image/webp', 0.82))
      } catch {
        resolve(value)
      }
    }
    image.onerror = () => resolve(value)
    image.src = value
  })
}

const dataUrlToFile = (dataUrl: string, filename: string): File => {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) throw new Error('Imagem incorporada inválida.')
  const mime = match[1] || 'image/png'
  const payload = match[3] || ''
  const binary = match[2]
    ? atob(payload)
    : decodeURIComponent(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

const walkTemplateNodes = (root: any, visit: (node: any) => void) => {
  if (!root || typeof root !== 'object') return
  const stack: any[] = [root]
  const visited = new WeakSet<object>()
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object' || visited.has(node)) continue
    visited.add(node)
    visit(node)
    if (Array.isArray(node.objects)) stack.push(...node.objects)
    if (node.clipPath && typeof node.clipPath === 'object') stack.push(node.clipPath)
  }
}

const persistEmbeddedImages = async (group: any): Promise<any> => {
  const next = cloneJson(group)
  const uploadedBySource = new Map<string, string>()
  const imageNodes: any[] = []
  walkTemplateNodes(next, (node) => {
    if (String(node?.type || '').toLowerCase() === 'image') imageNodes.push(node)
  })

  for (const [index, node] of imageNodes.entries()) {
    const source = String(node?.src || '').trim()
    if (!source) continue
    if (/^(javascript|vbscript|about):/i.test(source)) {
      throw new Error('A etiqueta contém uma origem de imagem inválida.')
    }
    if (!source.startsWith('data:') && !source.startsWith('blob:')) {
      // Persist a same-origin reference when an older template still points
      // directly to Wasabi. This prevents a tainted canvas during preview or
      // export and also removes expiring/presigned URLs from the template.
      const stableSource = toWasabiProxyUrl(source)
      if (stableSource && stableSource !== source) {
        node.src = stableSource
        node.__originalSrc = stableSource
        node.crossOrigin = 'anonymous'
      }
      continue
    }

    const cachedUrl = uploadedBySource.get(source)
    if (cachedUrl) {
      node.src = cachedUrl
      node.__originalSrc = cachedUrl
      continue
    }

    let file: File
    if (source.startsWith('data:')) {
      file = dataUrlToFile(source, `etiqueta-${index + 1}.png`)
    } else {
      const response = await fetch(source)
      const blob = await response.blob()
      file = new File([blob], `etiqueta-${index + 1}.${String(blob.type || 'image/png').split('/')[1] || 'png'}`, {
        type: blob.type || 'image/png'
      })
    }

    const uploaded = await uploadFile(file)
    const stableSource = toWasabiProxyUrl(uploaded?.key || uploaded?.url) || uploaded?.url
    if (!uploaded?.success || !stableSource) throw new Error('Não foi possível salvar a imagem da etiqueta.')
    uploadedBySource.set(source, stableSource)
    node.src = stableSource
    node.__originalSrc = stableSource
    node.crossOrigin = 'anonymous'
  }

  return next
}

const persistTemplateRecord = async (
  template: LabelTemplate,
  previewDataUrl?: string | null
): Promise<LabelTemplate> => {
  const group = await persistEmbeddedImages(template.group)
  const preview = await compactPreview(previewDataUrl ?? template.previewDataUrl)
  const headers = await getApiAuthHeaders()
  const response: any = await $fetch('/api/label-templates', {
    method: 'POST',
    headers,
    body: {
      id: template.id,
      name: template.name,
      kind: template.kind,
      group,
      previewDataUrl: preview ?? null
    }
  })

  if (!response?.success) {
    throw new Error(String(response?.message || 'O servidor não salvou o modelo.'))
  }

  return mapTemplateRow(response.template) || {
    ...template,
    group,
    previewDataUrl: preview ?? undefined,
    updatedAt: new Date().toISOString()
  }
}

const resetCreateForm = () => {
  createName.value = ''
  createImageFile.value = null
  createImageDataUrl.value = null
  createImagePreview.value = null
  if (createImageInput.value) createImageInput.value.value = ''
}

const openCreateDialog = () => {
  resetCreateForm()
  showCreateDialog.value = true
}

const chooseCreateImage = () => createImageInput.value?.click()

const handleCreateImageChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    input.value = ''
    return
  }

  try {
    if (!file.type.toLowerCase().startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
    if (file.size > 15 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 15 MB.')
    const dataUrl = await readFileAsDataUrl(file)
    createImageFile.value = file
    createImageDataUrl.value = dataUrl
    createImagePreview.value = await compactPreview(dataUrl) || dataUrl
  } catch (error: any) {
    showToast(error?.message || 'Não foi possível preparar a imagem.', 'error')
  } finally {
    input.value = ''
  }
}

const startCreateTemplate = async () => {
  if (isPreparingTemplate.value) return
  const name = createName.value.trim()
  if (!name) {
    showToast('Informe um nome para a etiqueta.', 'error')
    return
  }

  isPreparingTemplate.value = true
  try {
    let group: Record<string, any>
    if (createImageDataUrl.value) {
      const dimensions = await readImageDimensions(createImageDataUrl.value)
      group = createEditableLabelTemplateGroup({
        imageSrc: createImageDataUrl.value,
        imageWidth: dimensions.width,
        imageHeight: dimensions.height
      })
    } else {
      group = createEditableLabelTemplateGroup()
    }

    const now = new Date().toISOString()
    editingTemplate.value = {
      id: `tpl_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`,
      name,
      kind: 'priceGroup-v1',
      group,
      previewDataUrl: createImagePreview.value || undefined,
      createdAt: now,
      updatedAt: now
    }
    showCreateDialog.value = false
    resetCreateForm()
  } catch (error: any) {
    showToast(error?.message || 'Não foi possível criar a etiqueta.', 'error')
  } finally {
    isPreparingTemplate.value = false
  }
}

const openEditor = (template: LabelTemplate) => {
  editingTemplate.value = cloneJson(template)
}

const closeEditor = () => {
  if (isSaving.value) return
  editingTemplate.value = null
}

onBeforeRouteLeave(() => {
  if (!editingTemplate.value) return true
  if (!miniEditorRef.value?.requestClose) return !isSaving.value
  return miniEditorRef.value.requestClose()
})

const handleTemplateSave = async (
  templateId: string,
  updates: { group: any; previewDataUrl?: string; name?: string },
  done?: (result: TemplateSaveResult) => void
) => {
  if (isSaving.value) return
  const current = editingTemplate.value
  if (!current || current.id !== templateId) {
    done?.({ ok: false, message: 'Modelo não encontrado.' })
    return
  }

  isSaving.value = true
  try {
    const next: LabelTemplate = {
      ...current,
      name: normalizeLabelTemplateName(updates.name, current.name),
      group: updates.group,
      updatedAt: new Date().toISOString()
    }
    const saved = await persistTemplateRecord(next, updates.previewDataUrl ?? current.previewDataUrl)
    done?.({ ok: true })
    upsertLocalTemplate(saved)
    editingTemplate.value = null
    showToast('Modelo salvo. Ele já está disponível no seletor do editor.', 'success')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('label-templates:changed', { detail: { action: 'upsert', template: saved } }))
    }
  } catch (error: any) {
    const message = String(error?.data?.statusMessage || error?.message || 'Não foi possível salvar o modelo.')
    done?.({ ok: false, message })
    showToast(message, 'error')
  } finally {
    isSaving.value = false
  }
}

const duplicateTemplate = async (template: LabelTemplate) => {
  if (isSaving.value || isPreparingTemplate.value || isDuplicating.value) return
  isDuplicating.value = true
  isSaving.value = true
  try {
    const now = new Date().toISOString()
    const duplicate: LabelTemplate = {
      ...cloneJson(template),
      id: `tpl_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`,
      name: normalizeLabelTemplateName(`${template.name} (cópia)`, template.name),
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now
    }
    const saved = await persistTemplateRecord(duplicate, duplicate.previewDataUrl)
    upsertLocalTemplate(saved)
    showToast('Cópia criada com sucesso.', 'success')
  } catch (error: any) {
    showToast(String(error?.data?.statusMessage || error?.message || 'Não foi possível duplicar o modelo.'), 'error')
  } finally {
    isDuplicating.value = false
    isSaving.value = false
  }
}

const deleteTemplate = async (template: LabelTemplate) => {
  if (template.isBuiltIn || deletingTemplateId.value) return
  if (!await confirmInSystem(`Excluir o modelo “${template.name}”?`)) return

  deletingTemplateId.value = template.id
  try {
    const headers = await getApiAuthHeaders()
    const response: any = await $fetch('/api/label-templates', { method: 'DELETE', headers, query: { id: template.id } })
    if (response?.success === false) {
      throw new Error(String(response?.message || 'O servidor não excluiu o modelo.'))
    }
    templates.value = templates.value.filter((item) => item.id !== template.id)
    showToast('Modelo excluído.', 'success')
    window.dispatchEvent(new CustomEvent('label-templates:changed', { detail: { action: 'delete', templateId: template.id } }))
  } catch (error: any) {
    showToast(String(error?.data?.statusMessage || error?.message || 'Não foi possível excluir o modelo.'), 'error')
  } finally {
    deletingTemplateId.value = null
  }
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem data'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(() => {
  void loadTemplates()
})

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="min-h-screen bg-[#f7f8fc] text-slate-900">
    <header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div class="flex min-w-0 items-center gap-3">
           <NuxtLink :to="returnTo" class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100" :aria-label="returnLabel">
             <ArrowLeft class="h-4 w-4" />
           </NuxtLink>
           <div class="min-w-0">
             <p class="truncate text-sm font-bold tracking-tight text-slate-900">Biblioteca de etiquetas</p>
             <p class="hidden text-[11px] text-slate-400 sm:block">{{ returnLabel }} · modelos disponíveis em todos os encartes</p>
          </div>
        </div>
        <button type="button" class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 active:scale-[.98]" @click="openCreateDialog">
          <Plus class="h-4 w-4" />
          <span class="hidden sm:inline">Nova etiqueta</span>
          <span class="sm:hidden">Nova</span>
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section class="relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-2xl shadow-slate-900/10 sm:px-8 sm:py-9">
        <div class="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-44 left-1/3 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div class="relative max-w-2xl">
          <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-200">
            <Sparkles class="h-3.5 w-3.5" />
            Configuração central
          </div>
          <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Crie uma etiqueta que funciona em qualquer encarte.</h1>
          <p class="mt-3 max-w-xl text-sm leading-6 text-slate-300">Monte, edite e salve seus modelos fora do editor. Você pode começar do zero ou enviar uma imagem completa; depois, o modelo aparece automaticamente no seletor de etiquetas de cada zona.</p>
          <div class="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-300">
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Preço dinâmico</span>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Imagem de fundo</span>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Disponível no editor</span>
          </div>
        </div>
      </section>

      <section class="mt-8">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-500">Sua biblioteca</p>
            <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-900">Modelos de preço</h2>
            <p class="mt-1 text-sm text-slate-500">Edite a aparência uma vez e reutilize o modelo em qualquer projeto.</p>
          </div>
          <label class="relative block w-full sm:w-64">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input v-model="searchQuery" type="search" placeholder="Buscar modelo..." class="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </label>
        </div>

        <div v-if="isLoading" class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div v-for="index in 4" :key="index" class="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>

        <div v-else-if="loadError" class="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p class="font-semibold">Não foi possível carregar a biblioteca.</p>
          <p class="mt-1 text-red-600/80">{{ loadError }}</p>
          <button type="button" class="mt-4 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white" @click="loadTemplates">Tentar novamente</button>
        </div>

        <div v-else-if="filteredTemplates.length === 0" class="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
            <Tag class="h-7 w-7" />
          </div>
          <h3 class="mt-4 text-base font-bold text-slate-800">{{ searchQuery ? 'Nenhum modelo encontrado' : 'Sua biblioteca está vazia' }}</h3>
          <p class="mt-1 max-w-md text-sm leading-6 text-slate-500">{{ searchQuery ? 'Tente outro nome ou limpe a busca.' : 'Crie uma etiqueta do zero ou envie a arte completa para começar.' }}</p>
          <button v-if="!searchQuery" type="button" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500" @click="openCreateDialog">
            <Plus class="h-4 w-4" /> Criar primeiro modelo
          </button>
        </div>

        <div v-else class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <article v-for="template in filteredTemplates" :key="template.id" class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/5">
            <div class="relative flex h-44 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#eef2ff,transparent_42%),#f8fafc] p-5">
              <img v-if="template.previewDataUrl && !failedPreviewIds.has(template.id)" :src="template.previewDataUrl" :alt="template.name" class="max-h-full max-w-full object-contain drop-shadow-xl" loading="lazy" decoding="async" @error="markPreviewFailed(template.id)" />
              <div v-else class="flex h-24 w-44 items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-white/70 text-indigo-300">
                <ImagePlus class="h-8 w-8" />
              </div>
              <span v-if="template.isBuiltIn" class="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 shadow-sm">Sistema</span>
              <span v-else class="absolute left-3 top-3 rounded-full bg-indigo-600/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">Meu modelo</span>
            </div>
            <div class="p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate text-sm font-bold text-slate-800" :title="template.name">{{ template.name }}</h3>
                  <p class="mt-1 text-[11px] text-slate-400">Atualizado em {{ formatDate(template.updatedAt) }}</p>
                </div>
                <Check class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" title="Disponível no editor" />
              </div>
              <div class="mt-4 flex items-center gap-2">
                <button type="button" class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-600" @click="openEditor(template)">
                  <Pencil class="h-3.5 w-3.5" /> Editar
                </button>
                <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50" :disabled="isSaving || isPreparingTemplate || !!deletingTemplateId" title="Duplicar modelo" @click="duplicateTemplate(template)">
                  <Copy class="h-4 w-4" />
                </button>
                <button v-if="!template.isBuiltIn" type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="Excluir modelo" :disabled="deletingTemplateId === template.id" @click="deleteTemplate(template)">
                  <LoaderCircle v-if="deletingTemplateId === template.id" class="h-4 w-4 animate-spin" />
                  <Trash2 v-else class="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <div v-if="showCreateDialog" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" @click.self="!isPreparingTemplate && (showCreateDialog = false)">
      <div class="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-500">Novo modelo</p>
            <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-900">Comece sua etiqueta</h2>
            <p class="mt-1 text-sm text-slate-500">O preço continuará editável quando o modelo for usado no editor.</p>
          </div>
          <button type="button" class="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="isPreparingTemplate" @click="showCreateDialog = false"><X class="h-5 w-5" /></button>
        </div>

        <div class="mt-6 space-y-5">
          <label class="block">
            <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Nome do modelo</span>
            <input v-model="createName" type="text" maxlength="120" autofocus placeholder="Ex.: Oferta vermelha, Clube, Black..." class="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" @keyup.enter="startCreateTemplate" />
          </label>

          <div>
            <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Imagem completa da etiqueta <span class="font-normal normal-case tracking-normal text-slate-400">(opcional)</span></span>
            <input ref="createImageInput" type="file" accept="image/*" class="hidden" @change="handleCreateImageChange" />
            <button type="button" class="flex min-h-32 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40" @click="chooseCreateImage">
              <img v-if="createImagePreview" :src="createImagePreview" alt="Prévia da imagem selecionada" class="max-h-36 max-w-full object-contain" />
              <template v-else>
                <Upload class="h-7 w-7 text-indigo-400" />
                <span class="mt-2 text-sm font-semibold text-slate-700">Enviar a arte completa</span>
                <span class="mt-1 text-xs text-slate-400">PNG, JPG ou WEBP · até 15 MB</span>
              </template>
            </button>
            <p v-if="createImageFile" class="mt-2 truncate text-xs text-slate-500">{{ createImageFile.name }}</p>
            <p class="mt-2 text-xs leading-5 text-slate-400">A imagem ocupa toda a base da etiqueta e você pode mover, redimensionar, trocar textos e ajustar cores no próximo passo.</p>
          </div>
        </div>

        <div class="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50" :disabled="isPreparingTemplate" @click="showCreateDialog = false">Cancelar</button>
          <button type="button" class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60" :disabled="isPreparingTemplate" @click="startCreateTemplate">
            <LoaderCircle v-if="isPreparingTemplate" class="h-4 w-4 animate-spin" />
            <Plus v-else class="h-4 w-4" />
            {{ isPreparingTemplate ? 'Preparando...' : 'Criar e editar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="editingTemplate" class="fixed inset-0 z-50 bg-slate-950">
      <ClientOnly>
         <LabelTemplateMiniEditor ref="miniEditorRef" :template="editingTemplate" @close="closeEditor" @save="handleTemplateSave" />
        <template #fallback>
          <div class="flex h-full items-center justify-center text-sm text-white/70">Carregando editor de etiqueta...</div>
        </template>
      </ClientOnly>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-2xl" :class="toast.type === 'error' ? 'bg-red-600' : toast.type === 'success' ? 'bg-emerald-600' : 'bg-slate-800'" role="status">
        <Check v-if="toast.type === 'success'" class="h-4 w-4" />
        <X v-else-if="toast.type === 'error'" class="h-4 w-4" />
        <Sparkles v-else class="h-4 w-4" />
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
