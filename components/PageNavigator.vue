<script setup lang="ts">
import { ref } from 'vue'
import { useProject } from '~/composables/useProject'
import Button from './ui/Button.vue'
import { Plus, Copy, Trash2, Smartphone, Monitor, FileText, Instagram, ChevronUp, ChevronDown } from 'lucide-vue-next'

const { project, activePage, switchPage, addPage, duplicatePage, deletePage } = useProject()

const isExpanded = ref(true)
const pageThumbErrors = ref<Record<string, boolean>>({})

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

const getPageThumbSrc = (page: any): string => {
    const inlineThumb = typeof page?.thumbnail === 'string' ? page.thumbnail.trim() : ''
    const storedThumb = typeof page?.thumbnailUrl === 'string' ? page.thumbnailUrl.trim() : ''
    return inlineThumb || storedThumb
}

const hasUsablePageThumbnail = (page: any): boolean => {
    const id = String(page?.id || '')
    if (pageThumbErrors.value[id]) return false
    return isUsableThumbnailUrl(getPageThumbSrc(page))
}

const markPageThumbError = (page: any) => {
    const id = String(page?.id || '')
    if (!id) return
    pageThumbErrors.value[id] = true
}

const getPageInitials = (page: any): string => {
    const rawName = String(page?.name || '').trim()
    if (!rawName) return 'PG'
    const words = rawName.split(/\s+/).filter(Boolean).slice(0, 2)
    const initials = words.map((w: string) => (w[0] || '').toUpperCase()).join('')
    return initials || 'PG'
}

const createPage = (preset: string) => {
    switch(preset) {
        case 'story': addPage('RETAIL_OFFER', 1080, 1920, 'Story'); break;
        case 'feed': addPage('RETAIL_OFFER', 1080, 1350, 'Feed'); break; // 4:5
        case 'tv': addPage('FREE_DESIGN', 1920, 1080, 'TV / Horizontal'); break;
        case 'a4': addPage('RETAIL_OFFER', 2480, 3508, 'A4 Impressão'); break; // 300dpi approx
    }
}
</script>

<template>
  <div 
    class="bg-[#2c2c2c] border-t border-black flex flex-col shadow-2xl relative z-10 text-white transition-all duration-300 ease-in-out overflow-hidden"
    :class="isExpanded ? 'h-44' : 'h-8'"
  >
      <!-- Controls Header (Dark) -->
      <div 
        class="h-8 border-b border-black/20 flex items-center px-4 bg-[#2c2c2c] justify-between cursor-pointer hover:bg-white/5 transition-colors"
        @click="isExpanded = !isExpanded"
      >
          <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                 <component :is="isExpanded ? ChevronDown : ChevronUp" class="w-4 h-4 text-zinc-500" />
                 <span class="text-[10px] font-black tracking-widest text-zinc-500 uppercase opacity-70 select-none">Páginas do Projeto</span>
              </div>
              
              <div v-if="isExpanded" class="h-3 w-px bg-white/10"></div>
              
              <div v-if="isExpanded" class="flex items-center gap-1" @click.stop>
                   <button @click="createPage('story')" title="Story 9:16" class="p-1 hover:text-white transition-colors text-zinc-500"><Smartphone class="w-3.5 h-3.5"/></button>
                   <button @click="createPage('feed')" title="Feed 4:5" class="p-1 hover:text-white transition-colors text-zinc-500"><Instagram class="w-3.5 h-3.5"/></button>
                   <button @click="createPage('tv')" title="TV 16:9" class="p-1 hover:text-white transition-colors text-zinc-500"><Monitor class="w-3.5 h-3.5"/></button>
                   <button @click="createPage('a4')" title="A4" class="p-1 hover:text-white transition-colors text-zinc-500"><FileText class="w-3.5 h-3.5"/></button>
              </div>
          </div>
          <p class="text-[9px] font-bold text-zinc-600 uppercase">{{ project.pages.length }} Páginas</p>
      </div>

      <!-- Thumbnails Strip -->
      <div v-show="isExpanded" class="flex-1 overflow-x-auto p-4 flex items-end gap-5 custom-scrollbar bg-white/5">
          <div 
            v-for="(page, index) in project.pages" 
            :key="page.id"
            class="relative group pb-1"
            @click="switchPage(index)"
          >
              <!-- Thumbnail Container -->
              <div 
                :class="[
                    'relative rounded-lg overflow-hidden transition-all duration-300 ring-offset-2 ring-offset-[#2c2c2c]',
                    index === project.activePageIndex ? 'ring-2 ring-white scale-105 shadow-xl' : 'hover:scale-105 hover:shadow-lg border border-zinc-700 grayscale-[0.2]'
                ]"
                :style="{
                    width: '64px',
                    height: (64 * Math.min(1.5, Math.max(0.6, page.height / page.width))) + 'px',
                    backgroundColor: '#fff'
                }"
              >
                  <!-- Image Preview -->
                  <img
                    v-if="hasUsablePageThumbnail(page)"
                    :src="getPageThumbSrc(page)"
                    class="w-full h-full object-contain"
                    @error="markPageThumbError(page)"
                  />
                  <div v-else class="w-full h-full flex flex-col items-center justify-center gap-1 bg-zinc-900">
                      <FileText class="w-4 h-4 text-zinc-700" />
                      <span class="text-[8px] font-bold text-zinc-500 tracking-wide">{{ getPageInitials(page) }}</span>
                  </div>
                  
                  <!-- Selection Overlay -->
                  <div v-if="index === project.activePageIndex" class="absolute inset-0 bg-primary/5 pointer-events-none"></div>

                  <!-- Page Number Badge -->
                  <div class="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[8px] px-1.5 py-0.5 rounded shadow-sm font-bold backdrop-blur-sm">
                      {{ index + 1 }}
                  </div>

                  <!-- Quick Actions (Hover) -->
                  <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-sm">
                      <button @click.stop="duplicatePage(index)" class="p-1.5 bg-white text-black hover:scale-110 rounded transition-transform">
                          <Copy class="w-3 h-3" />
                      </button>
                      <button @click.stop="deletePage(index)" class="p-1.5 bg-white text-destructive hover:scale-110 rounded transition-transform">
                          <Trash2 class="w-3 h-3" />
                      </button>
                  </div>
              </div>

              <!-- Page Label (Optional) -->
              <!-- <span class="absolute -bottom-4 left-0 right-0 text-center text-[8px] font-bold text-muted-foreground uppercase opacity-0 group-hover:opacity-100">{{ page.name }}</span> -->
          </div>

          <!-- Add Button -->
           <button 
             class="shrink-0 w-16 h-16 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/5 hover:border-white/20 text-zinc-600 hover:text-white transition-all active:scale-95" 
             @click="createPage('story')"
           >
               <Plus class="w-5 h-5" />
               <span class="text-[8px] font-black uppercase">Nova</span>
           </button>
      </div>
  </div>
</template>

<style scoped>
.pattern-grid {
    background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
    background-size: 10px 10px;
}
</style>
