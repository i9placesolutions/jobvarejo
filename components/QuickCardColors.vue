<script setup lang="ts">
import ColorPicker from './ui/ColorPicker.vue'
const props = defineProps<{ mode: 'auto' | 'manual'; color: string; busy?: boolean }>()
const emit = defineEmits<{ apply: [value: { mode: 'auto' | 'manual'; color?: string; allPages: boolean }] }>()
const allPages = ref(false)
const show = ref(false)
const trigger = ref<HTMLElement | null>(null)
const apply = (mode: 'auto' | 'manual', color?: string) => emit('apply', { mode, color, allPages: allPages.value })
</script>
<template>
  <section class="mb-4 rounded-xl border border-white/15 bg-white/[0.03] p-4 text-white">
    <h3 class="text-sm font-semibold">Cores dos cards</h3>
    <p class="mt-1 text-xs leading-relaxed text-zinc-400">Destaques com a paleta do encarte. Os demais produtos ficam brancos.</p>
    <label class="mt-3 flex items-center gap-2 text-xs text-zinc-300">
      <input v-model="allPages" type="checkbox" :disabled="busy" class="accent-violet-500" />
      Aplicar também às páginas com um produto neste formato
    </label>
    <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button type="button" :disabled="busy" class="rounded-lg border px-3 py-2 text-sm" :class="mode === 'auto' ? 'border-violet-400 bg-violet-500/15' : 'border-white/15'" @click="apply('auto')">Usar paleta do encarte</button>
      <button ref="trigger" type="button" :disabled="busy" class="flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm" @click="show = !show">
        <span class="h-5 w-5 rounded border border-white/20" :style="{ background: color }"></span>Escolher cor
      </button>
    </div>
    <label class="mt-3 block text-xs text-zinc-300">Onde usar a cor escolhida
      <select :value="mode" :disabled="busy" class="mt-1 w-full rounded-lg border border-white/15 bg-zinc-900 p-2 text-sm text-white" @change="apply(($event.target as HTMLSelectElement).value as 'auto' | 'manual', color)">
        <option value="auto">Somente nos destaques · demais brancos</option>
        <option value="manual">Em todos os cards</option>
      </select>
    </label>
    <ColorPicker :show="show" :model-value="color" :trigger-element="trigger" @update:show="show = $event" @update:model-value="apply(mode, $event)" />
  </section>
</template>
