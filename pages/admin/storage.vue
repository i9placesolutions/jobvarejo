<script setup lang="ts">
import { ChevronRight, Download, FileCode2, FileImage, FilePlus2, FileText, Folder, FolderPlus, HardDrive, Pencil, RefreshCw, Trash2, Upload, X } from 'lucide-vue-next'

definePageMeta({ layout: false, middleware: ['auth', 'admin'], ssr: false })

type StorageStats = {
  ok: boolean
  bucket: string
  endpoint: string
  generatedAt: string
  maxKeys: number
  prefixes: Array<{ prefix: string; objects: number; bytes: number; size: string; truncated: boolean }>
  total: { objects: number; bytes: number; size: string }
  warnings?: string[]
}
type StorageFolder = { key: string; name: string }
type StorageFile = { key: string; name: string; size: number; lastModified?: string | null; etag?: string | null; contentType?: string | null }
type StorageList = { prefix: string; folders: StorageFolder[]; files: StorageFile[]; nextToken?: string | null }
type StorageObject = { key: string; content?: string; etag?: string | null; contentType?: string | null; encoding?: string; previewUrl?: string | null; size?: number }
type DialogAction = 'create-folder' | 'create-file' | 'rename' | 'move' | 'delete'
type Selection = { kind: 'folder' | 'file'; key: string; name: string }

const roots = ['imagens/', 'uploads/', 'projects/', 'logo/']
const auth = useAuth()
const { getApiAuthHeaders } = useApiAuth()
const stats = ref<StorageStats | null>(null)
const statsLoading = ref(false)
const statsStale = ref(false)
const currentPrefix = ref('')
const folders = ref<StorageFolder[]>([])
const files = ref<StorageFile[]>([])
const nextToken = ref<string | null>(null)
const listLoading = ref(false)
let listRevision = 0
const listError = ref('')
const toast = ref('')
const operationDetails = ref('')
const activeObject = ref<StorageObject | null>(null)
const objectLoading = ref(false)
let objectRevision = 0
const editorContent = ref('')
const savedContent = ref('')
const dialog = ref<DialogAction | null>(null)
const selection = ref<Selection | null>(null)
const inputName = ref('')
const inputContent = ref('')
const destinationFolder = ref('')
const confirmName = ref('')
const busy = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const replaceInput = ref<HTMLInputElement | null>(null)

const canManage = computed(() => auth.isSuperAdmin.value)
const hasChanges = computed(() => activeObject.value?.content !== undefined && editorContent.value !== savedContent.value)
const breadcrumbs = computed(() => {
  const segments = currentPrefix.value.split('/').filter(Boolean)
  return segments.map((name, index) => ({
    name,
    key: segments.slice(0, index + 1).join('/') + '/'
  }))
})
const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short'
  }).format(date)
}
const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}
const errorMessage = (error: any) =>
  String(error?.data?.statusMessage || error?.data?.message || error?.message || 'Operação não concluída')
const showOperationError = (error: any) => {
  toast.value = errorMessage(error)
  const details = error?.data?.data
  operationDetails.value = details?.partial ? JSON.stringify(details, null, 2).slice(0, 4000) : ''
}

async function fetchStats() {
  statsLoading.value = true
  try {
    stats.value = await $fetch<StorageStats>('/api/storage/stats', { headers: await getApiAuthHeaders() })
    statsStale.value = false
  } catch (error) {
    toast.value = errorMessage(error)
  } finally {
    statsLoading.value = false
  }
}

