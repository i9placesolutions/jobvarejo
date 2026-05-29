<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { Plus } from 'lucide-vue-next';

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

// Mede a area visivel do canvas (o overlay ocupa inset-0 do wrapper) para
// poder grudar o botao na zona SEM deixa-lo sair da tela.
const rootEl = ref<HTMLElement | null>(null);
const viewport = ref({ w: 0, h: 0 });
let ro: ResizeObserver | null = null;
const measure = () => {
  const el = rootEl.value;
  if (el) viewport.value = { w: el.clientWidth, h: el.clientHeight };
};
onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && rootEl.value) {
    ro = new ResizeObserver(measure);
    ro.observe(rootEl.value);
  }
});
onUnmounted(() => {
  if (ro) { ro.disconnect(); ro = null; }
});

const BTN_INSET = 8;

// Botao unico, "colado" no canto superior-esquerdo da parte VISIVEL da zona.
// Calculamos a intersecao da zona com a viewport e ancoramos o botao ali, com
// inset — assim ele acompanha a zona e NUNCA fica fora da tela (corrige o bug
// do botao suspenso aparecendo totalmente fora da viewport).
const btnStyle = computed(() => {
  const w = viewport.value.w || 0;
  const h = viewport.value.h || 0;
  const zL = props.left;
  const zT = props.top;
  const zR = props.left + props.width;
  const zB = props.top + props.height;
  // intersecao visivel (se ainda nao medimos, usa as coords cruas da zona)
  const vL = w ? Math.max(0, zL) : zL;
  const vT = h ? Math.max(0, zT) : zT;
  const vR = w ? Math.min(w, zR) : zR;
  const vB = h ? Math.min(h, zB) : zB;
  let x = vL + BTN_INSET;
  let y = vT + BTN_INSET;
  // nao deixa o botao ultrapassar a borda visivel da zona
  x = Math.min(x, Math.max(vL, vR - BTN_INSET));
  y = Math.min(y, Math.max(vT, vB - BTN_INSET));
  return { top: `${Math.round(y)}px`, left: `${Math.round(x)}px` };
});

const onPrimaryClick = () => emit(props.isEmpty ? 'fill' : 'append');
</script>

<template>
  <div v-if="visible" ref="rootEl" class="pointer-events-none absolute inset-0 z-[115]">
    <!-- Botao unico, grudado na zona e sempre dentro da tela -->
    <button
      type="button"
      class="pointer-events-auto absolute inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-[rgba(10,10,10,0.9)] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-emerald-100 shadow-[0_6px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-colors hover:border-emerald-300/50 hover:bg-[rgba(16,185,129,0.18)]"
      :style="btnStyle"
      :title="isEmpty ? 'Importar produtos para a zona' : 'Adicionar produtos à zona'"
      @click.stop="onPrimaryClick"
    >
      <Plus class="h-3.5 w-3.5" />
      Importar
    </button>
  </div>
</template>
