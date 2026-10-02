<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Palette, Pipette, X } from 'lucide-vue-next'
import ArtworkEyedropper from './ui/ArtworkEyedropper.vue'
import QuickModeElementTextControls from './QuickModeElementTextControls.vue'
import type { QuickEditableColorTarget } from '~/utils/quickModeNativeTools'

const SWATCHES = ['#172033', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6']
const props = defineProps<{
  targets: QuickEditableColorTarget[]
  recentColors?: string[]
  textSelected?: boolean
  fontFamily?: string
  fontSize?: number
  typography?: { lineHeight?: number; charSpacing?: number }
  busy?: boolean
  docked?: boolean
}>()
const emit = defineEmits<{
  (event: 'apply-color', payload: { targetId: string; value: string }): void
  (event: 'clear-color', targetId: string): void
  (event: 'restore-color', targetId: string): void
  (event: 'apply-font', value: string): void
  (event: 'apply-font-size', value: number): void
  (event: 'apply-typography', value: { property: string; value: number | string }): void
  (event: 'apply-opacity', payload: { targetId: string; value: number }): void
  (event: 'close'): void
}>()

const selectedId = ref('')
const selected = computed(() => props.targets.find(target => target.id === selectedId.value) || props.targets[0] || null)
const customColor = ref('#ef4444')
const eyedropper = ref<InstanceType<typeof ArtworkEyedropper> | null>(null)
const pickingColor = ref(false)
let pickedTargetId = ''
const startEyedropper = (event: MouseEvent) => {
  if (!selected.value || props.busy || pickingColor.value) return
  pickedTargetId = selected.value.id
  eyedropper.value?.start(event)
}
const applyPickedColor = (color: string) => {
  if (selected.value?.id !== pickedTargetId || props.busy) return
  customColor.value = color
  apply(color)
  pickedTargetId = ''
}
watch([() => selected.value?.id, () => props.busy], () => {
  eyedropper.value?.cancel()
  pickedTargetId = ''
})
watch(selected, target => {
  const color = String(target?.color || '').toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(color)) customColor.value = color
  else if (/^#[0-9a-f]{3}$/.test(color)) customColor.value = `#${color.slice(1).split('').map(char => char + char).join('')}`
}, { immediate: true })
const apply = (value: string) => {
  if (!selected.value || props.busy) return
  emit('apply-color', { targetId: selected.value.id, value })
}
</script>

<template>
  <div v-show="!pickingColor" class="element-color-menu" :class="{ 'element-color-menu--docked': docked }" role="dialog" :aria-label="textSelected ? 'Personalizar texto selecionado' : 'Cor do elemento selecionado'" @pointerdown.stop @mousedown.stop @click.stop @keydown.stop @keydown.esc="emit('close')">
    <div class="element-color-menu__heading">
      <div><Palette :size="15" /><strong>{{ textSelected ? 'Personalizar texto' : 'Cor deste elemento' }}</strong></div>
      <button type="button" aria-label="Fechar cores do elemento" @click="emit('close')"><X :size="15" /></button>
    </div>
    <p>Esta mudança afeta somente o item selecionado.</p>
    <label v-if="targets.length > 1" class="element-color-menu__target">
      Parte selecionada
      <select v-model="selectedId" aria-label="Parte do elemento">
        <option v-for="target in targets" :key="target.id" :value="target.id">{{ target.label }}</option>
      </select>
    </label>
    <strong v-else class="element-color-menu__name">{{ selected?.label }}</strong>
    <QuickModeElementTextControls v-if="textSelected" :font-family="fontFamily" :font-size="fontSize" :typography="typography" :busy="busy" @apply-font="emit('apply-font', $event)" @apply-font-size="emit('apply-font-size', $event)" @apply-typography="emit('apply-typography', $event)" />
    <div v-if="recentColors?.length" class="element-color-menu__recent" role="group" aria-label="Cores usadas recentemente">
      <span class="element-color-menu__swatches-label">Usadas recentemente</span>
      <div class="element-color-menu__swatches" aria-label="Cores usadas recentemente">
        <button v-for="color in recentColors" :key="`recent-${color}`" type="button" :style="{ backgroundColor: color }" :title="`Usar ${color}`" :aria-label="`Usar ${color} neste elemento`" :disabled="busy" @click="apply(color)" />
      </div>
    </div>
    <div class="element-color-menu__swatches" aria-label="Cores rápidas">
      <button v-for="color in SWATCHES" :key="color" type="button" :style="{ backgroundColor: color }" :aria-label="`Aplicar ${color} neste elemento`" :disabled="busy" @click="apply(color)" />
    </div>
    <div class="element-color-menu__custom">
      <label>Outra cor <input v-model="customColor" type="color" aria-label="Escolher cor deste elemento" :disabled="busy" @change="apply(customColor)" /></label>
      <button type="button" class="element-color-menu__eyedropper" aria-label="Capturar cor da arte para este elemento" :disabled="busy || pickingColor" @click="startEyedropper"><Pipette :size="15" /> Conta-gotas</button>
    </div>
    <ArtworkEyedropper ref="eyedropper" @pick="applyPickedColor" @active-change="pickingColor = $event" />
    <label class="element-color-menu__opacity">Opacidade <span>{{ Math.round((selected?.opacity ?? 1) * 100) }}%</span>
      <input type="range" min="0" max="100" step="1" :value="Math.round((selected?.opacity ?? 1) * 100)" :disabled="busy" aria-label="Opacidade deste elemento" @change="emit('apply-opacity', { targetId: selected!.id, value: Number(($event.target as HTMLInputElement).value) / 100 })" />
    </label>
    <button v-if="selected?.canClear" type="button" class="element-color-menu__clear" :disabled="busy" @click="emit('restore-color', selected!.id)">{{ selected?.id === 'selected-product-name' || selected?.kind === 'product-card' ? 'Usar cor automática' : 'Restaurar cor original' }}</button>
    <button v-if="selected?.canClear" type="button" class="element-color-menu__clear" :disabled="busy" @click="emit('clear-color', selected!.id)">Deixar sem cor</button>
  </div>
</template>

<style scoped>
.element-color-menu{position:absolute;z-index:130;width:min(280px,calc(100vw - 32px));max-height:min(560px,80vh);overflow:auto;padding:13px;border:1px solid #656078;border-radius:14px;background:#24252b;color:#f4f4f5;box-shadow:0 16px 40px #0008;font-size:12px}
.element-color-menu--docked{position:relative;width:100%;height:100%;max-height:100%;border:0;border-radius:0;box-shadow:none}
.element-color-menu__heading,.element-color-menu__heading>div{display:flex;align-items:center;justify-content:space-between;gap:8px}.element-color-menu__heading>div{justify-content:flex-start;color:#ddd6fe}.element-color-menu__heading button{display:grid;place-items:center;width:27px;height:27px;border-radius:7px;color:#d4d4d8}.element-color-menu__heading button:hover{background:#ffffff18}
.element-color-menu p{margin:6px 0 12px;color:#a1a1aa;font-size:11px}.element-color-menu__name{display:block;margin-bottom:9px}.element-color-menu__target{display:grid;gap:5px;margin-bottom:10px;color:#d4d4d8}.element-color-menu__target select{width:100%;padding:7px;border:1px solid #555662;border-radius:7px;background:#30313a;color:white}
.element-color-menu__recent{margin-bottom:10px}.element-color-menu__swatches-label{display:block;margin-bottom:5px;color:#a1a1aa;font-size:10px}.element-color-menu__swatches{display:grid;grid-template-columns:repeat(8,1fr);gap:5px}.element-color-menu__swatches button{height:25px;border:2px solid #ffffff55;border-radius:7px}.element-color-menu__swatches button:hover,.element-color-menu__swatches button:focus-visible{border-color:white;outline:2px solid #a78bfa}
.element-color-menu__custom{display:grid;gap:7px;margin-top:12px;color:#e4e4e7}.element-color-menu__custom label{display:flex;align-items:center;justify-content:space-between}.element-color-menu__custom input{width:42px;height:29px;border:0;background:transparent;cursor:pointer}.element-color-menu__eyedropper{display:flex;align-items:center;justify-content:center;gap:7px;padding:7px;border:1px solid #ffffff2b;border-radius:7px}.element-color-menu__eyedropper:hover{background:#ffffff14}.element-color-menu__opacity{display:grid;grid-template-columns:1fr auto;gap:5px;margin-top:12px;color:#e4e4e7}.element-color-menu__opacity input{grid-column:1/-1;width:100%;accent-color:#a78bfa}.element-color-menu__clear{width:100%;margin-top:12px;padding:8px;border:1px solid #ffffff2b;border-radius:8px;color:#e4e4e7;text-align:center}.element-color-menu__clear:hover{background:#ffffff14}.element-color-menu button:disabled{opacity:.45;cursor:wait}
</style>
