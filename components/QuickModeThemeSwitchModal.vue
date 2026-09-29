<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  ArrowDownAZ,
  Eye,
  LayoutTemplate,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  X,
  Zap
} from 'lucide-vue-next'
import { getProjectPreviewSource } from '~/utils/dashboardProjectPreview'
import {
  listFlyerTemplates,
  type FlyerTemplateSummary
} from '~/utils/flyerTemplateApi'
import { normalizeFlyerTemplateCategory } from '~/utils/flyerTemplateCategory'

const props = defineProps<{
  open: boolean
  busy?: boolean
  currentTemplateId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-template', template: FlyerTemplateSummary): void
}>()

const { getApiAuthHeaders } = useApiAuth()

const isLoading = ref(false)
const errorMessage = ref('')
const templates = ref<FlyerTemplateSummary[]>([])
const selectedTemplateCategory = ref<string | null>(null)
const selectedTemplateSubcategory = ref<string | null>(null)
const templateSearch = ref('')
const templateSort = ref<'recent' | 'name'>('recent')

const previewTemplate = ref<FlyerTemplateSummary | null>(null)
const previewDialog = ref<HTMLDialogElement | null>(null)
const previewImageFailed = ref(false)
const previewImageLoading = ref(false)

const normalizeSearchValue = (value: unknown): string => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim()

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

const clearTemplateFilters = () => {
  templateSearch.value = ''
  templateSort.value = 'recent'
  selectedTemplateCategory.value = null
  selectedTemplateSubcategory.value = null
}

const showTemplatePreview = async (template: FlyerTemplateSummary) => {
  previewTemplate.value = template
  previewImageFailed.value = false
  previewImageLoading.value = !!getProjectPreviewSource(template)
  await nextTick()
  previewDialog.value?.showModal()
}

const closeTemplatePreview = () => {
  previewDialog.value?.close()
}

const selectPreviewTemplate = () => {
  const template = previewTemplate.value
  if (!template) return
  closeTemplatePreview()
  emit('select-template', template)
}

const handleSelect = (template: FlyerTemplateSummary) => {
  emit('select-template', template)
}

const loadTemplates = async () => {
  if (isLoading.value) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    const headers = await getApiAuthHeaders()
    templates.value = await listFlyerTemplates(headers, { library: true })
  } catch (err: any) {
    errorMessage.value = String(
      err?.data?.statusMessage ||
      err?.message ||
      'Não foi possível carregar os modelos.'
    )
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void loadTemplates()
})
</script>

