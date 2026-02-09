<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  presentationImage: string
  presentationHotspots: Array<{
    top: string
    left: string
    width: string
    height: string
    target: string | number
  }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'hotspot-click', target: string | number): void
}>()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-100 bg-black flex items-center justify-center">
    <div class="relative w-full h-full flex items-center justify-center">
      <div class="relative w-full h-full">
        <img :src="presentationImage" class="w-full h-full object-contain" />
        <div class="absolute inset-0 w-full h-full">
          <div
            v-for="(hotspot, i) in presentationHotspots"
            :key="i"
            class="absolute cursor-pointer hover:bg-violet-500/30 transition-colors"
            :style="{ top: hotspot.top, left: hotspot.left, width: hotspot.width, height: hotspot.height }"
            @click="emit('hotspot-click', hotspot.target)"
            title="Clique para Navegar"
          />
        </div>
      </div>

      <button @click="open = false" class="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-white/20 transition-all z-50">
        <X class="w-6 h-6" />
      </button>

      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#2c2c2c] px-4 py-2 rounded-full flex gap-4 border border-white/10 shadow-xl z-50">
        <span class="text-xs text-white font-medium">Modo Apresentação Interativa</span>
      </div>
    </div>
  </div>
</template>
