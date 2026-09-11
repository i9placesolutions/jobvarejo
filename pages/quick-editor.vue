<script setup lang="ts">
import { ArrowLeft, Clock3, Eye, X, LayoutTemplate, Loader2, Plus, RefreshCw, Search, Tag, Zap } from 'lucide-vue-next'
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

const activeTab = ref<'models' | 'projects'>('models')
const selectEntryTab = (tab: 'models' | 'projects', event?: KeyboardEvent) => {
  activeTab.value = tab
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
const existingProjects = ref<ProjectListRow[]>([])
const projectSearch = ref('')
const filteredProjects = computed(() => {
  const normalizedSearch = projectSearch.value.trim().toLocaleLowerCase('pt-BR')
  return [...existingProjects.value]
    .sort((a, b) =>
    (Date.parse(b.updated_at || '') || 0) - (Date.parse(a.updated_at || '') || 0))
    .filter(project => String(project.name || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch))
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
  normalizeFlyerTemplateCategory(value)?.toLocaleLowerCase('pt-BR') || null
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
const selectTemplateCategory = (category: string | null) => {
  selectedTemplateCategory.value = category
  selectedTemplateSubcategory.value = null
}
const filteredTemplates = computed(() => templates.value.filter((template) => {
  if (selectedTemplateCategory.value && (
    getCategoryKey(getTemplateCategory(template)) !== getCategoryKey(selectedTemplateCategory.value)
  )) return false
  if (selectedTemplateSubcategory.value && (
    getCategoryKey(getTemplateSubcategory(template)) !== getCategoryKey(selectedTemplateSubcategory.value)
  )) return false
  return true
}))

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

const loadPicker = async () => {
  isPicking.value = true
  isOpening.value = true
  errorMessage.value = ''
  try {
    const headers = await getApiAuthHeaders()
    const [models, saved] = await Promise.all([listFlyerTemplates(headers), $fetch<ProjectListRow[]>('/api/projects', { headers })])
    templates.value = models
    existingProjects.value = Array.isArray(saved) ? saved : []
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
  <main class="quick-entry min-h-screen bg-[#f6f7fb] text-slate-900">
    <header class="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          class="inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-900"
          @click="navigateTo('/')"
        >
          <ArrowLeft class="h-4 w-4" />
          Voltar ao dashboard
        </button>
        <NuxtLink to="/art-studio" class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700">Estúdio de Artes</NuxtLink>
        <NuxtLink to="/flyer-templates" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600">
          <LayoutTemplate class="h-4 w-4" />
          Gerenciar modelos
        </NuxtLink>
      </div>
    </header>

    <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div class="max-w-2xl">
        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Edição rápida</p>
        <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Escolha um modelo para começar.</h1>
        <p class="mt-3 text-sm leading-6 text-slate-500">Crie um novo encarte a partir de um modelo ou continue uma edição na aba Meus trabalhos.</p>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 sm:inline-flex" role="tablist" aria-label="Edição rápida">
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
        <p v-if="isOpening" class="text-sm text-slate-500" role="status">Carregando seus trabalhos...</p>
        <div v-else-if="!existingProjects.length" class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 class="text-lg font-bold text-slate-800">Você ainda não tem trabalhos salvos</h2>
          <p class="mt-2 text-sm text-slate-500">Escolha um modelo para criar seu primeiro encarte.</p>
          <button type="button" class="mt-5 min-h-11 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200" @click="selectEntryTab('models')">Escolher modelo</button>
        </div>
        <div v-else>

        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Seus trabalhos</p>
            <h2 id="saved-flyers-heading" class="mt-1 text-xl font-bold tracking-tight text-slate-900">Encartes</h2>
            <p class="mt-1 text-sm text-slate-500">A lista já começa pelo que você editou por último.</p>
          </div>
          <span class="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">{{ existingProjects.length }} {{ existingProjects.length === 1 ? 'encarte salvo' : 'encartes salvos' }}</span>
        </div>

        <label class="sr-only" for="quick-editor-project-search">Pesquisar encartes salvos</label>
        <div class="relative mt-4">
          <Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="quick-editor-project-search" v-model="projectSearch" type="search" placeholder="Buscar pelo nome do encarte" class="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
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
            <div class="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#eef2ff,transparent_42%),#f8fafc]">
              <img
                v-if="getProjectPreviewSource(saved)"
                :src="getProjectPreviewSource(saved) || undefined"
                :alt="`Prévia do encarte ${saved.name || 'sem título'}`"
                class="absolute inset-0 h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                loading="lazy"
                decoding="async"
              />
              <LayoutTemplate v-else class="h-10 w-10 text-indigo-300" />
              <span v-if="index === 0 && !projectSearch" class="absolute left-3 top-3 rounded-full bg-slate-900/85 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">Mais recente</span>
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
          <p v-if="!filteredProjects.length" class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-3">Nenhum encarte encontrado com esse nome.</p>
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
          <button type="button" class="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50" @click="navigateTo('/')">Sair</button>
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
        <div class="mb-4">
          <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Novo encarte</p>
          <h2 class="mt-1 text-xl font-bold tracking-tight text-slate-900">Escolha um modelo</h2>
          <p class="mt-1 text-sm text-slate-500">O modelo abre com os campos e a área de produtos prontos para preencher.</p>
        </div>
        <div v-if="templateCategories.length" class="mb-4 rounded-2xl border border-slate-200 bg-white p-3">
          <p class="mb-2 text-xs font-semibold text-slate-600">Categoria principal</p>
          <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar modelos por categoria">
            <button
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              :class="!selectedTemplateCategory ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'"
              :aria-pressed="!selectedTemplateCategory"
              @click="selectTemplateCategory(null)"
            >Todos</button>
            <button
              v-for="category in templateCategories"
              :key="category"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              :class="selectedTemplateCategory === category ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'"
              :aria-pressed="selectedTemplateCategory === category"
              @click="selectTemplateCategory(category)"
            >{{ category }}</button>
          </div>
          <div v-if="selectedTemplateCategory && templateSubcategories.length" class="mt-3 border-t border-slate-100 pt-3">
            <p class="mb-2 text-xs font-semibold text-slate-600">Subcategoria</p>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrar modelos por subcategoria">
              <button
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                :class="!selectedTemplateSubcategory ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700'"
                :aria-pressed="!selectedTemplateSubcategory"
                @click="selectedTemplateSubcategory = null"
              >Todas</button>
              <button
                v-for="subcategory in templateSubcategories"
                :key="subcategory"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                :class="selectedTemplateSubcategory === subcategory ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700'"
                :aria-pressed="selectedTemplateSubcategory === subcategory"
                @click="selectedTemplateSubcategory = subcategory"
              >{{ subcategory }}</button>
            </div>
          </div>
        </div>
        <p v-if="errorMessage" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{{ errorMessage }}</p>
        <div v-if="filteredTemplates.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="template in filteredTemplates"
            :key="template.id"
            class="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/5"
          >
            <button type="button" :aria-label="`Ver prévia de ${template.name}`" class="relative flex aspect-[3/1] w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#eef2ff,transparent_42%),#f8fafc] focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:-outline-offset-2" @click="showTemplatePreview(template)">
              <img
                v-if="getProjectPreviewSource(template)"
                :src="getProjectPreviewSource(template) || undefined"
                :alt="template.name"
                class="absolute inset-0 h-full w-full object-cover object-top"
                loading="lazy"
                decoding="async"
              />
              <LayoutTemplate v-else class="h-10 w-10 text-indigo-300" />
              <span class="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-600 shadow-sm">Modelo</span>
              <span v-if="getTemplateCategoryLabel(template)" class="absolute right-3 top-3 inline-flex max-w-[65%] items-center gap-1 truncate rounded-full bg-slate-900/80 px-2.5 py-1 text-[9px] font-bold text-white shadow-sm">
                <Tag class="h-3 w-3 shrink-0" />
                <span class="truncate">{{ getTemplateCategoryLabel(template) }}</span>
              </span>
            </button>
            <div class="p-4">
              <p class="truncate text-sm font-bold text-slate-800">{{ template.name }}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600" @click="showTemplatePreview(template)">
                  <Eye class="h-4 w-4" /> Ver prévia
                </button>
                <button type="button" class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70" :disabled="!!usingTemplateId" @click="useTemplate(template)">
                  <Loader2 v-if="usingTemplateId === template.id" class="h-4 w-4 animate-spin" />
                  <Zap v-else class="h-4 w-4" /> Usar modelo
                </button>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Nenhum modelo encontrado nesta categoria. Escolha outra categoria ou veja todos os modelos.
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
