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
  <div class="flex items-center gap-0.5 shrink-0 min-w-0">
    <div class="flex items-center -space-x-1 shrink-0">
      <div
        v-for="(user, index) in visibleUsers"
        :key="user.id || index"
        :class="[
          'w-5 h-5 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center text-[8px] font-semibold text-white',
          getColorFromString(user.email || user.name || 'user')
        ]"
        :title="user.name || user.email || 'Usuario'"
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
      class="w-5 h-5 hover:bg-white/10 rounded flex items-center justify-center text-zinc-400 hover:text-white transition-all shrink-0"
      title="Apresentar"
    >
      <Play class="w-2.5 h-2.5" />
    </button>

    <button
      @click="emit('open-ai-generate')"
      class="h-5 px-1.5 bg-white/5 hover:bg-white/10 text-white rounded text-[9px] font-medium transition-all flex items-center gap-0.5 shrink-0 whitespace-nowrap border border-white/10"
    >
      <Sparkles class="w-2.5 h-2.5 shrink-0" />
      <span>Gerar com IA</span>
    </button>

    <button
      @click="emit('open-share')"
      class="h-5 px-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[9px] font-medium transition-all flex items-center gap-0.5 shrink-0 whitespace-nowrap"
    >
      <Share2 class="w-2.5 h-2.5 shrink-0" />
      <span>Exportar</span>
    </button>

    <div class="relative shrink-0 pr-0.5">
      <button
        @click="toggleZoomMenu"
        class="h-5 px-1 hover:bg-white/10 rounded text-[9px] font-medium text-white flex items-center gap-0.5 transition-all whitespace-nowrap"
      >
        <span>{{ currentZoom }}%</span>
        <ChevronDown class="w-2 h-2 text-zinc-400 shrink-0" />
      </button>

      <div
        v-if="showZoomMenu"
        class="absolute top-full right-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-30 z-50"
        @click.stop
      >
        <button @click="emit('zoom-50')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">50%</button>
        <button @click="emit('zoom-100')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">100%</button>
        <button @click="emit('zoom-200')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">200%</button>
        <button @click="emit('zoom-400')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">400%</button>
        <div class="h-px bg-white/10 my-1"></div>
        <button @click="emit('zoom-fit')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Ajustar a Tela</button>
        <button @click="emit('zoom-selection')" class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all">Ajustar Selecao</button>
      </div>
    </div>

    <div class="relative shrink-0 pr-0.5">
      <button
        @click="toggleViewMenu"
        class="h-5 px-1 hover:bg-white/10 rounded text-[9px] font-medium text-white flex items-center gap-0.5 transition-all whitespace-nowrap"
        title="Visualizacao e Snap"
      >
        <View class="w-2.5 h-2.5 text-zinc-400 shrink-0" />
        <ChevronDown class="w-2 h-2 text-zinc-500 shrink-0" />
      </button>

      <div
        v-if="showViewMenu"
        class="absolute top-full right-0 mt-1 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 min-w-44 z-50"
        @click.stop
      >
        <button
          @click="emit('toggle-grid'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all flex items-center justify-between gap-2"
        >
          <span class="flex items-center gap-2">
            <LayoutGrid class="w-3 h-3 text-zinc-400" />
            Grid
          </span>
          <Check v-if="viewShowGrid" class="w-3 h-3 text-emerald-400" />
        </button>
        <button
          @click="emit('toggle-rulers'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Rulers</span>
          <Check v-if="viewShowRulers" class="w-3 h-3 text-emerald-400" />
        </button>
        <button
          @click="emit('toggle-guides'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Guides</span>
          <Check v-if="viewShowGuides" class="w-3 h-3 text-emerald-400" />
        </button>

        <div class="h-px bg-white/10 my-1"></div>

        <button
          @click="emit('toggle-snap-objects'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to objects</span>
          <Check v-if="snapToObjects" class="w-3 h-3 text-emerald-400" />
        </button>
        <button
          @click="emit('toggle-snap-guides'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to guides</span>
          <Check v-if="snapToGuides" class="w-3 h-3 text-emerald-400" />
        </button>
        <button
          @click="emit('toggle-snap-grid'); closeViewMenu()"
          class="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/10 transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to grid</span>
          <Check v-if="snapToGrid" class="w-3 h-3 text-emerald-400" />
        </button>

        <div class="h-px bg-white/10 my-1"></div>

        <div class="px-3 py-1.5">
          <div class="text-[10px] text-zinc-400 mb-1">Grid size</div>
          <div class="flex items-center gap-1">
            <button
              class="px-2 h-6 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white transition-all"
              :class="gridSize === 10 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' : ''"
              @click="emit('set-grid-size', 10); closeViewMenu()"
            >10</button>
            <button
              class="px-2 h-6 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white transition-all"
              :class="gridSize === 20 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' : ''"
              @click="emit('set-grid-size', 20); closeViewMenu()"
            >20</button>
            <button
              class="px-2 h-6 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white transition-all"
              :class="gridSize === 40 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' : ''"
              @click="emit('set-grid-size', 40); closeViewMenu()"
            >40</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
