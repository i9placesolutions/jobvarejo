<script setup lang="ts">
import type { BuilderBadgeStyle } from '~/types/builder'

const props = defineProps<{
  badge: BuilderBadgeStyle
}>()

const bgColor = computed(() => props.badge.css_config?.bgColor || '#ef4444')
const textColor = computed(() => props.badge.css_config?.textColor || '#ffffff')
const text = computed(() => props.badge.css_config?.text || props.badge.name || 'OFERTA')
const position = computed(() => props.badge.css_config?.position || 'top-right')

const positionClass = computed(() => {
  switch (position.value) {
    case 'top-left': return 'top-1 left-1'
    case 'top-right': return 'top-1 right-1'
    default: return 'top-1 right-1'
  }
})
</script>

<template>
  <div
    class="absolute z-20 text-[0.45em] font-bold uppercase px-1.5 py-0.5 rounded-sm leading-none tracking-wide shadow-sm"
    :class="positionClass"
    :style="{
      backgroundColor: bgColor,
      color: textColor,
    }"
  >
    {{ text }}
  </div>
</template>
