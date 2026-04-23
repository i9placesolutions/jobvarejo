<script setup lang="ts">
/**
 * Admin: Gestao de Segmentos/Interesses
 * Permite criar, editar e remover segmentos de mercado
 * usados na recomendacao de temas do builder
 */
import { Target, Plus, Pencil, Trash2, ArrowLeft, Save, Loader2 } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false,
})

const { getApiAuthHeaders } = useApiAuth()
const route = useRoute()

// State
const segments = ref<any[]>([])
const isLoading = ref(true)
const showForm = ref(false)
const editingId = ref<string | null>(null)

const emptySegment = () => ({
  id: '',
  name: '',
  slug: '',
  icon: '📦',
  description: '',
  is_active: true,
  sort_order: 0,
})

const form = ref(emptySegment())

const ICON_OPTIONS = [
  '🛒', '🥬', '🥩', '🍞', '💊', '🍺', '📱', '🧱',
  '🐾', '💄', '🍽️', '👗', '🧸', '🏠', '📝', '📦',
  '🎮', '🏋️', '📚', '🔧', '🎨', '⚡', '💰', '🎁',
]

// Fetch
const fetchSegments = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<any>('/api/admin/builder/segments', { headers: await getApiAuthHeaders() })
    segments.value = Array.isArray(data) ? data : data?.data ?? []
  } catch (err) {
    console.error('Erro ao carregar segmentos:', err)
  } finally {
    isLoading.value = false
  }
}

// Form actions
const openCreate = () => {
  form.value = emptySegment()
  editingId.value = null
  showForm.value = true
}

const openEdit = (seg: any) => {
  form.value = { ...seg }
  editingId.value = seg.id
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
  editingId.value = null
}

const autoSlug = (name: string) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

watch(() => form.value.name, (newName) => {
  if (!editingId.value && newName) {
    form.value.slug = autoSlug(newName)
  }
})

const handleSave = async () => {
  if (!form.value.name.trim()) return

  try {
    if (editingId.value) {
      await $fetch(`/api/admin/builder/segments/${editingId.value}`, {
        method: 'PUT',
        headers: await getApiAuthHeaders(),
        body: form.value,
      })
    } else {
      await $fetch('/api/admin/builder/segments', {
        method: 'POST',
        headers: await getApiAuthHeaders(),
        body: form.value,
      })
    }
    closeForm()
    await fetchSegments()
  } catch (err: any) {
    console.error('Erro ao salvar segmento:', err)
  }
}

const handleDelete = async (id: string) => {
  if (!confirm('Tem certeza que deseja excluir este segmento?')) return
  try {
    await $fetch(`/api/admin/builder/segments/${id}`, {
      method: 'DELETE',
      headers: await getApiAuthHeaders(),
    })
    await fetchSegments()
  } catch (err) {
    console.error('Erro ao excluir segmento:', err)
  }
}

const toggleActive = async (seg: any) => {
  try {
    await $fetch(`/api/admin/builder/segments/${seg.id}`, {
      method: 'PUT',
      headers: await getApiAuthHeaders(),
      body: { is_active: !seg.is_active },
    })
    await fetchSegments()
  } catch (err) {
    console.error('Erro ao alternar status:', err)
  }
}

