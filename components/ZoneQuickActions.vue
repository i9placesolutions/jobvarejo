<script setup lang="ts">
import { computed, ref } from 'vue';
import { LayoutGrid, Plus, RefreshCcw, Copy, Wand2, Ellipsis } from 'lucide-vue-next';

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

const expanded = ref(false);

// Anchor compact badge to top-right corner of zone (inside bounds, 8px inset)
const badgeStyle = computed(() => ({
  top: `${props.top + 8}px`,
  left: `${props.left + props.width - 8}px`,
  transform: 'translateX(-100%)',
}));

// Show horizontal action row just below the badge when expanded
const actionsStyle = computed(() => ({
  top: `${props.top + 44}px`,
  left: `${props.left + props.width - 8}px`,
  transform: 'translateX(-100%)',
}));

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
    width: `${Math.max(props.width - inset * 2, 120)}px`,
  };
});
</script>

<template>
  <div v-if="visible" class="pointer-events-none absolute inset-0 z-[115]">

    <!-- Compact corner badge (always shown, top-right of zone) -->
    <div class="pointer-events-auto absolute" :style="badgeStyle">
      <div class="flex items-center gap-1 rounded-[13px] border border-white/12 bg-[rgba(10,10,10,0.88)] px-2 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.36)] backdrop-blur-xl">
        <!-- Zone icon -->
        <div class="flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-500/12 text-emerald-300">
          <LayoutGrid class="h-3 w-3" />
        </div>
        <!-- Primary action (Preencher / Substituir) -->
        <button
          type="button"
          class="rounded-[10px] bg-[linear-gradient(135deg,rgba(16,185,129,0.24),rgba(5,150,105,0.18))] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.04em] text-emerald-100 transition-colors hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.36),rgba(5,150,105,0.28))] border border-emerald-400/25 hover:border-emerald-300/40"
          @click.stop="emit('fill')"
        >
          {{ isEmpty ? 'Preencher' : 'Substituir' }}
        </button>
        <!-- Expand toggle -->
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/8 hover:text-zinc-200"
          :class="expanded ? 'bg-white/8 text-zinc-200' : ''"
          @click.stop="expanded = !expanded"
        >
          <Ellipsis class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <!-- Expanded secondary actions (shown below badge) -->
    <Transition name="zone-actions">
      <div v-if="expanded" class="pointer-events-auto absolute" :style="actionsStyle">
        <div class="flex flex-col gap-1 rounded-[14px] border border-white/10 bg-[rgba(10,10,10,0.92)] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <!-- Zone info -->
          <div class="flex items-center gap-2 border-b border-white/8 px-2 pb-1.5 pt-0.5">
            <span class="text-[11px] font-semibold text-white/90">{{ name }}</span>
            <span class="text-[10px] text-zinc-500">{{ roleLabel }} · {{ statusLabel }} · {{ productCount }} itens</span>
          </div>
          <!-- Secondary actions row -->
          <div class="flex items-center gap-1 pt-0.5">
            <button
              v-if="!isEmpty"
              type="button"
              class="zone-pill"
              @click.stop="emit('append')"
            >
              <Plus class="h-3 w-3" /> Adicionar
            </button>
            <button
              v-if="!isEmpty"
              type="button"
              class="zone-pill"
              @click.stop="emit('replace')"
            >
              <RefreshCcw class="h-3 w-3" /> Substituir
            </button>
            <button
              type="button"
              class="zone-pill"
              @click.stop="emit('preset')"
            >
              <Wand2 class="h-3 w-3" /> Preset
            </button>
            <button
              type="button"
              class="zone-pill"
              @click.stop="emit('duplicate')"
            >
              <Copy class="h-3 w-3" /> Duplicar
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Empty zone CTA (inside zone area) -->
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
.zone-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 1.875rem;
  padding: 0 0.7rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(228, 228, 231, 0.9);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}
.zone-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

/* Expand animation */
.zone-actions-enter-active,
.zone-actions-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.zone-actions-enter-from,
.zone-actions-leave-to {
  opacity: 0;
  transform: translateX(-100%) translateY(-6px);
}
</style>
