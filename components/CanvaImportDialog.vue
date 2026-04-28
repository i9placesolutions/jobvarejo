<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { X, Search, Loader2, ArrowLeft, CheckCircle2, AlertTriangle, ImageIcon, ExternalLink } from 'lucide-vue-next'

interface CanvaDesignSummary {
  id: string
  title: string
  thumbnail: string | null
  edit_url: string | null
  view_url: string | null
  page_count: number
  created_at: number | null
  updated_at: number | null
}

interface CanvaPageSummary {
  index: number
  thumbnail: string | null
}

interface ImportedPage {
  index: number
  key: string
  url: string
  width: number
  height: number
}

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'pages-imported', payload: { design: CanvaDesignSummary; pages: ImportedPage[] }): void
}>()

type Step = 'list' | 'pages'

const step = ref<Step>('list')
const search = ref('')
const designs = ref<CanvaDesignSummary[]>([])
const continuation = ref<string | null>(null)
const isLoadingDesigns = ref(false)
const designsError = ref<string | null>(null)
const designsAuthError = ref(false)

const selectedDesign = ref<CanvaDesignSummary | null>(null)
const pages = ref<CanvaPageSummary[]>([])
const isLoadingPages = ref(false)
const pagesError = ref<string | null>(null)
const selectedPageIndices = ref<Set<number>>(new Set())

const isImporting = ref(false)
const importError = ref<string | null>(null)

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const close = () => {
  if (isImporting.value) return
  open.value = false
}

const resetState = () => {
  step.value = 'list'
  search.value = ''
  designs.value = []
  continuation.value = null
  designsError.value = null
  designsAuthError.value = false
  selectedDesign.value = null
  pages.value = []
  pagesError.value = null
  selectedPageIndices.value = new Set()
  isImporting.value = false
  importError.value = null
}

const fetchDesigns = async (opts: { append?: boolean } = {}) => {
  isLoadingDesigns.value = true
  designsError.value = null
  designsAuthError.value = false
  try {
    const params: Record<string, string> = {}
    if (search.value.trim()) params.query = search.value.trim()
    if (opts.append && continuation.value) params.continuation = continuation.value
    const data = await $fetch<{ designs: CanvaDesignSummary[]; continuation: string | null }>(
      '/api/editor/canva/designs',
      { query: params },
    )
    if (opts.append) {
      designs.value = [...designs.value, ...(data.designs || [])]
    } else {
      designs.value = data.designs || []
    }
    continuation.value = data.continuation || null
  } catch (err: any) {
    const message = String(err?.data?.statusMessage || err?.statusMessage || err?.message || 'Erro ao listar designs')
    if (/oauth|token|invalid_grant|revogado/i.test(message)) {
      designsAuthError.value = true
    } else {
      designsError.value = message
    }
    if (!opts.append) designs.value = []
  } finally {
    isLoadingDesigns.value = false
  }
}

const openCanvaOauth = () => {
  if (typeof window === 'undefined') return
  window.open('/api/canva/oauth/start', 'canva-oauth', 'width=720,height=720')
}

const selectDesign = async (design: CanvaDesignSummary) => {
  selectedDesign.value = design
  step.value = 'pages'
  pages.value = []
  pagesError.value = null
  selectedPageIndices.value = new Set()
  isLoadingPages.value = true
  try {
    const data = await $fetch<{ pages: CanvaPageSummary[] }>(
      `/api/editor/canva/designs/${encodeURIComponent(design.id)}/pages`,
      { query: { offset: 1, limit: 50 } },
    )
    pages.value = data.pages || []
    if (pages.value.length === 1) {
      selectedPageIndices.value.add(pages.value[0]!.index)
    }
  } catch (err: any) {
    pagesError.value = String(err?.data?.statusMessage || err?.statusMessage || err?.message || 'Erro ao listar paginas')
  } finally {
    isLoadingPages.value = false
  }
}

const togglePage = (index: number) => {
  const next = new Set(selectedPageIndices.value)
  if (next.has(index)) next.delete(index)
  else next.add(index)
  selectedPageIndices.value = next
}

const selectAllPages = () => {
  selectedPageIndices.value = new Set(pages.value.map((p) => p.index))
}

const clearSelection = () => {
  selectedPageIndices.value = new Set()
}

const backToList = () => {
  if (isImporting.value) return
  step.value = 'list'
  selectedDesign.value = null
  pages.value = []
  pagesError.value = null
  selectedPageIndices.value = new Set()
  importError.value = null
}

