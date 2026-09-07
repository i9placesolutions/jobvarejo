<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  formatOfferDate, normalizeOfferDateFormat, type OfferDateFormat,
  formatOfferValidityPeriod,
  inferOfferValidityMode,
  normalizeOfferValidityMode,
  type OfferValidityMode
} from '~/utils/offerValidity'

const props = defineProps<{
  dateFormat?: OfferDateFormat
  startDate?: string
  endDate?: string
  mode?: OfferValidityMode | string
  whileStocks?: boolean
}>()

const emit = defineEmits<{
  (event: 'confirm', payload: { startDate: string; endDate: string; mode: OfferValidityMode; whileStocks: boolean; dateFormat: OfferDateFormat; show: boolean }): void
}>()

const dateFormat = ref<OfferDateFormat>(normalizeOfferDateFormat(props.dateFormat))
const startDate = ref(String(props.startDate || ''))
const endDate = ref(String(props.endDate || ''))
const mode = ref<OfferValidityMode>(normalizeOfferValidityMode(
  props.mode || inferOfferValidityMode(startDate.value, endDate.value)
))
const whileStocks = ref(props.whileStocks !== false)
const errorMessage = ref('')

const validityPreview = computed(() => {
  if (dateFormat.value === 'hidden') return 'Nenhuma validade será exibida no encarte.'
  const start = String(startDate.value || '').trim()
  const end = String(endDate.value || '').trim()
  if (mode.value === 'single_day' && !start && !end) {
    return 'Escolha uma data para ver o texto final.'
  }
  if (mode.value === 'date_range' && (!start || !end)) {
    return 'Escolha as duas datas para ver o texto final.'
  }
  return formatOfferValidityPeriod(
    formatOfferDate(start, dateFormat.value),
    formatOfferDate(end, dateFormat.value),
    mode.value,
    true
  )
})

watch(() => props.dateFormat, value => { dateFormat.value = normalizeOfferDateFormat(value) })
watch(() => props.startDate, value => { startDate.value = String(value || '') })
watch(() => props.endDate, value => { endDate.value = String(value || '') })
watch(() => props.mode, value => {
  if (value === undefined || value === null || String(value).trim() === '') return
  mode.value = normalizeOfferValidityMode(value)
})
watch(() => props.whileStocks, value => {
  if (value === undefined) return
  whileStocks.value = value !== false
})

const selectMode = (value: unknown) => {
  mode.value = normalizeOfferValidityMode(value)
  // As três opções comerciais deste fluxo sempre limitam a oferta pelo estoque.
  whileStocks.value = true
  errorMessage.value = ''
  if (mode.value === 'single_day') {
    const date = startDate.value || endDate.value
    startDate.value = date
    endDate.value = date
  } else if (mode.value === 'while_stocks') {
    startDate.value = ''
    endDate.value = ''
  }
}

const confirm = () => {
  errorMessage.value = ''
  whileStocks.value = true
  if (dateFormat.value === 'hidden') {
    emit('confirm', { startDate: startDate.value, endDate: endDate.value, mode: mode.value, whileStocks: false, dateFormat: 'hidden', show: false })
    return
  }
  if (mode.value === 'single_day') {
    const date = startDate.value || endDate.value
    if (!date) {
      errorMessage.value = 'Escolha o dia em que a oferta será válida.'
      return
    }
    startDate.value = date
    endDate.value = date
  } else if (mode.value === 'date_range') {
    if (!startDate.value || !endDate.value) {
      errorMessage.value = 'Informe o início e o final da validade.'
      return
    }
    if (endDate.value < startDate.value) {
      errorMessage.value = 'O final precisa ser igual ou posterior ao início.'
      return
    }
  } else {
    startDate.value = ''
    endDate.value = ''
  }
  emit('confirm', {
    startDate: startDate.value,
    endDate: endDate.value,
    mode: mode.value,
    whileStocks: whileStocks.value, dateFormat: dateFormat.value, show: true
  })
}
</script>

