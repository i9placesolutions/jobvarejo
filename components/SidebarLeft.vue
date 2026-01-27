<script setup lang="ts">
import { ref } from 'vue'
import { useProject } from '~/composables/useProject'
import { Search, Plus, FileText, Copy, Trash2, Box } from 'lucide-vue-next'
import AssetsPanel from './AssetsPanel.vue'

const { project, activePage, switchPage, addPage, duplicatePage, deletePage } = useProject()

const emit = defineEmits<{
    (e: 'insert-asset', asset: any): void
}>()


type Tab = 'layers' | 'pages' | 'assets';
const activeTab = ref<Tab>('layers')
const sidebarSearch = ref('')

const createPage = (preset: string) => {
    addPage('RETAIL_OFFER', 1080, 1920, `Page ${project.pages.length + 1}`);
}
</script>

<template>
  <aside class="w-[240px] border-r border-white/5 bg-[#1e1e1e] flex flex-col shrink-0 z-10 text-white h-full select-none">
       <!-- Header / Tabs -->
       <div class="h-10 border-b border-white/5 flex items-center px-2 gap-1 text-[11px] font-medium text-zinc-500 shrink-0">
            <button 
                @click="activeTab = 'layers'"
                class="h-full px-3 border-b-2 transition-colors hover:text-zinc-300"
                :class="activeTab === 'layers' ? 'border-white text-white' : 'border-transparent'"
            >
                Layers
            </button>
            <button 
                @click="activeTab = 'pages'"
                class="h-full px-3 border-b-2 transition-colors hover:text-zinc-300"
                :class="activeTab === 'pages' ? 'border-white text-white' : 'border-transparent'"
            >
                Pages
            </button>
            <button 
                @click="activeTab = 'assets'"
                class="h-full px-3 border-b-2 transition-colors hover:text-zinc-300"
                :class="activeTab === 'assets' ? 'border-white text-white' : 'border-transparent'"
            >
                Assets
            </button>
       </div>
       
       <!-- Search -->
       <div class="p-2 border-b border-black/20 shrink-0">
           <div class="relative">
               <Search class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
               <input 
                   v-model="sidebarSearch"
                   type="text" 
                   placeholder="Search" 
                   class="w-full h-7 bg-[#1e1e1e] border border-zinc-700 rounded text-[11px] text-white pl-7 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 font-medium" 
               />
           </div>
       </div>

       <!-- Content Area -->
       <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 relative">
           
           <!-- TAB: PAGES -->
           <div v-if="activeTab === 'pages'" class="flex flex-col h-full animate-in fade-in duration-200">
               <div class="p-2 flex items-center justify-between border-b border-white/5">
                   <span class="text-[10px] font-black uppercase text-zinc-500 pl-2">Project Pages</span>
                   <button @click.stop="createPage('story')" class="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white" title="Nova Página">
                       <Plus class="w-3.5 h-3.5" />
                   </button>
               </div>
               
               <div class="flex-1 overflow-y-auto">
                   <div 
                        v-for="(page, index) in project.pages" 
                        :key="page.id"
                        class="flex items-center h-8 px-4 gap-3 cursor-pointer group transition-colors relative"
                        :class="index === project.activePageIndex ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-zinc-400'"
                        @click="switchPage(index)"
                   >
                       <FileText class="w-3.5 h-3.5 opacity-70 shrink-0" />
                       <span class="text-[11px] font-medium truncate flex-1">{{ page.name }}</span>
                       
                       <!-- Actions (Hover) -->
                       <div class="hidden group-hover:flex items-center gap-1 ml-auto bg-[#2c2c2c] shadow-sm rounded px-1 absolute right-2 border border-zinc-700">
                           <button @click.stop="duplicatePage(index)" title="Duplicar" class="p-1 hover:text-white text-zinc-400 hover:bg-white/10 rounded"><Copy class="w-3 h-3" /></button>
                           <button @click.stop="deletePage(index)" title="Excluir" class="p-1 hover:text-red-400 text-zinc-400 hover:bg-white/10 rounded"><Trash2 class="w-3 h-3" /></button>
                       </div>

                       <div v-if="index === project.activePageIndex" class="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
                   </div>
               </div>
           </div>

           <!-- TAB: LAYERS -->
           <div v-else-if="activeTab === 'layers'" class="flex flex-col h-full animate-in fade-in duration-200">
               <!-- Pass Props/Events to Existing LayersPanel via Slot -->
               <slot name="layers-panel"></slot>
           </div>

           <!-- TAB: ASSETS -->
           <div v-else-if="activeTab === 'assets'" class="flex flex-col h-full animate-in fade-in duration-200">
               <AssetsPanel :search-query="sidebarSearch" @insert-asset="(asset) => emit('insert-asset', asset)" />
           </div>

       </div>
  </aside>
</template>
