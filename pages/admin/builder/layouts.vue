<script setup lang="ts">
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type Layout = {
  id: string
  name: string
  products_per_page: number
  columns: number
  rows: number
  grid_config: any
  highlight_positions: number[]
  model_id: string
  model?: { id: string; name: string }
  is_active: boolean
  sort_order: number
}

type Model = {
  id: string
  name: string
}

const layouts = ref<Layout[]>([])
const models = ref<Model[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const showDeleteConfirm = ref<string | null>(null)
const isSaving = ref(false)

const form = ref({
  name: '',
  products_per_page: 6,
  columns: 3,
  rows: 2,
  grid_config_text: '{}',
  highlight_positions_text: '',
  model_id: '',
  is_active: true,
  sort_order: 0
})

const resetForm = () => {
  form.value = {
    name: '',
    products_per_page: 6,
    columns: 3,
    rows: 2,
    grid_config_text: '{}',
    highlight_positions_text: '',
    model_id: '',
    is_active: true,
    sort_order: 0
  }
  editingId.value = null
}

const openCreate = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (layout: Layout) => {
  editingId.value = layout.id
  form.value = {
    name: layout.name,
    products_per_page: layout.products_per_page || 6,
    columns: layout.columns || 3,
    rows: layout.rows || 2,
    grid_config_text: JSON.stringify(layout.grid_config || {}, null, 2),
    highlight_positions_text: (layout.highlight_positions || []).join(', '),
    model_id: layout.model_id || '',
    is_active: layout.is_active ?? true,
    sort_order: layout.sort_order || 0
  }
  showForm.value = true
}

const getModelName = (modelId: string): string => {
  const model = models.value.find(m => m.id === modelId)
  return model?.name || modelId || '-'
}

const fetchData = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const [layoutsData, modelsData] = await Promise.all([
      $fetch<any>('/api/admin/builder/layouts', { headers }),
      $fetch<any>('/api/admin/builder/models', { headers })
    ])
    layouts.value = Array.isArray(layoutsData) ? layoutsData : layoutsData?.data ?? layoutsData?.items ?? []
    models.value = Array.isArray(modelsData) ? modelsData : modelsData?.data ?? modelsData?.items ?? []
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao carregar dados')
  } finally {
    isLoading.value = false
  }
}

const saveLayout = async () => {
  isSaving.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()

    let grid_config = {}
    try {
      grid_config = JSON.parse(form.value.grid_config_text)
    } catch {
      error.value = 'JSON invalido no campo grid_config'
      isSaving.value = false
      return
    }

    const highlight_positions = form.value.highlight_positions_text
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n))

    const payload = {
      name: form.value.name,
      products_per_page: form.value.products_per_page,
      columns: form.value.columns,
      rows: form.value.rows,
      grid_config,
      highlight_positions,
      model_id: form.value.model_id || null,
      is_active: form.value.is_active,
      sort_order: form.value.sort_order
    }

    if (editingId.value) {
      await $fetch(`/api/admin/builder/layouts/${editingId.value}`, {
        method: 'PUT',
        headers,
        body: payload
      })
    } else {
      await $fetch('/api/admin/builder/layouts', {
        method: 'POST',
        headers,
        body: payload
      })
    }

    showForm.value = false
    resetForm()
    await fetchData()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao salvar grade')
  } finally {
    isSaving.value = false
  }
}