async function fetchObjects(append = false) {
  if (!canManage.value || !currentPrefix.value) return
  const revision = ++listRevision
  const prefix = currentPrefix.value
  listLoading.value = true
  listError.value = ''
  try {
    const response = await $fetch<StorageList>('/api/admin/storage/objects', {
      headers: await getApiAuthHeaders(),
      query: { prefix, ...(append && nextToken.value ? { token: nextToken.value } : {}) }
    })
    if (revision !== listRevision || prefix !== currentPrefix.value) return
    folders.value = append ? [...folders.value, ...response.folders] : response.folders
    files.value = append ? [...files.value, ...response.files] : response.files
    nextToken.value = response.nextToken || null
  } catch (error) {
    if (revision === listRevision) listError.value = errorMessage(error)
  } finally {
    if (revision === listRevision) listLoading.value = false
  }
}

function openFolder(prefix: string) {
  if (busy.value) return
  if (hasChanges.value && !window.confirm('Descartar alterações não salvas?')) return
  listRevision += 1
  objectRevision += 1
  objectLoading.value = false
  listLoading.value = false
  activeObject.value = null
  currentPrefix.value = prefix
  folders.value = []
  files.value = []
  nextToken.value = null
  if (prefix) void fetchObjects()
}
function goToRoot() { openFolder('') }

async function openFile(file: StorageFile) {
  if (busy.value) return
  if (hasChanges.value && !window.confirm('Descartar alterações não salvas?')) return
  const revision = ++objectRevision
  objectLoading.value = true
  activeObject.value = null
  try {
    const data = await $fetch<StorageObject>('/api/admin/storage/object', {
      headers: await getApiAuthHeaders(), query: { key: file.key }
    })
    if (revision !== objectRevision) return
    activeObject.value = data
    editorContent.value = data.content ?? ''
    savedContent.value = editorContent.value
  } catch (error) {
    if (revision === objectRevision) toast.value = errorMessage(error)
  } finally {
    if (revision === objectRevision) objectLoading.value = false
  }
}
function closeFile() {
  if (busy.value) return
  if (hasChanges.value && !window.confirm('Descartar alterações não salvas?')) return
  objectRevision += 1
  objectLoading.value = false
  activeObject.value = null
}
async function saveFile() {
  if (!activeObject.value || activeObject.value.content === undefined || !hasChanges.value) return
  if (activeObject.value.key.startsWith('projects/') && !window.confirm('Editar este arquivo diretamente pode alterar ou impedir a abertura da arte. Salvar mesmo assim?')) return
  busy.value = true
  try {
    const result = await $fetch<{ backupKey?: string }>('/api/admin/storage/objects', {
      method: 'POST', headers: await getApiAuthHeaders(),
      body: { action: 'save-file', key: activeObject.value.key, content: editorContent.value, etag: activeObject.value.etag }
    })
    savedContent.value = editorContent.value
    toast.value = 'Arquivo salvo. Uma cópia anterior foi guardada.'
    operationDetails.value = result.backupKey || ''
    statsStale.value = true
    try {
      const refreshed = await $fetch<StorageObject>('/api/admin/storage/object', {
        headers: await getApiAuthHeaders(), query: { key: activeObject.value.key }
      })
      activeObject.value = refreshed
      editorContent.value = refreshed.content ?? ''
      savedContent.value = editorContent.value
    } catch {
      toast.value = 'Arquivo salvo, mas não foi possível recarregar a versão nova. Atualize antes de editar novamente.'
      activeObject.value = null
    }
    await fetchObjects()
  } catch (error) {
    showOperationError(error)
  } finally {
    busy.value = false
  }
}

