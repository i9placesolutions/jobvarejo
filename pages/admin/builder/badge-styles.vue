<script setup lang="ts">
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type BadgeStyle = {
  id: string
  name: string
  type: string
  css_config: {
    bgColor: string
    textColor: string
    text: string
    position: string
  }
  is_global: boolean
  is_active: boolean
  sort_order: number
}

const badges = ref<BadgeStyle[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const showDeleteConfirm = ref<string | null>(null)
const isSaving = ref(false)

const form = ref({
  name: '',
  type: 'PROMO',
  bgColor: '#ef4444',
  textColor: '#ffffff',
  text: 'OFERTA',
  position: 'top-right',
  is_global: true,
  is_active: true,
  sort_order: 0
})

const resetForm = () => {
  form.value = {
    name: '',
    type: 'PROMO',
    bgColor: '#ef4444',
    textColor: '#ffffff',
    text: 'OFERTA',
    position: 'top-right',
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

const openEdit = (badge: BadgeStyle) => {
  editingId.value = badge.id
  form.value = {
    name: badge.name,
    type: badge.type || 'PROMO',
    bgColor: badge.css_config?.bgColor || '#ef4444',
    textColor: badge.css_config?.textColor || '#ffffff',
    text: badge.css_config?.text || '',
    position: badge.css_config?.position || 'top-right',
    is_global: badge.is_global ?? true,
    is_active: badge.is_active ?? true,
    sort_order: badge.sort_order || 0
  }
  showForm.value = true
}

const fetchBadges = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>('/api/admin/builder/badge-styles', { headers })
    badges.value = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao carregar selos')
  } finally {
    isLoading.value = false
  }
}

const saveBadge = async () => {
  isSaving.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const payload = {
      name: form.value.name,
      type: form.value.type,
      css_config: {
        bgColor: form.value.bgColor,
        textColor: form.value.textColor,
        text: form.value.text,
        position: form.value.position
      },
      is_global: form.value.is_global,
      is_active: form.value.is_active,
      sort_order: form.value.sort_order
    }

    if (editingId.value) {
      await $fetch(`/api/admin/builder/badge-styles/${editingId.value}`, {
        method: 'PUT',
        headers,
        body: payload
      })
    } else {
      await $fetch('/api/admin/builder/badge-styles', {
        method: 'POST',
        headers,
        body: payload
      })
    }

    showForm.value = false
    resetForm()
    await fetchBadges()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao salvar selo')
  } finally {
    isSaving.value = false
  }
}

const deleteBadge = async (id: string) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/badge-styles/${id}`, {
      method: 'DELETE',
      headers
    })
    showDeleteConfirm.value = null
    await fetchBadges()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao excluir selo')
  }
}

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    PROMO: 'Promocao',
    OFFER: 'Oferta',
    NEW: 'Novo',
    FEATURED: 'Destaque'
  }
  return map[type] || type
}

const typeBadgeClass = (type: string) => {
  const map: Record<string, string> = {
    PROMO: 'bg-red-500/10 text-red-300 border-red-500/20',
    OFFER: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    NEW: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    FEATURED: 'bg-purple-500/10 text-purple-300 border-purple-500/20'
  }
  return map[type] || 'bg-zinc-800 text-zinc-400 border-zinc-700'
}

onMounted(() => {
  fetchBadges()
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
        <h1 class="text-2xl font-semibold tracking-tight">Selos do Builder</h1>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          Novo Selo
        </button>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="isLoading" class="text-center py-12 text-zinc-500">Carregando...</div>

      <!-- Table -->
      <div v-else-if="badges.length && !showForm" class="overflow-hidden rounded-lg border border-zinc-800">
        <table class="w-full text-left text-sm">
          <thead class="bg-zinc-900">
            <tr>
              <th class="px-4 py-3 font-medium text-zinc-300">Preview</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Nome</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Tipo</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Global</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Status</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Ordem</th>
              <th class="px-4 py-3 font-medium text-zinc-300 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="bg-zinc-900/50">
            <tr v-for="badge in badges" :key="badge.id" class="border-t border-zinc-800">
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold"
                  :style="{
                    backgroundColor: badge.css_config?.bgColor || '#ef4444',
                    color: badge.css_config?.textColor || '#fff'
                  }"
                >
                  {{ badge.css_config?.text || badge.name }}
                </span>
              </td>
              <td class="px-4 py-3 font-medium text-zinc-100">{{ badge.name }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                  :class="typeBadgeClass(badge.type)"
                >
                  {{ typeLabel(badge.type) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                  :class="badge.is_global
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'"
                >
                  {{ badge.is_global ? 'Sim' : 'Nao' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                  :class="badge.is_active
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'"
                >
                  {{ badge.is_active ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="px-4 py-3 text-zinc-400">{{ badge.sort_order }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                    title="Editar"
                    @click="openEdit(badge)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Excluir"
                    @click="showDeleteConfirm = badge.id"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!badges.length && !showForm && !isLoading" class="text-center py-12 text-zinc-500">
        Nenhum selo cadastrado.
      </div>

      <!-- Delete Confirmation -->
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDeleteConfirm = null"
      >
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl max-w-sm w-full mx-4">
          <h3 class="text-lg font-medium text-zinc-100">Confirmar exclusao</h3>
          <p class="mt-2 text-sm text-zinc-400">Tem certeza que deseja excluir este selo?</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              @click="showDeleteConfirm = null"
            >
              Cancelar
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 transition-colors"
              @click="deleteBadge(showDeleteConfirm!)"
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
            {{ editingId ? 'Editar Selo' : 'Novo Selo' }}
          </h2>
          <button
            class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            @click="showForm = false; resetForm()"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <form @submit.prevent="saveBadge" class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1">Nome *</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Ex: Oferta Especial"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1">Tipo</label>
              <select
                v-model="form.type"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="PROMO">Promocao</option>
                <option value="OFFER">Oferta</option>
                <option value="NEW">Novo</option>
                <option value="FEATURED">Destaque</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-zinc-400 mb-1">Texto do Selo</label>
              <input
                v-model="form.text"
                type="text"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Ex: OFERTA"
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
              <label class="block text-xs font-medium text-zinc-400 mb-1">Posicao</label>
              <select
                v-model="form.position"
                class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="top-right">Superior Direita</option>
                <option value="top-left">Superior Esquerda</option>
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
            <div class="relative inline-block rounded-lg border border-zinc-700 bg-zinc-800 w-32 h-24">
              <span
                class="absolute rounded-full px-2 py-0.5 text-xs font-bold"
                :class="form.position === 'top-left' ? 'top-1 left-1' : 'top-1 right-1'"
                :style="{
                  backgroundColor: form.bgColor,
                  color: form.textColor
                }"
              >
                {{ form.text || 'SELO' }}
              </span>
              <div class="flex items-center justify-center h-full text-xs text-zinc-500">
                Produto
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-zinc-800">
            <button
              type="submit"
              :disabled="isSaving || !form.name"
              class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {{ isSaving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar Selo') }}
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
