<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  LocateFixed,
  Maximize2,
  Move,
  Palette,
  Type,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'
import { AVAILABLE_FONT_FAMILIES } from '~/utils/font-catalog'
import type { QuickEditableColorTarget } from '~/utils/quickModeNativeTools'

const QUICK_COLOR_SWATCHES = [
  '#172033',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6'
]

const props = defineProps<{
  currentZoom: number
  nativeTextCount: number
  nativeColorCount: number
  colorTargets?: QuickEditableColorTarget[]
  selectedColorObjectId?: string
  nativeFontFamily?: string
  nativeFontSize?: number
  typography?: { height?: number; lineHeight?: number; charSpacing?: number }
  selectedText?: boolean
  applyAllLabel?: string
  busy?: boolean
}>()

const emit = defineEmits<{
  (event: 'zoom-in'): void
  (event: 'zoom-out'): void
  (event: 'zoom-fit'): void
  (event: 'set-zoom', value: number): void
  (event: 'pan', payload: { x: number; y: number }): void
  (event: 'apply-font', value: string): void
  (event: 'apply-font-size', value: number): void
  (event: 'apply-to-all'): void
  (event: 'apply-typography', value: { property: string; value: number | string }): void
  (event: 'apply-color', payload: { targetId: string; value: string }): void
  (event: 'clear-color', targetId: string): void
  (event: 'apply-opacity', payload: { targetId: string; value: number }): void
}>()

const openPanel = ref<'pan' | 'font' | 'color' | null>(null)
const customColor = ref('#ef4444')
const fontSearch = ref('')
const filteredFonts = computed(() => [...new Set([...(props.nativeFontFamily && props.nativeFontFamily !== 'Várias' ? [props.nativeFontFamily] : []), ...AVAILABLE_FONT_FAMILIES])].filter(font => font.toLocaleLowerCase().includes(fontSearch.value.trim().toLocaleLowerCase())))
const fontControls = computed(() => [
  { key: 'fontSize', label: 'Tamanho', unit: 'px', min: 1, value: props.nativeFontSize },
  { key: 'height', label: 'Altura do campo', unit: 'px', min: 1, value: props.typography?.height },
  { key: 'charSpacing', label: 'Entre letras', unit: '%', min: -100, value: props.typography?.charSpacing == null ? undefined : props.typography.charSpacing / 10 },
  { key: 'lineHeight', label: 'Entrelinhas', unit: '%', min: 10, value: props.typography?.lineHeight == null ? undefined : props.typography.lineHeight * 100 }
])
const updateFontControl = (key: string, event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.value || !Number.isFinite(Number(input.value))) return
  const value = Math.round(Number(input.value))
  input.value = String(value)
  if (key === 'fontSize') emit('apply-font-size', value)
  else emit('apply-typography', { property: key, value: key === 'lineHeight' ? value / 100 : key === 'charSpacing' ? value * 10 : value })
}
const selectedColorTargetId = ref('')

const zoomValue = computed({
  get: () => Math.max(15, Math.min(400, Math.round(Number(props.currentZoom || 100)))),
  set: value => emit('set-zoom', Math.max(15, Math.min(400, Math.round(Number(value || 100)))))
})

