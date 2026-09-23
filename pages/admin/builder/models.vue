<script setup lang="ts">
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type Model = {
  id: string
  name: string
  type: string
  width: number
  height: number
  aspect_ratio: string
  is_active: boolean
  sort_order: number
}

const models = ref<Model[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const showDeleteConfirm = ref<string | null>(null)
const isSaving = ref(false)

const form = ref({
  name: '',
  type: 'SOCIAL',
  width: 1080,
  height: 1080,
  aspect_ratio: '1:1',
  is_active: true,
  sort_order: 0
})

const resetForm = () => {
  form.value = {
    name: '',
    type: 'SOCIAL',
    width: 1080,
    height: 1080,
    aspect_ratio: '1:1',
    is_active: true,
    sort_order: 0
  }
  editingId.value = null
}

const openCreate = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (model: Model) => {
  editingId.value = model.id
  form.value = {
    name: model.name,
    type: model.type || 'SOCIAL',
    width: model.width,
    height: model.height,
    aspect_ratio: model.aspect_ratio || '',
    is_active: model.is_active ?? true,
    sort_order: model.sort_order || 0
  }
  showForm.value = true
}

const fetchModels = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>('/api/admin/builder/models', { headers })
    models.value = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao carregar modelos')
  } finally {
    isLoading.value = false
  }
}

const saveModel = async () => {
  isSaving.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const payload = { ...form.value }

    if (editingId.value) {
      await $fetch(`/api/admin/builder/models/${editingId.value}`, {
        method: 'PUT',
        headers,
        body: payload
      })
    } else {
      await $fetch('/api/admin/builder/models', {
        method: 'POST',
        headers,
        body: payload
      })
    }

    showForm.value = false
    resetForm()
    await fetchModels()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao salvar modelo')
  } finally {
    isSaving.value = false
  }
}

const deleteModel = async (id: string) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/models/${id}`, {
      method: 'DELETE',
      headers
    })
    showDeleteConfirm.value = null
    await fetchModels()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao excluir modelo')
  }
}

const typeLabel = (type: string) => {
  const map: Record<string, string> = { SOCIAL: 'Social', PRINT: 'Impressao', TV: 'TV' }
  return map[type] || type
}

const typeBadgeClass = (type: string) => {
  const map: Record<string, string> = {
    SOCIAL: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    PRINT: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    TV: 'bg-orange-500/10 text-orange-300 border-orange-500/20'
  }
  return map[type] || 'bg-[color:var(--jv-sky)] text-[color:var(--jv-muted)] border-[color:var(--jv-line)]'
}

onMounted(() => {
  fetchModels()
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
        <h1 class="text-2xl font-semibold tracking-tight">Modelos do Builder</h1>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-[color:var(--jv-blue)] px-4 py-2 text-sm font-medium text-[color:var(--jv-navy)] hover:bg-[#1a4f96] transition-colors"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          Novo Modelo
        </button>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ error }}
      </div>

      <div v-if="isLoading" class="text-center py-12 text-[color:var(--jv-muted)]">Carregando...</div>

      <!-- Table -->
      <div v-else-if="models.length && !showForm" class="overflow-x-auto rounded-lg border border-[color:var(--jv-line)]" role="region" aria-label="Tabela de registros — deslize para ver todas as colunas" tabindex="0">
        <table class="w-full text-left text-sm">
          <thead class="bg-[#f3f8fd]">
            <tr>
              <th class="px-4 py-3 font-medium text-slate-600">Nome</th>
              <th class="px-4 py-3 font-medium text-slate-600">Tipo</th>
              <th class="px-4 py-3 font-medium text-slate-600">Dimensoes</th>
              <th class="px-4 py-3 font-medium text-slate-600">Proporcao</th>
              <th class="px-4 py-3 font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 font-medium text-slate-600">Ordem</th>
              <th class="px-4 py-3 font-medium text-slate-600 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr v-for="model in models" :key="model.id" class="border-t border-[color:var(--jv-line)]">
              <td class="px-4 py-3 font-medium text-[color:var(--jv-ink)]">{{ model.name }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                  :class="typeBadgeClass(model.type)"
                >
                  {{ typeLabel(model.type) }}
                </span>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ model.width }} x {{ model.height }}</td>
              <td class="px-4 py-3 text-[color:var(--jv-muted)]">{{ model.aspect_ratio || '-' }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                  :class="model.is_active
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    : 'bg-[color:var(--jv-sky)] text-[color:var(--jv-muted)] border border-[color:var(--jv-line)]'"
                >
                  {{ model.is_active ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="px-4 py-3 text-[color:var(--jv-muted)]">{{ model.sort_order }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-[color:var(--jv-sky)] hover:text-[color:var(--jv-navy)] transition-colors"
                    title="Editar"
                    @click="openEdit(model)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
                    title="Excluir"
                    @click="showDeleteConfirm = model.id"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!models.length && !showForm && !isLoading" class="text-center py-12 text-[color:var(--jv-muted)]">
        Nenhum modelo cadastrado.
      </div>

      <!-- Delete Confirmation -->
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDeleteConfirm = null"
      >
        <div class="rounded-xl border border-[color:var(--jv-line)] bg-[#f3f8fd] p-6 shadow-xl max-w-sm w-full mx-4">
          <h3 class="text-lg font-medium text-[color:var(--jv-ink)]">Confirmar exclusao</h3>
          <p class="mt-2 text-sm text-[color:var(--jv-muted)]">Tem certeza que deseja excluir este modelo?</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-lg bg-[color:var(--jv-sky)] px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              @click="showDeleteConfirm = null"
            >
              Cancelar
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm text-[color:var(--jv-navy)] hover:bg-red-500 transition-colors"
              @click="deleteModel(showDeleteConfirm!)"
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
            {{ editingId ? 'Editar Modelo' : 'Novo Modelo' }}
          </h2>
          <button
            class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-[color:var(--jv-sky)] hover:text-[color:var(--jv-navy)]"
            @click="showForm = false; resetForm()"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <form @submit.prevent="saveModel" class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Nome *</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: Story Instagram"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Tipo</label>
              <select
                v-model="form.type"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="SOCIAL">Social</option>
                <option value="PRINT">Impressao</option>
                <option value="TV">TV</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Largura (px)</label>
              <input
                v-model.number="form.width"
                type="number"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Altura (px)</label>
              <input
                v-model.number="form.height"
                type="number"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Proporcao</label>
              <input
                v-model="form.aspect_ratio"
                type="text"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: 1:1, 9:16"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Ordem</label>
              <input
                v-model.number="form.sort_order"
                type="number"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
              {{ isSaving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar Modelo') }}
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
