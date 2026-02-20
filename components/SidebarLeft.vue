<script setup lang="ts">
import { ref, nextTick, defineAsyncComponent } from 'vue'
import { useProject } from '~/composables/useProject'
import { Search, Plus, FileText, Copy, Trash2, Box, ChevronDown, Menu } from 'lucide-vue-next'

const AssetsPanel = defineAsyncComponent(() => import('./AssetsPanel.vue'))
const ElementsPanel = defineAsyncComponent(() => import('./ElementsPanel.vue'))

const { project, activePage, switchPage, addPage, duplicatePage, deletePage, renamePage } = useProject()

const emit = defineEmits<{
    (e: 'insert-asset', asset: any): void
    (e: 'insert-element', element: { type: string; data: any }): void
    (e: 'open-menu'): void
}>()


type Tab = 'layers' | 'pages' | 'assets';
const activeTab = ref<Tab>('layers')
const sidebarSearch = ref('')

type AssetsSubTab = 'elements' | 'files'
const assetsSubTab = ref<AssetsSubTab>('elements')

const createPage = (preset: string) => {
    addPage('RETAIL_OFFER', 1080, 1920, `Page ${project.pages.length + 1}`);
}

	const editingPageId = ref<string | null>(null)
	const editingPageName = ref('')
	// Template ref inside a v-for can become an array; keep this type flexible.
	const pageNameInputRef = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

	const startPageRename = async (index: number) => {
	    const page = project.pages[index]
	    if (!page) return
	    editingPageId.value = String(page.id)
	    editingPageName.value = String(page.name || '')
	    await nextTick()
	    const raw: any = pageNameInputRef.value as any
	    const el: any = Array.isArray(raw) ? raw[0] : raw
	    if (el && typeof el.focus === 'function') el.focus()
	    if (el && typeof el.select === 'function') el.select()
	}

const cancelPageRename = () => {
    editingPageId.value = null
    editingPageName.value = ''
}

const commitPageRename = (index: number) => {
    const page = project.pages[index]
    if (!page || !editingPageId.value || String(page.id) !== editingPageId.value) {
        cancelPageRename()
        return
    }
    renamePage(index, editingPageName.value)
    cancelPageRename()
}
</script>

<template>
  <aside class="editor-left-sidebar w-64 border-r flex flex-col shrink-0 z-10 text-zinc-900 h-full select-none">
       <!-- Top: Menu, File Name & Tabs (Figma Style) -->
       <div class="border-b border-[var(--editor-border)] shrink-0">
         <!-- Menu & File Name -->
         <div class="h-11 px-3 flex items-center gap-2 border-b border-[var(--editor-border-soft)]">
           <!-- Menu Icon -->
           <button 
             @click="$emit('open-menu')"
             class="menu-btn w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors shrink-0"
             title="Menu"
           >
             <Menu class="w-4 h-4 text-[var(--editor-muted)]" />
           </button>
           
           <!-- File Name -->
           <div class="file-chip flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer group rounded-lg px-2 py-1.5 transition-all">
             <span class="text-xs font-medium text-[var(--editor-text)] truncate">{{ project.name || 'Sem título' }}</span>
             <ChevronDown class="w-3.5 h-3.5 text-[var(--editor-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
           </div>
           
           <div class="flex items-center gap-1">
             <span class="plan-badge text-[10px] font-semibold px-1.5 py-0.5 rounded-md">Grátis</span>
           </div>
         </div>
         
         <!-- File / Assets Tabs -->
         <div class="h-10 flex items-center px-2.5 gap-1 text-[11px] font-medium shrink-0">
            <button 
                @click="activeTab = 'layers'"
                class="tab-trigger h-7 px-3 rounded-lg transition-all"
                :class="activeTab === 'layers' ? 'is-active' : ''"
            >
                Arquivo
            </button>
            <button 
                @click="activeTab = 'assets'"
                class="tab-trigger h-7 px-3 rounded-lg transition-all"
                :class="activeTab === 'assets' ? 'is-active' : ''"
            >
                Recursos
            </button>
       </div>
       </div>
       
       <!-- Search (only when Assets tab is active) -->
       <div v-if="activeTab === 'assets'" class="p-2.5 border-b border-[var(--editor-border)] shrink-0">
           <div class="relative">
               <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--editor-muted)]" />
               <input 
                   v-model="sidebarSearch"
                   type="text" 
                   placeholder="Buscar" 
                   class="sidebar-search-input w-full h-8 rounded-lg text-xs text-[var(--editor-text)] pl-8 pr-3 focus:outline-none transition-all" 
               />
           </div>
       </div>

       <!-- Content Area -->
       <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 relative">
           
           <!-- TAB: FILE (Pages + Layers) -->
           <div v-if="activeTab === 'layers'" class="flex flex-col h-full animate-in fade-in duration-200">
               <!-- Pages Section -->
               <div class="shrink-0">
                 <div class="px-3 py-2 flex items-center justify-between border-b border-[var(--editor-border)]">
                   <span class="text-[10px] font-semibold uppercase text-[var(--editor-muted)]">Páginas</span>
                   <button @click.stop="createPage('story')" class="page-create-btn w-5 h-5 rounded-lg flex items-center justify-center text-[var(--editor-muted)] transition-all" title="Nova Página">
                     <Plus class="w-3.5 h-3.5" />
                   </button>
                 </div>
                 
                 <div class="px-1.5 py-1.5 space-y-0.5">
                   <div 
                     v-for="(page, index) in project.pages" 
                     :key="page.id"
                     class="page-row flex items-center h-8 px-2 gap-2 cursor-pointer group transition-all rounded-lg border border-transparent"
                     :class="index === project.activePageIndex ? 'is-active' : ''"
                     @click="switchPage(index)"
                     @dblclick.stop="startPageRename(index)"
                   >
                     <FileText class="w-3.5 h-3.5 opacity-70 shrink-0" />
	                     <input
	                       v-if="editingPageId === page.id"
	                       ref="pageNameInputRef"
		                       v-model="editingPageName"
		                       type="text"
		                       class="text-xs font-medium flex-1 h-6 bg-[#fffdf9] border border-[var(--editor-border)] rounded px-1.5 outline-none focus:border-[#b53a2b]"
		                       @click.stop
                       @dblclick.stop
                       @keydown.enter.prevent="commitPageRename(index)"
                       @keydown.escape.prevent="cancelPageRename()"
                       @blur="commitPageRename(index)"
                     />
                     <span
                       v-else
                       class="text-xs font-medium truncate flex-1"
                       :title="page.name"
                     >{{ page.name }}</span>
                     
                     <!-- Actions (Hover) -->
                     <div v-if="editingPageId !== page.id" class="hidden group-hover:flex items-center gap-0.5 ml-auto">
                       <button @click.stop="duplicatePage(index)" title="Duplicar" class="page-action-btn w-6 h-6 rounded flex items-center justify-center transition-all"><Copy class="w-3 h-3" /></button>
                       <button @click.stop="deletePage(index)" title="Excluir" class="page-action-btn is-danger w-6 h-6 rounded flex items-center justify-center transition-all"><Trash2 class="w-3 h-3" /></button>
                     </div>
                   </div>
                 </div>
               </div>

               <!-- Layers Section -->
               <div class="flex-1 min-h-0 flex flex-col border-t border-[var(--editor-border)]">
                 <slot name="layers-panel"></slot>
               </div>
           </div>

           <!-- TAB: ASSETS (Elementos + Meus Arquivos) -->
           <div v-else-if="activeTab === 'assets'" class="flex flex-col h-full animate-in fade-in duration-200">
               <!-- Sub-tabs -->
               <div class="px-2 pt-2 pb-1.5 flex gap-1 shrink-0">
                   <button
                       @click="assetsSubTab = 'elements'"
                       class="subtab-chip px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                       :class="assetsSubTab === 'elements' ? 'is-active' : ''"
                   >Elementos</button>
                   <button
                       @click="assetsSubTab = 'files'"
                       class="subtab-chip px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                       :class="assetsSubTab === 'files' ? 'is-active' : ''"
                   >Meus Arquivos</button>
               </div>
               <!-- Sub: Elementos -->
               <ElementsPanel v-if="assetsSubTab === 'elements'" :search-query="sidebarSearch" @insert-element="(el) => emit('insert-element', el)" />
               <!-- Sub: Meus Arquivos -->
               <AssetsPanel v-else :search-query="sidebarSearch" @insert-asset="(asset) => emit('insert-asset', asset)" />
           </div>

       </div>
  </aside>
