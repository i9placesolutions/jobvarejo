<script setup lang="ts">
import {
  ArrowDownAZ,
  ArrowLeft,
  Clock3,
  Eye,
  FolderOpen,
  LayoutTemplate,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
  Zap
} from 'lucide-vue-next'
import { formatHistoryDateTime, formatHistoryRelative } from '~/utils/dateTimeFormat'
import { getProjectPreviewSource } from '~/utils/dashboardProjectPreview'
import type { ProjectListRow } from '~/types/project'
import {
  instantiateFlyerTemplate,
  listFlyerTemplates,
  type FlyerTemplateSummary
} from '~/utils/flyerTemplateApi'
import { normalizeFlyerTemplateCategory } from '~/utils/flyerTemplateCategory'

definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false
})

const route = useRoute()
const router = useRouter()
const { getApiAuthHeaders } = useApiAuth()

const isProjectsLoading = ref(false)
const hasLoadedProjects = ref(false)
const projectsLoadError = ref('')
const activeTab = ref<'models' | 'projects'>('models')
const selectEntryTab = (tab: 'models' | 'projects', event?: KeyboardEvent) => {
  activeTab.value = tab
  if (tab === 'projects' && !hasLoadedProjects.value && !isProjectsLoading.value) {
    void loadSavedProjects()
  }
  if (event) {
    event.preventDefault()
    document.getElementById(`quick-tab-${tab}`)?.focus()
  }
}
const isOpening = ref(true)
const isPicking = ref(false)
const errorMessage = ref('')
const templates = ref<FlyerTemplateSummary[]>([])
const usingTemplateId = ref('')
const previewTemplate = ref<FlyerTemplateSummary | null>(null)
const previewDialog = ref<HTMLDialogElement | null>(null)
const previewImageFailed = ref(false)
const previewImageLoading = ref(false)
const showTemplatePreview = async (template: FlyerTemplateSummary) => {
  previewTemplate.value = template
  previewImageFailed.value = false
  previewImageLoading.value = !!getProjectPreviewSource(template)
  await nextTick()
  previewDialog.value?.showModal()
}
const closeTemplatePreview = () => previewDialog.value?.close()
const usePreviewTemplate = async () => {
  const template = previewTemplate.value
  if (!template) return
  closeTemplatePreview()
  await useTemplate(template)
}
const selectedTemplateCategory = ref<string | null>(null)
const selectedTemplateSubcategory = ref<string | null>(null)
const templateSearch = ref('')
const templateSort = ref<'recent' | 'name'>('recent')
const existingProjects = ref<ProjectListRow[]>([])
const projectSearch = ref('')
const projectSort = ref<'recent' | 'oldest' | 'name'>('recent')

const normalizeSearchValue = (value: unknown): string => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim()

const getProjectTimestamp = (project: ProjectListRow): number =>
  Date.parse(project.updated_at || project.created_at || '') || 0

const filteredProjects = computed(() => {
  const normalizedSearch = normalizeSearchValue(projectSearch.value)
  return [...existingProjects.value]
    .filter(project => normalizeSearchValue(project.name).includes(normalizedSearch))
    .sort((a, b) => {
      if (projectSort.value === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })
      }
      const difference = getProjectTimestamp(b) - getProjectTimestamp(a)
      return projectSort.value === 'oldest' ? -difference : difference
    })
})
const getTemplateCategory = (template: FlyerTemplateSummary): string | null =>
  normalizeFlyerTemplateCategory(template.template_category)
const getTemplateSubcategory = (template: FlyerTemplateSummary): string | null =>
  normalizeFlyerTemplateCategory(template.template_subcategory)
const getTemplateCategoryLabel = (template: FlyerTemplateSummary): string | null => {
  const category = getTemplateCategory(template)
  const subcategory = getTemplateSubcategory(template)
  return category ? (subcategory ? `${category} · ${subcategory}` : category) : null
}
const getCategoryKey = (value: string | null | undefined): string | null =>
  normalizeSearchValue(normalizeFlyerTemplateCategory(value)) || null
