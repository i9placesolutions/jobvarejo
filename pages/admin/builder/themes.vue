<script setup lang="ts">
import { ArrowLeft, Plus, Pencil, Trash2, X, Eye, Upload } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: ['auth', 'admin'],
  ssr: false
})

const { getApiAuthHeaders } = useApiAuth()

type CssConfig = {
  primaryColor: string
  secondaryColor: string
  bgColor: string
  textColor: string
  borderRadius: string
  headerBg: string
  bodyBg: string
  footerBg: string
  accentColor: string
}

type HeaderConfig = {
  layout: string
  showLogo: boolean
  showDates: boolean
  showTitle: boolean
  height: number
  backgroundImage: string
}

type BodyConfig = {
  padding: number
  gap: number
  productCardStyle: string
}

type FooterConfig = {
  showWatermark: boolean
  style: string
  height: number
}

type Theme = {
  id: string
  name: string
  slug: string
  category_name: string
  sort_order: number
  is_active: boolean
  is_premium: boolean
  is_public: boolean
  thumbnail: string
  background_image: string
  tags: string[]
  css_config: CssConfig
  header_config: HeaderConfig
  body_config: BodyConfig
  footer_config: FooterConfig
}

const themes = ref<Theme[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showForm = ref(false)
const editingId = ref<string | null>(null)
const showDeleteConfirm = ref<string | null>(null)
const isSaving = ref(false)
const uploadingField = ref<string | null>(null)

// Formatos para preview
const previewFormats = [
  { label: 'Feed 1:1', width: 1080, height: 1080 },
  { label: 'Stories 9:16', width: 1080, height: 1920 },
  { label: 'Feed 4:5', width: 1080, height: 1350 },
  { label: 'A4 Vertical', width: 794, height: 1123 },
  { label: 'A4 Horizontal', width: 1123, height: 794 },
  { label: 'A3 Vertical', width: 1123, height: 1587 },
  { label: 'A3 Horizontal', width: 1587, height: 1123 },
  { label: 'TV 16:9', width: 1920, height: 1080 },
] as const
const previewFormatIdx = ref(0)
const previewFormat = computed(() => previewFormats[previewFormatIdx.value] ?? previewFormats[0])
const PREVIEW_WIDTH = 270
const previewScale = computed(() => PREVIEW_WIDTH / previewFormat.value.width)
const previewHeight = computed(() => Math.round(previewFormat.value.height * previewScale.value))

const storageProxyUrl = (keyOrUrl: string | null | undefined): string => {
  if (!keyOrUrl) return ''
  const v = keyOrUrl.trim()
  if (v.startsWith('/api/')) return v
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  return `/api/storage/p?key=${encodeURIComponent(v)}`
}

const uploadImage = async (file: File, field: 'thumbnail' | 'background_image' | 'header_bg') => {
  uploadingField.value = field
  error.value = null
  try {
    const slug = form.value.slug || generateSlug(form.value.name) || 'untitled'
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const ts = Date.now()
    const key = `builder/themes/${slug}/${field}_${ts}.${ext}`
    const contentType = file.type || 'image/jpeg'

    const buffer = await file.arrayBuffer()

    const res = await $fetch<{ key: string }>('/api/admin/builder/storage/upload', {
      method: 'POST',
      query: { key, contentType },
      body: buffer,
      headers: { 'Content-Type': contentType },
    })

    const savedKey = res.key
    if (field === 'thumbnail') {
      form.value.thumbnail = savedKey
    } else if (field === 'background_image') {
      form.value.background_image = savedKey
    } else if (field === 'header_bg') {
      form.value.header_config.backgroundImage = savedKey
    }
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha no upload')
  } finally {
    uploadingField.value = null
  }
}

const hasImageValue = (val: string | null | undefined): boolean => {
  if (!val || typeof val !== 'string') return false
  const v = val.trim()
  if (v.length < 5) return false
  // Storage key (e.g. builder/themes/slug/thumbnail_123.jpg)
  if (v.startsWith('builder/') && v.includes('.')) return true
  // Proxy URL
  if (v.startsWith('/api/')) return true
  // Full URL
  if (v.startsWith('http://') || v.startsWith('https://')) {
    if (/^https?:\/\/\.{2,}/.test(v)) return false
    try { new URL(v) } catch { return false }
    return true
  }
  return false
}

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (img?.parentElement) img.parentElement.style.display = 'none'
}

