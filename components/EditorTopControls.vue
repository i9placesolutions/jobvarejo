<script setup lang="ts">
import { computed, ref } from 'vue'
import { Play, Share2, ChevronDown, View, Check, LayoutGrid, Sparkles } from 'lucide-vue-next'

const props = defineProps<{
  collaborators: any[]
  currentUser: any
  showZoomMenu: boolean
  currentZoom: number
  getColorFromString: (value: string) => string
  getInitial: (name?: string) => string
  viewShowGrid: boolean
  viewShowRulers: boolean
  viewShowGuides: boolean
  snapToObjects: boolean
  snapToGuides: boolean
  snapToGrid: boolean
  gridSize: number
}>()

const emit = defineEmits<{
  (e: 'update:showZoomMenu', value: boolean): void
  (e: 'present'): void
  (e: 'open-ai-generate'): void
  (e: 'open-share'): void
  (e: 'zoom-50'): void
  (e: 'zoom-100'): void
  (e: 'zoom-200'): void
  (e: 'zoom-400'): void
  (e: 'zoom-fit'): void
  (e: 'zoom-selection'): void
  (e: 'toggle-grid'): void
  (e: 'toggle-rulers'): void
  (e: 'toggle-guides'): void
  (e: 'toggle-snap-objects'): void
  (e: 'toggle-snap-guides'): void
  (e: 'toggle-snap-grid'): void
  (e: 'set-grid-size', size: number): void
}>()

const visibleUsers = computed(() => {
  const list = props.collaborators?.length > 0
    ? props.collaborators
    : (props.currentUser ? [props.currentUser] : [])
  return list.slice(0, 1)
})

const toggleZoomMenu = () => emit('update:showZoomMenu', !props.showZoomMenu)

const showViewMenu = ref(false)
const toggleViewMenu = () => { showViewMenu.value = !showViewMenu.value }
const closeViewMenu = () => { showViewMenu.value = false }
</script>