const templateCategories = computed(() => {
  const unique = new Map<string, string>()
  templates.value.forEach((template) => {
    const category = getTemplateCategory(template)
    if (!category) return
    unique.set(getCategoryKey(category) as string, category)
  })
  return [...unique.values()].sort((left, right) => left.localeCompare(right, 'pt-BR'))
})
const templateSubcategories = computed(() => {
  const mainCategoryKey = getCategoryKey(selectedTemplateCategory.value)
  if (!mainCategoryKey) return []
  const unique = new Map<string, string>()
  templates.value.forEach((template) => {
    if (getCategoryKey(getTemplateCategory(template)) !== mainCategoryKey) return
    const subcategory = getTemplateSubcategory(template)
    const key = getCategoryKey(subcategory)
    if (subcategory && key) unique.set(key, subcategory)
  })
  return [...unique.values()].sort((left, right) => left.localeCompare(right, 'pt-BR'))
})

const getTemplateCategoryCount = (category: string): number => templates.value.filter((template) => (
  getCategoryKey(getTemplateCategory(template)) === getCategoryKey(category)
)).length

const getTemplateSubcategoryCount = (subcategory: string): number => templates.value.filter((template) => (
  getCategoryKey(getTemplateCategory(template)) === getCategoryKey(selectedTemplateCategory.value) &&
  getCategoryKey(getTemplateSubcategory(template)) === getCategoryKey(subcategory)
)).length

const selectTemplateCategory = (category: string | null) => {
  selectedTemplateCategory.value = category
  selectedTemplateSubcategory.value = null
}

const filteredTemplates = computed(() => {
  const normalizedSearch = normalizeSearchValue(templateSearch.value)
  const categoryKey = getCategoryKey(selectedTemplateCategory.value)
  const subcategoryKey = getCategoryKey(selectedTemplateSubcategory.value)

  return [...templates.value]
    .filter((template) => {
      if (categoryKey && getCategoryKey(getTemplateCategory(template)) !== categoryKey) return false
      if (subcategoryKey && getCategoryKey(getTemplateSubcategory(template)) !== subcategoryKey) return false
      if (!normalizedSearch) return true

      const searchableText = normalizeSearchValue([
        template.name,
        getTemplateCategory(template),
        getTemplateSubcategory(template),
        template.template_category_label
      ].filter(Boolean).join(' '))
      return searchableText.includes(normalizedSearch)
    })
    .sort((a, b) => {
      if (templateSort.value === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })
      }
      return (Date.parse(b.updated_at || b.created_at || '') || 0) - (Date.parse(a.updated_at || a.created_at || '') || 0)
    })
})

const activeTemplateFilterCount = computed(() => [
  templateSearch.value.trim(),
  selectedTemplateCategory.value,
  selectedTemplateSubcategory.value
].filter(Boolean).length)

const hasTemplateFilters = computed(() => activeTemplateFilterCount.value > 0 || templateSort.value !== 'recent')
const hasProjectFilters = computed(() => !!projectSearch.value.trim() || projectSort.value !== 'recent')

const clearTemplateFilters = () => {
  templateSearch.value = ''
  templateSort.value = 'recent'
  selectedTemplateCategory.value = null
  selectedTemplateSubcategory.value = null
}

const clearProjectFilters = () => {
  projectSearch.value = ''
  projectSort.value = 'recent'
}

const getLastEditedAt = (project: ProjectListRow): string => project.updated_at || project.created_at || ''

const formatLastEdited = (project: ProjectListRow): string =>
  formatHistoryRelative(getLastEditedAt(project)) || 'data não disponível'

const getLastEditedTitle = (project: ProjectListRow): string => {
  const date = getLastEditedAt(project)
  return date ? `Última edição em ${formatHistoryDateTime(date)}` : 'Data da última edição indisponível'
}

const openExistingProject = async (projectId: string) => {
  await router.replace(`/editor/${projectId}?quick=1`)
}

const openFromTemplate = async (templateId: string, name?: string) => {
  const headers = await getApiAuthHeaders()
  const projectId = await instantiateFlyerTemplate({
    headers,
    templateId,
    name
  })
  await router.replace(`/editor/${projectId}?quick=1`)
}