function openDialog(action: DialogAction, item?: Selection) {
  dialog.value = action
  selection.value = item || null
  inputName.value = action === 'rename' ? (item?.name || '') : ''
  inputContent.value = ''
  destinationFolder.value = currentPrefix.value
  confirmName.value = ''
}
function closeDialog() {
  if (busy.value) return
  dialog.value = null
  selection.value = null
}
const targetKey = computed(() => {
  if (!dialog.value) return ''
  if (dialog.value === 'create-folder' || dialog.value === 'create-file') {
    return currentPrefix.value + inputName.value.trim() + (dialog.value === 'create-folder' ? '/' : '')
  }
  if (dialog.value === 'rename' && selection.value) {
    const sourceWithoutSlash = selection.value.key.replace(/\/$/, '')
    const parent = sourceWithoutSlash.slice(0, sourceWithoutSlash.length - selection.value.name.length)
    return parent + inputName.value.trim() + (selection.value.kind === 'folder' ? '/' : '')
  }
  if (dialog.value === 'move' && selection.value) {
    const prefix = destinationFolder.value.trim().replace(/^\/+/, '').replace(/\/*$/, '/')
    return prefix + selection.value.name + (selection.value.kind === 'folder' ? '/' : '')
  }
  return ''
})
const canSubmit = computed(() => {
  if (!dialog.value || busy.value) return false
  if (dialog.value === 'delete') return confirmName.value === selection.value?.name
  const needsReferenceConfirmation = !!selection.value && (dialog.value === 'move' || dialog.value === 'rename')
  if (needsReferenceConfirmation && confirmName.value !== selection.value?.name) return false
  if (dialog.value === 'move') return !!selection.value && roots.some(root => targetKey.value.startsWith(root)) && targetKey.value !== selection.value.key
  if (!inputName.value.trim() || inputName.value.includes('/') || inputName.value === '.' || inputName.value === '..') return false
  return dialog.value.startsWith('create') || targetKey.value !== selection.value?.key
})
async function submitDialog() {
  if (!dialog.value || !canSubmit.value) return
  busy.value = true
  const action = dialog.value
  try {
    let body: Record<string, unknown>
    if (action === 'create-folder') body = { action, key: targetKey.value }
    else if (action === 'create-file') body = { action, key: targetKey.value, content: inputContent.value }
    else if (action === 'rename' || action === 'move') {
      body = { action: 'move', sourceKey: selection.value?.key, destinationKey: targetKey.value, kind: selection.value?.kind }
    } else body = { action: 'delete', key: selection.value?.key, kind: selection.value?.kind, confirm: true }
    const result = await $fetch<{ backupKey?: string; backups?: Array<{ backupKey: string }> }>('/api/admin/storage/objects', { method: 'POST', headers: await getApiAuthHeaders(), body })
    dialog.value = null
    selection.value = null
    objectRevision += 1
    objectLoading.value = false
    activeObject.value = null
    toast.value = action === 'delete' ? 'Item excluído. Cópia de segurança preservada.' : 'Operação concluída.'
    operationDetails.value = result.backupKey || (result.backups?.length ? result.backups.length + ' backups criados. Exemplo: ' + result.backups[0]?.backupKey : '')
    statsStale.value = true
    await fetchObjects()
  } catch (error) {
    showOperationError(error)
  } finally {
    busy.value = false
  }
}
async function uploadFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !currentPrefix.value) return
  if (file.size > 20 * 1024 * 1024) {
    toast.value = 'O limite de envio é 20 MB por arquivo.'
    input.value = ''
    return
  }
  busy.value = true
  try {
    await $fetch('/api/admin/storage/upload', {
      method: 'POST',
      headers: { ...(await getApiAuthHeaders()), 'Content-Type': file.type || 'application/octet-stream' },
      query: { key: currentPrefix.value + file.name, contentType: file.type || 'application/octet-stream' },
      body: file
    })
    toast.value = 'Arquivo enviado.'
    operationDetails.value = ''
    statsStale.value = true
    await fetchObjects()
  } catch (error) {
    showOperationError(error)
  } finally {
    input.value = ''
    busy.value = false
  }
}
async function replaceFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const current = activeObject.value
  if (!file || !current) return
  if (file.size > 20 * 1024 * 1024) {
    toast.value = 'O limite de envio é 20 MB por arquivo.'
    input.value = ''
    return
  }
  const expectedExtension = current.key.split('/').pop()?.split('.').pop()?.toLowerCase()
  const incomingExtension = file.name.split('.').pop()?.toLowerCase()
  if (expectedExtension !== incomingExtension) {
    toast.value = 'Escolha um arquivo com a mesma extensão do original.'
    input.value = ''
    return
  }
  if (!window.confirm('Substituir este arquivo no Wasabi? A versão atual será guardada em backup.')) {
    input.value = ''
    return
  }
  busy.value = true
  try {
    const result = await $fetch<{ backupKey?: string }>('/api/admin/storage/upload', {
      method: 'POST',
      headers: { ...(await getApiAuthHeaders()), 'Content-Type': file.type || 'application/octet-stream' },
      query: { key: current.key, contentType: file.type || 'application/octet-stream', replace: 'true', etag: current.etag },
      body: file
    })
    toast.value = 'Arquivo substituído. A versão anterior foi guardada.'
    operationDetails.value = result.backupKey || ''
    statsStale.value = true
    try {
      activeObject.value = await $fetch<StorageObject>('/api/admin/storage/object', {
        headers: await getApiAuthHeaders(), query: { key: current.key }
      })
    } catch {
      toast.value = 'Arquivo substituído, mas não foi possível recarregar a prévia.'
      activeObject.value = null
    }
    await fetchObjects()
  } catch (error) {
    showOperationError(error)
  } finally {
    input.value = ''
    busy.value = false
  }
}

onMounted(() => { void fetchStats() })
</script>

<template>
  <AdminWorkspaceShell active-nav="storage">
    <div class="admin-page">
      <div class="admin-page__inner">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="admin-page__eyebrow">Configuração · Storage</p>
            <h1 class="admin-page__title">Arquivos do Wasabi</h1>
            <p class="admin-page__lead">Consulte o espaço usado e gerencie pastas e arquivos. Pastas no Wasabi são prefixos; mover ou renomear uma pasta copia seus objetos. Alterações em projects/ podem afetar artes em uso.</p>
          </div>
          <button class="admin-btn admin-btn--secondary" :disabled="statsLoading || listLoading" @click="fetchStats(); fetchObjects()">
            <RefreshCw class="h-4 w-4" /> Atualizar
          </button>
        </div>

        <div v-if="toast" class="admin-alert admin-alert--warning mt-5 justify-between" role="status">
          <div class="min-w-0"><span>{{ toast }}</span><pre v-if="operationDetails" class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">{{ operationDetails }}</pre></div><button type="button" aria-label="Fechar aviso" @click="toast = ''; operationDetails = ''"><X class="h-4 w-4" /></button>
        </div>

        <div v-if="stats" class="admin-card admin-card--pad mt-6">
          <div class="flex flex-wrap items-center gap-x-7 gap-y-2 text-sm">
            <div><span class="text-[color:var(--jv-muted)]">Bucket:</span> <strong>{{ stats.bucket }}</strong></div>
            <div><span class="text-[color:var(--jv-muted)]">Endpoint:</span> <strong>{{ stats.endpoint }}</strong></div>
            <div><span class="text-[color:var(--jv-muted)]">Total:</span> <strong>{{ stats.total.size }}</strong> <span class="text-[color:var(--jv-muted)]">({{ stats.total.objects }} objetos)</span></div>
          </div>
          <p class="mt-2 text-xs text-[color:var(--jv-muted)]">Atualizado em {{ formatDate(stats.generatedAt) }}<span v-if="statsStale" class="ml-2 font-semibold text-amber-700">· Uso pode ter mudado. Clique em Atualizar.</span></p>
        </div>

        <div v-if="stats" class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button v-for="item in stats.prefixes" :key="item.prefix" type="button"
            class="admin-card p-4 text-left transition-all hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            @click="openFolder(item.prefix)">
            <span class="flex items-center gap-2 font-semibold text-[color:var(--jv-navy)]"><Folder class="h-5 w-5 text-blue-600" />{{ item.prefix }}</span>
            <span class="mt-2 block text-xs text-[color:var(--jv-muted)]">{{ item.size }} · {{ item.objects }} objetos</span>
            <span v-if="item.truncated" class="mt-2 inline-block text-xs font-semibold text-amber-700">Contagem parcial</span>
          </button>
        </div>

        <section class="admin-card mt-6 overflow-hidden" aria-label="Explorador de arquivos">
          <div class="border-b border-[color:var(--jv-line)] bg-slate-50/60 px-4 py-4 sm:px-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
                <button type="button" class="font-semibold text-[color:var(--jv-blue)]" @click="goToRoot"><HardDrive class="inline h-4 w-4" /> Bucket</button>
                <template v-for="crumb in breadcrumbs" :key="crumb.key">
                  <ChevronRight class="h-4 w-4 shrink-0 text-slate-400" />
                  <button type="button" class="shrink-0 font-medium hover:text-blue-600" @click="openFolder(crumb.key)">{{ crumb.name }}</button>
                </template>
              </div>
              <div v-if="canManage && currentPrefix" class="flex flex-wrap gap-2">
                <button class="admin-btn admin-btn--secondary !min-h-9 !px-3" @click="openDialog('create-folder')"><FolderPlus class="h-4 w-4" /> Pasta</button>
                <button class="admin-btn admin-btn--secondary !min-h-9 !px-3" @click="openDialog('create-file')"><FilePlus2 class="h-4 w-4" /> Arquivo</button>
                <input ref="fileInput" type="file" class="hidden" @change="uploadFile">
                <button class="admin-btn admin-btn--primary !min-h-9 !px-3" :disabled="busy" @click="fileInput?.click()"><Upload class="h-4 w-4" /> Enviar</button>
              </div>
            </div>
          </div>

          <div v-if="!canManage" class="p-8 text-center text-sm text-slate-500">A gestão direta dos arquivos é restrita ao super admin.</div>
          <div v-else-if="!currentPrefix" class="grid gap-2 p-4 sm:grid-cols-2">
            <button v-for="root in roots" :key="root" class="flex items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-blue-50" @click="openFolder(root)">
              <Folder class="h-5 w-5 text-blue-600" /><span class="font-mono text-sm">{{ root }}</span><ChevronRight class="ml-auto h-4 w-4 text-slate-400" />
            </button>
          </div>
          <div v-else>
            <div v-if="listError" class="admin-alert admin-alert--error m-4">{{ listError }}</div>
            <p v-if="listLoading && !folders.length && !files.length" class="p-8 text-center text-sm text-slate-500">Carregando arquivos…</p>
            <p v-else-if="!folders.length && !files.length && !listError" class="p-8 text-center text-sm text-slate-500">Esta pasta está vazia.</p>
            <div v-else class="divide-y divide-slate-100">
              <div v-for="folder in folders" :key="folder.key" class="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                <Folder class="h-5 w-5 shrink-0 text-blue-600" />
                <button class="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-700" @click="openFolder(folder.key)">{{ folder.name }}</button>
                <div class="flex gap-1">
                  <button class="rounded-lg p-2 text-slate-500 hover:bg-blue-50" :aria-label="'Renomear ' + folder.name" @click="openDialog('rename', { kind: 'folder', key: folder.key, name: folder.name })"><Pencil class="h-4 w-4" /></button>
                  <button class="rounded-lg px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50" @click="openDialog('move', { kind: 'folder', key: folder.key, name: folder.name })">Mover</button>
                  <button class="rounded-lg p-2 text-red-600 hover:bg-red-50" :aria-label="'Excluir ' + folder.name" @click="openDialog('delete', { kind: 'folder', key: folder.key, name: folder.name })"><Trash2 class="h-4 w-4" /></button>
                </div>
              </div>
              <div v-for="file in files" :key="file.key" class="group flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:flex-nowrap sm:px-5">
                <FileImage v-if="file.contentType?.startsWith('image/')" class="h-5 w-5 shrink-0 text-emerald-600" />
                <FileCode2 v-else-if="/\.(json|txt|md|css|html|js|ts|svg|xml|csv)(\.gz)?$/i.test(file.name)" class="h-5 w-5 shrink-0 text-violet-600" />
                <FileText v-else class="h-5 w-5 shrink-0 text-slate-500" />
                <button class="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-700" @click="openFile(file)">{{ file.name }}</button>
                <span class="text-xs text-slate-400">{{ formatSize(file.size) }}</span>
                <span class="hidden text-xs text-slate-400 lg:inline">{{ formatDate(file.lastModified) }}</span>
                <div class="flex gap-1">
                  <button class="rounded-lg p-2 text-slate-500 hover:bg-blue-50" :aria-label="'Renomear ' + file.name" @click="openDialog('rename', { kind: 'file', key: file.key, name: file.name })"><Pencil class="h-4 w-4" /></button>
                  <button class="rounded-lg px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50" @click="openDialog('move', { kind: 'file', key: file.key, name: file.name })">Mover</button>
                  <button class="rounded-lg p-2 text-red-600 hover:bg-red-50" :aria-label="'Excluir ' + file.name" @click="openDialog('delete', { kind: 'file', key: file.key, name: file.name })"><Trash2 class="h-4 w-4" /></button>
                </div>
              </div>
            </div>
            <div v-if="nextToken" class="border-t border-slate-100 p-4 text-center">
              <button class="admin-btn admin-btn--secondary" :disabled="listLoading" @click="fetchObjects(true)">{{ listLoading ? 'Carregando…' : 'Carregar mais' }}</button>
            </div>
          </div>
        </section>

        <section v-if="activeObject || objectLoading" class="admin-card mt-6 overflow-hidden" aria-label="Visualização do arquivo">
          <div class="flex items-center justify-between gap-3 border-b border-[color:var(--jv-line)] px-4 py-3">
            <div class="min-w-0"><h2 class="truncate text-sm font-bold">{{ activeObject?.key || 'Abrindo arquivo…' }}</h2><p class="text-xs text-slate-500">Conteúdo direto do Wasabi</p></div>
            <button v-if="activeObject" class="rounded-lg p-2 hover:bg-slate-100" aria-label="Fechar arquivo" @click="closeFile"><X class="h-4 w-4" /></button>
          </div>
          <div v-if="objectLoading" class="p-6 text-sm text-slate-500">Carregando…</div>
          <div v-else-if="activeObject?.content !== undefined" class="p-4">
            <textarea v-model="editorContent" class="admin-textarea min-h-80 font-mono text-xs leading-relaxed" spellcheck="false" :aria-label="'Editar ' + activeObject.key"></textarea>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs text-slate-500">Edição direta · limite de 1 MB · cópia anterior preservada ao salvar</span>
              <button class="admin-btn admin-btn--primary" :disabled="!hasChanges || busy" @click="saveFile">{{ busy ? 'Salvando…' : 'Salvar alterações' }}</button>
            </div>
          </div>
          <div v-else-if="activeObject" class="p-5">
            <img v-if="activeObject.contentType?.startsWith('image/') && activeObject.previewUrl" :src="activeObject.previewUrl" alt="Prévia do arquivo" class="max-h-96 max-w-full rounded-xl border border-slate-200 object-contain">
            <p class="mt-3 text-sm text-slate-600">Arquivo binário. {{ activeObject.size != null ? formatSize(activeObject.size) : '' }}</p>
            <a v-if="activeObject.previewUrl" class="admin-btn admin-btn--secondary mt-3" :href="activeObject.previewUrl" target="_blank" rel="noopener noreferrer"><Download class="h-4 w-4" /> Abrir ou baixar</a>
            <input ref="replaceInput" type="file" class="hidden" @change="replaceFile">
            <button class="admin-btn admin-btn--danger ml-2 mt-3" :disabled="busy" @click="replaceInput?.click()"><Upload class="h-4 w-4" /> Substituir arquivo</button>
          </div>
        </section>
      </div>
    </div>

    <div v-if="dialog" class="fixed inset-0 z-200 flex items-center justify-center bg-slate-950/50 p-4" @click.self="closeDialog">
      <div class="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" :aria-label="dialog">
        <div class="flex items-start justify-between gap-3">
          <div><h2 class="text-lg font-bold text-[color:var(--jv-navy)]">{{ dialog === 'create-folder' ? 'Criar pasta' : dialog === 'create-file' ? 'Criar arquivo' : dialog === 'rename' ? 'Renomear' : dialog === 'move' ? 'Mover' : 'Excluir' }}</h2><p class="mt-1 break-all text-xs text-slate-500">{{ selection?.key || currentPrefix }}</p></div>
          <button class="rounded-lg p-2 hover:bg-slate-100" aria-label="Fechar" @click="closeDialog"><X class="h-4 w-4" /></button>
        </div>
        <div v-if="dialog === 'create-folder' || dialog === 'create-file' || dialog === 'rename'" class="mt-5">
          <label class="mb-1 block text-xs font-semibold text-slate-600">Nome</label>
          <input v-model="inputName" class="admin-input" maxlength="255" placeholder="Nome do arquivo ou pasta" @keyup.enter="submitDialog">
          <label v-if="dialog === 'create-file'" class="mb-1 mt-4 block text-xs font-semibold text-slate-600">Conteúdo inicial</label>
          <textarea v-if="dialog === 'create-file'" v-model="inputContent" class="admin-textarea min-h-48 font-mono text-xs" spellcheck="false"></textarea>
        </div>
        <div v-if="dialog === 'move'" class="mt-5">
          <label class="mb-1 block text-xs font-semibold text-slate-600">Pasta de destino</label>
          <input v-model="destinationFolder" class="admin-input font-mono text-xs" placeholder="imagens/subpasta/">
          <div class="mt-2 flex flex-wrap gap-2">
            <button v-for="root in roots" :key="root" class="rounded-lg bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100" @click="destinationFolder = root">{{ root }}</button>
          </div>
          <p class="mt-2 break-all text-xs text-slate-500">Novo caminho: {{ targetKey }}</p>
        </div>
        <div v-if="(dialog === 'move' || dialog === 'rename') && selection" class="mt-4">
          <p class="text-sm text-amber-800">Este caminho pode estar salvo em projetos ou cadastros. Movê-lo ou renomeá-lo pode quebrar essas referências. Digite <strong>{{ selection.name }}</strong> para confirmar.</p>
          <input v-model="confirmName" class="admin-input mt-2" :placeholder="selection.name">
        </div>
        <div v-if="dialog === 'delete'" class="mt-5">
          <p class="text-sm text-red-700">Esta ação remove o item do bucket e pode quebrar referências em projetos ou cadastros. Uma cópia de segurança será guardada. Para confirmar, digite <strong>{{ selection?.name }}</strong>.</p>
          <p v-if="selection?.kind === 'folder'" class="mt-2 text-xs text-slate-500">Operações em pasta aceitam até 500 objetos por vez.</p>
          <input v-model="confirmName" class="admin-input mt-3" :placeholder="selection?.name">
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button class="admin-btn admin-btn--secondary" :disabled="busy" @click="closeDialog">Cancelar</button>
          <button class="admin-btn" :class="dialog === 'delete' ? 'admin-btn--danger' : 'admin-btn--primary'" :disabled="!canSubmit" @click="submitDialog">{{ busy ? 'Processando…' : dialog === 'delete' ? 'Excluir' : 'Confirmar' }}</button>
        </div>
      </div>
    </div>
  </AdminWorkspaceShell>
</template>