const onFileSelected = (event: Event, field: 'thumbnail' | 'background_image' | 'header_bg') => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    uploadImage(file, field)
  }
  input.value = ''
}

const defaultCssConfig = (): CssConfig => ({
  primaryColor: '#10b981',
  secondaryColor: '#6366f1',
  bgColor: '#ffffff',
  textColor: '#18181b',
  borderRadius: '8px',
  headerBg: '#18181b',
  bodyBg: '#ffffff',
  footerBg: '#18181b',
  accentColor: '#f59e0b'
})

const defaultHeaderConfig = (): HeaderConfig => ({
  layout: 'center',
  showLogo: true,
  showDates: true,
  showTitle: true,
  height: 200,
  backgroundImage: ''
})

const defaultBodyConfig = (): BodyConfig => ({
  padding: 16,
  gap: 12,
  productCardStyle: 'rounded'
})

const defaultFooterConfig = (): FooterConfig => ({
  showWatermark: true,
  style: '',
  height: 80
})

const form = ref({
  name: '',
  slug: '',
  category_name: '',
  sort_order: 0,
  is_active: true,
  is_premium: false,
  is_public: true,
  thumbnail: '',
  background_image: '',
  tags_text: '',
  css_config: defaultCssConfig(),
  header_config: defaultHeaderConfig(),
  body_config: defaultBodyConfig(),
  footer_config: defaultFooterConfig()
})

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const resetForm = () => {
  form.value = {
    name: '',
    slug: '',
    category_name: '',
    sort_order: 0,
    is_active: true,
    is_premium: false,
    is_public: true,
    thumbnail: '',
    background_image: '',
    tags_text: '',
    css_config: defaultCssConfig(),
    header_config: defaultHeaderConfig(),
    body_config: defaultBodyConfig(),
    footer_config: defaultFooterConfig()
  }
  editingId.value = null
}

const openCreate = () => {
  resetForm()
  showForm.value = true
}

const openEdit = (theme: Theme) => {
  editingId.value = theme.id
  form.value = {
    name: theme.name,
    slug: theme.slug,
    category_name: theme.category_name || '',
    sort_order: theme.sort_order || 0,
    is_active: theme.is_active ?? true,
    is_premium: theme.is_premium ?? false,
    is_public: theme.is_public ?? true,
    thumbnail: hasImageValue(theme.thumbnail) ? theme.thumbnail : '',
    background_image: hasImageValue(theme.background_image) ? theme.background_image : '',
    tags_text: (theme.tags || []).join(', '),
    css_config: { ...defaultCssConfig(), ...(theme.css_config || {}) },
    header_config: {
      ...defaultHeaderConfig(),
      ...(theme.header_config || {}),
      backgroundImage: hasImageValue(theme.header_config?.backgroundImage) ? theme.header_config.backgroundImage : '',
    },
    body_config: { ...defaultBodyConfig(), ...(theme.body_config || {}) },
    footer_config: { ...defaultFooterConfig(), ...(theme.footer_config || {}) }
  }
  showForm.value = true
}

const fetchThemes = async () => {
  isLoading.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const data = await $fetch<any>('/api/admin/builder/themes', { headers })
    themes.value = Array.isArray(data) ? data : data?.themes ?? data?.data ?? data?.items ?? []
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao carregar temas')
  } finally {
    isLoading.value = false
  }
}

const saveTheme = async () => {
  isSaving.value = true
  error.value = null
  try {
    const headers = await getApiAuthHeaders()
    const slug = form.value.slug || generateSlug(form.value.name)
    const tags = form.value.tags_text
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const payload = {
      name: form.value.name,
      slug,
      category_name: form.value.category_name,
      sort_order: form.value.sort_order,
      is_active: form.value.is_active,
      is_premium: form.value.is_premium,
      is_public: form.value.is_public,
      thumbnail: form.value.thumbnail,
      background_image: form.value.background_image,
      tags,
      css_config: form.value.css_config,
      header_config: form.value.header_config,
      body_config: form.value.body_config,
      footer_config: form.value.footer_config
    }

    if (editingId.value) {
      await $fetch(`/api/admin/builder/themes/${editingId.value}`, {
        method: 'PUT',
        headers,
        body: payload
      })
    } else {
      await $fetch('/api/admin/builder/themes', {
        method: 'POST',
        headers,
        body: payload
      })
    }

    showForm.value = false
    resetForm()
    await fetchThemes()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao salvar tema')
  } finally {
    isSaving.value = false
  }
}

