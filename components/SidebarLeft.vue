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
  <aside class="w-60 border-r border-white/5 bg-[#1a1a1a] flex flex-col shrink-0 z-10 text-white h-full select-none">
       <!-- Top: Menu, File Name & Tabs (Figma Style) -->
       <div class="border-b border-white/5 shrink-0">
         <!-- Menu & File Name -->
         <div class="h-10 px-3 flex items-center gap-2 border-b border-white/5">
           <!-- Menu Icon -->
           <button 
             @click="$emit('open-menu')"
             class="w-7 h-7 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer transition-colors shrink-0"
             title="Menu"
           >
             <Menu class="w-4 h-4 text-zinc-400" />
           </button>
           
           <!-- File Name -->
           <div class="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer group hover:bg-white/5 rounded-lg px-2 py-1.5 transition-all">
             <span class="text-xs font-medium text-white truncate">{{ project.name || 'Sem título' }}</span>
             <ChevronDown class="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
           </div>
           
           <div class="flex items-center gap-1">
             <span class="text-[10px] text-blue-400 font-medium px-1.5 py-0.5 rounded bg-blue-500/10">Grátis</span>
           </div>
         </div>
         
         <!-- File / Assets Tabs -->
         <div class="h-9 flex items-center px-2 gap-1 text-[11px] font-medium shrink-0">
            <button 
                @click="activeTab = 'layers'"
                class="h-full px-3 border-b-2 transition-colors rounded-t-md"
                :class="activeTab === 'layers' ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'"
            >
                Arquivo
            </button>
            <button 
                @click="activeTab = 'assets'"
                class="h-full px-3 border-b-2 transition-colors rounded-t-md"
                :class="activeTab === 'assets' ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'"
            >
                Recursos
            </button>
       </div>
       </div>
       
       <!-- Search (only when Assets tab is active) -->
       <div v-if="activeTab === 'assets'" class="p-2 border-b border-white/5 shrink-0">
           <div class="relative">
               <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
               <input 
                   v-model="sidebarSearch"
                   type="text" 
                   placeholder="Buscar" 
                   class="w-full h-8 bg-[#2a2a2a] border border-white/10 rounded-lg text-xs text-white pl-8 pr-3 focus:outline-none focus:border-violet-500/50 placeholder:text-zinc-500 transition-all" 
               />
           </div>
       </div>

       <!-- Content Area -->
       <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 relative">
           
           <!-- TAB: FILE (Pages + Layers) -->
           <div v-if="activeTab === 'layers'" class="flex flex-col h-full animate-in fade-in duration-200">
               <!-- Pages Section -->
               <div class="shrink-0">
                 <div class="px-3 py-2 flex items-center justify-between border-b border-white/5">
                   <span class="text-[10px] font-semibold uppercase text-zinc-500">Páginas</span>
                   <button @click.stop="createPage('story')" class="w-5 h-5 hover:bg-white/10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-all" title="Nova Página">
                     <Plus class="w-3.5 h-3.5" />
                   </button>
                 </div>
                 
                 <div class="px-1 py-1">
                   <div 
                     v-for="(page, index) in project.pages" 
                     :key="page.id"
                     class="flex items-center h-8 px-2 gap-2 cursor-pointer group transition-all rounded-lg"
                     :class="index === project.activePageIndex ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-zinc-400'"
                     @click="switchPage(index)"
                     @dblclick.stop="startPageRename(index)"
                   >
                     <FileText class="w-3.5 h-3.5 opacity-70 shrink-0" />
	                     <input
	                       v-if="editingPageId === page.id"
	                       ref="pageNameInputRef"
	                       v-model="editingPageName"
	                       type="text"
	                       class="text-xs font-medium flex-1 h-6 bg-transparent border border-white/20 rounded px-1.5 outline-none focus:border-violet-400"
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
                       <button @click.stop="duplicatePage(index)" title="Duplicar" class="w-6 h-6 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all"><Copy class="w-3 h-3" /></button>
                       <button @click.stop="deletePage(index)" title="Excluir" class="w-6 h-6 hover:bg-red-500/10 rounded flex items-center justify-center text-zinc-400 hover:text-red-400 transition-all"><Trash2 class="w-3 h-3" /></button>
                     </div>
                   </div>
                 </div>
               </div>

               <!-- Layers Section -->
               <div class="flex-1 min-h-0 flex flex-col border-t border-white/5">
                 <slot name="layers-panel"></slot>
               </div>
           </div>

           <!-- TAB: ASSETS (Elementos + Meus Arquivos) -->
           <div v-else-if="activeTab === 'assets'" class="flex flex-col h-full animate-in fade-in duration-200">
               <!-- Sub-tabs -->
               <div class="px-2 pt-2 pb-1.5 flex gap-1 shrink-0">
                   <button
                       @click="assetsSubTab = 'elements'"
                       class="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                       :class="assetsSubTab === 'elements' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'"
                   >Elementos</button>
                   <button
                       @click="assetsSubTab = 'files'"
                       class="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                       :class="assetsSubTab === 'files' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'"
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
