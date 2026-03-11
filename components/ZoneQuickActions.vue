<script setup lang="ts">
import { LayoutGrid, Plus, RefreshCcw, Copy, Wand2 } from 'lucide-vue-next';

defineProps<{
  visible: boolean;
  top: number;
  left: number;
  width: number;
  name: string;
  roleLabel: string;
  statusLabel: string;
  frameLabel?: string;
  productCount: number;
  isEmpty: boolean;
}>();

const emit = defineEmits<{
  (e: 'fill'): void;
  (e: 'append'): void;
  (e: 'replace'): void;
  (e: 'preset'): void;
  (e: 'duplicate'): void;
}>();
</script>

<template>
  <div v-if="visible" class="pointer-events-none absolute inset-0 z-[115]">
    <div
      class="pointer-events-auto absolute flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950/88 px-3 py-2 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur"
      :style="{
        top: `${Math.max(12, top - 62)}px`,
        left: `${Math.max(12, left + (width / 2))}px`,
        transform: 'translateX(-50%)'
      }"
    >
      <div class="flex min-w-0 items-center gap-2 pr-2 border-r border-white/10">
        <div class="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
          <LayoutGrid class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] font-semibold text-white truncate">{{ name }}</div>
          <div class="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span>{{ roleLabel }}</span>
            <span>•</span>
            <span>{{ statusLabel }}</span>
            <span>•</span>
            <span>{{ productCount }} itens</span>
            <span v-if="frameLabel">•</span>
            <span v-if="frameLabel" class="truncate max-w-[130px]">{{ frameLabel }}</span>
          </div>
        </div>
      </div>

      <button type="button" class="zone-action-button zone-action-button--primary" @click="emit('fill')">
        Preencher
      </button>
      <button type="button" class="zone-action-button" @click="emit('append')">
        <Plus class="h-3.5 w-3.5" />
        Adicionar
      </button>
      <button type="button" class="zone-action-button" @click="emit('replace')">
        <RefreshCcw class="h-3.5 w-3.5" />
        Substituir
      </button>
      <button type="button" class="zone-action-button" @click="emit('preset')">
        <Wand2 class="h-3.5 w-3.5" />
        Preset
      </button>
      <button type="button" class="zone-action-button" @click="emit('duplicate')">
        <Copy class="h-3.5 w-3.5" />
        Duplicar
      </button>
    </div>

    <button
      v-if="isEmpty"
      type="button"
      class="pointer-events-auto absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/12 px-4 py-3 text-sm font-medium text-emerald-100 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur transition-colors hover:bg-emerald-500/18"
      :style="{
        left: `${Math.max(24, left + (width / 2))}px`,
        top: `${Math.max(24, top + 120)}px`
      }"
      @click="emit('fill')"
    >
      <Plus class="h-4 w-4" />
      Adicionar produtos
    </button>
  </div>
</template>

<style scoped>
.zone-action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 2rem;
  border-radius: 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  padding: 0 0.75rem;
  color: rgba(244, 244, 245, 0.88);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.zone-action-button:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.zone-action-button--primary {
  background: rgba(16, 185, 129, 0.18);
  border-color: rgba(52, 211, 153, 0.25);
  color: #ecfdf5;
}

.zone-action-button--primary:hover {
  background: rgba(16, 185, 129, 0.26);
  border-color: rgba(52, 211, 153, 0.35);
}
</style>
