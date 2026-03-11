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
  <aside class="w-60 border-r border-white/5 bg-[#18181b] flex flex-col shrink-0 z-10 text-white h-full select-none">
       <!-- Top: Menu, File Name & Tabs -->
       <div class="border-b border-white/5 shrink-0 bg-[#18181b]/50 backdrop-blur-md">
         <!-- Menu & File Name -->
         <div class="h-12 px-3 flex items-center gap-2 border-b border-white/5">
           <!-- Menu Icon -->
           <button 
             @click="$emit('open-menu')"
             class="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer transition-colors shrink-0"
             title="Menu"
           >
             <Menu class="w-4 h-4 text-zinc-400" />
           </button>
           
           <!-- File Name -->
           <div class="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer group hover:bg-white/5 rounded-md px-2 py-1.5 transition-all">
             <span class="text-xs font-semibold text-zinc-100 truncate tracking-wide">{{ project.name || 'Sem título' }}</span>
             <ChevronDown class="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
           </div>
           
           <div class="flex items-center gap-1 shrink-0">
             <span class="text-[9px] text-fuchsia-300 font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/15 border border-fuchsia-500/20 uppercase tracking-widest shadow-[0_0_10px_rgba(217,70,239,0.1)]">Pro</span>
           </div>
         </div>
         
         <!-- File / Assets Tabs -->
         <div class="h-10 flex items-center px-1 gap-1 text-[10px] font-bold uppercase tracking-widest shrink-0">
            <button 
                @click="activeTab = 'layers'"
                class="flex-1 h-full flex items-center justify-center border-b-2 transition-all relative"
                :class="activeTab === 'layers' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'"
            >
                Arquivo
                <div v-if="activeTab === 'layers'" class="absolute bottom-0 left-0 w-full h-[2px] bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></div>
            </button>
            <button 
                @click="activeTab = 'assets'"
                class="flex-1 h-full flex items-center justify-center border-b-2 transition-all relative"
                :class="activeTab === 'assets' ? 'border-violet-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'"
            >
                Recursos
                <div v-if="activeTab === 'assets'" class="absolute bottom-0 left-0 w-full h-[2px] bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]"></div>
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
                   placeholder="Buscar elementos..." 
                   class="w-full h-8 bg-[#2a2a2a]/60 border border-white/5 rounded-md text-[11px] text-zinc-100 pl-8 pr-3 focus:outline-none focus:border-violet-500/50 focus:bg-[#2a2a2a] placeholder:text-zinc-500 transition-all shadow-inner" 
               />
           </div>
       </div>

       <!-- Content Area -->
       <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 relative">
           
           <!-- TAB: FILE (Pages + Layers) -->
           <div v-if="activeTab === 'layers'" class="flex flex-col h-full animate-in fade-in duration-200">
               <!-- Pages Section -->
               <div class="shrink-0 mb-2">
                 <div class="px-3 py-2.5 flex items-center justify-between border-b border-white/5">
                   <span class="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Páginas</span>
                   <button @click.stop="createPage('story')" class="w-6 h-6 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all bg-white/5 border border-white/5" title="Nova Página">
                     <Plus class="w-3.5 h-3.5" />
                   </button>
                 </div>
                 
                 <div class="px-2 py-2 space-y-0.5">
                   <div 
                     v-for="(page, index) in project.pages" 
                     :key="page.id"
                     class="flex items-center h-8 px-2 gap-2 cursor-pointer group transition-all rounded-md relative overflow-hidden"
                     :class="index === project.activePageIndex ? 'bg-violet-500/10 text-violet-100' : 'hover:bg-white/5 text-zinc-400'"
                     @click="switchPage(index)"
                     @dblclick.stop="startPageRename(index)"
                   >
                     <div v-if="index === project.activePageIndex" class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-violet-500 rounded-r-md"></div>
                     <FileText class="w-3.5 h-3.5 shrink-0" :class="index === project.activePageIndex ? 'text-violet-400' : 'opacity-70'" />
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
               <div class="px-3 pt-3 pb-2 flex shrink-0">
                   <div class="flex p-0.5 bg-[#2a2a2a] rounded-md border border-white/5 w-full">
                       <button
                           @click="assetsSubTab = 'elements'"
                           class="flex-1 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all"
                           :class="assetsSubTab === 'elements' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
                       >Elementos</button>
                       <button
                           @click="assetsSubTab = 'files'"
                           class="flex-1 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all"
                           :class="assetsSubTab === 'files' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
                       >Meus Arquivos</button>
                   </div>
               </div>
               <!-- Sub: Elementos -->
               <ElementsPanel v-if="assetsSubTab === 'elements'" :search-query="sidebarSearch" @insert-element="(el) => emit('insert-element', el)" />
               <!-- Sub: Meus Arquivos -->
               <AssetsPanel v-else :search-query="sidebarSearch" @insert-asset="(asset) => emit('insert-asset', asset)" />
           </div>

       </div>
  </aside>
</template>
