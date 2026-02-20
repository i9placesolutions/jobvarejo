<script setup lang="ts">
defineProps<{
  labels: Array<{
    id: string
    name: string
    x: number
    y: number
    dimX: number
    dimY: number
    dims: string
    isSelected: boolean
  }>
}>()

const emit = defineEmits<{
  (e: 'label-click', label: any, event: MouseEvent): void
  (e: 'label-mousedown', label: any, event: MouseEvent): void
}>()
</script>

<template>
  <template v-for="label in labels" :key="label.id">
    <div
      class="absolute z-40 select-none cursor-pointer whitespace-nowrap"
      :style="{
        left: label.x + 'px',
        top: label.y + 'px',
        pointerEvents: 'auto',
      }"
      @mousedown.stop.prevent="emit('label-mousedown', label, $event)"
      @click.stop.prevent="emit('label-click', label, $event)"
      @dblclick.stop.prevent
    >
      <span
        class="text-xs font-bold px-1 py-0.5 rounded transition-colors"
        :class="label.isSelected ? 'text-[#0d99ff] bg-[#0d99ff]/10' : 'text-[#0d99ff]/60 hover:text-[#0d99ff] hover:bg-[#0d99ff]/10'"
      >
        {{ label.name }}
      </span>
    </div>

    <div
      class="absolute z-40 select-none pointer-events-none whitespace-nowrap"
      :style="{
        left: label.dimX + 'px',
        top: label.dimY + 'px',
        transform: 'translateX(-50%)',
      }"
    >
      <span
        class="text-[11px] font-bold px-1.5 py-0.5 rounded"
        :class="label.isSelected ? 'bg-[#0d99ff] text-white' : 'bg-[#0d99ff]/60 text-white/85'"
      >
        {{ label.dims }}
      </span>
    </div>
  </template>
</template>