<template>
  <div class="flex items-center gap-1.5 shrink-0 min-w-0 py-1">
    <div class="flex items-center -space-x-1.5 shrink-0">
      <div
        v-for="(user, index) in visibleUsers"
        :key="user.id || index"
        :class="[
          'w-7 h-7 rounded-full border border-white/10 bg-[#2a2a2a] flex items-center justify-center text-[10px] font-bold text-white shadow-sm hover:z-10 transition-transform hover:scale-105',
          getColorFromString(user.email || user.name || 'user')
        ]"
        :title="user.name || user.email || 'Usuário'"
      >
        <img
          v-if="user.avatar_url"
          :src="user.avatar_url"
          :alt="user.name || 'User'"
          class="w-full h-full rounded-full object-cover"
        />
        <span v-else>{{ getInitial(user.name) }}</span>
      </div>
    </div>

    <button
      @click="emit('present')"
      class="w-8 h-8 hover:bg-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all shrink-0 ml-0.5"
      title="Apresentar"
    >
      <Play class="w-3.5 h-3.5" />
    </button>

    <div class="w-px h-5 bg-white/10 mx-1 shrink-0"></div>

    <button
      @click="emit('open-ai-generate')"
      class="h-8 px-3.5 bg-gradient-to-r from-violet-600/30 to-fuchsia-600/30 hover:from-violet-600/40 hover:to-fuchsia-600/40 border border-violet-500/30 hover:border-violet-500/50 text-violet-100 rounded-full text-[12px] font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-[0_0_12px_rgba(139,92,246,0.15)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]"
    >
      <Sparkles class="w-4 h-4 shrink-0 text-violet-300" />
      <span>Gerar IA</span>
    </button>

    <button
      @click="emit('open-share')"
      class="h-8 px-4 bg-white text-zinc-900 hover:bg-zinc-200 rounded-full text-[12px] font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-sm"
    >
      <Share2 class="w-4 h-4 shrink-0" />
      <span>Exportar</span>
    </button>

    <div class="relative shrink-0 pr-0.5">
      <button
        @click="toggleZoomMenu"
        class="h-8 px-2 hover:bg-white/10 rounded-lg text-[12px] font-medium text-zinc-300 hover:text-white flex items-center gap-1 transition-all whitespace-nowrap"
      >
        <span>{{ currentZoom }}%</span>
        <ChevronDown class="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </button>

      <div
        v-if="showZoomMenu"
        class="absolute top-full right-0 mt-2 bg-[#18181b]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[140px] z-50 overflow-hidden"
        @click.stop
      >
        <button @click="emit('zoom-50')" class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all">50%</button>
        <button @click="emit('zoom-100')" class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all">100%</button>
        <button @click="emit('zoom-200')" class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all">200%</button>
        <button @click="emit('zoom-400')" class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all">400%</button>
        <div class="h-px bg-white/5 my-1.5"></div>
        <button @click="emit('zoom-fit')" class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all">Ajustar à Tela</button>
        <button @click="emit('zoom-selection')" class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all">Ajustar Seleção</button>
      </div>
    </div>

    <div class="relative shrink-0 pr-0.5">
      <button
        @click="toggleViewMenu"
        class="h-8 px-2 hover:bg-white/10 rounded-lg text-[12px] font-medium text-zinc-300 hover:text-white flex items-center gap-1 transition-all whitespace-nowrap"
        title="Visualização e Snap"
      >
        <View class="w-4 h-4 text-zinc-400 shrink-0" />
        <ChevronDown class="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </button>

      <div
        v-if="showViewMenu"
        class="absolute top-full right-0 mt-2 bg-[#18181b]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[200px] z-50 overflow-hidden"
        @click.stop
      >
        <button
          @click="emit('toggle-grid'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all flex items-center justify-between gap-2"
        >
          <span class="flex items-center gap-2">
            <LayoutGrid class="w-3.5 h-3.5 text-zinc-400" />
            Grid
          </span>
          <Check v-if="viewShowGrid" class="w-3.5 h-3.5 text-violet-400" />
        </button>
        <button
          @click="emit('toggle-rulers'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Rulers</span>
          <Check v-if="viewShowRulers" class="w-3.5 h-3.5 text-violet-400" />
        </button>
        <button
          @click="emit('toggle-guides'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Guides</span>
          <Check v-if="viewShowGuides" class="w-3.5 h-3.5 text-violet-400" />
        </button>

        <div class="h-px bg-white/5 my-1.5"></div>

        <button
          @click="emit('toggle-snap-objects'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to objects</span>
          <Check v-if="snapToObjects" class="w-3.5 h-3.5 text-violet-400" />
        </button>
        <button
          @click="emit('toggle-snap-guides'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to guides</span>
          <Check v-if="snapToGuides" class="w-3.5 h-3.5 text-violet-400" />
        </button>
        <button
          @click="emit('toggle-snap-grid'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-violet-500/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to grid</span>
          <Check v-if="snapToGrid" class="w-3.5 h-3.5 text-violet-400" />
        </button>

        <div class="h-px bg-white/5 my-1.5"></div>

        <div class="px-3 py-1.5">
          <div class="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Tamanho do Grid</div>
          <div class="flex items-center gap-1.5">
            <button
              class="flex-1 h-7 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-white transition-all"
              :class="gridSize === 10 ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-inner' : ''"
              @click="emit('set-grid-size', 10); closeViewMenu()"
            >10</button>
            <button
              class="flex-1 h-7 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-white transition-all"
              :class="gridSize === 20 ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-inner' : ''"
              @click="emit('set-grid-size', 20); closeViewMenu()"
            >20</button>
            <button
              class="flex-1 h-7 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-white transition-all"
              :class="gridSize === 40 ? 'bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-inner' : ''"
              @click="emit('set-grid-size', 40); closeViewMenu()"
            >40</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
