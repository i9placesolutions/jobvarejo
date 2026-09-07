<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, Copy, Maximize2, Plus } from 'lucide-vue-next'
import { FLYER_TEMPLATE_FORMATS, type FlyerTemplateFormatId } from '~/utils/flyerTemplateApi'

const mobileOptionsOpen = ref(false)
const props = defineProps<{
  currentPageId?: string
  pageNumber: number
  pageCount: number
  modelName: string
  formatLabel: string
  width: number
  height: number
  busy?: boolean
}>()

const emit = defineEmits<{
  (event: 'duplicate-page', pageId: string): void
  (event: 'add-page', formatId: FlyerTemplateFormatId): void
  (event: 'resize-page', formatId: FlyerTemplateFormatId): void
}>()

const addMenuOpen = ref(false)
const resizeMenuOpen = ref(false)

const pageLabel = computed(() => `Página ${Math.max(1, props.pageNumber)} de ${Math.max(1, props.pageCount)}`)
const dimensionsLabel = computed(() => {
  const width = Number(props.width || 0)
  const height = Number(props.height || 0)
  return width > 0 && height > 0 ? `${width}×${height}` : 'tamanho livre'
})

const closeMenus = () => {
  addMenuOpen.value = false
  resizeMenuOpen.value = false
}

const toggleAddMenu = () => {
  resizeMenuOpen.value = false
  addMenuOpen.value = !addMenuOpen.value
}

const toggleResizeMenu = () => {
  addMenuOpen.value = false
  resizeMenuOpen.value = !resizeMenuOpen.value
}

const duplicateCurrentPage = () => {
  const pageId = String(props.currentPageId || '').trim()
  if (!pageId || props.busy) return
  closeMenus()
  emit('duplicate-page', pageId)
}

const addPage = (formatId: FlyerTemplateFormatId) => {
  closeMenus()
  emit('add-page', formatId)
}

const resizePage = (formatId: FlyerTemplateFormatId) => {
  const pageId = String(props.currentPageId || '').trim()
  if (!pageId || props.busy) return
  closeMenus()
  emit('resize-page', formatId)
}

watch(() => props.currentPageId, closeMenus)
</script>

<template>
  <div
    class="quick-mode-page-toolbar"
    :data-mobile-expanded="mobileOptionsOpen"
    role="toolbar"
    aria-label="Controles da página aberta"
    @click.stop
    @pointerdown.stop
    @keydown.esc="closeMenus"
  >
    <div class="quick-mode-page-toolbar__identity">
      <span class="quick-mode-page-toolbar__eyebrow">Página aberta · {{ pageLabel }}</span>
      <strong>{{ props.modelName || 'Modelo' }}</strong>
      <small>{{ props.formatLabel || 'Formato livre' }} · {{ dimensionsLabel }}</small>
    </div>

    <button type="button" class="quick-page-options" :aria-expanded="mobileOptionsOpen" @click="mobileOptionsOpen = !mobileOptionsOpen">Opções <ChevronDown :size="14" /></button>
    <div class="quick-mode-page-toolbar__actions">
      <button
        type="button"
        class="quick-mode-page-toolbar__action quick-mode-page-toolbar__action--primary"
        :disabled="!props.currentPageId || props.busy"
        aria-label="Duplicar página atual"
        title="Duplicar página atual"
        @click="duplicateCurrentPage"
      >
        <Copy class="h-4 w-4" aria-hidden="true" />
        <span>Duplicar atual</span>
      </button>

      <div class="quick-mode-page-toolbar__menu-wrap">
        <button
          type="button"
          class="quick-mode-page-toolbar__action"
          :aria-expanded="addMenuOpen"
          aria-haspopup="menu"
          aria-label="Criar nova página"
          title="Criar nova página"
          @click="toggleAddMenu"
        >
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span>Nova página</span>
          <ChevronDown class="quick-mode-page-toolbar__action-chevron" :class="addMenuOpen ? 'rotate-180' : ''" aria-hidden="true" />
        </button>

        <div v-if="addMenuOpen" class="quick-mode-page-toolbar__menu" role="menu" aria-label="Formato da nova página">
          <span class="quick-mode-page-toolbar__menu-label">Nova página no mesmo tema</span>
          <button v-for="format in FLYER_TEMPLATE_FORMATS" :key="`toolbar-add-${format.id}`" type="button" role="menuitem" @click="addPage(format.id)">
            <strong>{{ format.label }}</strong>
            <small>{{ format.width }}×{{ format.height }}</small>
          </button>
        </div>
      </div>

      <div class="quick-mode-page-toolbar__menu-wrap">
        <button
          type="button"
          class="quick-mode-page-toolbar__action"
          :aria-expanded="resizeMenuOpen"
          aria-haspopup="menu"
          aria-label="Redimensionar página atual"
          title="Redimensionar página atual"
          :disabled="!props.currentPageId || props.busy"
          @click="toggleResizeMenu"
        >
          <Maximize2 class="h-4 w-4" aria-hidden="true" />
          <span>Redimensionar</span>
          <ChevronDown class="quick-mode-page-toolbar__action-chevron" :class="resizeMenuOpen ? 'rotate-180' : ''" aria-hidden="true" />
        </button>

        <div v-if="resizeMenuOpen" class="quick-mode-page-toolbar__menu" role="menu" aria-label="Novo formato da página">
          <span class="quick-mode-page-toolbar__menu-label">Novo formato da página</span>
          <button v-for="format in FLYER_TEMPLATE_FORMATS" :key="`toolbar-resize-${format.id}`" type="button" role="menuitem" @click="resizePage(format.id)">
            <strong>{{ format.label }}</strong>
            <small>{{ format.width }}×{{ format.height }}</small>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-mode-page-toolbar {
  position: relative;
  z-index: 240;
  display: flex;
  align-items: center;
  gap: 7px;
  width: max-content;
  max-width: min(calc(100% - 24px), 920px);
  border: 1px solid rgba(159, 192, 255, 0.34);
  border-radius: 11px;
  background: rgba(25, 34, 48, 0.94);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.34), 0 0 0 3px rgba(76, 139, 245, 0.08);
  color: #fff;
  padding: 5px 6px;
  backdrop-filter: blur(14px);
}

