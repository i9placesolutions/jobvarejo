<script setup lang="ts">
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type PriceTagStyle = {
  id: string
  name: string
  css_config: {
    bgColor: string
    textColor: string
    shape: string
  }
  is_global: boolean
  is_active: boolean
  sort_order: number
}

const styles = ref<PriceTagStyle[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const showDeleteConfirm = ref<string | null>(null)
const isSaving = ref(false)

const form = ref({
  name: '',
  bgColor: '#ef4444',
  textColor: '#ffffff',
  shape: 'rounded',
  is_global: true,
  is_active: true,
  sort_order: 0
})

const resetForm = () => {
  form.value = {
    name: '',
    bgColor: '#ef4444',
    textColor: '#ffffff',
    shape: 'rounded',
    is_global: true,
    is_active: true,
    sort_order: 0
  }
  editingId.value = null
}

const openCreate = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (style: PriceTagStyle) => {
  editingId.value = style.id
  form.value = {
    name: style.name,
    bgColor: style.css_config?.bgColor || '#ef4444',
    textColor: style.css_config?.textColor || '#ffffff',
    shape: style.css_config?.shape || 'rounded',
    is_global: style.is_global ?? true,
    is_active: style.is_active ?? true,
    sort_order: style.sort_order || 0
  }
  showForm.value = true
}

const fetchStyles = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>('/api/admin/builder/price-tag-styles', { headers })
    styles.value = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao carregar estilos de preco')
  } finally {
    isLoading.value = false
  }
}

const saveStyle = async () => {
  isSaving.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const payload = {
      name: form.value.name,
      css_config: {
        bgColor: form.value.bgColor,
        textColor: form.value.textColor,
        shape: form.value.shape
      },
      is_global: form.value.is_global,
      is_active: form.value.is_active,
      sort_order: form.value.sort_order
    }

    if (editingId.value) {
      await $fetch(`/api/admin/builder/price-tag-styles/${editingId.value}`, {
        method: 'PUT',
        headers,
        body: payload
      })
    } else {
      await $fetch('/api/admin/builder/price-tag-styles', {
        method: 'POST',
        headers,
        body: payload
      })
    }

    showForm.value = false
    resetForm()
    await fetchStyles()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao salvar estilo')
  } finally {
    isSaving.value = false
  }
}

const deleteStyle = async (id: string) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/price-tag-styles/${id}`, {
      method: 'DELETE',
      headers
    })
    showDeleteConfirm.value = null
    await fetchStyles()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao excluir estilo')
  }
}

const shapeLabel = (shape: string) => {
  const map: Record<string, string> = {
    rounded: 'Arredondado',
    square: 'Quadrado',
    pill: 'Pilula',
    circle: 'Circulo'
  }
  return map[shape] || shape
}

onMounted(() => {
  fetchStyles()
})
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <div class="mb-8">
        <NuxtLink
          to="/admin/builder"
          class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft class="h-4 w-4" />
          Voltar
        </NuxtLink>
      </div>

      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold tracking-tight">Estilos de Preco</h1>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          Novo Estilo
        </button>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="isLoading" class="text-center py-12 text-zinc-500">Carregando...</div>

      <!-- Table -->
      <div v-else-if="styles.length && !showForm" class="overflow-hidden rounded-lg border border-zinc-800">
        <table class="w-full text-left text-sm">
          <thead class="bg-zinc-900">
            <tr>
              <th class="px-4 py-3 font-medium text-zinc-300">Preview</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Nome</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Formato</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Global</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Status</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Ordem</th>
              <th class="px-4 py-3 font-medium text-zinc-300 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="bg-zinc-900/50">
            <tr v-for="style in styles" :key="style.id" class="border-t border-zinc-800">
              <td class="px-4 py-3">
                <div
                  class="inline-flex items-center justify-center px-3 py-1 text-xs font-bold"
                  :style="{
                    backgroundColor: style.css_config?.bgColor || '#ef4444',
                    color: style.css_config?.textColor || '#fff',
                    borderRadius: style.css_config?.shape === 'pill' ? '9999px'
                      : style.css_config?.shape === 'circle' ? '50%'
                      : style.css_config?.shape === 'square' ? '0'
                      : '6px'
                  }"
                >
                  R$ 9,99
                </div>
              </td>
              <td class="px-4 py-3 font-medium text-zinc-100">{{ style.name }}</td>
              <td class="px-4 py-3 text-zinc-300">{{ shapeLabel(style.css_config?.shape) }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                  :class="style.is_global
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'"
                >
                  {{ style.is_global ? 'Sim' : 'Nao' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                  :class="style.is_active
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'"
                >
                  {{ style.is_active ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="px-4 py-3 text-zinc-400">{{ style.sort_order }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                    title="Editar"
                    @click="openEdit(style)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Excluir"
                    @click="showDeleteConfirm = style.id"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!styles.length && !showForm && !isLoading" class="text-center py-12 text-zinc-500">
        Nenhum estilo de preco cadastrado.
      </div>

      <!-- Delete Confirmation -->
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDeleteConfirm = null"
      >
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl max-w-sm w-full mx-4">
          <h3 class="text-lg font-medium text-zinc-100">Confirmar exclusao</h3>
          <p class="mt-2 text-sm text-zinc-400">Tem certeza que deseja excluir este estilo?</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              @click="showDeleteConfirm = null"
            >
              Cancelar
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 transition-colors"
              @click="deleteStyle(showDeleteConfirm!)"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>

      <!-- Form -->
      <div v-if="showForm" class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-medium">
            {{ editingId ? 'Editar Estilo de Preco' : 'Novo Estilo de Preco' }}
          </h2>
          <button
            class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            @click="showForm = false; resetForm()"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <form @submit.prevent="saveStyle" class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1">Nome *</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Ex: Vermelho Classico"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1">Cor de Fundo</label>
              <div class="flex items-center gap-2">
                <input v-model="form.bgColor" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                <input v-model="form.bgColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1">Cor do Texto</label>
              <div class="flex items-center gap-2">
                <input v-model="form.textColor" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                <input v-model="form.textColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1">Formato</label>
              <select
                v-model="form.shape"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="rounded">Arredondado</option>
                <option value="square">Quadrado</option>
                <option value="pill">Pilula</option>
                <option value="circle">Circulo</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1">Ordem</label>
              <input
                v-model.number="form.sort_order"
                type="number"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          <div class="flex items-center gap-6">
            <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input v-model="form.is_global" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
              Global
            </label>
            <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input v-model="form.is_active" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
              Ativo
            </label>
          </div>

          <!-- Preview -->
          <div>
            <label class="block text-xs font-medium text-zinc-400 mb-2">Preview</label>
            <div
              class="inline-flex items-center justify-center px-4 py-2 text-sm font-bold"
              :style="{
                backgroundColor: form.bgColor,
                color: form.textColor,
                borderRadius: form.shape === 'pill' ? '9999px'
                  : form.shape === 'circle' ? '50%'
                  : form.shape === 'square' ? '0'
                  : '6px'
              }"
            >
              R$ 12,99
            </div>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-zinc-800">
            <button
              type="submit"
              :disabled="isSaving || !form.name"
              class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {{ isSaving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar Estilo') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-zinc-800 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              @click="showForm = false; resetForm()"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
