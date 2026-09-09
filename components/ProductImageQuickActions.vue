<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ChevronDown, SlidersHorizontal, Copy, ImagePlus, Minus, Plus, Tag, Trash2 } from 'lucide-vue-next'
import { getProductImageToolbarPlacement } from '~/utils/productImageToolbarPlacement'

type TemplateOption = {
  id: string
  name: string
  previewDataUrl?: string
}

const props = withDefaults(defineProps<{
  visible: boolean
  top: number
  left: number
  width: number
  height: number
  templates?: TemplateOption[]
  selectedTemplateId?: string
  fillCount?: number
  fillDirection?: string
}>(), {
  templates: () => [],
  selectedTemplateId: ''
})

const emit = defineEmits<{
  (e: 'duplicate'): void
  (e: 'replace'): void
  (e: 'remove'): void
  (e: 'fill', count: number, direction?: string): void
  (e: 'resize', direction: 'smaller' | 'larger'): void
  (e: 'template', templateId: string): void
  (e: 'manage-templates'): void
}>()

const templateMenuOpen = ref(false)

const root = ref<HTMLElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)
const bounds = ref({ width: 800, height: 600, panelHeight: 190 })
const expanded = ref(false)
let observer: ResizeObserver | null = null
const measure = () => {
  if (root.value) bounds.value = { width: root.value.clientWidth, height: root.value.clientHeight, panelHeight: toolbar.value?.offsetHeight || 190 }
}
const closeOutside = (event: PointerEvent) => {
  if (toolbar.value && !toolbar.value.contains(event.target as Node)) { templateMenuOpen.value = false; expanded.value = false }
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
  const width = Math.min(420, Math.max(240, bounds.value.width - 16))
  const placement = getProductImageToolbarPlacement({
    targetLeft: Number(props.left),
    targetTop: Number(props.top),
    targetWidth: Number(props.width),
    targetHeight: Number(props.height),
    containerWidth: bounds.value.width,
    containerHeight: bounds.value.height,
    toolbarWidth: width,
    toolbarHeight: bounds.value.panelHeight
  })
  return {
    '--toolbar-left': `${Math.round(placement.left)}px`,
    '--toolbar-top': `${Math.round(placement.top)}px`,
    '--toolbar-width': `${width}px`
  }
})

const selectTemplate = (templateId: string) => {
  templateMenuOpen.value = false
  if (templateId) emit('template', templateId)
}

watch(() => props.visible, (visible) => {
  if (!visible) templateMenuOpen.value = false
})
</script>

<template>
  <div v-if="visible" ref="root" class="image-actions-root pointer-events-none absolute inset-0 z-[116]" @keydown.esc.stop="templateMenuOpen = false; expanded = false">
    <section ref="toolbar" class="image-actions pointer-events-auto" :style="toolbarStyle" aria-label="Imagem do produto" @pointerdown.stop @mousedown.stop @click.stop>
      <div class="image-actions-header">
        <button type="button" class="image-action image-action-primary" title="Trocar a imagem e suas cópias neste produto" @click="emit('replace')"><ImagePlus />Substituir imagem</button>
        <button type="button" class="image-action image-action-settings" :aria-expanded="expanded" aria-label="Ajustar imagem" @click="expanded = !expanded"><SlidersHorizontal /><span>Ajustar</span><ChevronDown :class="{ 'rotate-180': expanded }" /></button>
        <button type="button" class="image-action image-action-remove" aria-label="Remover imagem" title="Remover imagem" @click="emit('remove')"><Trash2 /></button>
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
        <div class="image-actions-tools">
          <button type="button" class="image-action" @click="emit('duplicate')"><Copy />Duplicar</button>
          <button type="button" class="image-action" :aria-expanded="templateMenuOpen" @click="templateMenuOpen = !templateMenuOpen"><Tag />Etiqueta</button>
          <div class="image-actions-size" role="group" aria-label="Tamanho da imagem"><button type="button" class="image-action" aria-label="Reduzir imagem" @click="emit('resize', 'smaller')"><Minus /></button><span>Tamanho</span><button type="button" class="image-action" aria-label="Aumentar imagem" @click="emit('resize', 'larger')"><Plus /></button></div>
        </div>
      </div>
      <div v-if="templateMenuOpen" class="image-template-list">
        <p>Etiqueta de preço</p>
        <button v-for="template in templates" :key="template.id" type="button" class="image-template-option" :aria-pressed="template.id === selectedTemplateId" @click="selectTemplate(template.id)">
          <img v-if="template.previewDataUrl" :src="template.previewDataUrl" alt="" /><Tag v-else /><span>{{ template.name }}</span><span v-if="template.id === selectedTemplateId">Atual</span>
        </button>
        <button v-if="!templates.length" type="button" class="image-action" @click="emit('manage-templates')">Abrir biblioteca de etiquetas</button>
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
.image-action-settings {display:none;}
.image-actions-details {border-top:1px solid #ffffff10;margin-top:8px;padding-top:10px;}
.image-actions-fields {display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.image-actions-fields label {min-width:0;color:#a1a1aa;font-size:11px;}
.image-actions-fields select {display:block;width:100%;min-height:40px;margin-top:4px;padding:0 8px;background:#303036;border:1px solid #ffffff12;border-radius:8px;color:#fafafa;font-size:13px;}
.image-actions-tools {margin-top:8px;gap:2px;justify-content:space-between;}
.image-actions-size {display:flex;align-items:center;border-left:1px solid #ffffff15;padding-left:4px;}
.image-actions-size span {font-size:10px;color:#a1a1aa;}
.image-template-list {max-height:220px;overflow:auto;overscroll-behavior:contain;border-top:1px solid #ffffff15;margin-top:8px;padding-top:8px;}
.image-template-list p {font-size:11px;color:#a1a1aa;margin:0 6px 8px;}
.image-template-option {display:flex;align-items:center;gap:8px;width:100%;min-height:48px;padding:6px;border-radius:8px;text-align:left;}
.image-template-option:hover,.image-template-option[aria-pressed=true] {background:#7c3aed26;}
.image-template-option img {width:36px;height:32px;object-fit:contain;}
.image-template-option span:first-of-type {flex:1;}
@media(max-width:767px) {
.image-actions {position:fixed;left:8px;right:8px;top:auto;bottom:calc(76px + env(safe-area-inset-bottom, 0px));width:auto;max-width:none;max-height:45dvh;overflow:auto;padding:8px;border-radius:16px;}
.image-action {min-height:44px;min-width:44px;padding:0 8px;}
.image-action-primary {min-width:0;white-space:normal;text-align:left;}
.image-action-settings {display:inline-flex;}
.image-action-settings svg:last-child {width:12px;}
.image-actions-details {display:none;}
.image-actions-details.is-expanded {display:block;}
.image-actions-fields select {min-height:44px;font-size:16px;}
.image-actions-tools {flex-wrap:wrap;}
.image-actions-size {margin-left:auto;}
}
@media(prefers-reduced-motion:reduce) {.image-action {transition:none;}}
</style>
