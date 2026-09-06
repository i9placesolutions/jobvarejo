<script setup lang="ts">
import { ArrowLeft, LayoutTemplate, Loader2, Plus, RefreshCw, Zap } from 'lucide-vue-next'
import { getProjectPreviewSource } from '~/utils/dashboardProjectPreview'
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
const existingProjects = ref<any[]>([])
const projectSearch = ref('')
const filteredProjects = computed(() => existingProjects.value.filter(p => String(p.name || '').toLocaleLowerCase().includes(projectSearch.value.toLocaleLowerCase())))

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
    const [models, saved] = await Promise.all([listFlyerTemplates(headers), $fetch<any[]>('/api/projects', { headers })])
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
        <h1 class="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Continue seu encarte ou comece um novo.</h1>
        <p class="mt-3 text-sm leading-6 text-slate-500">Abra um projeto salvo para continuar de onde parou. Escolher um modelo abaixo cria um novo encarte.</p>
      </div>

      <section v-if="!isOpening && existingProjects.length" class="mt-8 rounded-2xl border border-indigo-200 bg-white p-5" aria-label="Continuar encarte salvo">
        <h2 class="text-lg font-bold text-slate-900">Continuar editando</h2>
        <p class="mt-1 text-sm text-slate-500">Mantém os produtos, as páginas e as alterações do projeto.</p>
        <input v-model="projectSearch" type="search" placeholder="Pesquisar seus encartes" aria-label="Pesquisar encartes salvos" class="mt-4 w-full rounded-xl border border-slate-200 p-3 text-base" />
        <div class="mt-3 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          <button v-for="saved in filteredProjects" :key="saved.id" type="button" class="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-indigo-400 hover:bg-indigo-50" @click="openExistingProject(saved.id)">
            <span class="min-w-0 truncate text-sm font-semibold text-slate-800">{{ saved.name }}</span><span class="text-sm font-semibold text-indigo-600">Continuar</span>
          </button>
          <p v-if="!filteredProjects.length" class="p-3 text-sm text-slate-500">Nenhum encarte com esse nome.</p>
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

      <div v-else class="mt-8">
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
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
</style>
