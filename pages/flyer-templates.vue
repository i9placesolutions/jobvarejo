<script setup lang="ts">
import { confirmInSystem, alertInSystem } from '~/utils/systemMessages'

import {
  ArrowLeft,
  Copy,
  LayoutTemplate,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
  Zap
} from 'lucide-vue-next'
import { getProjectPreviewSource } from '~/utils/dashboardProjectPreview'
import {
  createFlyerTemplate,
  FLYER_TEMPLATE_FORMATS,
  duplicateFlyerTemplate,
  instantiateFlyerTemplate,
  listFlyerTemplates,
  type FlyerTemplateFormatId,
  type FlyerTemplateSummary
} from '~/utils/flyerTemplateApi'
import {
  getFlyerTemplateCategoryKey,
  normalizeFlyerTemplateCategory,
  type FlyerTemplateCategory
} from '~/utils/flyerTemplateCategory'
import {
  createFlyerTemplateCategory,
  listFlyerTemplateCategories
} from '~/utils/flyerTemplateCategoryApi'
import {
  FLYER_TEMPLATE_PRESETS,
  type FlyerTemplatePresetId
} from '~/utils/mesDoConsumidorPreset'

definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

const templates = ref<FlyerTemplateSummary[]>([])
const isLoading = ref(true)
const loadError = ref('')
const searchQuery = ref('')
const showCreateDialog = ref(false)
const createName = ref('Ofertas da semana')
const categories = ref<FlyerTemplateCategory[]>([])
const createCategoryId = ref('')
const createPresetId = ref<FlyerTemplatePresetId | null>(null)
const createAllFormats = ref(true)
const createFormatIds = ref<FlyerTemplateFormatId[]>(FLYER_TEMPLATE_FORMATS.map(format => format.id))
const isCreating = ref(false)
const usingTemplateId = ref('')
const deletingTemplateId = ref('')
const renamingId = ref('')
const renameDraft = ref('')
const savingName = ref(false)
const categoryEditingId = ref('')
const categoryDraftId = ref('')
const savingCategory = ref(false)
const selectedCategory = ref<string | null>(null)
const showCategoryDialog = ref(false)
const categoryDialogName = ref('')
const categoryDialogTarget = ref<'create' | 'edit' | null>(null)
const isCreatingCategory = ref(false)
const sentenceName = (value: string) => {
  const name = value.trim().toLocaleLowerCase('pt-BR')
  return name.charAt(0).toLocaleUpperCase('pt-BR') + name.slice(1)
}
const startRename = (template: FlyerTemplateSummary) => {
  renamingId.value = template.id
  renameDraft.value = sentenceName(template.name)
}
const saveName = async (template: FlyerTemplateSummary) => {
  const name = sentenceName(renameDraft.value)
  if (!name || savingName.value) return
  savingName.value = true
  try {
    await $fetch('/api/projects', { method: 'PATCH', headers: await getApiAuthHeaders(), body: { id: template.id, name } })
    template.name = name
    renamingId.value = ''
    showToast('Nome atualizado')
  } catch {
    showToast('Não foi possível salvar o nome. Tente novamente.', 'error')
  } finally {
    savingName.value = false
  }
}
const getTemplateCategory = (template: FlyerTemplateSummary): string | null =>
  normalizeFlyerTemplateCategory(template.template_category)
const getCategoryKey = (value: string | null | undefined): string | null =>
  getFlyerTemplateCategoryKey(value)
