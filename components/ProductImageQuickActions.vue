<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ChevronDown, SlidersHorizontal, Copy, ImagePlus, Minus, Plus, Trash2 } from 'lucide-vue-next'
import { getProductImageToolbarPlacement } from '~/utils/productImageToolbarPlacement'

const props = defineProps<{
  visible: boolean
  top: number
  left: number
  width: number
  height: number
  fillCount?: number
  fillDirection?: string
}>()

const emit = defineEmits<{
  (e: 'duplicate'): void
  (e: 'replace'): void
  (e: 'remove'): void
  (e: 'fill', count: number, direction?: string): void
  (e: 'resize', direction: 'smaller' | 'larger'): void
}>()


const root = ref<HTMLElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)
const bounds = ref({ width: 800, height: 600, panelHeight: 190 })
const expanded = ref(false)
let observer: ResizeObserver | null = null
const measure = () => {
  if (root.value) bounds.value = { width: root.value.clientWidth, height: root.value.clientHeight, panelHeight: toolbar.value?.offsetHeight || 190 }
}
const closeOutside = (event: PointerEvent) => {
  if (toolbar.value && !toolbar.value.contains(event.target as Node)) { expanded.value = false }
}
onMounted(() => {
  document.addEventListener('pointerdown', closeOutside)
  observer = new ResizeObserver(measure)
  window.addEventListener('resize', measure)
  nextTick(() => { if (root.value) observer?.observe(root.value); if (toolbar.value) observer?.observe(toolbar.value); measure() })
})
onBeforeUnmount(() => { document.removeEventListener('pointerdown', closeOutside); observer?.disconnect(); window.removeEventListener('resize', measure) })
watch(() => props.visible, async () => { await nextTick(); if (root.value) observer?.observe(root.value); if (toolbar.value) observer?.observe(toolbar.value); measure() })
const toolbarStyle = computed(() => {
  const width = Math.min(360, Math.max(200, bounds.value.width - 16))
  const placement = getProductImageToolbarPlacement({
    targetLeft: Number(props.left),
    targetTop: Number(props.top),
    targetWidth: Number(props.width),
    targetHeight: Number(props.height),
    containerWidth: bounds.value.width,
    containerHeight: bounds.value.height,
    toolbarWidth: width,
    gap: 36,
    toolbarHeight: bounds.value.panelHeight
  })
  return {
    '--toolbar-left': `${Math.round(placement.left)}px`,
    '--toolbar-top': `${Math.round(placement.top)}px`,
    '--toolbar-width': `${width}px`
  }
})

</script>

<template>
  <div v-if="visible" ref="root" class="image-actions-root pointer-events-none absolute inset-0 z-[116]" @keydown.esc.stop="expanded = false">
    <section ref="toolbar" class="image-actions pointer-events-auto" :style="toolbarStyle" aria-label="Imagem do produto" @pointerdown.stop @mousedown.stop @click.stop>
      <div class="image-actions-header">
        <button type="button" class="image-action image-action-primary" title="Trocar a imagem e suas cópias neste produto" @click="emit('replace')"><ImagePlus /><span>Trocar</span></button>
        <button type="button" class="image-action" title="Duplicar imagem" @click="emit('duplicate')"><Copy /><span>Duplicar</span></button>
        <button type="button" class="image-action" aria-label="Reduzir imagem" title="Reduzir imagem" @click="emit('resize', 'smaller')"><Minus /><span>Diminuir</span></button>
        <button type="button" class="image-action" aria-label="Aumentar imagem" title="Aumentar imagem" @click="emit('resize', 'larger')"><Plus /><span>Aumentar</span></button>
        <button type="button" class="image-action image-action-settings" :aria-expanded="expanded" aria-label="Ajustar imagem" @click="expanded = !expanded"><SlidersHorizontal /><span>Ajustar</span><ChevronDown :class="{ 'rotate-180': expanded }" /></button>
        <button type="button" class="image-action image-action-remove" aria-label="Remover imagem" title="Remover imagem" @click="emit('remove')"><Trash2 /><span>Excluir</span></button>
      </div>
      <div class="image-actions-details" :class="{ 'is-expanded': expanded }">
        <div class="image-actions-fields">
          <label>Quantidade<select aria-label="Preenchimento de imagens" :value="fillCount ?? 1" @change="emit('fill', Number(($event.target as HTMLSelectElement).value), fillDirection)">
            <option value="0">Automática</option><option value="1">1 imagem</option><option value="2">2 imagens</option><option value="3">3 imagens</option><option value="4">4 imagens</option>
          </select></label>
          <label>Organização<select aria-label="Disposição das imagens" :value="fillDirection || 'auto'" @change="emit('fill', fillCount === 1 ? 0 : (fillCount ?? 0), ($event.target as HTMLSelectElement).value)">
            <option value="auto">Automática</option><option value="horizontal">Lado a lado</option><option value="vertical">Empilhadas</option>
          </select></label>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.image-actions { position:absolute;left:var(--toolbar-left);top:var(--toolbar-top);width:var(--toolbar-width);max-width:calc(100% - 16px);padding:10px;border:1px solid #ffffff24;border-radius:16px;background:#202024f5;color:#f4f4f5;box-shadow:0 12px 32px #0006;backdrop-filter:blur(16px);font-size:12px; }
.image-actions-header,.image-actions-tools {display:flex;align-items:center;gap:8px;}
.image-action {display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 10px;border-radius:9px;white-space:nowrap;transition:background .15s;}
.image-action:hover {background:#ffffff12;}
.image-action:focus-visible,select:focus-visible {outline:2px solid #a78bfa;outline-offset:2px;}
.image-action svg {width:17px;height:17px;flex-shrink:0;}
.image-action-primary {flex:1;background:#7c3aed26;color:#ddd6fe;font-weight:600;justify-content:flex-start;}
.image-action-primary:hover {background:#7c3aed45;}
.image-action-remove {color:#fda4af;}
.image-action-settings {display:inline-flex;}
.image-actions-details {display:none;border-top:1px solid #ffffff10;margin-top:8px;padding-top:10px;}
.image-actions-details.is-expanded {display:block;}
.image-actions-fields {display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.image-actions-fields label {min-width:0;color:#a1a1aa;font-size:11px;}
.image-actions-fields select {display:block;width:100%;min-height:40px;margin-top:4px;padding:0 8px;background:#303036;border:1px solid #ffffff12;border-radius:8px;color:#fafafa;font-size:13px;}
/* Floating controls never participate in the canvas layout. */
.image-actions-root {position:absolute;inset:0;pointer-events:none;z-index:116;}
.image-actions {box-sizing:border-box;pointer-events:auto;padding:6px;border-radius:14px;max-height:calc(100% - 16px);overflow:auto;}
.image-actions-header {gap:2px;}
.image-actions-header .image-action {flex:1;min-width:0;min-height:48px;flex-direction:column;gap:4px;padding:4px 5px;font-size:10px;}
.image-actions-header .image-action svg {width:19px;height:19px;}
.image-actions-header .image-action-primary {justify-content:center;}
.image-action-settings svg:last-child {display:none;}
@media(max-width:767px) {
.image-actions-fields select {font-size:16px;}
}
@media(prefers-reduced-motion:reduce) {.image-action {transition:none;}}
</style>
