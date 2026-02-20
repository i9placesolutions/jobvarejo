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
  <div class="editor-top-controls flex items-center gap-1 shrink-0 min-w-0">
    <div class="flex items-center -space-x-1 shrink-0">
      <div
        v-for="(user, index) in visibleUsers"
        :key="user.id || index"
        :class="[
          'w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-semibold text-white',
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
      class="control-icon-btn w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0"
      title="Apresentar"
    >
      <Play class="w-3 h-3" />
    </button>

    <button
      @click="emit('open-ai-generate')"
      class="control-soft-btn h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap border"
    >
      <Sparkles class="w-3 h-3 shrink-0" />
      <span>Gerar com IA</span>
    </button>

    <button
      @click="emit('open-share')"
      class="control-primary-btn h-7 px-2.5 rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
    >
      <Share2 class="w-3 h-3 shrink-0" />
      <span>Exportar</span>
    </button>

    <div class="relative shrink-0 pr-0.5">
      <button
        @click="toggleZoomMenu"
        class="control-plain-btn h-7 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all whitespace-nowrap"
      >
        <span>{{ currentZoom }}%</span>
        <ChevronDown class="w-2.5 h-2.5 text-[var(--controls-muted)] shrink-0" />
      </button>

      <div
        v-if="showZoomMenu"
        class="menu-panel absolute top-full right-0 mt-1 rounded-lg py-1 min-w-32 z-50"
        @click.stop
      >
        <button @click="emit('zoom-50')" class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all">50%</button>
        <button @click="emit('zoom-100')" class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all">100%</button>
        <button @click="emit('zoom-200')" class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all">200%</button>
        <button @click="emit('zoom-400')" class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all">400%</button>
        <div class="menu-divider h-px my-1"></div>
        <button @click="emit('zoom-fit')" class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Ajustar a Tela</button>
        <button @click="emit('zoom-selection')" class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all">Ajustar Selecao</button>
      </div>
    </div>

    <div class="relative shrink-0 pr-0.5">
      <button
        @click="toggleViewMenu"
        class="control-plain-btn h-7 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all whitespace-nowrap"
        title="Visualizacao e Snap"
      >
        <View class="w-3 h-3 text-[var(--controls-muted)] shrink-0" />
        <ChevronDown class="w-2.5 h-2.5 text-[var(--controls-muted)] shrink-0" />
      </button>

      <div
        v-if="showViewMenu"
        class="menu-panel absolute top-full right-0 mt-1 rounded-lg py-1 min-w-44 z-50"
        @click.stop
      >
        <button
          @click="emit('toggle-grid'); closeViewMenu()"
          class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all flex items-center justify-between gap-2"
        >
          <span class="flex items-center gap-2">
            <LayoutGrid class="w-3 h-3 text-[var(--controls-muted)]" />
            Grid
          </span>
          <Check v-if="viewShowGrid" class="w-3 h-3 text-emerald-600" />
        </button>
        <button
          @click="emit('toggle-rulers'); closeViewMenu()"
          class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all flex items-center justify-between gap-2"
        >
          <span>Rulers</span>
          <Check v-if="viewShowRulers" class="w-3 h-3 text-emerald-600" />
        </button>
        <button
          @click="emit('toggle-guides'); closeViewMenu()"
          class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all flex items-center justify-between gap-2"
        >
          <span>Guides</span>
          <Check v-if="viewShowGuides" class="w-3 h-3 text-emerald-600" />
        </button>

        <div class="menu-divider h-px my-1"></div>

        <button
          @click="emit('toggle-snap-objects'); closeViewMenu()"
          class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to objects</span>
          <Check v-if="snapToObjects" class="w-3 h-3 text-emerald-600" />
        </button>
        <button
          @click="emit('toggle-snap-guides'); closeViewMenu()"
          class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to guides</span>
          <Check v-if="snapToGuides" class="w-3 h-3 text-emerald-600" />
        </button>
        <button
          @click="emit('toggle-snap-grid'); closeViewMenu()"
          class="menu-item w-full px-3 py-1.5 text-left text-xs transition-all flex items-center justify-between gap-2"
        >
          <span>Snap to grid</span>
          <Check v-if="snapToGrid" class="w-3 h-3 text-emerald-600" />
        </button>

        <div class="menu-divider h-px my-1"></div>

        <div class="px-3 py-1.5">
          <div class="text-[10px] text-[var(--controls-muted)] mb-1">Grid size</div>
          <div class="flex items-center gap-1">
            <button
              class="menu-chip px-2 h-6 rounded text-[10px] transition-all"
              :class="gridSize === 10 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700' : ''"
              @click="emit('set-grid-size', 10); closeViewMenu()"
            >10</button>
            <button
              class="menu-chip px-2 h-6 rounded text-[10px] transition-all"
              :class="gridSize === 20 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700' : ''"
              @click="emit('set-grid-size', 20); closeViewMenu()"
            >20</button>
            <button
              class="menu-chip px-2 h-6 rounded text-[10px] transition-all"
              :class="gridSize === 40 ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700' : ''"
              @click="emit('set-grid-size', 40); closeViewMenu()"
            >40</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-top-controls {
  --controls-text: #2f2419;
  --controls-muted: #7b6a58;
  --controls-border: #e8dccb;
}

.control-icon-btn,
.control-plain-btn {
  color: var(--controls-text);
}

.control-icon-btn:hover,
.control-plain-btn:hover {
  background: rgba(179, 38, 30, 0.08);
}

.control-soft-btn {
  color: #5f4e3f;
  background: linear-gradient(180deg, #fffefb 0%, #fff8ee 100%);
  border-color: var(--controls-border);
}

.control-soft-btn:hover {
  color: #3c2a1f;
  border-color: #d4b693;
  background: #fff6e8;
}

.control-primary-btn {
  color: #fff;
  background: linear-gradient(135deg, #2a6cf7 0%, #1f57cf 100%);
  border: 1px solid rgba(40, 83, 172, 0.28);
}

.control-primary-btn:hover {
  background: linear-gradient(135deg, #235ede 0%, #1948b3 100%);
}

.menu-panel {
  background: linear-gradient(180deg, #fffefb 0%, #fff8ef 100%);
  border: 1px solid var(--controls-border);
  box-shadow: 0 18px 24px -16px rgba(58, 39, 22, 0.55);
}

.menu-item {
  color: var(--controls-text);
}

.menu-item:hover {
  background: rgba(179, 38, 30, 0.09);
}

.menu-divider {
  background: rgba(232, 220, 203, 0.92);
}

.menu-chip {
  color: var(--controls-text);
  background: #fffefb;
  border: 1px solid var(--controls-border);
}

.menu-chip:hover {
  background: #fff6e8;
  border-color: #d4b693;
}
</style>
