<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface MenuItem {
  label?: string
  action?: string
  icon?: any
  danger?: boolean
  divider?: boolean
}

const props = defineProps<{
  modelValue: boolean
  x: number
  y: number
  items: MenuItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', action: string): void
}>()

const menuRef = ref<HTMLElement | null>(null)

const close = () => {
  emit('update:modelValue', false)
}

const handleAction = (action: string) => {
  if (!action) return
  emit('select', action)
  close()
}

const handleItemClick = (item: MenuItem) => {
  if (!item.action) return
  handleAction(item.action)
}

// Close on click outside
const handleClickOutside = (e: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    close()
  }
}

// Adjust position to keep in viewport
const adjustedPosition = ref({ x: 0, y: 0 })

watch(() => [props.x, props.y, props.modelValue], () => {
  if (props.modelValue) {
    // Simple adjustment logic
    // In a real app, use useElementBounding or similar
    let posX = props.x
    let posY = props.y
    
    // Check if near right edge (approximate menu width 200px)
    if (typeof window !== 'undefined' && posX + 200 > window.innerWidth) {
        posX -= 200
    }
    
    // Check if near bottom edge (approximate menu height based on items)
    const nonDividerItems = props.items.filter(item => !item.divider)
    if (typeof window !== 'undefined' && posY + (nonDividerItems.length * 40) > window.innerHeight) {
        posY -= (nonDividerItems.length * 40)
    }

    adjustedPosition.value = { x: posX, y: posY }
  }
}, { immediate: true })

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('contextmenu', handleClickOutside) // Close on other right clicks
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('contextmenu', handleClickOutside)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      ref="menuRef"
      class="fixed z-[99999] min-w-[160px] bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl py-1 flex flex-col overflow-hidden"
      :style="{ top: `${adjustedPosition.y}px`, left: `${adjustedPosition.x}px` }"
      @contextmenu.prevent
    >
      <template v-for="(item, index) in items" :key="index">
        <div v-if="item.divider" class="h-px bg-white/10 my-1 mx-2" />
        <button
          v-else
          @click.stop="handleItemClick(item)"
          :class="[
            'w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors',
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-zinc-300 hover:bg-white/10 hover:text-white'
          ]"
        >
          <component :is="item.icon" v-if="item.icon" class="w-3.5 h-3.5" />
          {{ item.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>
