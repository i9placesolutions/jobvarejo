<script setup lang="ts">
import { ArrowLeft, Clock3, LayoutTemplate, Loader2, Plus, RefreshCw, Search, Zap } from 'lucide-vue-next'
import { formatHistoryDateTime, formatHistoryRelative } from '~/utils/dateTimeFormat'
import { getProjectPreviewSource } from '~/utils/dashboardProjectPreview'
import type { ProjectListRow } from '~/types/project'
import {
  instantiateFlyerTemplate,
  listFlyerTemplates,
  type FlyerTemplateSummary
} from '~/utils/flyerTemplateApi'

definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false
})

const route = useRoute()
const router = useRouter()
const { getApiAuthHeaders } = useApiAuth()

const isOpening = ref(true)
const isPicking = ref(false)
const errorMessage = ref('')
const templates = ref<FlyerTemplateSummary[]>([])
const usingTemplateId = ref('')
const existingProjects = ref<ProjectListRow[]>([])
const projectSearch = ref('')
const filteredProjects = computed(() => {
  const normalizedSearch = projectSearch.value.trim().toLocaleLowerCase('pt-BR')
  return [...existingProjects.value]
    .sort((a, b) =>
    (Date.parse(b.updated_at || '') || 0) - (Date.parse(a.updated_at || '') || 0))
    .filter(project => String(project.name || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch))
})

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
        <NuxtLink to="/flyer-templates" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600">
          <LayoutTemplate class="h-4 w-4" />
          Gerenciar modelos
        </NuxtLink>
      </div>
    </header>

    <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div class="max-w-2xl">
        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">Edição rápida</p>
        <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Seus encartes, prontos para continuar.</h1>
        <p class="mt-3 text-sm leading-6 text-slate-500">Toque em um encarte salvo para seguir de onde parou ou escolha um modelo para criar outro.</p>
      </div>

      <section v-if="!isOpening && existingProjects.length" class="mt-8" aria-labelledby="saved-flyers-heading">
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
      </section>

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
        <p v-if="errorMessage" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{{ errorMessage }}</p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="template in templates"
            :key="template.id"
            type="button"
            class="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-900/5 disabled:cursor-wait disabled:opacity-70"
            :disabled="!!usingTemplateId"
            @click="useTemplate(template)"
          >
            <div class="relative flex aspect-[3/1] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#eef2ff,transparent_42%),#f8fafc]">
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
            </div>
            <div class="flex items-center justify-between gap-3 p-4">
              <div class="min-w-0">
                <p class="truncate text-sm font-bold text-slate-800">{{ template.name }}</p>
                <p class="mt-1 text-[11px] text-slate-400">Abrir e preencher produtos</p>
              </div>
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Loader2 v-if="usingTemplateId === template.id" class="h-4 w-4 animate-spin" />
                <Zap v-else class="h-4 w-4" />
              </span>
            </div>
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.quick-entry {
  font-family: Barlow, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
</style>