const zoomLabel = computed(() => `${zoomValue.value}%`)
const fontLabel = computed(() => {
  const value = String(props.nativeFontFamily || '').trim()
  return value || 'Fonte'
})
const hasNativeText = computed(() => props.nativeTextCount > 0)
const colorTargets = computed(() => {
  const targets = Array.isArray(props.colorTargets) ? props.colorTargets : []
  const selected = targets.find(target => target.id === 'selected-card-backgrounds')
  if (!selected) return targets
  const objects = new Set(selected.objects.map(entry => entry.object))
  return targets.filter(target => target === selected || !target.objects.every(entry => objects.has(entry.object)))
})
const colorTargetCount = computed(() => colorTargets.value.length || props.nativeColorCount)
const hasNativeColor = computed(() => colorTargetCount.value > 0)
const selectedColorTarget = computed(() => (
  colorTargets.value.find(target => target.id === selectedColorTargetId.value) || colorTargets.value[0] || null
))
const selectedColorInput = computed(() => {
  const color = String(selectedColorTarget.value?.color || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map(char => `${char}${char}`).join('')}`
  }
  return customColor.value
})
const selectedOpacity = computed(() => Math.round(Math.max(0, Math.min(1, Number(selectedColorTarget.value?.opacity ?? 1))) * 100))

watch(() => props.selectedColorObjectId, id => {
  const target = colorTargets.value.find(item => item.objects.some(entry => entry.object?._customId === id))
  if (target) selectedColorTargetId.value = target.id
})

watch(colorTargets, targets => {
  if (targets.some(target => target.id === 'selected-card-backgrounds')) {
    selectedColorTargetId.value = 'selected-card-backgrounds'
    return
  }
  if (!targets.some(target => target.id === selectedColorTargetId.value)) {
    selectedColorTargetId.value = targets[0]?.id || ''
  }
}, { immediate: true })

watch(selectedColorTarget, target => {
  const color = String(target?.color || '').trim().toLowerCase()
  if (/^#[0-9a-f]{3,6}$/i.test(color)) {
    customColor.value = color.length === 4
      ? `#${color.slice(1).split('').map(char => `${char}${char}`).join('')}`
      : color
  }
})

const togglePanel = (panel: 'pan' | 'font' | 'color') => {
  openPanel.value = openPanel.value === panel ? null : panel
}

const closePanel = () => {
  openPanel.value = null
}

const chooseFont = (font: string) => {
  if (!hasNativeText.value || props.busy) return
  // O pai aplica a fonte apenas aos textos nativos encontrados no canvas.
  emit('apply-font', font)
  closePanel()
}

const chooseColor = (color: string) => {
  const target = selectedColorTarget.value
  if (!target || props.busy) return
  customColor.value = color
  emit('apply-color', { targetId: target.id, value: color })
}

const applyCustomColor = () => chooseColor(customColor.value)

const selectColorTarget = (targetId: string) => {
  if (props.busy) return
  selectedColorTargetId.value = targetId
}

const clearSelectedColor = () => {
  const target = selectedColorTarget.value
  if (!target || props.busy) return
  emit('clear-color', target.id)
}

const applySelectedOpacity = (event: Event) => {
  const target = selectedColorTarget.value
  const input = event.target as HTMLInputElement | null
  if (!target || props.busy) return
  emit('apply-opacity', {
    targetId: target.id,
    value: Math.max(0, Math.min(100, Number(input?.value || 100))) / 100
  })
}

const onZoomInput = (event: Event) => {
  const input = event.target as HTMLInputElement | null
  emit('set-zoom', Number(input?.value || 100))
}

</script>