const categoryOptions = computed(() => {
  const unique = new Map<string, FlyerTemplateCategory>()
  const add = (category: FlyerTemplateCategory) => {
    const key = getCategoryKey(category.name)
    if (!key || unique.has(key)) return
    unique.set(key, category)
  }

  categories.value.forEach(add)
  // Se a consulta do catálogo falhar temporariamente, o modelo antigo ainda
  // continua disponível para selecionar e não perde a categoria ao salvar.
  templates.value.forEach((template) => {
    const name = getTemplateCategory(template)
    const key = getCategoryKey(name)
    if (!name || !key) return
    add({ id: `legacy:${key}`, name })
  })

  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
})
const getCategoryNameById = (id: string): string | null => {
  const category = categoryOptions.value.find(item => item.id === id)
  return category?.name || null
}
const startCategoryEdit = (template: FlyerTemplateSummary) => {
  renamingId.value = ''
  categoryEditingId.value = template.id
  const categoryKey = getCategoryKey(getTemplateCategory(template))
  categoryDraftId.value = categoryKey
    ? categoryOptions.value.find(item => getCategoryKey(item.name) === categoryKey)?.id || ''
    : ''
}
const saveCategory = async (template: FlyerTemplateSummary) => {
  if (savingCategory.value) return
  const previousCategory = getTemplateCategory(template)
  const category = normalizeFlyerTemplateCategory(getCategoryNameById(categoryDraftId.value))
  if (categoryDraftId.value && !category) {
    showToast('Escolha uma categoria existente ou crie uma nova.', 'error')
    return
  }
  savingCategory.value = true
  try {
    await $fetch('/api/projects', {
      method: 'PATCH',
      headers: await getApiAuthHeaders(),
      body: { id: template.id, template_category: category }
    })
    template.template_category = category
    if (getCategoryKey(selectedCategory.value) === getCategoryKey(previousCategory) && previousCategory !== category) {
      selectedCategory.value = category
    }
    categoryEditingId.value = ''
    showToast(category ? 'Categoria atualizada.' : 'Categoria removida.')
  } catch (error: any) {
    showToast(String(error?.data?.statusMessage || error?.message || 'Não foi possível salvar a categoria.'), 'error')
  } finally {
    savingCategory.value = false
  }
}
const openCategoryDialog = (target: 'create' | 'edit' | null = null) => {
  categoryDialogTarget.value = target
  categoryDialogName.value = ''
  showCategoryDialog.value = true
}
const createCatalogCategory = async () => {
  if (isCreatingCategory.value) return
  const name = normalizeFlyerTemplateCategory(categoryDialogName.value)
  if (!name) {
    showToast('Informe o nome da categoria.', 'error')
    return
  }
  isCreatingCategory.value = true
  try {
    const category = await createFlyerTemplateCategory({
      headers: await getApiAuthHeaders(),
      name
    })
    const key = getCategoryKey(category.name)
    categories.value = [
      ...categories.value.filter(item => getCategoryKey(item.name) !== key),
      category
    ].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
    if (categoryDialogTarget.value === 'create') createCategoryId.value = category.id
    if (categoryDialogTarget.value === 'edit') categoryDraftId.value = category.id
    showCategoryDialog.value = false
    categoryDialogName.value = ''
    showToast(`Categoria “${category.name}” criada.`)
  } catch (error: any) {
    showToast(String(error?.data?.statusMessage || error?.message || 'Não foi possível criar a categoria.'), 'error')
  } finally {
    isCreatingCategory.value = false
  }
}
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

const filteredTemplates = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('pt-BR')
  return templates.value.filter((item) => {
    const category = getTemplateCategory(item)
    const matchesCategory = !selectedCategory.value || (
      getCategoryKey(category) === getCategoryKey(selectedCategory.value)
    )
    if (!matchesCategory) return false
    if (!query) return true
    return [item.name, category]
      .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query))
  })
})
const hasTemplateFilter = computed(() => Boolean(searchQuery.value.trim() || selectedCategory.value))

const selectedFormats = computed(() => {
  if (createAllFormats.value) return [...FLYER_TEMPLATE_FORMATS]
  return FLYER_TEMPLATE_FORMATS.filter(format => createFormatIds.value.includes(format.id))
})

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  toast.value = { message, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, 4200)
}

