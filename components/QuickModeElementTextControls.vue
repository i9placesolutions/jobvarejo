<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AVAILABLE_FONT_FAMILIES } from '~/utils/font-catalog'

const props = defineProps<{
  fontFamily?: string
  fontSize?: number
  typography?: { lineHeight?: number; charSpacing?: number }
  busy?: boolean
}>()

const emit = defineEmits<{
  (event: 'apply-font', value: string): void
  (event: 'apply-font-size', value: number): void
  (event: 'apply-typography', value: { property: string; value: number | string }): void
}>()

const fontOptions = computed(() => {
  const current = String(props.fontFamily || '').trim()
  return [...new Set([...(current ? [current] : []), ...AVAILABLE_FONT_FAMILIES])]
})

const fontSizeDraft = ref(props.fontSize == null ? '' : String(Math.round(props.fontSize)))
const lineHeightDraft = ref(props.typography?.lineHeight == null
  ? '95'
  : String(Math.round(props.typography.lineHeight * 100)))
const charSpacingDraft = ref(props.typography?.charSpacing == null
  ? ''
  : String(Math.round(props.typography.charSpacing / 10)))

watch(() => props.fontSize, value => {
  fontSizeDraft.value = value == null ? '' : String(Math.round(value))
})
watch(() => props.typography?.lineHeight, value => {
  lineHeightDraft.value = value == null ? '95' : String(Math.round(value * 100))
})
watch(() => props.typography?.charSpacing, value => {
  charSpacingDraft.value = value == null ? '' : String(Math.round(value / 10))
})

const applyNumber = (property: 'fontSize' | 'lineHeight' | 'charSpacing', event: Event) => {
  const input = event.target as HTMLInputElement
  const raw = input.value.trim()
  if (!raw || !Number.isFinite(Number(raw))) {
    if (property === 'fontSize') fontSizeDraft.value = props.fontSize == null ? '' : String(Math.round(props.fontSize))
    else if (property === 'lineHeight') lineHeightDraft.value = props.typography?.lineHeight == null ? '95' : String(Math.round(props.typography.lineHeight * 100))
    else charSpacingDraft.value = props.typography?.charSpacing == null ? '' : String(Math.round(props.typography.charSpacing / 10))
    return
  }

  let value = Math.round(Number(raw))
  if (property === 'fontSize') value = Math.max(1, Math.min(500, value))
  if (property === 'lineHeight') value = Math.max(1, value)
  input.value = String(value)

  if (property === 'fontSize') {
    fontSizeDraft.value = String(value)
    emit('apply-font-size', value)
  } else if (property === 'lineHeight') {
    lineHeightDraft.value = String(value)
    emit('apply-typography', { property, value: value / 100 })
  } else {
    charSpacingDraft.value = String(value)
    emit('apply-typography', { property, value: value * 10 })
  }
}

const applyTextCase = (value: 'upper' | 'lower' | 'none') => {
  emit('apply-typography', { property: 'textCase', value })
}
</script>

<template>
  <section class="element-text-controls" aria-label="Formatação do texto">
    <label class="element-text-controls__font">
      <span>Fonte</span>
      <select
        :value="fontFamily || ''"
        :disabled="busy"
        aria-label="Fonte do texto"
        @change="emit('apply-font', ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="!fontFamily" value="" disabled>Selecione uma fonte</option>
        <option v-for="font in fontOptions" :key="font" :value="font">{{ font }}</option>
      </select>
    </label>

    <div class="element-text-controls__numbers">
      <label>
        <span>Tamanho</span>
        <span class="element-text-controls__input-wrap">
          <input v-model="fontSizeDraft" type="number" min="1" max="500" step="1" :disabled="busy" aria-label="Tamanho da fonte em pixels" @change="applyNumber('fontSize', $event)" />
          <span aria-hidden="true">px</span>
        </span>
      </label>
      <label>
        <span>Entrelinhas</span>
        <span class="element-text-controls__input-wrap">
          <input v-model="lineHeightDraft" type="number" min="1" step="1" :disabled="busy" aria-label="Entrelinhas em porcentagem" @change="applyNumber('lineHeight', $event)" />
          <span aria-hidden="true">%</span>
        </span>
      </label>
      <label>
        <span>Entre letras</span>
        <span class="element-text-controls__input-wrap">
          <input v-model="charSpacingDraft" type="number" step="1" :disabled="busy" aria-label="Espaçamento entre letras em porcentagem" @change="applyNumber('charSpacing', $event)" />
          <span aria-hidden="true">%</span>
        </span>
      </label>
    </div>

    <div class="element-text-controls__case" role="group" aria-label="Maiúsculas e minúsculas">
      <button type="button" :disabled="busy" aria-label="Maiúsculas" title="Maiúsculas" @click="applyTextCase('upper')">AA</button>
      <button type="button" :disabled="busy" aria-label="Minúsculas" title="Minúsculas" @click="applyTextCase('lower')">aa</button>
      <button type="button" :disabled="busy" aria-label="Texto original" title="Texto original" @click="applyTextCase('none')">Aa</button>
    </div>
  </section>
</template>

<style scoped>
.element-text-controls {
  display: grid;
  gap: 10px;
  width: min(100%, 280px);
  color: #e4e4e7;
  font-size: 12px;
}

.element-text-controls label {
  display: grid;
  min-width: 0;
  gap: 5px;
  color: #a1a1aa;
}

.element-text-controls select,
.element-text-controls__input-wrap {
  min-width: 0;
  height: 36px;
  border: 1px solid #484850;
  border-radius: 7px;
  background: #29292f;
  color: #f4f4f5;
}

.element-text-controls select {
  width: 100%;
  padding: 0 9px;
  font: inherit;
}

.element-text-controls__numbers {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.element-text-controls__input-wrap {
  display: flex;
  align-items: center;
  padding-right: 7px;
}

.element-text-controls__input-wrap input {
  width: 100%;
  min-width: 0;
  height: 100%;
  padding: 0 4px 0 8px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #fff;
  font: inherit;
}

.element-text-controls__input-wrap > span {
  color: #a1a1aa;
  font-size: 10px;
}

.element-text-controls__case {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.element-text-controls__case button {
  min-height: 34px;
  border: 1px solid #484850;
  border-radius: 7px;
  background: #303036;
  color: #e4e4e7;
  font-weight: 700;
}

.element-text-controls select:focus-visible,
.element-text-controls__input-wrap:focus-within,
.element-text-controls__case button:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 1px;
}

.element-text-controls button:disabled,
.element-text-controls select:disabled,
.element-text-controls input:disabled {
  cursor: not-allowed;
  opacity: .5;
}
</style>