<template>
  <div
    class="quick-mode-canvas-controls"
    role="toolbar"
    aria-label="Controles da pré-visualização"
    @click.stop
    @pointerdown.stop
    @keydown.esc="closePanel"
  >
    <div class="quick-mode-canvas-controls__group quick-mode-canvas-controls__zoom" aria-label="Zoom">
      <button type="button" class="quick-mode-canvas-controls__icon-button" aria-label="Diminuir zoom" title="Diminuir zoom" @click="emit('zoom-out')">
        <ZoomOut :size="15" aria-hidden="true" />
      </button>
      <label class="quick-mode-canvas-controls__zoom-value" title="Escolha o nível de zoom">
        <span>{{ zoomLabel }}</span>
        <input :value="zoomValue" type="range" min="15" max="400" step="1" aria-label="Nível de zoom" @input="onZoomInput" />
      </label>
      <button type="button" class="quick-mode-canvas-controls__icon-button" aria-label="Aumentar zoom" title="Aumentar zoom" @click="emit('zoom-in')">
        <ZoomIn :size="15" aria-hidden="true" />
      </button>
      <button type="button" class="quick-mode-canvas-controls__fit" title="Ajustar página na tela" @click="emit('zoom-fit')">
        <Maximize2 :size="14" aria-hidden="true" />
        <span>Ajustar</span>
      </button>
    </div>

    <div class="quick-mode-canvas-controls__divider" aria-hidden="true"></div>

    <div class="quick-mode-canvas-controls__group quick-mode-canvas-controls__tool-group">
      <div class="quick-mode-canvas-controls__popover-wrap">
        <button
          type="button"
          class="quick-mode-canvas-controls__tool-button"
          :class="{ 'is-active': openPanel === 'pan' }"
          :aria-expanded="openPanel === 'pan'"
          aria-haspopup="dialog"
          title="Rolar a pré-visualização"
          @click="togglePanel('pan')"
        >
          <Move :size="16" aria-hidden="true" />
          <span>Rolar</span>
        </button>
        <div v-if="openPanel === 'pan'" class="quick-mode-canvas-controls__popover quick-mode-canvas-controls__pan-popover" role="dialog" aria-label="Rolar página">
          <div class="quick-mode-canvas-controls__popover-title">Rolar página</div>
          <div class="quick-mode-canvas-controls__pan-pad">
            <span></span>
            <button type="button" aria-label="Rolar para cima" title="Para cima" @click="emit('pan', { x: 0, y: 120 })"><ArrowUp :size="16" /></button>
            <span></span>
            <button type="button" aria-label="Rolar para a esquerda" title="Para a esquerda" @click="emit('pan', { x: 120, y: 0 })"><ArrowLeft :size="16" /></button>
            <button type="button" aria-label="Centralizar página" title="Centralizar" @click="emit('zoom-fit')"><LocateFixed :size="16" /></button>
            <button type="button" aria-label="Rolar para a direita" title="Para a direita" @click="emit('pan', { x: -120, y: 0 })"><ArrowRight :size="16" /></button>
            <span></span>
            <button type="button" aria-label="Rolar para baixo" title="Para baixo" @click="emit('pan', { x: 0, y: -120 })"><ArrowDown :size="16" /></button>
            <span></span>
          </div>
          <small>Use também a roda do mouse ou trackpad sobre a página.</small>
        </div>
      </div>

      <div class="quick-mode-canvas-controls__popover-wrap">
        <button
          type="button"
          class="quick-mode-canvas-controls__tool-button"
          :class="{ 'is-active': openPanel === 'font' }"
          :aria-expanded="openPanel === 'font'"
          aria-haspopup="dialog"
          aria-label="Fontes dos elementos nativos"
          title="Alterar fonte dos textos nativos"
          @click="togglePanel('font')"
        >
          <Type :size="16" aria-hidden="true" />
          <span>Fontes</span>
          <em>{{ nativeTextCount }}</em>
        </button>
        <div v-if="openPanel === 'font'" class="quick-mode-canvas-controls__popover quick-mode-canvas-controls__font-popover" role="dialog" aria-label="Fontes editáveis">
          <div class="quick-mode-canvas-controls__popover-title">Texto</div>
          <template v-if="hasNativeText">
            <p>{{ selectedText ? 'Texto selecionado' : `${nativeTextCount} texto${nativeTextCount === 1 ? '' : 's'} na página` }}</p>
            <div class="font-current"><strong>{{ fontLabel }}</strong><span>{{ nativeFontSize == null ? 'Vários tamanhos' : `${Math.round(nativeFontSize)} px` }}</span></div>
            <button type="button" class="font-apply-all" :disabled="!selectedText || busy" @click="emit('apply-to-all')">{{ applyAllLabel || 'Aplicar a todos os textos da página' }}</button>
            <p v-if="!selectedText">Selecione um texto para copiar sua configuração.</p>
            <div class="font-controls-grid">
              <label v-for="control in fontControls" :key="control.key" class="font-control">
                <span>{{ control.label }}</span>
                <div class="font-number">
                  <input type="number" :aria-label="control.label" step="1" :min="control.min" :value="control.value == null ? undefined : Math.round(control.value)" placeholder="—" @input="updateFontControl(control.key, $event)" />
                  <span>{{ control.unit }}</span>
                </div>
              </label>
            </div>
            <div class="font-case" aria-label="Maiúsculas e minúsculas">
              <button v-for="option in [{ value: 'upper', label: 'AA', title: 'Maiúsculas' }, { value: 'lower', label: 'aa', title: 'Minúsculas' }, { value: 'none', label: 'Aa', title: 'Original' }]" :key="option.value" type="button" :aria-label="option.title" :title="option.title" @click="emit('apply-typography', { property: 'textCase', value: option.value })"><strong>{{ option.label }}</strong><span>{{ option.title }}</span></button>
            </div>
            <input v-model="fontSearch" type="search" placeholder="Pesquisar fonte..." aria-label="Pesquisar fonte" class="font-search" />
            <p v-if="!filteredFonts.length">Nenhuma fonte encontrada.</p>
            <button v-for="font in filteredFonts" :key="font" type="button" class="quick-mode-canvas-controls__font-option" :class="{ 'is-selected': font === fontLabel }" :style="{ fontFamily: font }" @click="chooseFont(font)">
              <span>{{ font }}</span>
              <small v-if="font === fontLabel">Atual</small>
            </button>
          </template>
          <p v-else class="quick-mode-canvas-controls__empty">Este modelo não possui textos nativos editáveis. Selecione uma página com textos editáveis.</p>
        </div>
      </div>

      <div class="quick-mode-canvas-controls__popover-wrap">
        <button
          type="button"
          class="quick-mode-canvas-controls__tool-button"
          :class="{ 'is-active': openPanel === 'color' }"
          :aria-expanded="openPanel === 'color'"
          aria-haspopup="dialog"
          aria-label="Cores editáveis desta página"
          title="Alterar cores editáveis desta página"
          @click="togglePanel('color')"
        >
          <Palette :size="16" aria-hidden="true" />
          <span>Cores</span>
          <em>{{ colorTargetCount }}</em>
        </button>
        <div v-if="openPanel === 'color'" class="quick-mode-canvas-controls__popover quick-mode-canvas-controls__color-popover" role="dialog" aria-label="Cores editáveis">
          <div class="quick-mode-canvas-controls__popover-title">Cores desta página</div>
          <template v-if="hasNativeColor">
            <p>Selecione um card ou use Shift + clique para selecionar vários.</p>
            <div class="quick-mode-canvas-controls__color-targets" role="list" aria-label="Alvos de cor">
              <button
                v-for="target in colorTargets"
                :key="target.id"
                type="button"
                class="quick-mode-canvas-controls__color-target"
                :class="{ 'is-selected': selectedColorTarget?.id === target.id }"
                :aria-pressed="selectedColorTarget?.id === target.id"
                @click="selectColorTarget(target.id)"
              >
                <span class="quick-mode-canvas-controls__target-swatch" :class="{ 'is-empty': !target.color, 'is-mixed': target.mixedColor }" :style="target.color ? { backgroundColor: target.color } : undefined" aria-hidden="true"></span>
                <span class="quick-mode-canvas-controls__target-copy">
                  <strong>{{ target.label }}</strong>
                  <small>{{ target.id === 'selected-card-backgrounds' ? 'Selecionado no encarte' : target.description }}</small>
                </span>
                <span class="quick-mode-canvas-controls__target-check" aria-hidden="true">{{ selectedColorTarget?.id === target.id ? '✓' : '›' }}</span>
              </button>
            </div>
            <div v-if="selectedColorTarget" class="quick-mode-canvas-controls__color-editor">
              <div class="quick-mode-canvas-controls__color-editor-heading">
                <div>
                  <strong>{{ selectedColorTarget.label }}</strong>
                  <small>{{ selectedColorTarget.description }}</small>
                </div>
                <span v-if="selectedColorTarget.mixedColor" class="quick-mode-canvas-controls__mixed-label">Várias</span>
              </div>
            <div class="quick-mode-canvas-controls__swatches" role="list" aria-label="Paleta rápida">
                <button v-for="color in QUICK_COLOR_SWATCHES" :key="color" type="button" class="quick-mode-canvas-controls__swatch" :class="{ 'is-current': selectedColorInput === color }" :style="{ backgroundColor: color }" :aria-label="`Aplicar cor ${color} em ${selectedColorTarget.label}`" :title="color" @click="chooseColor(color)"></button>
            </div>
            <label class="quick-mode-canvas-controls__custom-color">
              <span>Escolher outra cor</span>
                <input v-model="customColor" type="color" aria-label="Escolher outra cor" @change="applyCustomColor" />
            </label>
              <div class="quick-mode-canvas-controls__opacity-control">
                <div class="quick-mode-canvas-controls__opacity-heading">
                  <span>Transparência</span>
                  <output>{{ selectedOpacity }}%</output>
                </div>
                <input :value="selectedOpacity" type="range" min="0" max="100" step="1" aria-label="Transparência do alvo selecionado" @input="applySelectedOpacity" />
              </div>
              <button v-if="selectedColorTarget.canClear" type="button" class="quick-mode-canvas-controls__clear-color" @click="clearSelectedColor">Deixar sem cor</button>
            </div>
          </template>
          <p v-else class="quick-mode-canvas-controls__empty">Não há formas editáveis nesta página. Imagens, fundo da arte e dados automáticos ficam protegidos.</p>
          <small>Imagens de fundo e de produtos nunca recebem cor. As etiquetas originais também não são alteradas.</small>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-mode-canvas-controls {
  position: relative;
  z-index: 245;
  display: flex;
  align-items: center;
  gap: 3px;
  width: max-content;
  max-width: min(calc(100% - 28px), 640px);
  border: 1px solid rgba(159, 192, 255, 0.18);
  border-radius: 9px;
  background: rgba(18, 23, 32, 0.82);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
  color: rgba(255, 255, 255, 0.82);
  padding: 3px 4px;
  backdrop-filter: blur(12px);
}