onMounted(() => {
  fetchSegments()
})
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <!-- Back link -->
      <div class="mb-8">
        <NuxtLink
          to="/admin/builder"
          class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft class="h-4 w-4" />
          Voltar ao dashboard
        </NuxtLink>
      </div>

      <!-- Header -->
      <div class="mb-8 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Target class="h-7 w-7 text-emerald-400" />
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">Segmentos</h1>
            <p class="text-sm text-zinc-400">Gerencie os segmentos de mercado para recomendacao de temas.</p>
          </div>
        </div>
        <button
          @click="openCreate"
          class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          <Plus class="h-4 w-4" />
          Novo Segmento
        </button>
      </div>

      <!-- Form Modal -->
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="closeForm">
        <div class="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-lg p-6 space-y-4">
          <h2 class="text-lg font-medium text-zinc-100">
            {{ editingId ? 'Editar Segmento' : 'Novo Segmento' }}
          </h2>

          <!-- Icon -->
          <div>
            <label class="text-xs text-zinc-400 mb-1 block">Icone</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="icon in ICON_OPTIONS" :key="icon"
                @click="form.icon = icon"
                :class="['w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all border',
                  form.icon === icon ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700']">
                {{ icon }}
              </button>
            </div>
          </div>

          <!-- Name -->
          <div>
            <label class="text-xs text-zinc-400 mb-1 block">Nome</label>
            <input v-model="form.name" placeholder="Ex: Supermercado"
              class="w-full bg-zinc-800 text-sm text-zinc-100 rounded-lg px-3 py-2 border border-zinc-700 outline-none focus:border-emerald-500" />
          </div>

          <!-- Slug -->
          <div>
            <label class="text-xs text-zinc-400 mb-1 block">Slug</label>
            <input v-model="form.slug" placeholder="supermercado"
              class="w-full bg-zinc-800 text-sm text-zinc-100 rounded-lg px-3 py-2 border border-zinc-700 outline-none focus:border-emerald-500" />
          </div>

          <!-- Description -->
          <div>
            <label class="text-xs text-zinc-400 mb-1 block">Descricao</label>
            <textarea v-model="form.description" rows="2" placeholder="Descricao do segmento..."
              class="w-full bg-zinc-800 text-sm text-zinc-100 rounded-lg px-3 py-2 border border-zinc-700 outline-none resize-none focus:border-emerald-500" />
          </div>

          <!-- Sort Order -->
          <div>
            <label class="text-xs text-zinc-400 mb-1 block">Ordem</label>
            <input v-model.number="form.sort_order" type="number"
              class="w-24 bg-zinc-800 text-sm text-zinc-100 rounded-lg px-3 py-2 border border-zinc-700 outline-none focus:border-emerald-500" />
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-2">
            <button @click="closeForm" class="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Cancelar</button>
            <button @click="handleSave" :disabled="!form.name.trim()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed">
              <Save class="h-4 w-4" />
              Salvar
            </button>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div v-if="isLoading" class="flex items-center justify-center py-20">
        <Loader2 class="h-8 w-8 text-emerald-400 animate-spin" />
      </div>

      <div v-else-if="segments.length === 0" class="text-center py-20 text-zinc-500">
        <Target class="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p class="text-sm">Nenhum segmento cadastrado.</p>
        <p class="text-xs mt-1">Clique em "Novo Segmento" para comecar.</p>
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-zinc-800">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-zinc-900 border-b border-zinc-800">
              <th class="text-left px-4 py-3 text-xs font-medium text-zinc-400">Icone</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-zinc-400">Nome</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-zinc-400">Slug</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-zinc-400">Ordem</th>
              <th class="text-left px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
              <th class="text-right px-4 py-3 text-xs font-medium text-zinc-400">Acoes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="seg in [...segments].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))" :key="seg.id"
              class="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
              <td class="px-4 py-3 text-xl">{{ seg.icon }}</td>
              <td class="px-4 py-3 text-zinc-100 font-medium">{{ seg.name }}</td>
              <td class="px-4 py-3 text-zinc-400 font-mono text-xs">{{ seg.slug }}</td>
              <td class="px-4 py-3 text-zinc-400">{{ seg.sort_order ?? 0 }}</td>
              <td class="px-4 py-3">
                <button @click="toggleActive(seg)"
                  :class="['px-2 py-0.5 rounded-full text-xs font-medium',
                    seg.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500']">
                  {{ seg.is_active ? 'Ativo' : 'Inativo' }}
                </button>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button @click="openEdit(seg)" class="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors" title="Editar">
                    <Pencil class="h-3.5 w-3.5" />
                  </button>
                  <button @click="handleDelete(seg.id)" class="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors" title="Excluir">
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
