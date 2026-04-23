<script setup lang="ts">
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Image,
  X,
  Check,
  Save,
  Layers
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false,
})

const { getApiAuthHeaders } = useApiAuth()

interface CanvaTemplate {
  id: string
  canva_design_id: string
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  page_count: number
  products_per_page: any
  pattern: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// Categorias disponíveis
const categories = [
  { value: null, label: 'Sem categoria' },
  { value: 'carnes', label: 'Carnes' },
  { value: 'hortifruti', label: 'Hortifruti' },
  { value: 'padaria', label: 'Padaria' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'limpeza', label: 'Limpeza' },
  { value: 'geral', label: 'Geral' },
]

// Estado
const templates = ref<CanvaTemplate[]>([])
const isLoading = ref(false)
const isSyncing = ref(false)
const syncMessage = ref<string | null>(null)
const error = ref<string | null>(null)

// Modal de edição
const showEditModal = ref(false)
const editingTemplate = ref<CanvaTemplate | null>(null)
const editForm = ref({
  title: '',
  description: '',
  category: null as string | null,
  sort_order: 0,
  is_active: true,
})
const isSaving = ref(false)

// Modal de confirmação de exclusão
const showDeleteModal = ref(false)
const deletingTemplate = ref<CanvaTemplate | null>(null)
const isDeleting = ref(false)

// Carregar lista de templates
const fetchTemplates = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<CanvaTemplate[]>('/api/canva/admin/templates', { headers })
    templates.value = Array.isArray(data) ? data : []
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    error.value = `Erro ao carregar templates: ${msg}`
  } finally {
    isLoading.value = false
  }
}

// Sincronizar do Canva
const syncFromCanva = async () => {
  isSyncing.value = true
  syncMessage.value = null
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<{ added: number; total: number }>('/api/canva/admin/sync-from-canva', {
      method: 'POST',
      headers,
    })
    const count = data?.added ?? 0
    syncMessage.value = `${count} novo(s) template(s) importado(s)`
    await fetchTemplates()
    // Limpar mensagem após 5 segundos
    setTimeout(() => {
      syncMessage.value = null
    }, 5000)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    error.value = `Erro ao sincronizar: ${msg}`
  } finally {
    isSyncing.value = false
  }
}

// Toggle ativo/inativo rápido
const toggleActive = async (template: CanvaTemplate) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/canva/admin/templates/${template.id}`, {
      method: 'PUT',
      headers,
      body: { is_active: !template.is_active },
    })
    template.is_active = !template.is_active
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    error.value = `Erro ao atualizar status: ${msg}`
  }
}

// Abrir modal de edição
const openEditModal = (template: CanvaTemplate) => {
  editingTemplate.value = template
  editForm.value = {
    title: template.title,
    description: template.description ?? '',
    category: template.category,
    sort_order: template.sort_order,
    is_active: template.is_active,
  }
  showEditModal.value = true
}

// Salvar edição
const saveEdit = async () => {
  if (!editingTemplate.value) return
  isSaving.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const body = {
      title: editForm.value.title,
      description: editForm.value.description || null,
      category: editForm.value.category,
      sort_order: editForm.value.sort_order,
      is_active: editForm.value.is_active,
    }
    await $fetch(`/api/canva/admin/templates/${editingTemplate.value.id}`, {
      method: 'PUT',
      headers,
      body,
    })
    // Atualizar na lista local
    const idx = templates.value.findIndex(t => t.id === editingTemplate.value!.id)
    const current = templates.value[idx]
    if (idx !== -1 && current) {
      templates.value[idx] = {
        ...current,
        ...body,
      }
    }
    showEditModal.value = false
    editingTemplate.value = null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    error.value = `Erro ao salvar: ${msg}`
  } finally {
    isSaving.value = false
  }
}

// Abrir modal de exclusão
const openDeleteModal = (template: CanvaTemplate) => {
  deletingTemplate.value = template
  showDeleteModal.value = true
}

// Confirmar exclusão
const confirmDelete = async () => {
  if (!deletingTemplate.value) return
  isDeleting.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/canva/admin/templates/${deletingTemplate.value.id}`, {
      method: 'DELETE',
      headers,
    })
    templates.value = templates.value.filter(t => t.id !== deletingTemplate.value!.id)
    showDeleteModal.value = false
    deletingTemplate.value = null
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    error.value = `Erro ao deletar: ${msg}`
  } finally {
    isDeleting.value = false
  }
}

