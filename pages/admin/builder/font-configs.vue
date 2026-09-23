<script setup lang="ts">
import { ArrowLeft, Plus, Pencil, Trash2, X } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type FontConfig = {
  id: string
  name: string
  family: string
  weight: string
  style: string
  google_url: string
  is_active: boolean
  sort_order: number
}

const fonts = ref<FontConfig[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const showDeleteConfirm = ref<string | null>(null)
const isSaving = ref(false)
const loadedFonts = ref<Set<string>>(new Set())

const form = ref({
  name: '',
  family: '',
  weight: '400',
  style: 'normal',
  google_url: '',
  is_active: true,
  sort_order: 0
})

const resetForm = () => {
  form.value = {
    name: '',
    family: '',
    weight: '400',
    style: 'normal',
    google_url: '',
    is_active: true,
    sort_order: 0
  }
  editingId.value = null
}

const openCreate = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (font: FontConfig) => {
  editingId.value = font.id
  form.value = {
    name: font.name,
    family: font.family || '',
    weight: font.weight || '400',
    style: font.style || 'normal',
    google_url: font.google_url || '',
    is_active: font.is_active ?? true,
    sort_order: font.sort_order || 0
  }
  loadGoogleFont(font.google_url)
  showForm.value = true
}

const loadGoogleFont = (url: string) => {
  if (!url || loadedFonts.value.has(url)) return
  try {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    document.head.appendChild(link)
    loadedFonts.value.add(url)
  } catch {
    // ignore font load errors
  }
}

const fetchFonts = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>('/api/admin/builder/font-configs', { headers })
    fonts.value = Array.isArray(data) ? data : data?.data ?? data?.items ?? []
    // Load all Google Fonts for preview
    for (const font of fonts.value) {
      if (font.google_url) loadGoogleFont(font.google_url)
    }
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao carregar fontes')
  } finally {
    isLoading.value = false
  }
}

const saveFont = async () => {
  isSaving.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const payload = { ...form.value }

    if (editingId.value) {
      await $fetch(`/api/admin/builder/font-configs/${editingId.value}`, {
        method: 'PUT',
        headers,
        body: payload
      })
    } else {
      await $fetch('/api/admin/builder/font-configs', {
        method: 'POST',
        headers,
        body: payload
      })
    }

    showForm.value = false
    resetForm()
    await fetchFonts()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao salvar fonte')
  } finally {
    isSaving.value = false
  }
}