<template>
  <Teleport to="body">
  <div
    class="offer-validity-prompt"
    role="dialog"
    aria-modal="true"
    aria-labelledby="offer-validity-prompt-title"
  >
    <section class="offer-validity-prompt__card">
      <div class="offer-validity-prompt__body">
      <p class="offer-validity-prompt__eyebrow">Validade do encarte</p>
      <h2 id="offer-validity-prompt-title">Até quando valem as ofertas?</h2>
      <p class="offer-validity-prompt__help">
        Defina a validade antes de começar a editar.
      </p>

      <label class="mb-4 grid gap-2 text-sm">
        <span>Como exibir a validade</span>
        <select v-model="dateFormat" aria-label="Formato da validade" class="min-h-11 rounded-lg border border-white/20 bg-zinc-900 p-3 text-white">
          <option value="numeric">07/09/2026 — numérica</option>
          <option value="long">07 de setembro de 2026 — por extenso</option>
          <option value="hidden">Não mostrar validade no encarte</option>
        </select>
      </label>
      <div v-if="dateFormat !== 'hidden'">
      <div class="offer-validity-prompt__options" role="radiogroup" aria-label="Tipo de validade">
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'single_day'"
          :class="['offer-validity-prompt__option', mode === 'single_day' ? 'offer-validity-prompt__option--active' : '']"
          @click="selectMode('single_day')"
        >
          <span class="offer-validity-prompt__option-radio" aria-hidden="true"></span>
          <span class="offer-validity-prompt__option-copy">
            <strong>Um dia</strong>
            <small>Uma data específica</small>
          </span>
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'date_range'"
          :class="['offer-validity-prompt__option', mode === 'date_range' ? 'offer-validity-prompt__option--active' : '']"
          @click="selectMode('date_range')"
        >
          <span class="offer-validity-prompt__option-radio" aria-hidden="true"></span>
          <span class="offer-validity-prompt__option-copy">
            <strong>Vários dias</strong>
            <small>Data inicial e final</small>
          </span>
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'while_stocks'"
          :class="['offer-validity-prompt__option', mode === 'while_stocks' ? 'offer-validity-prompt__option--active' : '']"
          @click="selectMode('while_stocks')"
        >
          <span class="offer-validity-prompt__option-radio" aria-hidden="true"></span>
          <span class="offer-validity-prompt__option-copy">
            <strong>Sem data</strong>
            <small>Até acabar o estoque</small>
          </span>
        </button>
      </div>
      <p class="offer-validity-prompt__stock-note">Todas as opções incluem “enquanto durarem os estoques”.</p>

      <div v-if="mode === 'single_day'" class="offer-validity-prompt__dates">
        <label>
          <span>Data da oferta</span>
          <input v-model="startDate" type="date" aria-label="Dia da oferta" />
        </label>
      </div>
      <div v-else-if="mode === 'date_range'" class="offer-validity-prompt__dates offer-validity-prompt__dates--range">
        <label>
          <span>Começa em</span>
          <input v-model="startDate" type="date" aria-label="Início da validade" />
        </label>
        <label>
          <span>Termina em</span>
          <input v-model="endDate" type="date" :min="startDate || undefined" aria-label="Final da validade" />
        </label>
      </div>
      <div v-else class="offer-validity-prompt__stocks">
        <span class="offer-validity-prompt__stocks-icon" aria-hidden="true">✓</span>
        <span>
          <strong>Sem datas no encarte</strong>
          <small>A oferta ficará válida até o estoque acabar.</small>
        </span>
      </div>

      </div>
      <div class="offer-validity-prompt__preview" aria-live="polite">
        <span class="offer-validity-prompt__preview-label">Assim vai aparecer no encarte</span>
        <strong>{{ validityPreview }}</strong>
      </div>

      <p v-if="errorMessage" class="offer-validity-prompt__error" role="alert">{{ errorMessage }}</p>
      </div>
      <footer class="offer-validity-prompt__footer">
      <button type="button" class="offer-validity-prompt__confirm" @click="confirm">
        Continuar para editar
      </button>
      </footer>
    </section>
  </div>
  </Teleport>
</template>

<style scoped>
.offer-validity-prompt {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: grid;
  place-items: center;
  background: rgba(15, 23, 42, 0.48);
  padding: 18px;
  backdrop-filter: blur(7px);
}

.offer-validity-prompt__card {
  width: min(560px, 100%);
  max-height: calc(100dvh - 36px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.2);
  color: #0f172a;
}

.offer-validity-prompt__body {
  min-height: 0;
  overflow-y: auto;
  padding: 24px 24px 0;
}

.offer-validity-prompt__footer {
  flex-shrink: 0;
  padding: 16px 24px 24px;
}