const deleteTheme = async (id: string) => {
  try {
    const headers = await getApiAuthHeaders()
    await $fetch(`/api/admin/builder/themes/${id}`, {
      method: 'DELETE',
      headers
    })
    showDeleteConfirm.value = null
    await fetchThemes()
  } catch (e: any) {
    error.value = String(e?.data?.message || e?.message || 'Falha ao excluir tema')
  }
}

watch(() => form.value.name, (name) => {
  if (!editingId.value) {
    form.value.slug = generateSlug(name)
  }
})

onMounted(() => {
  fetchThemes()
})
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">
    <div class="mx-auto max-w-6xl px-6 py-10">
      <!-- Header -->
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
        <h1 class="text-2xl font-semibold tracking-tight">Temas do Builder</h1>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          @click="openCreate"
        >
          <Plus class="h-4 w-4" />
          Novo Tema
        </button>
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {{ error }}
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="text-center py-12 text-zinc-500">Carregando...</div>

      <!-- Theme Table -->
      <div v-else-if="themes.length && !showForm" class="overflow-hidden rounded-lg border border-zinc-800">
        <table class="w-full text-left text-sm">
          <thead class="bg-zinc-900">
            <tr>
              <th class="px-4 py-3 font-medium text-zinc-300">Preview</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Nome</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Slug</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Categoria</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Status</th>
              <th class="px-4 py-3 font-medium text-zinc-300">Ordem</th>
              <th class="px-4 py-3 font-medium text-zinc-300 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody class="bg-zinc-900/50">
            <tr
              v-for="theme in themes"
              :key="theme.id"
              class="border-t border-zinc-800"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <img
                    v-if="hasImageValue(theme.thumbnail)"
                    :src="storageProxyUrl(theme.thumbnail)"
                    class="h-10 w-10 rounded border border-zinc-700 object-cover"
                    @error="onImageError"
                  />
                  <div v-else class="flex gap-1">
                    <div
                      class="h-6 w-6 rounded border border-zinc-700"
                      :style="{ backgroundColor: theme.css_config?.bgColor || '#fff' }"
                      :title="'Fundo: ' + (theme.css_config?.bgColor || '-')"
                    />
                    <div
                      class="h-6 w-6 rounded border border-zinc-700"
                      :style="{ backgroundColor: theme.css_config?.primaryColor || '#10b981' }"
                      :title="'Primaria: ' + (theme.css_config?.primaryColor || '-')"
                    />
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 font-medium text-zinc-100">{{ theme.name }}</td>
              <td class="px-4 py-3 font-mono text-xs text-zinc-400">{{ theme.slug }}</td>
              <td class="px-4 py-3 text-zinc-300">{{ theme.category_name || '-' }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-1.5">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                    :class="theme.is_active
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700'"
                  >
                    {{ theme.is_active ? 'Ativo' : 'Inativo' }}
                  </span>
                  <span
                    v-if="theme.is_premium"
                    class="inline-flex items-center rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 text-xs"
                  >
                    Premium
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-zinc-400">{{ theme.sort_order }}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                    title="Editar"
                    @click="openEdit(theme)"
                  >
                    <Pencil class="h-4 w-4" />
                  </button>
                  <button
                    class="rounded-md p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Excluir"
                    @click="showDeleteConfirm = theme.id"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!themes.length && !showForm && !isLoading" class="text-center py-12 text-zinc-500">
        Nenhum tema cadastrado.
      </div>

      <!-- Delete Confirmation -->
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        @click.self="showDeleteConfirm = null"
      >
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl max-w-sm w-full mx-4">
          <h3 class="text-lg font-medium text-zinc-100">Confirmar exclusao</h3>
          <p class="mt-2 text-sm text-zinc-400">Tem certeza que deseja excluir este tema? Esta acao nao pode ser desfeita.</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
              @click="showDeleteConfirm = null"
            >
              Cancelar
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 transition-colors"
              @click="deleteTheme(showDeleteConfirm!)"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>

      <!-- Create/Edit Form -->
      <div v-if="showForm" class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-medium">
            {{ editingId ? 'Editar Tema' : 'Novo Tema' }}
          </h2>
          <button
            class="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            @click="showForm = false; resetForm()"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <form @submit.prevent="saveTheme" class="space-y-8">
          <!-- Basic Info -->
          <div>
            <h3 class="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Informacoes Basicas</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Nome *</label>
                <input
                  v-model="form.name"
                  type="text"
                  required
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Ex: Moderno Verde"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Slug</label>
                <input
                  v-model="form.slug"
                  type="text"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="auto-gerado"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Categoria</label>
                <input
                  v-model="form.category_name"
                  type="text"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="Ex: Supermercado"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Ordem</label>
                <input
                  v-model.number="form.sort_order"
                  type="number"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Thumbnail</label>
                <div class="space-y-2">
                  <div
                    v-if="hasImageValue(form.thumbnail)"
                    class="relative w-full h-24 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900"
                  >
                    <img :src="storageProxyUrl(form.thumbnail)" class="w-full h-full object-cover" @error="onImageError" />
                    <button
                      type="button"
                      class="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      @click="form.thumbnail = ''"
                    >
                      <X class="h-3 w-3" />
                    </button>
                  </div>
                  <label
                    class="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-zinc-600 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors"
                    :class="{ 'opacity-50 pointer-events-none': uploadingField === 'thumbnail' }"
                  >
                    <Upload v-if="uploadingField !== 'thumbnail'" class="h-4 w-4" />
                    <span>{{ uploadingField === 'thumbnail' ? 'Enviando...' : 'Upload thumbnail' }}</span>
                    <input type="file" accept="image/*" class="hidden" @change="onFileSelected($event, 'thumbnail')" />
                  </label>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Imagem de Fundo</label>
                <div class="space-y-2">
                  <div
                    v-if="hasImageValue(form.background_image)"
                    class="relative w-full h-24 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900"
                  >
                    <img :src="storageProxyUrl(form.background_image)" class="w-full h-full object-cover" @error="onImageError" />
                    <button
                      type="button"
                      class="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      @click="form.background_image = ''"
                    >
                      <X class="h-3 w-3" />
                    </button>
                  </div>
                  <label
                    class="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-zinc-600 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors"
                    :class="{ 'opacity-50 pointer-events-none': uploadingField === 'background_image' }"
                  >
                    <Upload v-if="uploadingField !== 'background_image'" class="h-4 w-4" />
                    <span>{{ uploadingField === 'background_image' ? 'Enviando...' : 'Upload imagem de fundo' }}</span>
                    <input type="file" accept="image/*" class="hidden" @change="onFileSelected($event, 'background_image')" />
                  </label>
                </div>
              </div>
              <div class="sm:col-span-2 lg:col-span-3">
                <label class="block text-xs font-medium text-zinc-400 mb-1">Tags (separadas por virgula)</label>
                <input
                  v-model="form.tags_text"
                  type="text"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="supermercado, moderno, verde"
                />
              </div>
              <div class="flex items-center gap-6 sm:col-span-2 lg:col-span-3">
                <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input v-model="form.is_active" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                  Ativo
                </label>
                <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input v-model="form.is_premium" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                  Premium
                </label>
                <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input v-model="form.is_public" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                  Publico
                </label>
              </div>
            </div>
          </div>

          <!-- CSS Config -->
          <div>
            <h3 class="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Configuracao Visual (CSS)</h3>
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Cor Primaria</label>
                <div class="flex items-center gap-2">
                  <input v-model="form.css_config.primaryColor" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                  <input v-model="form.css_config.primaryColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Cor Secundaria</label>
                <div class="flex items-center gap-2">
                  <input v-model="form.css_config.secondaryColor" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                  <input v-model="form.css_config.secondaryColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Cor de Fundo</label>
                <div class="flex items-center gap-2">
                  <input v-model="form.css_config.bgColor" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                  <input v-model="form.css_config.bgColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Cor do Texto</label>
                <div class="flex items-center gap-2">
                  <input v-model="form.css_config.textColor" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                  <input v-model="form.css_config.textColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Cor Destaque</label>
                <div class="flex items-center gap-2">
                  <input v-model="form.css_config.accentColor" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                  <input v-model="form.css_config.accentColor" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Header Bg</label>
                <div class="flex items-center gap-2">
                  <input v-model="form.css_config.headerBg" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                  <input v-model="form.css_config.headerBg" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Body Bg</label>
                <div class="flex items-center gap-2">
                  <input v-model="form.css_config.bodyBg" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                  <input v-model="form.css_config.bodyBg" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Footer Bg</label>
                <div class="flex items-center gap-2">
                  <input v-model="form.css_config.footerBg" type="color" class="h-8 w-10 rounded border border-zinc-700 bg-zinc-900 cursor-pointer" />
                  <input v-model="form.css_config.footerBg" type="text" class="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Border Radius</label>
                <input
                  v-model="form.css_config.borderRadius"
                  type="text"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  placeholder="8px"
                />
              </div>
            </div>
          </div>

          <!-- Header Config -->
          <div>
            <h3 class="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Configuracao do Header</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Layout</label>
                <select
                  v-model="form.header_config.layout"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Altura (px)</label>
                <input
                  v-model.number="form.header_config.height"
                  type="number"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Imagem de Fundo do Header</label>
                <div class="space-y-2">
                  <div
                    v-if="hasImageValue(form.header_config.backgroundImage)"
                    class="relative w-full h-20 rounded-lg border border-zinc-700 overflow-hidden bg-zinc-900"
                  >
                    <img :src="storageProxyUrl(form.header_config.backgroundImage)" class="w-full h-full object-cover" @error="onImageError" />
                    <button
                      type="button"
                      class="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      @click="form.header_config.backgroundImage = ''"
                    >
                      <X class="h-3 w-3" />
                    </button>
                  </div>
                  <label
                    class="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-zinc-600 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors"
                    :class="{ 'opacity-50 pointer-events-none': uploadingField === 'header_bg' }"
                  >
                    <Upload v-if="uploadingField !== 'header_bg'" class="h-3.5 w-3.5" />
                    <span>{{ uploadingField === 'header_bg' ? 'Enviando...' : 'Upload' }}</span>
                    <input type="file" accept="image/*" class="hidden" @change="onFileSelected($event, 'header_bg')" />
                  </label>
                </div>
              </div>
              <div class="flex items-end gap-4">
                <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input v-model="form.header_config.showLogo" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                  Logo
                </label>
                <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input v-model="form.header_config.showDates" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                  Datas
                </label>
                <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input v-model="form.header_config.showTitle" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                  Titulo
                </label>
              </div>
            </div>
          </div>

          <!-- Body Config -->
          <div>
            <h3 class="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Configuracao do Body</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Padding</label>
                <input
                  v-model.number="form.body_config.padding"
                  type="number"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Gap</label>
                <input
                  v-model.number="form.body_config.gap"
                  type="number"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Estilo do Card</label>
                <select
                  v-model="form.body_config.productCardStyle"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="rounded">Rounded</option>
                  <option value="square">Square</option>
                  <option value="pill">Pill</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Footer Config -->
          <div>
            <h3 class="text-sm font-medium text-zinc-300 mb-4 uppercase tracking-wider">Configuracao do Footer</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Estilo</label>
                <input
                  v-model="form.footer_config.style"
                  type="text"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-zinc-400 mb-1">Altura (px)</label>
                <input
                  v-model.number="form.footer_config.height"
                  type="number"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div class="flex items-end">
                <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input v-model="form.footer_config.showWatermark" type="checkbox" class="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/50" />
                  Marca d'agua
                </label>
              </div>
            </div>
          </div>

          <!-- Live Preview -->
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-medium text-zinc-300 uppercase tracking-wider">Preview do Encarte</h3>
              <div class="flex items-center gap-1">
                <button
                  v-for="(fmt, idx) in previewFormats"
                  :key="idx"
                  type="button"
                  class="rounded-md px-2 py-1 text-[10px] font-medium transition-colors"
                  :class="previewFormatIdx === idx
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'"
                  @click="previewFormatIdx = idx"
                >
                  {{ fmt.label }}
                </button>
              </div>
            </div>
            <p class="text-[10px] text-zinc-500 mb-2">{{ previewFormat.width }}x{{ previewFormat.height }}px</p>

            <div class="flex gap-6 items-start">
              <!-- Mini encarte proporcional ao formato -->
              <div
                class="border border-zinc-700 overflow-hidden shrink-0 flex flex-col"
                :style="{
                  width: `${PREVIEW_WIDTH}px`,
                  height: `${previewHeight}px`,
                  borderRadius: form.css_config.borderRadius,
                  backgroundColor: form.css_config.bgColor,
                }"
              >
                <!-- HEADER -->
                <div
                  class="relative flex overflow-hidden shrink-0"
                  :style="{
                    backgroundColor: form.css_config.headerBg,
                    color: '#fff',
                    height: `${Math.round(form.header_config.height * previewScale)}px`,
                    justifyContent: form.header_config.layout === 'left' ? 'flex-start' : form.header_config.layout === 'right' ? 'flex-end' : 'center',
                    alignItems: 'center',
                  }"
                >
                  <img
                    v-if="hasImageValue(form.header_config.backgroundImage)"
                    :src="storageProxyUrl(form.header_config.backgroundImage)"
                    class="absolute inset-0 w-full h-full object-cover"
                    @error="onImageError"
                  />
                  <div class="relative z-10 flex flex-col items-center gap-0.5 p-2">
                    <div
                      v-if="form.header_config.showLogo"
                      class="w-7 h-7 rounded-full flex items-center justify-center text-[7px] font-bold"
                      :style="{ backgroundColor: form.css_config.primaryColor, color: '#fff' }"
                    >
                      LOGO
                    </div>
                    <span
                      v-if="form.header_config.showTitle"
                      class="text-[10px] font-extrabold drop-shadow-sm"
                      :style="{ color: form.css_config.primaryColor }"
                    >
                      OFERTAS DA SEMANA
                    </span>
                    <span v-if="form.header_config.showDates" class="text-[7px] opacity-70">01/04 a 07/04</span>
                  </div>
                </div>

                <!-- BODY -->
                <div
                  class="relative flex-1 overflow-hidden"
                  :style="{
                    backgroundColor: form.css_config.bodyBg || form.css_config.bgColor,
                    padding: `${Math.round(form.body_config.padding * previewScale)}px`,
                  }"
                >
                  <img
                    v-if="hasImageValue(form.background_image)"
                    :src="storageProxyUrl(form.background_image)"
                    class="absolute inset-0 w-full h-full object-cover opacity-15"
                    @error="onImageError"
                  />
                  <div
                    class="relative z-10 grid grid-cols-3"
                    :style="{ gap: `${Math.round(form.body_config.gap * previewScale)}px` }"
                  >
                    <div
                      v-for="i in 6"
                      :key="i"
                      class="flex flex-col items-center p-1 border"
                      :style="{
                        borderRadius: form.body_config.productCardStyle === 'pill' ? '999px' : form.body_config.productCardStyle === 'square' ? '0' : form.css_config.borderRadius,
                        borderColor: form.css_config.primaryColor + '30',
                        backgroundColor: form.css_config.bgColor,
                      }"
                    >
                      <div
                        class="w-full aspect-square rounded-sm mb-0.5"
                        :style="{ backgroundColor: form.css_config.textColor + '10' }"
                      />
                      <span class="text-[6px] leading-tight" :style="{ color: form.css_config.textColor }">Produto {{ i }}</span>
                      <span
                        class="text-[8px] font-bold mt-0.5 px-0.5 rounded"
                        :style="{ color: '#fff', backgroundColor: form.css_config.primaryColor, borderRadius: form.css_config.borderRadius }"
                      >
                        R$ 9,99
                      </span>
                    </div>
                  </div>
                </div>

                <!-- FOOTER -->
                <div
                  class="flex flex-col items-center justify-center shrink-0"
                  :style="{
                    backgroundColor: form.css_config.footerBg,
                    height: `${Math.round(form.footer_config.height * previewScale)}px`,
                    padding: '2px 6px',
                  }"
                >
                  <span class="text-[6px]" :style="{ color: form.css_config.accentColor }">Tel: (11) 9999-9999</span>
                  <span class="text-[5px] opacity-50" :style="{ color: '#fff' }">Ofertas validas enquanto durarem os estoques</span>
                </div>
              </div>

              <!-- Thumbnail -->
              <div v-if="hasImageValue(form.thumbnail)" class="shrink-0">
                <p class="text-[10px] text-zinc-500 mb-1">Thumbnail</p>
                <img
                  :src="storageProxyUrl(form.thumbnail)"
                  class="h-20 w-20 rounded-lg border border-zinc-700 object-cover"
                  @error="onImageError"
                />
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-4 border-t border-zinc-800">
            <button
              type="submit"
              :disabled="isSaving || !form.name"
              class="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {{ isSaving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar Tema') }}
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