const confirmImport = async () => {
  if (!selectedDesign.value) return
  if (selectedPageIndices.value.size === 0) {
    importError.value = 'Selecione ao menos uma pagina'
    return
  }
  isImporting.value = true
  importError.value = null
  try {
    const orderedPages = Array.from(selectedPageIndices.value).sort((a, b) => a - b)
    const data = await $fetch<{ pages: ImportedPage[] }>(
      `/api/editor/canva/designs/${encodeURIComponent(selectedDesign.value.id)}/import`,
      { method: 'POST', body: { pages: orderedPages } },
    )
    if (!data?.pages?.length) {
      importError.value = 'Nenhuma pagina foi importada'
      return
    }
    emit('pages-imported', { design: selectedDesign.value, pages: data.pages })
    open.value = false
  } catch (err: any) {
    importError.value = String(err?.data?.statusMessage || err?.statusMessage || err?.message || 'Falha na importacao')
  } finally {
    isImporting.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (step.value === 'list') fetchDesigns()
  }, 300)
})

watch(open, (value) => {
  if (value) {
    resetState()
    fetchDesigns()
  }
})

const formattedDate = (timestamp: number | null) => {
  if (!timestamp) return ''
  try {
    return new Date(timestamp * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      @click.self="close"
    >
      <div class="w-full max-w-5xl max-h-[90vh] bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <header class="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div class="flex items-center gap-3">
            <button
              v-if="step === 'pages'"
              type="button"
              class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300"
              :disabled="isImporting"
              @click="backToList"
            >
              <ArrowLeft class="w-4 h-4" />
            </button>
            <div>
              <h2 class="text-base font-semibold text-white">
                {{ step === 'list' ? 'Importar do Canva' : (selectedDesign?.title || 'Selecionar paginas') }}
              </h2>
              <p class="text-[12px] text-zinc-500 mt-0.5">
                {{ step === 'list'
                  ? 'Escolha um design e selecione as paginas que quer trazer.'
                  : `Marque as paginas para importar (${selectedPageIndices.size} de ${pages.length} selecionadas).` }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300"
            :disabled="isImporting"
            @click="close"
          >
            <X class="w-4 h-4" />
          </button>
        </header>

        <div v-if="step === 'list'" class="flex flex-col min-h-0 flex-1">
          <div class="px-6 py-3 border-b border-white/5">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                v-model="search"
                type="text"
                placeholder="Buscar designs por titulo..."
                class="w-full h-10 pl-9 pr-4 bg-white/5 hover:bg-white/10 focus:bg-white/10 rounded-lg text-[13px] text-white placeholder:text-zinc-500 border border-transparent focus:border-violet-500/40 outline-none transition-all"
              />
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-4">
            <div v-if="designsAuthError" class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
              <AlertTriangle class="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-sm text-amber-100 font-medium">Conta Canva nao conectada</p>
                <p class="text-[12px] text-amber-200/80 mt-1">
                  Conecte uma conta Canva para listar e importar seus designs.
                </p>
                <button
                  type="button"
                  class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-md text-[12px] font-semibold text-amber-100"
                  @click="openCanvaOauth"
                >
                  <ExternalLink class="w-3.5 h-3.5" />
                  Conectar Canva
                </button>
              </div>
            </div>

            <div v-else-if="designsError" class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {{ designsError }}
            </div>

            <div v-else-if="isLoadingDesigns && designs.length === 0" class="flex flex-col items-center justify-center py-16 text-zinc-400">
              <Loader2 class="w-6 h-6 animate-spin mb-3" />
              <p class="text-[13px]">Carregando designs do Canva...</p>
            </div>

            <div v-else-if="!isLoadingDesigns && designs.length === 0" class="flex flex-col items-center justify-center py-16 text-zinc-500">
              <ImageIcon class="w-10 h-10 mb-3 opacity-40" />
              <p class="text-[13px]">Nenhum design encontrado</p>
            </div>

            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <button
                v-for="design in designs"
                :key="design.id"
                type="button"
                class="group flex flex-col bg-white/5 hover:bg-white/10 border border-white/5 hover:border-violet-500/40 rounded-xl overflow-hidden transition-all text-left"
                @click="selectDesign(design)"
              >
                <div class="aspect-[4/3] bg-zinc-800 flex items-center justify-center overflow-hidden">
                  <img
                    v-if="design.thumbnail"
                    :src="design.thumbnail"
                    :alt="design.title"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                  />
                  <ImageIcon v-else class="w-8 h-8 text-zinc-600" />
                </div>
                <div class="p-2.5">
                  <p class="text-[12px] font-medium text-white truncate">{{ design.title }}</p>
                  <div class="flex items-center justify-between mt-1 text-[10px] text-zinc-500">
                    <span>{{ design.page_count || 1 }} pag.</span>
                    <span>{{ formattedDate(design.updated_at) }}</span>
                  </div>
                </div>
              </button>
            </div>

            <div v-if="continuation && !isLoadingDesigns" class="mt-4 flex justify-center">
              <button
                type="button"
                class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[12px] font-medium text-zinc-200"
                @click="fetchDesigns({ append: true })"
              >
                Carregar mais
              </button>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col min-h-0 flex-1">
          <div class="px-6 py-3 border-b border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[11px] font-medium text-zinc-200 disabled:opacity-50"
                :disabled="isLoadingPages || pages.length === 0"
                @click="selectAllPages"
              >
                Selecionar todas
              </button>
              <button
                type="button"
                class="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[11px] font-medium text-zinc-200 disabled:opacity-50"
                :disabled="isLoadingPages || selectedPageIndices.size === 0"
                @click="clearSelection"
              >
                Limpar
              </button>
            </div>
            <a
              v-if="selectedDesign?.edit_url"
              :href="selectedDesign.edit_url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[11px] text-zinc-400 hover:text-white inline-flex items-center gap-1"
            >
              Abrir no Canva <ExternalLink class="w-3 h-3" />
            </a>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-4">
            <div v-if="pagesError" class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {{ pagesError }}
            </div>
            <div v-else-if="isLoadingPages" class="flex flex-col items-center justify-center py-16 text-zinc-400">
              <Loader2 class="w-6 h-6 animate-spin mb-3" />
              <p class="text-[13px]">Carregando paginas...</p>
            </div>
            <div v-else-if="pages.length === 0" class="flex flex-col items-center justify-center py-16 text-zinc-500">
              <ImageIcon class="w-10 h-10 mb-3 opacity-40" />
              <p class="text-[13px]">Esse design nao retornou paginas.</p>
            </div>
            <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <button
                v-for="page in pages"
                :key="page.index"
                type="button"
                class="relative group flex flex-col bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl overflow-hidden transition-all text-left"
                :class="selectedPageIndices.has(page.index) ? 'ring-2 ring-violet-500 border-violet-500/60' : 'hover:border-white/20'"
                :disabled="isImporting"
                @click="togglePage(page.index)"
              >
                <div class="aspect-[4/5] bg-zinc-800 flex items-center justify-center overflow-hidden">
                  <img
                    v-if="page.thumbnail"
                    :src="page.thumbnail"
                    :alt="`Pagina ${page.index}`"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                  />
                  <ImageIcon v-else class="w-8 h-8 text-zinc-600" />
                </div>
                <div class="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] font-semibold text-white">
                  Pag. {{ page.index }}
                </div>
                <div
                  v-if="selectedPageIndices.has(page.index)"
                  class="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center shadow-lg"
                >
                  <CheckCircle2 class="w-4 h-4 text-white" />
                </div>
              </button>
            </div>
          </div>

          <footer class="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-3">
            <p v-if="importError" class="text-[12px] text-red-300 flex items-center gap-1.5">
              <AlertTriangle class="w-3.5 h-3.5" />
              {{ importError }}
            </p>
            <p v-else class="text-[12px] text-zinc-500">
              Cada pagina selecionada vira uma pagina nova no projeto atual.
            </p>
            <div class="flex items-center gap-2 ml-auto">
              <button
                type="button"
                class="h-9 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[12px] font-medium text-zinc-200"
                :disabled="isImporting"
                @click="close"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="h-9 px-4 rounded-md text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:cursor-not-allowed flex items-center gap-2"
                :disabled="isImporting || selectedPageIndices.size === 0"
                @click="confirmImport"
              >
                <Loader2 v-if="isImporting" class="w-4 h-4 animate-spin" />
                {{ isImporting
                  ? 'Importando...'
                  : `Importar ${selectedPageIndices.size} pag.${selectedPageIndices.size === 1 ? '' : 's'}` }}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  </Teleport>
</template>