// Label da categoria
const categoryLabel = (value: string | null): string => {
  const found = categories.find(c => c.value === value)
  return found?.label ?? 'Sem categoria'
}

onMounted(() => {
  fetchTemplates()
})
</script>

<template>
  <div class="min-h-screen bg-[#0f0f0f] text-zinc-100">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <!-- Header -->
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <NuxtLink
            to="/admin/builder"
            class="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft class="h-4 w-4" />
            Voltar
          </NuxtLink>
          <div class="flex items-center gap-3">
            <Layers class="h-7 w-7 text-blue-400" />
            <h1 class="text-2xl font-semibold tracking-tight">Templates Canva</h1>
          </div>
          <p class="mt-1 text-sm text-zinc-400">
            Gerencie os templates importados do Canva para geração de encartes.
          </p>
        </div>
        <button
          :disabled="isSyncing"
          class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="syncFromCanva"
        >
          <RefreshCw v-if="!isSyncing" class="h-4 w-4" />
          <Loader2 v-else class="h-4 w-4 animate-spin" />
          {{ isSyncing ? 'Sincronizando...' : 'Sincronizar do Canva' }}
        </button>
      </div>

      <!-- Mensagem de sincronização -->
      <div
        v-if="syncMessage"
        class="mb-4 flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300"
      >
        <Check class="h-4 w-4 shrink-0" />
        {{ syncMessage }}
      </div>

      <!-- Mensagem de erro -->
      <div
        v-if="error"
        class="mb-4 flex items-center justify-between rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300"
      >
        <span>{{ error }}</span>
        <button class="text-red-400 hover:text-red-200" @click="error = null">
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
        <Loader2 class="h-8 w-8 animate-spin text-zinc-500" />
        <p class="mt-3 text-sm text-zinc-500">Carregando templates...</p>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="templates.length === 0"
        class="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-20"
      >
        <Image class="h-12 w-12 text-zinc-600" />
        <p class="mt-4 text-base text-zinc-400">Nenhum template encontrado.</p>
        <p class="mt-1 text-sm text-zinc-500">
          Clique em "Sincronizar do Canva" para importar templates.
        </p>
      </div>

      <!-- Tabela de templates -->
      <div v-else class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
              <th class="px-4 py-3">Thumbnail</th>
              <th class="px-4 py-3">Título</th>
              <th class="px-4 py-3">Categoria</th>
              <th class="px-4 py-3 text-center">Páginas</th>
              <th class="px-4 py-3 text-center">Status</th>
              <th class="px-4 py-3 text-center">Ordem</th>
              <th class="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="template in templates"
              :key="template.id"
              class="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
            >
              <!-- Thumbnail -->
              <td class="px-4 py-3">
                <div class="h-[60px] w-[60px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800">
                  <img
                    v-if="template.thumbnail_url"
                    :src="template.thumbnail_url"
                    :alt="template.title"
                    class="h-full w-full object-cover"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center">
                    <Image class="h-5 w-5 text-zinc-600" />
                  </div>
                </div>
              </td>

              <!-- Título -->
              <td class="px-4 py-3">
                <p class="font-medium text-zinc-100">{{ template.title }}</p>
                <p v-if="template.description" class="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                  {{ template.description }}
                </p>
              </td>

              <!-- Categoria -->
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="template.category
                    ? 'bg-violet-900/40 text-violet-300 border border-violet-800/50'
                    : 'bg-zinc-800 text-zinc-500'"
                >
                  {{ categoryLabel(template.category) }}
                </span>
              </td>

              <!-- Páginas -->
              <td class="px-4 py-3 text-center text-zinc-400">
                {{ template.page_count }}
              </td>

              <!-- Status toggle -->
              <td class="px-4 py-3 text-center">
                <button
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                  :class="template.is_active
                    ? 'bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/50'
                    : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 border border-zinc-700'"
                  @click="toggleActive(template)"
                >
                  <Eye v-if="template.is_active" class="h-3.5 w-3.5" />
                  <EyeOff v-else class="h-3.5 w-3.5" />
                  {{ template.is_active ? 'Ativo' : 'Inativo' }}
                </button>
              </td>

              <!-- Ordem -->
              <td class="px-4 py-3 text-center text-zinc-400">
                {{ template.sort_order }}
              </td>

              <!-- Ações -->
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    class="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-blue-400"
                    title="Editar"
                    @click="openEditModal(template)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400"
                    title="Deletar"
                    @click="openDeleteModal(template)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Contador -->
      <div v-if="!isLoading && templates.length > 0" class="mt-3 text-right text-xs text-zinc-500">
        {{ templates.length }} template(s)
      </div>
    </div>

    <!-- Modal de edição -->
    <Teleport to="body">
      <div
        v-if="showEditModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="showEditModal = false"
      >
        <div class="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-zinc-100">Editar Template</h2>
            <button
              class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              @click="showEditModal = false"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="space-y-4">
            <!-- Título -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-zinc-300">Título</label>
              <input
                v-model="editForm.title"
                type="text"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Título do template"
              />
            </div>

            <!-- Descrição -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-zinc-300">Descrição</label>
              <textarea
                v-model="editForm.description"
                rows="3"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder="Descrição opcional"
              />
            </div>

            <!-- Categoria -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-zinc-300">Categoria</label>
              <select
                v-model="editForm.category"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option
                  v-for="cat in categories"
                  :key="String(cat.value)"
                  :value="cat.value"
                >
                  {{ cat.label }}
                </option>
              </select>
            </div>

            <!-- Ordem -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-zinc-300">Ordem de exibição</label>
              <input
                v-model.number="editForm.sort_order"
                type="number"
                min="0"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <!-- Toggle ativo -->
            <div class="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3">
              <span class="text-sm text-zinc-300">Template ativo</span>
              <button
                class="relative h-6 w-11 rounded-full transition-colors"
                :class="editForm.is_active ? 'bg-blue-600' : 'bg-zinc-600'"
                @click="editForm.is_active = !editForm.is_active"
              >
                <span
                  class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                  :class="editForm.is_active ? 'left-[22px]' : 'left-0.5'"
                />
              </button>
            </div>
          </div>

          <!-- Botões do modal -->
          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              class="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              @click="showEditModal = false"
            >
              Cancelar
            </button>
            <button
              :disabled="isSaving || !editForm.title.trim()"
              class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="saveEdit"
            >
              <Loader2 v-if="isSaving" class="h-4 w-4 animate-spin" />
              <Save v-else class="h-4 w-4" />
              {{ isSaving ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal de confirmação de exclusão -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="showDeleteModal = false"
      >
        <div class="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
          <div class="mb-2 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/30">
              <Trash2 class="h-5 w-5 text-red-400" />
            </div>
            <h2 class="text-lg font-semibold text-zinc-100">Deletar Template</h2>
          </div>

          <p class="mt-3 text-sm text-zinc-400">
            Tem certeza que deseja deletar o template
            <span class="font-medium text-zinc-200">"{{ deletingTemplate?.title }}"</span>?
            Esta ação não pode ser desfeita.
          </p>

          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              class="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              @click="showDeleteModal = false"
            >
              Cancelar
            </button>
            <button
              :disabled="isDeleting"
              class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="confirmDelete"
            >
              <Loader2 v-if="isDeleting" class="h-4 w-4 animate-spin" />
              <Trash2 v-else class="h-4 w-4" />
              {{ isDeleting ? 'Deletando...' : 'Deletar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