</template>

<style scoped>
.editor-left-sidebar {
  --editor-sidebar-bg: #fdfbf6;
  --editor-sidebar-bg-strong: #fffefb;
  --editor-border: #e8dccb;
  --editor-border-soft: #efe5d7;
  --editor-text: #2f2419;
  --editor-muted: #7b6a58;
  --editor-accent: #b3261e;
  --editor-accent-soft: #fde9e4;
  --editor-accent-soft-hover: #f8dbd4;
  background: linear-gradient(180deg, var(--editor-sidebar-bg-strong) 0%, var(--editor-sidebar-bg) 100%);
  border-color: var(--editor-border);
}

.menu-btn {
  color: var(--editor-muted);
}

.menu-btn:hover {
  color: var(--editor-text);
  background: rgba(179, 38, 30, 0.08);
}

.file-chip {
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid transparent;
}

.file-chip:hover {
  background: #fffefb;
  border-color: var(--editor-border);
}

.plan-badge {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.12);
}

.tab-trigger {
  color: var(--editor-muted);
}

.tab-trigger:hover {
  color: var(--editor-text);
  background: rgba(179, 38, 30, 0.08);
}

.tab-trigger.is-active {
  color: #7a1d19;
  background: var(--editor-accent-soft);
  box-shadow: inset 0 0 0 1px rgba(179, 38, 30, 0.16);
}

.sidebar-search-input {
  background: linear-gradient(180deg, #fffefb 0%, #fff8ee 100%);
  border: 1px solid var(--editor-border);
}

.sidebar-search-input:focus {
  border-color: #b53a2b;
  box-shadow: 0 0 0 3px rgba(181, 58, 43, 0.14);
}

.sidebar-search-input::placeholder {
  color: #998675;
}

.page-create-btn:hover {
  color: var(--editor-text);
  background: rgba(179, 38, 30, 0.1);
}

.page-row {
  color: var(--editor-muted);
}

.page-row:hover {
  color: var(--editor-text);
  background: rgba(179, 38, 30, 0.08);
}

.page-row.is-active {
  color: var(--editor-text);
  background: var(--editor-accent-soft);
  border-color: rgba(179, 38, 30, 0.15);
}

.page-action-btn {
  color: #8f7f6f;
}

.page-action-btn:hover {
  color: var(--editor-text);
  background: rgba(179, 38, 30, 0.12);
}

.page-action-btn.is-danger:hover {
  color: #b3261e;
  background: rgba(179, 38, 30, 0.14);
}

.subtab-chip {
  color: var(--editor-muted);
}

.subtab-chip:hover {
  color: var(--editor-text);
  background: rgba(179, 38, 30, 0.08);
}

.subtab-chip.is-active {
  color: #7a1d19;
  background: var(--editor-accent-soft);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(239, 229, 215, 0.45);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cfbea7;
  border-radius: 999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #bca488;
}
</style>