.quick-mode-canvas-controls__group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-mode-canvas-controls__divider {
  width: 1px;
  align-self: stretch;
  margin: 2px 1px;
  background: rgba(255, 255, 255, 0.1);
}

.quick-mode-canvas-controls button {
  font: inherit;
}

.quick-mode-canvas-controls__icon-button,
.quick-mode-canvas-controls__fit,
.quick-mode-canvas-controls__tool-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 24px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.quick-mode-canvas-controls__icon-button {
  width: 28px;
}

.quick-mode-canvas-controls__fit,
.quick-mode-canvas-controls__tool-button {
  padding: 0 6px;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.quick-mode-canvas-controls__icon-button:hover,
.quick-mode-canvas-controls__fit:hover,
.quick-mode-canvas-controls__tool-button:hover:not(:disabled),
.quick-mode-canvas-controls__tool-button.is-active {
  border-color: rgba(159, 192, 255, 0.42);
  background: rgba(76, 139, 245, 0.17);
  color: #fff;
}

.quick-mode-canvas-controls button:active:not(:disabled) {
  transform: translateY(1px);
}

.quick-mode-canvas-controls button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.quick-mode-canvas-controls__zoom-value {
  display: inline-flex;
  align-items: center;
  width: auto;
  min-width: 68px;
  gap: 4px;
  cursor: pointer;
}

.quick-mode-canvas-controls__zoom-value > span {
  color: rgba(255, 255, 255, 0.94);
  flex: 0 0 auto;
  font-size: 8px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.quick-mode-canvas-controls__zoom-value input {
  width: 42px;
  height: 3px;
  flex: 0 0 42px;
  accent-color: #79a8ff;
  cursor: pointer;
}

.quick-mode-canvas-controls__popover-wrap {
  position: relative;
}

.quick-mode-canvas-controls__tool-button em {
  min-width: 14px;
  border-radius: 999px;
  background: rgba(159, 192, 255, 0.16);
  color: #a9c7ff;
  font-size: 7px;
  font-style: normal;
  line-height: 13px;
  text-align: center;
}

.quick-mode-canvas-controls__popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  width: 260px;
  max-height: min(440px, calc(100vh - 130px));
  overflow: auto;
  border: 1px solid rgba(159, 192, 255, 0.36);
  border-radius: 13px;
  background: rgba(25, 34, 48, 0.98);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.48);
  padding: 12px;
}