<template>
  <div
    v-if="props.open"
    class="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-6"
    role="dialog"
    aria-modal="true"
    aria-labelledby="theme-modal-title"
  >
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity"
      @click="emit('close')"
    ></div>

    <!-- Modal Card -->
    <div
      class="relative z-10 flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl shadow-black/60"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <LayoutTemplate class="h-4 w-4" />
            </span>
            <h2 id="theme-modal-title" class="text-base font-bold text-white">
              Trocar de Tema
            </h2>
            <span class="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-400/20">
              Substitui tudo
            </span>
          </div>
          <p class="mt-1 text-xs text-slate-400">
            Escolha o novo tema. O layout e a arte serão totalmente substituídos, preservando seus produtos, preços e dados da loja.
          </p>
        </div>
        <button
          type="button"
          aria-label="Fechar modal"
          class="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          @click="emit('close')"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Filters & Search -->
      <div class="border-b border-slate-800/80 bg-slate-950/40 p-4 sm:px-6">
        <div class="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div class="relative">
            <Search class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              v-model="templateSearch"
              type="search"
              placeholder="Buscar tema por nome, categoria ou campanha…"
              class="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-9 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              v-if="templateSearch"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-white"
              @click="templateSearch = ''"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>

          <div class="relative">
            <ArrowDownAZ class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
            <select
              v-model="templateSort"
              class="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="recent">Mais recentes</option>
              <option value="name">Nome: A–Z</option>
            </select>
            <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">⌄</span>
          </div>
        </div>

        <!-- Categories -->
        <div v-if="templateCategories.length" class="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition"
            :class="!selectedTemplateCategory ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:bg-slate-700'"
            @click="selectTemplateCategory(null)"
          >
            Todos
            <span class="rounded-full px-1.5 py-0.2 text-[9px]" :class="!selectedTemplateCategory ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'">{{ templates.length }}</span>
          </button>
          <button
            v-for="cat in templateCategories"
            :key="cat"
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition"
            :class="getCategoryKey(selectedTemplateCategory) === getCategoryKey(cat) ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:bg-slate-700'"
            @click="selectTemplateCategory(cat)"
          >
            {{ cat }}
            <span class="rounded-full px-1.5 py-0.2 text-[9px]" :class="getCategoryKey(selectedTemplateCategory) === getCategoryKey(cat) ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'">{{ getTemplateCategoryCount(cat) }}</span>
          </button>
        </div>

        <!-- Subcategories -->
        <div v-if="selectedTemplateCategory && templateSubcategories.length" class="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition"
            :class="!selectedTemplateSubcategory ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:bg-slate-700'"
            @click="selectedTemplateSubcategory = null"
          >
            Todas subcategorias
          </button>
          <button
            v-for="subcat in templateSubcategories"
            :key="subcat"
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition"
            :class="getCategoryKey(selectedTemplateSubcategory) === getCategoryKey(subcat) ? 'border-sky-500 bg-sky-600 text-white' : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:bg-slate-700'"
            @click="selectedTemplateSubcategory = subcat"
          >
            {{ subcat }}
            <span class="rounded-full px-1 text-[9px]" :class="getCategoryKey(selectedTemplateSubcategory) === getCategoryKey(subcat) ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'">{{ getTemplateSubcategoryCount(subcat) }}</span>
          </button>
        </div>
      </div>

      <!-- Content Grid -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 class="h-8 w-8 animate-spin text-blue-500" />
          <span class="mt-3 text-xs font-semibold">Carregando catálogo de temas…</span>
        </div>

        <div v-else-if="errorMessage" class="rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-center text-xs text-red-300">
          <p>{{ errorMessage }}</p>
          <button
            type="button"
            class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
            @click="loadTemplates"
          >
            Tentar novamente
          </button>
        </div>

        <div v-else-if="filteredTemplates.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="(template, index) in filteredTemplates"
            :key="template.id"
            class="group flex flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-800/60 text-left transition duration-150 hover:-translate-y-0.5 hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-950/50"
            :class="{ 'ring-2 ring-blue-500 border-blue-500': template.id === props.currentTemplateId }"
          >
            <div class="relative flex aspect-[3/1] w-full items-center justify-center overflow-hidden bg-slate-950">
              <img
                v-if="getProjectPreviewSource(template)"
                :src="getProjectPreviewSource(template) || undefined"
                :alt="template.name"
                class="absolute inset-0 h-full w-full object-cover object-top"
                :loading="index < 6 ? 'eager' : 'lazy'"
                decoding="async"
              />
              <LayoutTemplate v-else class="h-10 w-10 text-slate-600" />
              <span
                v-if="template.id === props.currentTemplateId"
                class="absolute left-2.5 top-2.5 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow"
              >
                Tema Atual
              </span>
              <span
                v-else
                class="absolute left-2.5 top-2.5 rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-300 border border-slate-700 shadow"
              >
                Tema
              </span>

              <span
                v-if="getTemplateCategoryLabel(template)"
                class="absolute right-2.5 top-2.5 inline-flex max-w-[65%] items-center gap-1 truncate rounded-full bg-slate-900/90 px-2 py-0.5 text-[9px] font-bold text-slate-200 border border-slate-700 shadow"
              >
                <Tag class="h-2.5 w-2.5 shrink-0 text-blue-400" />
                <span class="truncate">{{ getTemplateCategoryLabel(template) }}</span>
              </span>
            </div>

            <div class="flex flex-1 flex-col justify-between p-3.5">
              <div>
                <p class="truncate text-xs font-bold text-white">{{ template.name }}</p>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  <span v-if="template.template_format_count">{{ template.template_format_count }} {{ template.template_format_count === 1 ? 'formato' : 'formatos' }}</span>
                  <span v-if="template.template_model_count">{{ template.template_model_count }} {{ template.template_model_count === 1 ? 'modelo' : 'modelos' }}</span>
                </div>
              </div>

              <div class="mt-3 flex gap-2">
                <button
                  type="button"
                  class="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                  @click="showTemplatePreview(template)"
                >
                  <Eye class="h-3.5 w-3.5" /> Ver prévia
                </button>
                <button
                  type="button"
                  class="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                  :disabled="props.busy || template.id === props.currentTemplateId"
                  @click="handleSelect(template)"
                >
                  <Zap class="h-3.5 w-3.5" />
                  <span>{{ template.id === props.currentTemplateId ? 'Atual' : 'Substituir' }}</span>
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 px-5 py-12 text-center text-slate-400">
          <Search class="mx-auto h-8 w-8 text-slate-500" />
          <p class="mt-3 text-xs font-bold text-slate-200">Nenhum tema encontrado</p>
          <p class="mt-1 text-[11px] text-slate-400">Ajuste os filtros ou o termo de busca para encontrar outros modelos.</p>
          <button
            v-if="hasTemplateFilters"
            type="button"
            class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-600/30"
            @click="clearTemplateFilters"
          >
            <RotateCcw class="h-3.5 w-3.5" /> Limpar filtros
          </button>
        </div>
      </div>

      <!-- Footer Info -->
      <div class="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-6 py-3 text-xs text-slate-400">
        <span>Ao trocar, toda a arte do modelo novo é aplicada e seus produtos são organizados na nova grade.</span>
        <button
          type="button"
          class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          @click="emit('close')"
        >
          Cancelar
        </button>
      </div>
    </div>

    <!-- Preview Modal -->
    <dialog
      ref="previewDialog"
      aria-labelledby="template-preview-dialog-title"
      class="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/80"
      @click.self="closeTemplatePreview"
      @close="previewTemplate = null"
    >
      <template v-if="previewTemplate">
        <header class="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div class="min-w-0">
            <h3 id="template-preview-dialog-title" class="text-base font-bold text-white">{{ previewTemplate.name }}</h3>
            <p class="mt-0.5 text-xs text-slate-400">Prévia do tema</p>
          </div>
          <button type="button" autofocus aria-label="Fechar prévia" class="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" @click="closeTemplatePreview">
            <X class="h-5 w-5" />
          </button>
        </header>
        <div class="relative flex min-h-64 items-center justify-center bg-slate-950 p-4">
          <Loader2 v-if="previewImageLoading" class="absolute h-8 w-8 animate-spin text-blue-500" aria-label="Carregando prévia" />
          <img
            v-if="getProjectPreviewSource(previewTemplate) && !previewImageFailed"
            :key="previewTemplate.id"
            :src="getProjectPreviewSource(previewTemplate) || undefined"
            :alt="`Prévia de ${previewTemplate.name}`"
            class="relative max-h-[65dvh] max-w-full object-contain shadow-md"
            @load="previewImageLoading = false"
            @error="previewImageFailed = true; previewImageLoading = false"
          />
          <p v-else class="text-center text-xs text-slate-500">Prévia indisponível para este tema.</p>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
          <p class="text-xs text-slate-400">Substitui a arte atual mantendo sua lista de ofertas.</p>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
            :disabled="props.busy || previewTemplate.id === props.currentTemplateId"
            @click="selectPreviewTemplate"
          >
            <Zap class="h-4 w-4" />
            <span>{{ previewTemplate.id === props.currentTemplateId ? 'Tema já selecionado' : 'Substituir tudo por este tema' }}</span>
          </button>
        </footer>
      </template>
    </dialog>
  </div>
</template>
