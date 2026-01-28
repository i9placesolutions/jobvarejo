<script setup lang="ts">
import { ref } from 'vue'
import { useProject } from '~/composables/useProject'
import { Search, Plus, FileText, Copy, Trash2, Box, ChevronDown, Menu } from 'lucide-vue-next'
import AssetsPanel from './AssetsPanel.vue'

const { project, activePage, switchPage, addPage, duplicatePage, deletePage } = useProject()

const emit = defineEmits<{
    (e: 'insert-asset', asset: any): void
    (e: 'open-menu'): void
}>()


type Tab = 'layers' | 'pages' | 'assets';
const activeTab = ref<Tab>('layers')
const sidebarSearch = ref('')

const createPage = (preset: string) => {
    addPage('RETAIL_OFFER', 1080, 1920, `Page ${project.pages.length + 1}`);
}
</script>

<template>
  <aside class="w-[240px] border-r border-white/5 bg-[#1a1a1a] flex flex-col shrink-0 z-10 text-white h-full select-none">
       <!-- Top: Menu, File Name & Tabs (Figma Style) -->
       <div class="border-b border-white/5 shrink-0">
         <!-- Menu & File Name -->
         <div class="h-10 px-3 flex items-center gap-2 border-b border-white/5">
           <!-- Menu Icon -->
           <button 
             @click="$emit('open-menu')"
             class="w-7 h-7 hover:bg-white/10 rounded-lg flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
             title="Menu"
           >
             <Menu class="w-4 h-4 text-zinc-400" />
           </button>
           
           <!-- File Name -->
           <div class="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer group hover:bg-white/5 rounded-lg px-2 py-1.5 transition-all">
             <span class="text-xs font-medium text-white truncate">{{ project.name || 'Untitled' }}</span>
             <ChevronDown class="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
           </div>
           
           <div class="flex items-center gap-1">
             <span class="text-[10px] text-blue-400 font-medium px-1.5 py-0.5 rounded bg-blue-500/10">Free</span>
             <button class="w-6 h-6 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all">
               <Search class="w-3.5 h-3.5 text-zinc-400" />
             </button>
           </div>
         </div>
         
         <!-- File / Assets Tabs -->
         <div class="h-9 flex items-center px-2 gap-1 text-[11px] font-medium shrink-0">
            <button 
                @click="activeTab = 'layers'"
                class="h-full px-3 border-b-2 transition-colors rounded-t-md"
                :class="activeTab === 'layers' ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'"
            >
                File
            </button>
            <button 
                @click="activeTab = 'assets'"
                class="h-full px-3 border-b-2 transition-colors rounded-t-md"
                :class="activeTab === 'assets' ? 'border-white text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'"
            >
                Assets
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
                   placeholder="Search" 
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
                   <span class="text-[10px] font-semibold uppercase text-zinc-500">Pages</span>
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
                   >
                     <FileText class="w-3.5 h-3.5 opacity-70 shrink-0" />
                     <span class="text-xs font-medium truncate flex-1">{{ page.name }}</span>
                     
                     <!-- Actions (Hover) -->
                     <div class="hidden group-hover:flex items-center gap-0.5 ml-auto">
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

           <!-- TAB: ASSETS -->
           <div v-else-if="activeTab === 'assets'" class="flex flex-col h-full animate-in fade-in duration-200">
               <AssetsPanel :search-query="sidebarSearch" @insert-asset="(asset) => emit('insert-asset', asset)" />
           </div>

       </div>
  </aside>
</template>