.quick-mode-canvas-controls__popover-title {
  color: #a9c7ff;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.quick-mode-canvas-controls__popover p,
.quick-mode-canvas-controls__popover > small {
  display: block;
  margin: 5px 0 10px;
  color: rgba(255, 255, 255, 0.56);
  font-size: 10px;
  line-height: 1.4;
}

.quick-mode-canvas-controls__popover p.quick-mode-canvas-controls__empty {
  margin: 12px 0 4px;
  border: 1px solid rgba(159, 192, 255, 0.16);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.045);
  color: rgba(255, 255, 255, 0.68);
  padding: 10px;
}

.quick-mode-canvas-controls__pan-popover {
  width: 210px;
}

.quick-mode-canvas-controls__pan-pad {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  justify-content: center;
  gap: 5px;
  margin: 12px 0 10px;
}

.quick-mode-canvas-controls__pan-pad button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(159, 192, 255, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #d8e5ff;
}

.quick-mode-canvas-controls__pan-pad button:hover {
  border-color: rgba(159, 192, 255, 0.7);
  background: rgba(76, 139, 245, 0.22);
}

.quick-mode-canvas-controls__font-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  padding: 7px 8px;
  text-align: left;
}

.quick-mode-canvas-controls__font-option:hover,
.quick-mode-canvas-controls__font-option.is-selected {
  background: rgba(76, 139, 245, 0.18);
  color: #fff;
}