.offer-validity-prompt__stock-note {
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
  margin: 10px 0 0;
}

.offer-validity-prompt__eyebrow {
  margin: 0;
  color: #4f35f4;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.offer-validity-prompt h2 {
  margin: 8px 0 0;
  color: #0f172a;
  font-size: clamp(22px, 4vw, 26px);
  font-weight: 700;
  line-height: 1.14;
}

.offer-validity-prompt__help {
  max-width: 52ch;
  margin: 8px 0 18px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.45;
}

.offer-validity-prompt__options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.offer-validity-prompt__option {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  color: #1e293b;
  cursor: pointer;
  padding: 12px;
  text-align: left;
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
}

.offer-validity-prompt__option:hover {
  border-color: #a5a0fc;
  background: #f5f3ff;
  transform: translateY(-1px);
}

.offer-validity-prompt__option:focus-visible,
.offer-validity-prompt__confirm:focus-visible,
.offer-validity-prompt__dates input:focus-visible {
  outline: 3px solid #c4b5fd;
  outline-offset: 2px;
}

.offer-validity-prompt__option--active {
  border-color: #4f35f4;
  background: #f5f3ff;
  box-shadow: 0 0 0 1px #4f35f4;
}

.offer-validity-prompt__option-radio {
  position: relative;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border: 2px solid #cbd5e1;
  border-radius: 50%;
}

.offer-validity-prompt__option--active .offer-validity-prompt__option-radio {
  border-color: #4f35f4;
  background: #4f35f4;
  box-shadow: inset 0 0 0 4px #f5f3ff;
}

.offer-validity-prompt__option-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.offer-validity-prompt__option strong {
  font-size: 15px;
  font-weight: 800;
}

.offer-validity-prompt__option small {
  color: #64748b;
  font-size: 12px;
  line-height: 1.4;
}

.offer-validity-prompt__dates {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.offer-validity-prompt__dates--range {
  grid-template-columns: 1fr 1fr;
}

.offer-validity-prompt__dates label {
  display: grid;
  gap: 5px;
}

.offer-validity-prompt__dates label > span {
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.offer-validity-prompt__dates input {
  width: 100%;
  min-height: 42px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #1e293b;
  color-scheme: light;
  outline: none;
  padding: 0 10px;
  font-size: 14px;
}

.offer-validity-prompt__dates input:focus {
  border-color: #4f35f4;
}

.offer-validity-prompt__stocks {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin: 13px 0 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  color: #64748b;
  padding: 14px;
  font-size: 12px;
  line-height: 1.4;
}

.offer-validity-prompt__stocks-icon {
  display: grid;
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 50%;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 13px;
  font-weight: 800;
}

.offer-validity-prompt__stocks > span:last-child {
  display: grid;
  gap: 3px;
}

.offer-validity-prompt__stocks strong {
  color: #1e293b;
  font-size: 13px;
}

.offer-validity-prompt__stocks small {
  color: #64748b;
  font-size: 12px;
}

.offer-validity-prompt__preview {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 14px 15px;
}

.offer-validity-prompt__preview-label {
  color: #6d28d9;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.offer-validity-prompt__preview strong {
  color: #1e293b;
  font-size: 13px;
  line-height: 1.45;
}

.offer-validity-prompt__error {
  margin: 12px 0 0;
  color: #dc2626;
  font-size: 12px;
  line-height: 1.35;
}

.offer-validity-prompt__confirm {
  width: 100%;
  min-height: 48px;
  margin-top: 0;
  border: 1px solid #4f35f4;
  border-radius: 10px;
  background: #4f35f4;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  transition: background-color 0.16s ease, transform 0.16s ease;
}

.offer-validity-prompt__confirm:hover {
  background: #4325de;
}

.offer-validity-prompt__confirm:active {
  transform: translateY(1px);
}

@media (max-width: 520px) {
  .offer-validity-prompt__body {
    padding: 18px 18px 0;
  }
  .offer-validity-prompt__footer {
    padding: 14px 18px 18px;
  }
  .offer-validity-prompt__option {
    padding: 10px 8px;
  }
  .offer-validity-prompt__option strong {
    font-size: 13px;
  }
  .offer-validity-prompt__option small {
    font-size: 11px;
  }
  .offer-validity-prompt__dates label {
    min-width: 0;
  }
  .offer-validity-prompt__dates input {
    min-width: 0;
  }
}
</style>
