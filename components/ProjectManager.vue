<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Button from './ui/Button.vue'
import ConfirmDialog from './ui/ConfirmDialog.vue'
import { Trash2, FolderOpen, Clock, X, Search, FileEdit } from 'lucide-vue-next'
import { toWasabiProxyUrl } from '~/utils/storageProxy'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'load', data: any): void
  (e: 'imported', data: any): void
}>()

const projects = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const showConfirmDialog = ref(false)
const pendingDeleteId = ref<string | null>(null)
const { getApiAuthHeaders } = useApiAuth()

const fetchProjects = async () => {
  isLoading.value = true
  try {
      const headers = await getApiAuthHeaders()
      const data = await $fetch('/api/projects', { headers });
      if (data) {
        projects.value = (Array.isArray(data) ? data : []).map((p: any) => {
          if (p?.preview_url) p.preview_url = toWasabiProxyUrl(p.preview_url)
          if (p && typeof p === 'object') p._thumbError = false
          return p
        })
      }
  } catch (e) {
      console.error("Failed to fetch projects", e);
  } finally {
      isLoading.value = false
  }
}

const THUMB_FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #1d4ed8 0%, #312e81 100%)',
  'linear-gradient(135deg, #0f766e 0%, #14532d 100%)',
  'linear-gradient(135deg, #b45309 0%, #7c2d12 100%)',
  'linear-gradient(135deg, #6d28d9 0%, #7e22ce 100%)',
  'linear-gradient(135deg, #0f172a 0%, #1f2937 100%)',
  'linear-gradient(135deg, #9f1239 0%, #831843 100%)',
]

const hashText = (input: string): number => {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const getProjectInitials = (project: any): string => {
  const name = String(project?.name || '').trim()
  if (!name) return 'JV'
  const words = name.split(/\s+/).filter(Boolean).slice(0, 2)
  const initials = words.map(w => (w[0] || '').toUpperCase()).join('')
  return initials || 'JV'
}

const getProjectThumbStyle = (project: any) => {
  const seed = `${String(project?.id || '')}:${String(project?.name || '')}`
  const idx = hashText(seed) % THUMB_FALLBACK_GRADIENTS.length
  return { background: THUMB_FALLBACK_GRADIENTS[idx] || THUMB_FALLBACK_GRADIENTS[0] }
}

const isUsableThumbnailUrl = (url: unknown): boolean => {
  if (typeof url !== 'string') return false
  const value = url.trim()
  if (!value) return false
  const lower = value.toLowerCase()
  if (lower === 'data:,' || lower === 'about:blank') return false
  if (lower.startsWith('blob:null')) return false
  if (lower.startsWith('javascript:')) return false
  return true
}

const hasUsableProjectPreview = (project: any): boolean => {
  return isUsableThumbnailUrl(project?.preview_url)
}

const handleProjectThumbLoad = (project: any, event: Event) => {
  const img = event?.target as HTMLImageElement | null
  if (!img) return
  if ((img.naturalWidth || 0) < 2 || (img.naturalHeight || 0) < 2) {
    project._thumbError = true
  }
}

const deleteProject = async (id: string) => {
  pendingDeleteId.value = id
  showConfirmDialog.value = true
}

const confirmDelete = async () => {
  const id = pendingDeleteId.value
  if (!id) return

  try {
    const headers = await getApiAuthHeaders()
    await $fetch('/api/projects', {
      method: 'DELETE',
      headers,
      query: { id }
    })
    projects.value = projects.value.filter(p => p.id !== id)
  } catch (error) {
    console.error('Failed to delete project', error)
  }
  
  showConfirmDialog.value = false
  pendingDeleteId.value = null
}

const loadProject = (project: any) => {
  emit('load', project) // Emit full object to handle ID binding
  emit('close')
}

const filteredProjects = computed(() => {
    if (!searchQuery.value) return projects.value
    return projects.value.filter(p => p.name.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

onMounted(() => {
    fetchProjects()
})
</script>

<template>
  <Transition name="fade">
    <div v-if="isOpen" class="fixed inset-0 z-100 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-background/80 backdrop-blur-md" @click="$emit('close')"></div>
      
      <!-- Modal Content -->
      <div class="relative bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh] overflow-hidden transition-all scale-100">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FolderOpen class="w-5 h-5 text-primary" />
              </div>
              <div>
                  <h2 class="text-lg font-bold text-foreground">Meus Projetos</h2>
                  <p class="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Gerencie suas artes salvas</p>
              </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="$emit('close')" class="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground">
                <X class="w-5 h-5 " />
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="p-4 border-b border-border bg-card/50">
            <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                    v-model="searchQuery"
                    type="text" 
                    placeholder="Pesquisar projetos..." 
                    class="w-full h-11 pl-10 pr-4 bg-muted/50 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                >
            </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 gap-3">
              <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span class="text-sm text-muted-foreground font-medium">Carregando seus projetos...</span>
          </div>
          
          <div v-else-if="filteredProjects.length === 0" class="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border text-center px-8">
              <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FileEdit class="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 class="text-base font-bold text-muted-foreground mb-1">Nenhum projeto encontrado</h3>
              <p class="text-sm text-muted-foreground/60">Comece criando sua primeira arte e salvando-a no editor.</p>
          </div>

	          <div 
	              v-for="project in filteredProjects" 
	              :key="project.id"
	              @click="loadProject(project)"
	              class="group flex items-center justify-between p-4 border border-border rounded-xl bg-card hover:bg-accent/5 hover:border-primary/30 transition-all cursor-pointer shadow-sm hover:shadow-md"
	          >
	              <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                      <img
                        v-if="hasUsableProjectPreview(project) && !project._thumbError"
                        :src="project.preview_url"
                        class="w-full h-full object-cover"
                        :alt="project.name"
                        loading="lazy"
                        decoding="async"
                        @load="handleProjectThumbLoad(project, $event)"
                        @error="project._thumbError = true"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center text-white text-xs font-bold"
                        :style="getProjectThumbStyle(project)"
                        :title="project.name || 'Projeto sem nome'"
                      >
                        {{ getProjectInitials(project) }}
                      </div>
                  </div>
	                  <div class="flex flex-col">
	                      <span class="font-bold text-foreground group-hover:text-primary transition-colors">{{ project.name }}</span>
	                      <span class="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
	                          <Clock class="w-3.5 h-3.5" /> {{ new Date(project.created_at).toLocaleDateString('pt-BR') }} às {{ new Date(project.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
	                      </span>
	                  </div>
	              </div>
              
              <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                      @click.stop="deleteProject(project.id)"
                      class="p-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                      title="Excluir projeto"
                  >
                      <Trash2 class="w-4.5 h-4.5" />
                  </button>
                  <Button size="sm" class="rounded-lg px-4 h-9 shadow-sm" @click.stop="loadProject(project)">
                      Abrir
                  </Button>
              </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-border bg-muted/10 flex justify-end gap-3">
            <Button variant="ghost" @click="$emit('close')" class="rounded-xl h-10 px-6">Fechar</Button>
        </div>
        </div>
      </div>
    </Transition>

    <!-- Confirm Dialog -->
    <ConfirmDialog
        :show="showConfirmDialog"
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita."
        variant="danger"
        confirm-text="Excluir"
        cancel-text="Cancelar"
        @confirm="confirmDelete"
        @cancel="showConfirmDialog = false; pendingDeleteId = null"
    />
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 10px; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.fade-enter-active div.relative, .fade-leave-active div.relative {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-enter-from div.relative { transform: scale(0.95) translateY(10px); }
.fade-leave-to div.relative { transform: scale(0.95); }
</style>