.quick-mode-canvas-controls__font-option small {
  color: #a9c7ff;
  font-size: 9px;
  font-weight: 800;
}

.quick-mode-canvas-controls__swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 12px 0;
}

.quick-mode-canvas-controls__color-popover {
  width: 320px;
  background: #242528;
}

.quick-mode-canvas-controls__color-targets {
  display: grid;
  gap: 5px;
  margin: 10px 0 12px;
  max-height: 180px;
  overflow-y: auto;
}

.quick-mode-canvas-controls__color-target {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
  border: 1px solid rgba(159, 192, 255, 0.14);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.045);
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  padding: 8px;
  text-align: left;
  transition: background-color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.quick-mode-canvas-controls__color-target:hover,
.quick-mode-canvas-controls__color-target.is-selected {
  border-color: rgba(121, 168, 255, 0.7);
  background: rgba(76, 139, 245, 0.18);
  transform: translateY(-1px);
}

.quick-mode-canvas-controls__target-swatch {
  display: block;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 7px;
  background-image: linear-gradient(45deg, rgba(255,255,255,.18) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.18) 75%), linear-gradient(45deg, rgba(255,255,255,.18) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.18) 75%);
  background-position: 0 0, 5px 5px;
  background-size: 10px 10px;
  background-color: rgba(0, 0, 0, 0.22);
}