const deleteLayout = async (id: string) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/layouts/${id}`, {
      method: 'DELETE',
      headers
    })
    showDeleteConfirm.value = null
    await fetchData()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao excluir grade')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <AdminWorkspaceShell>
  <div class="admin-page admin-page--builder">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <div class="mb-8">
        <NuxtLink
          to="/admin/builder"
          class="admin-page__back inline-flex items-center gap-1.5 text-sm text-[color:var(--jv-muted)] hover:text-[color:var(--jv-blue)] transition-colors"
        >
          <ArrowLeft class="h-4 w-4" />
          Voltar
        </NuxtLink>
      </div>

      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold tracking-tight">Grades do Builder</h1>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-[color:var(--jv-blue)] px-4 py-2 text-sm font-medium text-[color:var(--jv-navy)] hover:bg-[#1a4f96] transition-colors"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          Nova Grade
        </button>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ error }}
      </div>

      <div v-if="isLoading" class="text-center py-12 text-[color:var(--jv-muted)]">Carregando...</div>

      <!-- Table -->
      <div v-else-if="layouts.length && !showForm" class="overflow-x-auto rounded-lg border border-[color:var(--jv-line)]" role="region" aria-label="Tabela de registros — deslize para ver todas as colunas" tabindex="0">
        <table class="w-full text-left text-sm">
          <thead class="bg-[#f3f8fd]">
            <tr>
              <th class="px-4 py-3 font-medium text-slate-600">Nome</th>
              <th class="px-4 py-3 font-medium text-slate-600">Produtos</th>
              <th class="px-4 py-3 font-medium text-slate-600">Grid</th>
              <th class="px-4 py-3 font-medium text-slate-600">Modelo</th>
              <th class="px-4 py-3 font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 font-medium text-slate-600">Ordem</th>
              <th class="px-4 py-3 font-medium text-slate-600 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr v-for="layout in layouts" :key="layout.id" class="border-t border-[color:var(--jv-line)]">
              <td class="px-4 py-3 font-medium text-[color:var(--jv-ink)]">{{ layout.name }}</td>
              <td class="px-4 py-3 text-slate-600">{{ layout.products_per_page }}</td>
              <td class="px-4 py-3 font-mono text-xs text-[color:var(--jv-muted)]">{{ layout.columns }} x {{ layout.rows }}</td>
              <td class="px-4 py-3 text-slate-600">{{ layout.model?.name || getModelName(layout.model_id) }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                  :class="layout.is_active
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    : 'bg-[color:var(--jv-sky)] text-[color:var(--jv-muted)] border border-[color:var(--jv-line)]'"
                >
                  {{ layout.is_active ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="px-4 py-3 text-[color:var(--jv-muted)]">{{ layout.sort_order }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-[color:var(--jv-sky)] hover:text-[color:var(--jv-navy)] transition-colors"
                    title="Editar"
                    @click="openEdit(layout)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
                    title="Excluir"
                    @click="showDeleteConfirm = layout.id"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!layouts.length && !showForm && !isLoading" class="text-center py-12 text-[color:var(--jv-muted)]">
        Nenhuma grade cadastrada.
      </div>

      <!-- Delete Confirmation -->
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDeleteConfirm = null"
      >
        <div class="rounded-xl border border-[color:var(--jv-line)] bg-[#f3f8fd] p-6 shadow-xl max-w-sm w-full mx-4">
          <h3 class="text-lg font-medium text-[color:var(--jv-ink)]">Confirmar exclusao</h3>
          <p class="mt-2 text-sm text-[color:var(--jv-muted)]">Tem certeza que deseja excluir esta grade?</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-lg bg-[color:var(--jv-sky)] px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              @click="showDeleteConfirm = null"
            >
              Cancelar
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm text-[color:var(--jv-navy)] hover:bg-red-500 transition-colors"
              @click="deleteLayout(showDeleteConfirm!)"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>

      <!-- Form -->
      <div v-if="showForm" class="rounded-xl border border-[color:var(--jv-line)] bg-white p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-medium">
            {{ editingId ? 'Editar Grade' : 'Nova Grade' }}
          </h2>
          <button
            class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-[color:var(--jv-sky)] hover:text-[color:var(--jv-navy)]"
            @click="showForm = false; resetForm()"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <form @submit.prevent="saveLayout" class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Nome *</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: Grid 3x2"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Produtos por Pagina</label>
              <input
                v-model.number="form.products_per_page"
                type="number"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Colunas</label>
              <input
                v-model.number="form.columns"
                type="number"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Linhas</label>
              <input
                v-model.number="form.rows"
                type="number"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Modelo</label>
              <select
                v-model="form.model_id"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">Nenhum</option>
                <option v-for="model in models" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Ordem</label>
              <input
                v-model.number="form.sort_order"
                type="number"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div class="sm:col-span-2 lg:col-span-3">
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Posicoes Destaque (separadas por virgula)</label>
              <input
                v-model="form.highlight_positions_text"
                type="text"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: 0, 3"
              />
            </div>
            <div class="sm:col-span-2 lg:col-span-3">
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Grid Config (JSON)</label>
              <textarea
                v-model="form.grid_config_text"
                rows="4"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] font-mono placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder='{"areas": ["..."]}'
              />
            </div>
          </div>

          <div>
            <label class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input v-model="form.is_active" type="checkbox" class="rounded border-zinc-600 bg-[color:var(--jv-sky)] text-blue-500 focus:ring-blue-500/50" />
              Ativo
            </label>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-[color:var(--jv-line)]">
            <button
              type="submit"
              :disabled="isSaving || !form.name"
              class="rounded-lg bg-[color:var(--jv-blue)] px-6 py-2 text-sm font-medium text-[color:var(--jv-navy)] hover:bg-[#1a4f96] disabled:opacity-50 transition-colors"
            >
              {{ isSaving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar Grade') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-[color:var(--jv-sky)] px-6 py-2 text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              @click="showForm = false; resetForm()"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  </AdminWorkspaceShell>
</template>