const formatDate = (value: string | null | undefined): string => {
  const time = Date.parse(String(value || ''))
  if (!Number.isFinite(time)) return '—'
  return new Date(time).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const formatSize = (template: FlyerTemplateSummary): string => {
  const width = Number(template.preview_width || 0)
  const height = Number(template.preview_height || 0)
  if (width > 0 && height > 0) return `${width} × ${height}`
  return 'Tamanho livre'
}

const formatTemplateStructure = (template: FlyerTemplateSummary): string => {
  const formats = Math.max(1, Number(template.template_format_count || 1))
  return `${formats} ${formats === 1 ? 'formato' : 'formatos'}`
}

const loadTemplates = async () => {
  isLoading.value = true
  loadError.value = ''
  try {
    const headers = await getApiAuthHeaders()
    const categoriesRequest = listFlyerTemplateCategories(headers).catch(() => [])
    templates.value = await listFlyerTemplates(headers)
    categories.value = await categoriesRequest
  } catch (error: any) {
    loadError.value = String(error?.data?.statusMessage || error?.message || 'Não foi possível carregar os modelos.')
    templates.value = []
  } finally {
    isLoading.value = false
  }
}

const openCreateDialog = () => {
  createName.value = 'Ofertas da semana'
  createCategoryId.value = ''
  createPresetId.value = null
  createAllFormats.value = true
  createFormatIds.value = FLYER_TEMPLATE_FORMATS.map(format => format.id)
  showCreateDialog.value = true
}

const selectCreatePreset = (presetId: FlyerTemplatePresetId | null) => {
  createPresetId.value = presetId
  if (!presetId) return
  const preset = FLYER_TEMPLATE_PRESETS.find(item => item.id === presetId)
  if (preset && createName.value.trim() === 'Ofertas da semana') {
    createName.value = preset.name
  }
  // O preset foi criado para as cinco composições, não para ser esticado a
  // partir de uma página única.
  createAllFormats.value = true
  createFormatIds.value = FLYER_TEMPLATE_FORMATS.map(format => format.id)
}

const toggleCreateFormat = (formatId: FlyerTemplateFormatId) => {
  createAllFormats.value = false
  const next = createFormatIds.value.includes(formatId)
    ? createFormatIds.value.filter(id => id !== formatId)
    : [...createFormatIds.value, formatId]
  if (next.length === 0) return
  createFormatIds.value = next
}

const selectAllCreateFormats = () => {
  createAllFormats.value = true
  createFormatIds.value = FLYER_TEMPLATE_FORMATS.map(format => format.id)
}

const createTemplate = async () => {
  if (isCreating.value) return
  if (!selectedFormats.value.length) {
    showToast('Selecione pelo menos um formato.', 'error')
    return
  }
  isCreating.value = true
  try {
    const headers = await getApiAuthHeaders()
    const projectId = await createFlyerTemplate({
      headers,
      name: createName.value,
      category: getCategoryNameById(createCategoryId.value),
      formatIds: selectedFormats.value.map(format => format.id),
      modelNames: [sentenceName(createName.value) || 'Ofertas da semana'],
      templatePresetId: createPresetId.value || undefined
    })
    showCreateDialog.value = false
    await navigateTo(`/editor/${projectId}`)
  } catch (error: any) {
    showToast(String(error?.data?.statusMessage || error?.message || 'Não foi possível criar o modelo.'), 'error')
  } finally {
    isCreating.value = false
  }
}

const useTemplate = async (template: FlyerTemplateSummary) => {
  if (usingTemplateId.value) return
  usingTemplateId.value = template.id
  try {
    const headers = await getApiAuthHeaders()
    const projectId = await instantiateFlyerTemplate({
      headers,
      templateId: template.id,
      name: template.name
    })
    await navigateTo(`/editor/${projectId}?quick=1`)
  } catch (error: any) {
    showToast(String(error?.data?.statusMessage || error?.message || 'Não foi possível abrir a edição rápida.'), 'error')
  } finally {
    usingTemplateId.value = ''
  }
}

const duplicateTemplate = async (template: FlyerTemplateSummary) => {
  try {
    const headers = await getApiAuthHeaders()
    await duplicateFlyerTemplate({
      headers,
      templateId: template.id
    })
    await loadTemplates()
    showToast('Modelo duplicado.')
  } catch (error: any) {
    showToast(String(error?.data?.statusMessage || error?.message || 'Não foi possível duplicar o modelo.'), 'error')
  }
}

const deleteTemplate = async (template: FlyerTemplateSummary) => {
  if (!await confirmInSystem(`Excluir o modelo “${template.name}”? Os encartes já criados a partir dele continuam intactos.`)) return
  deletingTemplateId.value = template.id
  try {
    const headers = await getApiAuthHeaders()
    await $fetch('/api/projects', {
      method: 'DELETE',
      headers,
      query: { id: template.id }
    })
    templates.value = templates.value.filter(item => item.id !== template.id)
    showToast('Modelo excluído.')
  } catch (error: any) {
    showToast(String(error?.data?.statusMessage || error?.message || 'Não foi possível excluir o modelo.'), 'error')
  } finally {
    deletingTemplateId.value = ''
  }
}

onMounted(() => {
  void loadTemplates()
})

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="min-h-screen bg-[#f6f7fb] text-slate-900">
    <header class="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <NuxtLink to="/" class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600">
            <ArrowLeft class="h-4 w-4" />
          </NuxtLink>
          <div class="min-w-0">
            <p class="truncate text-sm font-bold tracking-tight text-slate-900">Modelos de encarte</p>
            <p class="hidden text-[11px] text-slate-400 sm:block">Monte o layout uma vez. Na edição rápida só entram os produtos.</p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button type="button" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700" @click="openCategoryDialog()">
            <Tag class="h-4 w-4" />
            <span class="hidden sm:inline">Nova categoria</span>
          </button>
          <button type="button" class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 active:scale-[.98]" @click="openCreateDialog">
            <Plus class="h-4 w-4" />
            <span class="hidden sm:inline">Novo modelo</span>
            <span class="sm:hidden">Novo</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section class="relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-7 text-white shadow-2xl shadow-slate-900/10 sm:px-8 sm:py-9">
        <div class="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-indigo-500/30 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-44 left-1/3 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div class="relative max-w-2xl">
          <div class="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-indigo-200">
            <Sparkles class="h-3.5 w-3.5" />
            Edição avançada + edição rápida
          </div>
          <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Crie o encarte pronto. O usuário só joga os produtos.</h1>
          <p class="mt-3 max-w-xl text-sm leading-6 text-slate-300">Use o editor avançado para montar fundo, logo, zona de produtos e rodapé. Depois, a edição rápida abre uma cópia desse modelo e preenche só a lista de ofertas.</p>
          <div class="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-300">
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Layout no modo avançado</span>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Produtos na edição rápida</span>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Mesmo canvas Fabric</span>
          </div>
        </div>
      </section>

      <section class="mt-8">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-500">Sua biblioteca</p>
            <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-900">Modelos reutilizáveis</h2>
            <p class="mt-1 text-sm text-slate-500">Cada modelo vira um encarte novo sem alterar o original.</p>
          </div>
          <label class="relative block w-full sm:w-64">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input v-model="searchQuery" type="search" placeholder="Buscar modelo..." class="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
          </label>
        </div>

        <div v-if="categoryOptions.length" class="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs font-semibold text-slate-600">Filtrar por categoria</p>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar modelos por categoria">
            <button
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              :class="!selectedCategory ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'"
              :aria-pressed="!selectedCategory"
              @click="selectedCategory = null"
            >Todos</button>
            <button
              v-for="category in categoryOptions"
              :key="category.id"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              :class="getCategoryKey(selectedCategory) === getCategoryKey(category.name) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'"
              :aria-pressed="getCategoryKey(selectedCategory) === getCategoryKey(category.name)"
              @click="selectedCategory = category.name"
            >{{ category.name }}</button>
          </div>
        </div>

        <div v-if="isLoading" class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div v-for="index in 4" :key="index" class="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>

        <div v-else-if="loadError" class="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p class="font-semibold">Não foi possível carregar os modelos.</p>
          <p class="mt-1 text-red-600/80">{{ loadError }}</p>
          <button type="button" class="mt-4 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white" @click="loadTemplates">Tentar novamente</button>
        </div>

        <div v-else-if="filteredTemplates.length === 0" class="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
            <LayoutTemplate class="h-7 w-7" />
          </div>
          <h3 class="mt-4 text-base font-bold text-slate-800">{{ hasTemplateFilter ? 'Nenhum modelo encontrado' : 'Nenhum modelo ainda' }}</h3>
          <p class="mt-1 max-w-md text-sm leading-6 text-slate-500">{{ hasTemplateFilter ? 'Tente outra categoria, outro nome ou limpe os filtros.' : 'Crie o primeiro encarte no editor avançado. Deixe a zona de produtos vazia para a edição rápida preenchê-la.' }}</p>
          <button v-if="!hasTemplateFilter" type="button" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500" @click="openCreateDialog">
            <Plus class="h-4 w-4" /> Criar primeiro modelo
          </button>
        </div>

        <div v-else class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <article v-for="template in filteredTemplates" :key="template.id" class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/5">
            <div class="relative flex aspect-[3/1] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#eef2ff,transparent_42%),#f8fafc]">
              <img
                v-if="getProjectPreviewSource(template)"
                :src="getProjectPreviewSource(template) || undefined"
                :alt="template.name"
                class="absolute inset-0 h-full w-full object-cover object-top"
                loading="lazy"
                decoding="async"
              />
              <div v-else class="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-indigo-200 bg-white/70 text-indigo-300">
                <LayoutTemplate class="h-8 w-8" />
              </div>
              <span class="absolute left-3 top-3 rounded-full bg-indigo-600/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">Modelo</span>
            </div>
            <div class="p-4">
              <form v-if="renamingId === template.id" class="space-y-2" @submit.prevent="saveName(template)">
                <input v-model="renameDraft" aria-label="Nome do modelo" maxlength="120" required class="w-full rounded-lg border border-violet-300 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-500" @keydown.esc="renamingId = ''" />
                <div class="flex gap-3 text-xs">
                  <button type="submit" :disabled="savingName || !renameDraft.trim()" class="rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white disabled:opacity-50">{{ savingName ? 'Salvando…' : 'Salvar nome' }}</button>
                  <button type="button" :disabled="savingName" class="text-slate-500" @click="renamingId = ''">Cancelar</button>
                </div>
              </form>
              <div v-else class="flex items-center gap-2">
                <h3 class="min-w-0 flex-1 truncate text-sm font-bold text-slate-800" :title="sentenceName(template.name)">{{ sentenceName(template.name) }}</h3>
                <button class="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600" title="Alterar nome" aria-label="Alterar nome" @click="startRename(template)"><Pencil class="h-4 w-4" /></button>
              </div>
              <form v-if="categoryEditingId === template.id" class="mt-2 flex items-center gap-2" @submit.prevent="saveCategory(template)">
                <label class="sr-only" :for="`template-category-${template.id}`">Categoria do modelo</label>
                <select
                  :id="`template-category-${template.id}`"
                  v-model="categoryDraftId"
                  class="min-w-0 flex-1 rounded-lg border border-indigo-300 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  @keydown.esc="categoryEditingId = ''"
                >
                  <option value="">Sem categoria</option>
                  <option v-for="category in categoryOptions" :key="category.id" :value="category.id">{{ category.name }}</option>
                </select>
                <button type="button" class="rounded-lg border border-indigo-200 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-50" @click="openCategoryDialog('edit')">Nova</button>
                <button type="submit" :disabled="savingCategory" class="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">{{ savingCategory ? '...' : 'Salvar' }}</button>
                <button type="button" :disabled="savingCategory" class="text-[11px] font-medium text-slate-500" @click="categoryEditingId = ''">Cancelar</button>
              </form>
              <div v-else class="mt-2 flex flex-wrap items-center gap-2">
                <span class="inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold" :class="getTemplateCategory(template) ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'">
                  <Tag class="h-3 w-3 shrink-0" />
                  <span class="truncate">{{ getTemplateCategory(template) || 'Sem categoria' }}</span>
                </span>
                <button type="button" class="text-[10px] font-semibold text-indigo-600 transition hover:text-indigo-800" @click="startCategoryEdit(template)">Editar categoria</button>
              </div>
              <p class="mt-1 text-[11px] text-slate-400">{{ formatTemplateStructure(template) }} · {{ formatSize(template) }} · {{ formatDate(template.updated_at || template.created_at) }}</p>
              <div class="mt-4 flex items-center gap-2">
                <button type="button" class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60" :disabled="!!usingTemplateId" @click="useTemplate(template)">
                  <LoaderCircle v-if="usingTemplateId === template.id" class="h-3.5 w-3.5 animate-spin" />
                  <Zap v-else class="h-3.5 w-3.5" />
                  Usar rápido
                </button>
                <NuxtLink :to="`/editor/${template.id}`" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600" title="Editar no modo avançado">
                  <Pencil class="h-4 w-4" />
                </NuxtLink>
                <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600" title="Duplicar modelo" @click="duplicateTemplate(template)">
                  <Copy class="h-4 w-4" />
                </button>
                <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" title="Excluir modelo" :disabled="deletingTemplateId === template.id" @click="deleteTemplate(template)">
                  <LoaderCircle v-if="deletingTemplateId === template.id" class="h-4 w-4 animate-spin" />
                  <Trash2 v-else class="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>

    <div v-if="showCreateDialog" class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:p-5" @click.self="!isCreating && (showCreateDialog = false)">
      <div class="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
        <div class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7 sm:py-6">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-500">Novo tema</p>
            <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-900">Montar no editor avançado</h2>
            <p class="mt-1 text-sm text-slate-500">Escolha o nome e os formatos que deseja criar.</p>
          </div>
          <button type="button" class="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" :disabled="isCreating" @click="showCreateDialog = false"><X class="h-5 w-5" /></button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div class="space-y-5">
          <label class="block">
            <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Nome do modelo</span>
            <input v-model="createName" type="text" maxlength="120" autofocus placeholder="Ex.: Oferta vermelha, Semana, Atacarejo..." class="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" @keyup.enter="createTemplate" />
          </label>

          <div>
            <div class="mb-2 flex items-center justify-between gap-3">
              <label for="create-template-category" class="block text-xs font-bold uppercase tracking-wider text-slate-500">Categoria</label>
              <button type="button" class="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 transition hover:text-indigo-800" @click="openCategoryDialog('create')">
                <Plus class="h-3.5 w-3.5" /> Nova categoria
              </button>
            </div>
            <select id="create-template-category" v-model="createCategoryId" class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10">
              <option value="">Sem categoria</option>
              <option v-for="category in categoryOptions" :key="category.id" :value="category.id">{{ category.name }}</option>
            </select>
            <span class="mt-1.5 block text-[11px] leading-5 text-slate-400">Escolha uma categoria já criada ou crie uma nova. Ela poderá ser usada em vários modelos.</span>
          </div>

          <div>
            <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Composição inicial</span>
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                class="rounded-2xl border p-3 text-left transition"
                :class="!createPresetId ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10' : 'border-slate-200 bg-white hover:border-indigo-200'"
                :aria-pressed="!createPresetId"
                @click="selectCreatePreset(null)"
              >
                <span class="block text-sm font-semibold text-slate-800">Em branco</span>
                <span class="mt-0.5 block text-[11px] leading-5 text-slate-500">Crie a estrutura vazia para desenhar do zero.</span>
              </button>
              <button
                v-for="preset in FLYER_TEMPLATE_PRESETS"
                :key="preset.id"
                type="button"
                class="rounded-2xl border p-3 text-left transition"
                :class="createPresetId === preset.id ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10' : 'border-slate-200 bg-white hover:border-indigo-200'"
                :aria-pressed="createPresetId === preset.id"
                @click="selectCreatePreset(preset.id)"
              >
                <span class="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Sparkles class="h-3.5 w-3.5 text-amber-500" /> {{ preset.name }}</span>
                <span class="mt-0.5 block text-[11px] leading-5 text-slate-500">{{ preset.description }}</span>
              </button>
            </div>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between gap-3">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Formatos disponíveis</span>
              <span class="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-600">
                {{ selectedFormats.length }} formato{{ selectedFormats.length === 1 ? '' : 's' }}
              </span>
            </div>

            <button
              type="button"
              class="flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition"
              :class="createAllFormats ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10' : 'border-slate-200 bg-white hover:border-indigo-200'"
              @click="selectAllCreateFormats"
            >
              <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border" :class="createAllFormats ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'">
                <svg v-if="createAllFormats" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.415 0l-3.25-3.25a1 1 0 111.415-1.42l2.543 2.544 6.543-6.544a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold text-slate-800">Criar todos os formatos</span>
                <span class="mt-0.5 block text-[11px] leading-5 text-slate-500">Cria uma página para cada formato: Story, Feed, Post, Banner e A4.</span>
              </span>
            </button>

            <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="format in FLYER_TEMPLATE_FORMATS"
                :key="format.id"
                type="button"
                class="flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition"
                :class="createAllFormats || createFormatIds.includes(format.id) ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white hover:border-indigo-200'"
                @click="toggleCreateFormat(format.id)"
              >
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border" :class="createAllFormats || createFormatIds.includes(format.id) ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'">
                  <svg v-if="createAllFormats || createFormatIds.includes(format.id)" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5"><path fill-rule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.415 0l-3.25-3.25a1 1 0 111.415-1.42l2.543 2.544 6.543-6.544a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-semibold text-slate-800">{{ format.label }}</span>
                  <span class="mt-0.5 block text-[11px] text-slate-500">{{ format.hint }} · {{ format.width }}×{{ format.height }}</span>
                </span>
              </button>
            </div>
            <p class="mt-2 text-[11px] text-slate-400">Cada formato selecionado terá sua própria página para você personalizar no editor.</p>
          </div>
          </div>
        </div>

        <div class="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          <button type="button" class="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50" :disabled="isCreating" @click="showCreateDialog = false">Cancelar</button>
          <button type="button" class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60" :disabled="isCreating" @click="createTemplate">
              <LoaderCircle v-if="isCreating" class="h-4 w-4 animate-spin" />
              <Plus v-else class="h-4 w-4" />
              {{ isCreating ? 'Criando...' : 'Criar e editar' }}
            </button>
        </div>
      </div>
    </div>

    <div v-if="showCategoryDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" @click.self="!isCreatingCategory && (showCategoryDialog = false)">
      <form class="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6" @submit.prevent="createCatalogCategory">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-500">Biblioteca</p>
            <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-900">Nova categoria</h2>
            <p class="mt-1 text-sm leading-6 text-slate-500">Ela ficará disponível para selecionar em qualquer modelo.</p>
          </div>
          <button type="button" class="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" :disabled="isCreatingCategory" aria-label="Fechar" @click="showCategoryDialog = false"><X class="h-5 w-5" /></button>
        </div>
        <label class="mt-5 block">
          <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Nome da categoria</span>
          <input v-model="categoryDialogName" type="text" maxlength="60" autofocus placeholder="Ex.: Hortifruti, Limpeza, Fim de semana..." class="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10" />
        </label>
        <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50" :disabled="isCreatingCategory" @click="showCategoryDialog = false">Cancelar</button>
          <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-60" :disabled="isCreatingCategory || !categoryDialogName.trim()">
            <LoaderCircle v-if="isCreatingCategory" class="h-4 w-4 animate-spin" />
            <Plus v-else class="h-4 w-4" />
            {{ isCreatingCategory ? 'Criando...' : 'Criar categoria' }}
          </button>
        </div>
      </form>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-2xl" :class="toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'" role="status">
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
