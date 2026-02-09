<script setup lang="ts">
import { computed } from 'vue'
import { Play, Share2, ChevronDown } from 'lucide-vue-next'

const props = defineProps<{
  collaborators: any[]
  currentUser: any
  showZoomMenu: boolean
  currentZoom: number
  getColorFromString: (value: string) => string
  getInitial: (name?: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:showZoomMenu', value: boolean): void
  (e: 'present'): void
  (e: 'open-share'): void
  (e: 'zoom-50'): void
  (e: 'zoom-100'): void
  (e: 'zoom-200'): void
  (e: 'zoom-400'): void
  (e: 'zoom-fit'): void
  (e: 'zoom-selection'): void
}>()

const visibleUsers = computed(() => {
  const list = props.collaborators?.length > 0
    ? props.collaborators
    : (props.currentUser ? [props.currentUser] : [])
  return list.slice(0, 1)
})

const toggleZoomMenu = () => emit('update:showZoomMenu', !props.showZoomMenu)
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
  </div>
</template>