const loadSavedProjects = async () => {
  if (isProjectsLoading.value || hasLoadedProjects.value) return
  isProjectsLoading.value = true
  projectsLoadError.value = ''
  try {
    const headers = await getApiAuthHeaders()
    const saved = await $fetch<ProjectListRow[]>('/api/projects', {
      headers,
      query: { summary: '1' }
    })
    existingProjects.value = Array.isArray(saved) ? saved : []
    hasLoadedProjects.value = true
  } catch (error: any) {
    projectsLoadError.value = String(
      error?.data?.statusMessage ||
      error?.message ||
      'Não foi possível carregar seus trabalhos. Tente novamente.'
    )
  } finally {
    isProjectsLoading.value = false
  }
}

const loadPicker = async () => {
  isPicking.value = true
  isOpening.value = true
  errorMessage.value = ''
  try {
    const headers = await getApiAuthHeaders()
    // A aba inicial é a de modelos. Carregar todos os trabalhos em paralelo
    // bloqueava a primeira prévia quando a conta tinha muitos encartes.
    const models = await listFlyerTemplates(headers)
    templates.value = models
  } catch (error: any) {
    errorMessage.value = String(
      error?.data?.statusMessage ||
      error?.message ||
      'Não foi possível carregar os encartes. Tente novamente.'
    )
  } finally {
    isOpening.value = false
  }
}

const useTemplate = async (template: FlyerTemplateSummary) => {
  if (usingTemplateId.value) return
  usingTemplateId.value = template.id
  errorMessage.value = ''
  try {
    await openFromTemplate(template.id, template.name)
  } catch (error: any) {
    errorMessage.value = String(
      error?.data?.statusMessage ||
      error?.message ||
      'Não foi possível abrir este modelo.'
    )
    usingTemplateId.value = ''
  }
}

const openQuickEditor = async () => {
  if (!isOpening.value) isOpening.value = true
  errorMessage.value = ''

  try {
    const existingProjectId = String(route.query.id || '').trim()
    if (existingProjectId) {
      await openExistingProject(existingProjectId)
      return
    }

    const templateId = String(route.query.template || '').trim()
    if (templateId) {
      await openFromTemplate(templateId)
      return
    }

    await loadPicker()
  } catch (error: any) {
    errorMessage.value = String(
      error?.data?.statusMessage ||
      error?.message ||
      'Não foi possível abrir a edição rápida.'
    )
    isOpening.value = false
    isPicking.value = false
  }
}

onMounted(() => {
  void openQuickEditor()
})
</script>