const deleteFont = async (id: string) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/font-configs/${id}`, {
      method: 'DELETE',
      headers
    })
    showDeleteConfirm.value = null
    await fetchFonts()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao excluir fonte')
  }
}

// Dynamically load form font for preview
watch(() => form.value.google_url, (url) => {
  if (url) loadGoogleFont(url)
})

onMounted(() => {
  fetchFonts()
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
        <h1 class="text-2xl font-semibold tracking-tight">Fontes do Builder</h1>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-[color:var(--jv-blue)] px-4 py-2 text-sm font-medium text-[color:var(--jv-navy)] hover:bg-[#1a4f96] transition-colors"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          Nova Fonte
        </button>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {{ error }}
      </div>

      <div v-if="isLoading" class="text-center py-12 text-[color:var(--jv-muted)]">Carregando...</div>

      <!-- Table -->
      <div v-else-if="fonts.length && !showForm" class="overflow-x-auto rounded-lg border border-[color:var(--jv-line)]" role="region" aria-label="Tabela de registros — deslize para ver todas as colunas" tabindex="0">
        <table class="w-full text-left text-sm">
          <thead class="bg-[#f3f8fd]">
            <tr>
              <th class="px-4 py-3 font-medium text-slate-600">Preview</th>
              <th class="px-4 py-3 font-medium text-slate-600">Nome</th>
              <th class="px-4 py-3 font-medium text-slate-600">Familia</th>
              <th class="px-4 py-3 font-medium text-slate-600">Peso</th>
              <th class="px-4 py-3 font-medium text-slate-600">Estilo</th>
              <th class="px-4 py-3 font-medium text-slate-600">Status</th>
              <th class="px-4 py-3 font-medium text-slate-600 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr v-for="font in fonts" :key="font.id" class="border-t border-[color:var(--jv-line)]">
              <td class="px-4 py-3">
                <span
                  class="text-base text-[color:var(--jv-ink)]"
                  :style="{
                    fontFamily: font.family ? `'${font.family}', sans-serif` : 'sans-serif',
                    fontWeight: font.weight || '400',
                    fontStyle: font.style || 'normal'
                  }"
                >
                  Abc 123
                </span>
              </td>
              <td class="px-4 py-3 font-medium text-[color:var(--jv-ink)]">{{ font.name }}</td>
              <td class="px-4 py-3 text-slate-600">{{ font.family || '-' }}</td>
              <td class="px-4 py-3 text-[color:var(--jv-muted)]">{{ font.weight }}</td>
              <td class="px-4 py-3 text-[color:var(--jv-muted)]">{{ font.style }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                  :class="font.is_active
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    : 'bg-[color:var(--jv-sky)] text-[color:var(--jv-muted)] border border-[color:var(--jv-line)]'"
                >
                  {{ font.is_active ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-[color:var(--jv-sky)] hover:text-[color:var(--jv-navy)] transition-colors"
                    title="Editar"
                    @click="openEdit(font)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
                    title="Excluir"
                    @click="showDeleteConfirm = font.id"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!fonts.length && !showForm && !isLoading" class="text-center py-12 text-[color:var(--jv-muted)]">
        Nenhuma fonte cadastrada.
      </div>

      <!-- Delete Confirmation -->
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDeleteConfirm = null"
      >
        <div class="rounded-xl border border-[color:var(--jv-line)] bg-[#f3f8fd] p-6 shadow-xl max-w-sm w-full mx-4">
          <h3 class="text-lg font-medium text-[color:var(--jv-ink)]">Confirmar exclusao</h3>
          <p class="mt-2 text-sm text-[color:var(--jv-muted)]">Tem certeza que deseja excluir esta fonte?</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-lg bg-[color:var(--jv-sky)] px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 transition-colors"
              @click="showDeleteConfirm = null"
            >
              Cancelar
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm text-[color:var(--jv-navy)] hover:bg-red-500 transition-colors"
              @click="deleteFont(showDeleteConfirm!)"
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
            {{ editingId ? 'Editar Fonte' : 'Nova Fonte' }}
          </h2>
          <button
            class="rounded-md p-1.5 text-[color:var(--jv-muted)] hover:bg-[color:var(--jv-sky)] hover:text-[color:var(--jv-navy)]"
            @click="showForm = false; resetForm()"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <form @submit.prevent="saveFont" class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Nome *</label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: Roboto Bold"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Familia</label>
              <input
                v-model="form.family"
                type="text"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: Roboto"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Peso</label>
              <input
                v-model="form.weight"
                type="text"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: 400, 700"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Estilo</label>
              <input
                v-model="form.style"
                type="text"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Ex: normal, italic"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-1">Google Fonts URL</label>
              <input
                v-model="form.google_url"
                type="text"
                class="w-full rounded-lg border border-[color:var(--jv-line)] bg-[#f3f8fd] px-3 py-2 text-sm text-[color:var(--jv-navy)] placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="https://fonts.googleapis.com/css2?family=Roboto:wght@700"
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

          <!-- Font Preview -->
          <div v-if="form.family">
            <label class="block text-xs font-medium text-[color:var(--jv-muted)] mb-2">Preview</label>
            <div class="rounded-lg border border-[color:var(--jv-line)] bg-[color:var(--jv-sky)] p-4">
              <p
                class="text-2xl text-[color:var(--jv-ink)]"
                :style="{
                  fontFamily: `'${form.family}', sans-serif`,
                  fontWeight: form.weight || '400',
                  fontStyle: form.style || 'normal'
                }"
              >
                Encarte de Ofertas - R$ 9,99
              </p>
              <p
                class="mt-2 text-sm text-slate-600"
                :style="{
                  fontFamily: `'${form.family}', sans-serif`,
                  fontWeight: form.weight || '400',
                  fontStyle: form.style || 'normal'
                }"
              >
                ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t border-[color:var(--jv-line)]">
            <button
              type="submit"
              :disabled="isSaving || !form.name"
              class="rounded-lg bg-[color:var(--jv-blue)] px-6 py-2 text-sm font-medium text-[color:var(--jv-navy)] hover:bg-[#1a4f96] disabled:opacity-50 transition-colors"
            >
              {{ isSaving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar Fonte') }}
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