.quick-mode-page-toolbar__identity {
  display: grid;
  min-width: 140px;
  gap: 2px;
  padding: 1px 7px 1px 5px;
}

.quick-mode-page-toolbar__identity strong,
.quick-mode-page-toolbar__identity small,
.quick-mode-page-toolbar__eyebrow {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-page-toolbar__eyebrow {
  margin: 0;
  color: #9fc0ff;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.11em;
  line-height: 1.1;
  text-transform: uppercase;
}

.quick-mode-page-toolbar__identity strong {
  color: rgba(255, 255, 255, 0.95);
  font-size: 12px;
  line-height: 1.2;
}

.quick-mode-page-toolbar__identity small {
  color: rgba(255, 255, 255, 0.56);
  font-size: 9px;
  line-height: 1.15;
}

.quick-mode-page-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-mode-page-toolbar__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  padding: 0 8px;
  font-size: 9px;
  font-weight: 800;
  white-space: nowrap;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.quick-mode-page-toolbar__action:hover:not(:disabled),
.quick-mode-page-toolbar__action[aria-expanded='true'] {
  border-color: rgba(159, 192, 255, 0.72);
  background: rgba(76, 139, 245, 0.18);
  color: #fff;
}

.quick-mode-page-toolbar__action:active:not(:disabled) {
  transform: translateY(1px);
}

.quick-mode-page-toolbar__action--primary {
  border-color: rgba(76, 139, 245, 0.68);
  background: rgba(76, 139, 245, 0.17);
}

.quick-mode-page-toolbar__action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.quick-mode-page-toolbar__action-chevron {
  width: 12px;
  height: 12px;
  transition: transform 0.16s ease;
}

.quick-mode-page-toolbar__menu-wrap {
  position: relative;
}

.quick-mode-page-toolbar__menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  width: 248px;
  border: 1px solid rgba(159, 192, 255, 0.42);
  border-radius: 10px;
  background: linear-gradient(160deg, #253954 0%, #1b2029 100%);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.38);
  padding: 8px;
}

.quick-mode-page-toolbar__menu-label {
  grid-column: 1 / -1;
  color: rgba(255, 255, 255, 0.58);
  font-size: 9px;
  line-height: 1.25;
}

.quick-mode-page-toolbar__menu button {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 5px;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  padding: 7px;
  text-align: left;
}

.quick-mode-page-toolbar__menu button:hover {
  border-color: rgba(159, 192, 255, 0.72);
  background: rgba(76, 139, 245, 0.18);
  color: #fff;
}

.quick-mode-page-toolbar__menu strong,
.quick-mode-page-toolbar__menu small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-page-toolbar__menu strong {
  font-size: 9px;
  line-height: 1.2;
}

.quick-mode-page-toolbar__menu small {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 8px;
}

@media (max-width: 767px) {
  .quick-mode-page-toolbar {
    width: calc(100% - 20px);
    max-width: calc(100% - 20px);
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px;
  }

  .quick-mode-page-toolbar__identity {
    flex: 1 1 150px;
    min-width: 0;
  }

  .quick-mode-page-toolbar__actions {
    flex: 1 1 100%;
  }

  .quick-mode-page-toolbar__menu-wrap,
  .quick-mode-page-toolbar__action {
    flex: 1 1 0;
  }

  .quick-mode-page-toolbar__action {
    min-width: 0;
    padding: 0 7px;
  }

  .quick-mode-page-toolbar__menu {
    right: 0;
    max-width: calc(100vw - 32px);
  }
}
</style>

<style scoped>
@media(max-width:767px) {
 .quick-mode-page-toolbar button { min-height:44px; }
 .quick-mode-page-toolbar__menu strong { font-size:12px; }
 .quick-mode-page-toolbar__menu small { font-size:10px; }
}
</style>

<style scoped>
.quick-page-options {display:none;}
@media(max-width:767px) {
 .quick-mode-page-toolbar {background:#18181b;border-color:#ffffff14;border-radius:12px;box-shadow:none;}
 .quick-mode-page-toolbar__identity {flex:1;}
 .quick-mode-page-toolbar__eyebrow {font-size:9px;}
 .quick-page-options {display:flex;align-items:center;gap:6px;min-height:44px;padding:0 10px;color:#c4b5fd;font-size:12px;}
 .quick-mode-page-toolbar[data-mobile-expanded=false] .quick-mode-page-toolbar__actions {display:none;}
}
</style>