.quick-mode-canvas-controls__target-swatch.is-empty::after {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(135deg, transparent 45%, #f87171 46%, #f87171 54%, transparent 55%);
  content: '';
}

.quick-mode-canvas-controls__target-swatch.is-mixed {
  background: conic-gradient(#ef4444 0 25%, #facc15 0 50%, #3b82f6 0 75%, #22c55e 0);
}

.quick-mode-canvas-controls__target-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.quick-mode-canvas-controls__target-copy strong,
.quick-mode-canvas-controls__color-editor-heading strong {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.93);
  font-size: 10px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-canvas-controls__target-copy small,
.quick-mode-canvas-controls__color-editor-heading small {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.52);
  font-size: 9px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-mode-canvas-controls__target-check {
  color: #a9c7ff;
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
}

.quick-mode-canvas-controls__color-editor {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.quick-mode-canvas-controls__color-editor-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.quick-mode-canvas-controls__color-editor-heading > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.quick-mode-canvas-controls__mixed-label {
  flex: 0 0 auto;
  border-radius: 999px;
  background: rgba(159, 192, 255, 0.16);
  color: #a9c7ff;
  font-size: 8px;
  font-weight: 800;
  padding: 3px 6px;
}

.quick-mode-canvas-controls__opacity-control {
  margin-top: 10px;
}

.quick-mode-canvas-controls__opacity-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(255, 255, 255, 0.68);
  font-size: 9px;
  font-weight: 700;
}

.quick-mode-canvas-controls__opacity-heading output {
  color: #a9c7ff;
  font-variant-numeric: tabular-nums;
}

.quick-mode-canvas-controls__opacity-control input {
  width: 100%;
  height: 4px;
  margin-top: 7px;
  accent-color: #79a8ff;
  cursor: pointer;
}

.quick-mode-canvas-controls__clear-color {
  width: 100%;
  margin-top: 10px;
  border: 1px solid rgba(248, 113, 113, 0.38);
  border-radius: 8px;
  background: rgba(248, 113, 113, 0.08);
  color: #fecaca;
  cursor: pointer;
  font-size: 9px;
  font-weight: 800;
  padding: 7px 8px;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.quick-mode-canvas-controls__clear-color:hover {
  border-color: rgba(248, 113, 113, 0.7);
  background: rgba(248, 113, 113, 0.16);
}

.quick-mode-canvas-controls__swatch {
  width: 34px;
  height: 34px;
  border: 2px solid rgba(255, 255, 255, 0.24);
  border-radius: 9px;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);
}

.quick-mode-canvas-controls__swatch:hover {
  border-color: #fff;
  transform: translateY(-1px);
}

.quick-mode-canvas-controls__swatch.is-current {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(121, 168, 255, 0.7), inset 0 0 0 1px rgba(0, 0, 0, 0.16);
}

.quick-mode-canvas-controls__custom-color {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 10px;
  font-weight: 700;
}

.quick-mode-canvas-controls__custom-color input {
  width: 34px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

@media (max-width: 900px) {
  .quick-mode-canvas-controls {
    bottom: auto;
    gap: 2px;
    padding: 3px;
  }

  .quick-mode-canvas-controls__fit span {
    display: none;
  }

  .quick-mode-canvas-controls__fit,
  .quick-mode-canvas-controls__tool-button {
    width: 28px;
    padding: 0;
  }

  .quick-mode-canvas-controls__tool-button span {
    display: none;
  }
}

@media (max-width: 420px) {
  .quick-mode-canvas-controls__tool-button span {
    display: none;
  }
}
</style>

<style scoped>
.quick-mode-canvas-controls__font-popover { width: min(300px, calc(100vw - 32px)); background: #242529; border-color: #45464d; padding: 16px; overflow-x: hidden; }
.font-current { display: flex; justify-content: space-between; gap: 8px; padding: 10px 0 14px; color: #f4f4f5; font-size: 13px; }
.font-current span { color: #a1a1aa; white-space: nowrap; }
.font-controls-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.font-control { min-width: 0; color: #bfc0c9; font-size: 11px; }
.font-number { display: flex; align-items: center; margin-top: 5px; border: 1px solid #494950; background: #303136; border-radius: 8px; padding-right: 9px; }
.font-number:focus-within { border-color: #a78bfa; box-shadow: 0 0 0 2px #8b5cf622; }
.font-number input { width: 100%; min-width: 0; padding: 9px; background: transparent; color: white; border: 0; outline: 0; font-size: 13px; }
.font-number > span { color: #a1a1aa; font-size: 11px; }
.font-case { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin: 16px 0; padding: 4px; background: #191a1e; border-radius: 9px; }
.font-case button { min-width: 0; padding: 7px 2px; border-radius: 6px; color: #e4e4e7; }
.font-case button:hover, .font-case button:focus-visible { background: #45404f; outline: 1px solid #a78bfa; }
.font-case strong { display: block; font-size: 15px; }
.font-case span { display: block; font-size: 9px; margin-top: 3px; }
.font-search { width: 100%; padding: 10px; background: #303136; border: 1px solid #494950; border-radius: 8px; color: white; font-size: 12px; margin-bottom: 8px; }
</style>

<style scoped>
.font-apply-all { width: 100%; border: 1px solid #8b5cf6; border-radius: 8px; background: #7c3aed; color: white; padding: 9px; margin-bottom: 12px; font-size: 12px; font-weight: 600; }
.font-apply-all:disabled { opacity: .4; cursor: not-allowed; }
.font-apply-all:not(:disabled):hover { background: #6d28d9; }
</style>