<template>
  <main class="quick-entry min-h-screen bg-[linear-gradient(180deg,#f7f8fc_0%,#f8fafc_46%,#f1f5f9_100%)] text-slate-900">
    <header class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 shadow-[0_1px_16px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
            @click="navigateTo('/flyer-templates')"
          >
            <ArrowLeft class="h-4 w-4" />
            <span class="hidden sm:inline">Voltar para Encartes</span>
            <span class="sm:hidden">Voltar</span>
          </button>
          <span class="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <NuxtLink to="/flyer-templates" class="hidden items-center gap-2 text-sm font-bold tracking-tight text-slate-800 sm:inline-flex">
            <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
              <Zap class="h-4 w-4" />
            </span>
            JobVarejo · Encartes
          </NuxtLink>
        </div>
        <nav class="flex items-center gap-2" aria-label="Atalhos da edição rápida">
          <NuxtLink to="/flyer-templates" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
            <LayoutTemplate class="h-4 w-4" />
            <span class="hidden sm:inline">Gerenciar modelos</span>
            <span class="sm:hidden">Modelos</span>
          </NuxtLink>
        </nav>
      </div>
    </header>

    <section class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div class="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 px-5 py-7 text-white shadow-2xl shadow-indigo-950/15 sm:px-9 sm:py-10 lg:px-12">
        <div class="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden="true" />
        <div class="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-violet-400/15 blur-3xl" aria-hidden="true" />
        <div class="relative grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-100">
              <Sparkles class="h-3.5 w-3.5 text-amber-300" />
              Edição rápida
            </div>
            <h1 class="mt-4 max-w-xl text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl lg:text-[2.75rem]">Comece pelo encarte certo.</h1>
            <p class="mt-3 max-w-xl text-sm leading-6 text-indigo-100/80 sm:text-base">Encontre um modelo pronto, filtre por categoria ou pesquise pelo nome. Depois, é só preencher os produtos e publicar.</p>
            <div class="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
              <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-indigo-50">
                <LayoutTemplate class="h-3.5 w-3.5 text-indigo-200" />
                {{ isOpening ? 'Carregando modelos…' : `${templates.length} ${templates.length === 1 ? 'modelo disponível' : 'modelos disponíveis'}` }}
              </span>
              <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-indigo-50">
                <Search class="h-3.5 w-3.5 text-indigo-200" />
                Busca e filtros rápidos
              </span>
            </div>
          </div>
          <div class="relative hidden min-h-48 items-center justify-center lg:flex" aria-hidden="true">
            <div class="absolute h-44 w-44 rounded-full border border-white/10" />
            <div class="absolute h-32 w-32 rounded-full border border-white/10" />
            <div class="relative w-64 rotate-[-4deg] rounded-2xl border border-white/20 bg-white/95 p-3 text-slate-900 shadow-2xl shadow-black/20">
              <div class="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-3 py-2 text-white">
                <span class="text-[9px] font-bold uppercase tracking-[0.16em]">Oferta da semana</span>
                <Zap class="h-3.5 w-3.5 text-amber-200" />
              </div>
              <div class="mt-3 grid grid-cols-[0.8fr_1.2fr] items-center gap-3">
                <div class="h-20 rounded-xl bg-gradient-to-br from-amber-100 via-orange-200 to-rose-300" />
                <div class="space-y-2">
                  <div class="h-2.5 w-4/5 rounded-full bg-slate-200" />
                  <div class="h-2.5 w-3/5 rounded-full bg-slate-100" />
                  <div class="h-7 w-2/3 rounded-lg bg-indigo-100" />
                </div>
              </div>
              <div class="mt-3 h-2 w-full rounded-full bg-slate-100" />
            </div>
            <span class="absolute bottom-2 right-5 rounded-full border border-white/15 bg-slate-900/60 px-3 py-1.5 text-[10px] font-bold text-indigo-100 shadow-lg backdrop-blur">Busque · filtre · crie</span>
          </div>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200/80 bg-white/80 p-1.5 shadow-sm sm:inline-flex" role="tablist" aria-label="Edição rápida">
        <button id="quick-tab-models" type="button" role="tab" aria-controls="quick-panel-models"
          :aria-selected="activeTab === 'models'" :tabindex="activeTab === 'models' ? 0 : -1"
          class="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:px-6"
          :class="activeTab === 'models' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'"
          @click="selectEntryTab('models')" @keydown.right="selectEntryTab('projects', $event)" @keydown.left="selectEntryTab('projects', $event)" @keydown.end="selectEntryTab('projects', $event)" @keydown.home="selectEntryTab('models', $event)">
          <LayoutTemplate class="h-4 w-4 shrink-0" /> Escolher modelo
        </button>
        <button id="quick-tab-projects" type="button" role="tab" aria-controls="quick-panel-projects"
          :aria-selected="activeTab === 'projects'" :tabindex="activeTab === 'projects' ? 0 : -1"
          class="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:px-6"
          :class="activeTab === 'projects' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'"
          @click="selectEntryTab('projects')" @keydown.right="selectEntryTab('models', $event)" @keydown.left="selectEntryTab('models', $event)" @keydown.home="selectEntryTab('models', $event)" @keydown.end="selectEntryTab('projects', $event)">
          <Clock3 class="h-4 w-4 shrink-0" /> Meus trabalhos
        </button>
      </div>

      <section v-show="activeTab === 'projects'" id="quick-panel-projects" role="tabpanel" aria-labelledby="quick-tab-projects" tabindex="0" class="mt-8">
        <p v-if="isProjectsLoading" class="text-sm text-slate-500" role="status">Carregando seus trabalhos...</p>
        <div v-else-if="projectsLoadError" class="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-sm text-red-700">
          <p>{{ projectsLoadError }}</p>
          <button type="button" class="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500" @click="loadSavedProjects">Tentar novamente</button>
        </div>
        <div v-else-if="!existingProjects.length" class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 class="text-lg font-bold text-slate-800">Você ainda não tem trabalhos salvos</h2>
          <p class="mt-2 text-sm text-slate-500">Escolha um modelo para criar seu primeiro encarte.</p>
          <button type="button" class="mt-5 min-h-11 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200" @click="selectEntryTab('models')">Escolher modelo</button>
        </div>
        <div v-else>
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Seus trabalhos</p>
            <h2 id="saved-flyers-heading" class="mt-1 text-xl font-bold tracking-tight text-slate-900">Continue de onde parou</h2>
            <p class="mt-1 text-sm text-slate-500">Encontre um encarte salvo e retome a edição em um clique.</p>
          </div>
          <span class="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
            <FolderOpen class="h-3.5 w-3.5" />
            {{ existingProjects.length }} {{ existingProjects.length === 1 ? 'encarte salvo' : 'encartes salvos' }}
          </span>
        </div>

        <div class="mt-5 rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div class="flex items-center gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Search class="h-4 w-4" />
            </span>
            <div>
              <p class="text-sm font-bold text-slate-800">Encontre um trabalho</p>
              <p class="text-xs text-slate-500">Pesquise pelo nome ou organize a lista.</p>
            </div>
          </div>
          <div class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label class="relative block">
              <span class="sr-only">Pesquisar encartes salvos</span>
              <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="quick-editor-project-search" v-model="projectSearch" type="search" autocomplete="off" placeholder="Ex.: ofertas de sábado, hortifruti…" class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
              <button v-if="projectSearch" type="button" aria-label="Limpar busca de encartes" class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" @click="projectSearch = ''">
                <X class="h-4 w-4" />
              </button>
            </label>
            <label class="relative block">
              <span class="sr-only">Ordenar encartes</span>
              <ArrowDownAZ class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
              <select v-model="projectSort" aria-label="Ordenar encartes" class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-9 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100">
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="name">Nome: A–Z</option>
              </select>
              <span class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">⌄</span>
            </label>
          </div>
          <div v-if="hasProjectFilters" class="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span class="font-semibold text-slate-500">Filtros ativos</span>
            <span v-if="projectSearch" class="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">“{{ projectSearch }}”</span>
            <span v-if="projectSort !== 'recent'" class="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{{ projectSort === 'oldest' ? 'Mais antigos' : 'Nome A–Z' }}</span>
            <button type="button" class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" @click="clearProjectFilters">
              <RotateCcw class="h-3 w-3" />
              Limpar
            </button>
          </div>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="(saved, index) in filteredProjects"
            :key="saved.id"
            type="button"
            class="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-900/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
            :title="`${saved.name || 'Sem título'} — ${getLastEditedTitle(saved)}`"
            @click="openExistingProject(saved.id)"
          >
            <div class="relative flex aspect-[3/1] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#eef2ff,transparent_42%),#f8fafc]">
              <img
                v-if="getProjectPreviewSource(saved)"
                :src="getProjectPreviewSource(saved) || undefined"
                :alt="`Cabeçalho do encarte ${saved.name || 'sem título'}`"
                class="absolute inset-0 h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                :loading="index < 6 ? 'eager' : 'lazy'"
                decoding="async"
                :fetchpriority="index < 3 ? 'high' : (index < 6 ? 'auto' : 'low')"
              />
              <LayoutTemplate v-else class="h-10 w-10 text-indigo-300" />
              <span v-if="index === 0 && !projectSearch && projectSort === 'recent'" class="absolute left-3 top-3 rounded-full bg-slate-900/85 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">Mais recente</span>
            </div>
            <div class="p-4">
              <p class="truncate text-sm font-bold text-slate-800">{{ saved.name || 'Encarte sem título' }}</p>
              <p class="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500" :title="getLastEditedTitle(saved)">
                <Clock3 class="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                <span>Última edição {{ formatLastEdited(saved) }}</span>
              </p>
              <span class="mt-4 inline-flex min-h-10 items-center rounded-xl bg-indigo-50 px-3 text-xs font-bold text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white">Abrir encarte</span>
            </div>
          </button>
          <div v-if="!filteredProjects.length" class="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center sm:col-span-2 lg:col-span-3">
            <span class="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Search class="h-5 w-5" /></span>
            <p class="mt-3 text-sm font-bold text-slate-700">Nenhum encarte encontrado</p>
            <p class="mt-1 text-sm text-slate-500">Tente outro nome ou limpe os filtros para ver todos os trabalhos.</p>
            <button v-if="hasProjectFilters" type="button" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" @click="clearProjectFilters">
              <RotateCcw class="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          </div>
        </div>
      </div>
      </section>

      <section v-show="activeTab === 'models'" id="quick-panel-models" role="tabpanel" aria-labelledby="quick-tab-models" tabindex="0">
      <div v-if="isOpening" class="mt-8 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Loader2 class="h-4 w-4 animate-spin text-indigo-500" />
        Preparando o encarte...
      </div>

      <div v-else-if="errorMessage" class="mt-8 max-w-md space-y-4">
        <p class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700" role="alert">{{ errorMessage }}</p>
        <div class="flex gap-2">
          <button type="button" class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500" @click="openQuickEditor">
            <RefreshCw class="h-4 w-4" />
            Tentar novamente
          </button>
          <button type="button" class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50" @click="navigateTo('/flyer-templates')">Sair</button>
        </div>
      </div>

      <div v-else-if="isPicking && templates.length === 0" class="mt-8 flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
          <LayoutTemplate class="h-7 w-7" />
        </div>
        <h2 class="mt-4 text-lg font-bold text-slate-800">Crie um modelo primeiro</h2>
        <p class="mt-2 max-w-md text-sm leading-6 text-slate-500">A edição rápida usa um encarte já montado. Crie o layout no modo avançado e deixe a zona de produtos pronta para receber a lista.</p>
        <NuxtLink to="/flyer-templates" class="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500">
          <Plus class="h-4 w-4" />
          Criar modelo de encarte
        </NuxtLink>
      </div>

      <div v-else class="mt-10">
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Novo encarte</p>
            <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-900">Escolha um modelo</h2>
            <p class="mt-1 text-sm text-slate-500">O modelo abre com os campos e a área de produtos prontos para preencher.</p>
          </div>
          <span class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
            {{ filteredTemplates.length }} de {{ templates.length }} {{ templates.length === 1 ? 'modelo' : 'modelos' }}
          </span>
        </div>

        <div class="mb-6 rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <SlidersHorizontal class="h-4 w-4" />
              </span>
              <div>
                <p class="text-sm font-bold text-slate-800">Encontre seu modelo</p>
                <p class="text-xs text-slate-500">Busque por nome, categoria ou subcategoria.</p>
              </div>
            </div>
            <button v-if="hasTemplateFilters" type="button" class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" @click="clearTemplateFilters">
              <RotateCcw class="h-3.5 w-3.5" />
              Limpar filtros<span v-if="activeTemplateFilterCount"> ({{ activeTemplateFilterCount }})</span>
            </button>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label class="relative block">
              <span class="sr-only">Pesquisar modelos</span>
              <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="quick-editor-template-search" v-model="templateSearch" type="search" autocomplete="off" placeholder="Buscar modelo, campanha ou tema…" class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
              <button v-if="templateSearch" type="button" aria-label="Limpar busca de modelos" class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" @click="templateSearch = ''">
                <X class="h-4 w-4" />
              </button>
            </label>
            <label class="relative block">
              <span class="sr-only">Ordenar modelos</span>
              <ArrowDownAZ class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
              <select v-model="templateSort" aria-label="Ordenar modelos" class="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-9 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100">
                <option value="recent">Mais recentes</option>
                <option value="name">Nome: A–Z</option>
              </select>
              <span class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">⌄</span>
            </label>
          </div>

          <div v-if="templateCategories.length" class="mt-4 border-t border-slate-100 pt-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Categoria</p>
              <span class="text-[11px] text-slate-400">{{ templateCategories.length }} opções</span>
            </div>
            <div class="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar modelos por categoria">
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                :class="!selectedTemplateCategory ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'"
                :aria-pressed="!selectedTemplateCategory"
                @click="selectTemplateCategory(null)"
              >Todos <span class="rounded-full px-1.5 py-0.5 text-[10px]" :class="!selectedTemplateCategory ? 'bg-white/20 text-white' : 'bg-white text-slate-500'">{{ templates.length }}</span></button>
              <button
                v-for="category in templateCategories"
                :key="category"
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                :class="getCategoryKey(selectedTemplateCategory) === getCategoryKey(category) ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'"
                :aria-pressed="getCategoryKey(selectedTemplateCategory) === getCategoryKey(category)"
                @click="selectTemplateCategory(category)"
              >{{ category }} <span class="rounded-full px-1.5 py-0.5 text-[10px]" :class="getCategoryKey(selectedTemplateCategory) === getCategoryKey(category) ? 'bg-white/20 text-white' : 'bg-white text-slate-500'">{{ getTemplateCategoryCount(category) }}</span></button>
            </div>
          </div>

          <div v-if="selectedTemplateCategory && templateSubcategories.length" class="mt-4 border-t border-slate-100 pt-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Subcategoria</p>
              <span class="text-[11px] text-slate-400">{{ templateSubcategories.length }} opções</span>
            </div>
            <div class="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar modelos por subcategoria">
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                :class="!selectedTemplateSubcategory ? 'border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-600/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700'"
                :aria-pressed="!selectedTemplateSubcategory"
                @click="selectedTemplateSubcategory = null"
              >Todas</button>
              <button
                v-for="subcategory in templateSubcategories"
                :key="subcategory"
                type="button"
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                :class="getCategoryKey(selectedTemplateSubcategory) === getCategoryKey(subcategory) ? 'border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-600/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700'"
                :aria-pressed="getCategoryKey(selectedTemplateSubcategory) === getCategoryKey(subcategory)"
                @click="selectedTemplateSubcategory = subcategory"
              >{{ subcategory }} <span class="rounded-full px-1.5 py-0.5 text-[10px]" :class="getCategoryKey(selectedTemplateSubcategory) === getCategoryKey(subcategory) ? 'bg-white/20 text-white' : 'bg-white text-slate-500'">{{ getTemplateSubcategoryCount(subcategory) }}</span></button>
            </div>
          </div>

          <div v-if="activeTemplateFilterCount" class="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span class="font-semibold text-slate-500">Aplicado:</span>
            <span v-if="templateSearch" class="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">“{{ templateSearch }}”</span>
            <span v-if="selectedTemplateCategory" class="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">{{ selectedTemplateCategory }}</span>
            <span v-if="selectedTemplateSubcategory" class="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-violet-700">{{ selectedTemplateSubcategory }}</span>
          </div>
        </div>
        <p v-if="errorMessage" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{{ errorMessage }}</p>
        <div v-if="filteredTemplates.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="(template, index) in filteredTemplates"
            :key="template.id"
            class="group overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/5"
          >
            <button type="button" :aria-label="`Ver prévia de ${template.name}`" class="relative flex aspect-[3/1] w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#eef2ff,transparent_42%),#f8fafc] focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:-outline-offset-2" @click="showTemplatePreview(template)">
              <img
                v-if="getProjectPreviewSource(template)"
                :src="getProjectPreviewSource(template) || undefined"
                :alt="template.name"
                class="absolute inset-0 h-full w-full object-cover object-top"
                :loading="index < 6 ? 'eager' : 'lazy'"
                decoding="async"
                :fetchpriority="index < 3 ? 'high' : (index < 6 ? 'auto' : 'low')"
              />
              <LayoutTemplate v-else class="h-10 w-10 text-indigo-300" />
              <span class="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 shadow-sm">Modelo</span>
              <span v-if="getTemplateCategoryLabel(template)" class="absolute right-3 top-3 inline-flex max-w-[65%] items-center gap-1 truncate rounded-full bg-slate-900/80 px-2.5 py-1 text-[9px] font-bold text-white shadow-sm">
                <Tag class="h-3 w-3 shrink-0" />
                <span class="truncate">{{ getTemplateCategoryLabel(template) }}</span>
              </span>
            </button>
            <div class="p-4">
              <div class="flex items-start justify-between gap-3">
                <p class="min-w-0 truncate text-sm font-bold text-slate-800">{{ template.name }}</p>
                <span v-if="template.template_format_count" class="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{{ template.template_format_count }} {{ template.template_format_count === 1 ? 'formato' : 'formatos' }}</span>
              </div>
              <div v-if="template.template_model_count || template.template_format_count" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span v-if="template.template_model_count">{{ template.template_model_count }} {{ template.template_model_count === 1 ? 'modelo visual' : 'modelos visuais' }}</span>
                <span v-if="template.template_page_count">{{ template.template_page_count }} {{ template.template_page_count === 1 ? 'página pronta' : 'páginas prontas' }}</span>
              </div>
              <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" @click="showTemplatePreview(template)">
                  <Eye class="h-4 w-4" /> Ver prévia
                </button>
                <button type="button" class="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-600/15 transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200" :disabled="!!usingTemplateId" @click="useTemplate(template)">
                  <Loader2 v-if="usingTemplateId === template.id" class="h-4 w-4 animate-spin" />
                  <Zap v-else class="h-4 w-4" /> Usar modelo
                </button>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <span class="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Search class="h-5 w-5" /></span>
          <p class="mt-3 text-sm font-bold text-slate-700">Nenhum modelo encontrado</p>
          <p class="mt-1 text-sm text-slate-500">Ajuste sua busca ou escolha outra categoria para continuar.</p>
          <button v-if="hasTemplateFilters" type="button" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100" @click="clearTemplateFilters">
            <RotateCcw class="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        </div>
      </div>
      </section>
    </section>
    <dialog ref="previewDialog" aria-labelledby="template-preview-title" class="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/70" @click.self="closeTemplatePreview" @close="previewTemplate = null">
      <template v-if="previewTemplate">
        <header class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div class="min-w-0">
            <h2 id="template-preview-title" class="text-lg font-bold text-slate-900">{{ previewTemplate.name }}</h2>
            <p class="mt-1 text-xs text-slate-500">Prévia do modelo</p>
          </div>
          <button type="button" autofocus aria-label="Fechar prévia" class="rounded-lg p-2 text-slate-600 hover:bg-slate-100" @click="closeTemplatePreview"><X class="h-5 w-5" /></button>
        </header>
        <div class="relative flex min-h-64 items-center justify-center bg-slate-100 p-4">
          <Loader2 v-if="previewImageLoading" class="absolute h-8 w-8 animate-spin text-indigo-600" aria-label="Carregando prévia" />
          <img v-if="getProjectPreviewSource(previewTemplate) && !previewImageFailed" :key="previewTemplate.id" :src="getProjectPreviewSource(previewTemplate) || undefined" :alt="`Prévia de ${previewTemplate.name}`" class="relative max-h-[65dvh] max-w-full object-contain shadow-sm" @load="previewImageLoading = false" @error="previewImageFailed = true; previewImageLoading = false" />
          <p v-else class="text-center text-sm text-slate-500">Prévia indisponível para este modelo.</p>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p class="text-xs text-slate-500">Visualizar não cria um encarte.</p>
          <button type="button" class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70" :disabled="!!usingTemplateId" @click="usePreviewTemplate"><Zap class="h-4 w-4" /> Usar este modelo</button>
        </footer>
      </template>
    </dialog>
  </main>
</template>

<style scoped>
.quick-entry {
  font-family: Barlow, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
</style>
