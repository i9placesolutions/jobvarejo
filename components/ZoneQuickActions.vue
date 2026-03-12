<script setup lang="ts">
import { computed } from 'vue';
import { LayoutGrid, Plus, RefreshCcw, Copy, Wand2 } from 'lucide-vue-next';

const props = defineProps<{
  visible: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
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

const zoneCenterX = computed(() => props.left + (props.width / 2));

const toolbarStyle = computed(() => {
  const anchoredTop = props.top - 78;
  const fallbackTop = props.top + 10;

  return {
    top: `${anchoredTop >= 12 ? anchoredTop : fallbackTop}px`,
    left: `${Math.max(16, zoneCenterX.value)}px`,
    transform: 'translateX(-50%)'
  };
});

const isCompactZone = computed(() => props.width < 300 || props.height < 180);

const emptyStateStyle = computed(() => {
  const inset = Math.max(14, Math.min(22, props.width * 0.06));
  const availableHeight = Math.max(props.height - 28, 72);
  const targetHeight = isCompactZone.value ? availableHeight * 0.34 : availableHeight * 0.28;
  const placeholderHeight = Math.max(72, Math.min(targetHeight, isCompactZone.value ? 96 : 132));
  const topInset = Math.max(14, (props.height - placeholderHeight) / 2);

  return {
    left: `${props.left + inset}px`,
    top: `${props.top + topInset}px`,
    width: `${Math.max(props.width - (inset * 2), 120)}px`
  };
});
</script>

<template>
  <div v-if="visible" class="pointer-events-none absolute inset-0 z-[115]">
    <div
      class="pointer-events-auto absolute flex max-w-[min(92vw,960px)] flex-wrap items-center justify-center gap-2 rounded-[24px] border border-white/12 bg-[linear-gradient(135deg,rgba(10,10,10,0.94),rgba(22,22,22,0.9))] px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.34)] backdrop-blur-xl"
      :style="toolbarStyle"
    >
      <div class="flex min-w-0 items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.035] px-2.5 py-2">
        <div class="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/12 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <LayoutGrid class="h-4 w-4" />
        </div>
        <div class="min-w-0">
          <div class="truncate text-[11px] font-semibold text-white">{{ name }}</div>
          <div class="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span>{{ roleLabel }}</span>
            <span>•</span>
            <span>{{ statusLabel }}</span>
            <span>•</span>
            <span>{{ productCount }} itens</span>
            <span v-if="frameLabel">•</span>
            <span v-if="frameLabel" class="max-w-[130px] truncate">{{ frameLabel }}</span>
          </div>
        </div>
      </div>

      <button type="button" class="zone-action-button zone-action-button--primary" @click="emit('fill')">
        Preencher
      </button>
      <button v-if="!isEmpty" type="button" class="zone-action-button" @click="emit('append')">
        <Plus class="h-3.5 w-3.5" />
        Adicionar
      </button>
      <button v-if="!isEmpty" type="button" class="zone-action-button" @click="emit('replace')">
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
      class="pointer-events-auto absolute flex flex-col items-center justify-center gap-1.5 rounded-[26px] border border-dashed border-emerald-400/30 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(6,95,70,0.14))] px-5 py-4 text-center text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_44px_rgba(0,0,0,0.16)] backdrop-blur-sm transition-all duration-200 hover:border-emerald-300/45 hover:bg-[linear-gradient(180deg,rgba(16,185,129,0.22),rgba(6,95,70,0.18))]"
      :style="emptyStateStyle"
      @click="emit('append')"
    >
      <span class="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/14 bg-white/10">
        <Plus class="h-5 w-5" />
      </span>
      <span class="text-sm font-semibold tracking-[0.01em]">Adicionar produtos</span>
      <span v-if="!isCompactZone" class="text-[11px] text-emerald-50/75">
        Preencha esta zona mantendo o layout e o template atual.
      </span>
    </button>
  </div>
</template>

<style scoped>
.zone-action-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 2.15rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.035);
  padding: 0 0.9rem;
  color: rgba(244, 244, 245, 0.88);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.zone-action-button:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  transform: translateY(-1px);
}

.zone-action-button--primary {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.24), rgba(5, 150, 105, 0.16));
  border-color: rgba(52, 211, 153, 0.3);
  color: #ecfdf5;
}

.zone-action-button--primary:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.32), rgba(5, 150, 105, 0.22));
  border-color: rgba(52, 211, 153, 0.4);
}
</style>
