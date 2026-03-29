<script setup lang="ts">
import type { BuilderBadgeStyle } from '~/types/builder'

const props = defineProps<{
  badge: BuilderBadgeStyle
}>()

const bgColor = computed(() => props.badge.css_config?.bgColor || '#ef4444')
const textColor = computed(() => props.badge.css_config?.textColor || '#ffffff')
const text = computed(() => props.badge.css_config?.text || props.badge.name || 'OFERTA')
const position = computed(() => props.badge.css_config?.position || 'top-right')

const isRight = computed(() => position.value === 'top-right')
</script>

<template>
  <!-- Banner diagonal no canto superior -->
  <div
    class="absolute z-30 overflow-hidden pointer-events-none"
    :style="{
      top: '0',
      [isRight ? 'right' : 'left']: '0',
      width: '5em',
      height: '5em',
    }"
  >
    <div
      class="absolute font-extrabold uppercase text-center leading-none tracking-wider shadow-md"
      :style="{
        backgroundColor: bgColor,
        color: textColor,
        fontSize: '0.4em',
        padding: '0.3em 0',
        width: '8em',
        top: '1.1em',
        [isRight ? 'right' : 'left']: '-1.8em',
        transform: isRight ? 'rotate(45deg)' : 'rotate(-45deg)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }"
    >
      {{ text }}
    </div>
  </div>
</template>
