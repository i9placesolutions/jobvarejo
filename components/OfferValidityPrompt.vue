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

const dateFormat = ref<OfferDateFormat>(
  props.dateFormat === undefined ? 'long' : normalizeOfferDateFormat(props.dateFormat)
)
const dateFormatSelected = ref(dateFormat.value !== 'hidden')
const startDate = ref(String(props.startDate || ''))
const endDate = ref(String(props.endDate || ''))
const mode = ref<OfferValidityMode>(normalizeOfferValidityMode(
  props.mode || inferOfferValidityMode(startDate.value, endDate.value)
))
const whileStocks = ref(props.whileStocks !== false)
const errorMessage = ref('')

const validityPreview = computed(() => {
  if (dateFormat.value === 'hidden') return 'Nenhuma validade será exibida no encarte.'
  if (mode.value !== 'while_stocks' && !dateFormatSelected.value) return 'Escolha entre o formato numérico e o mês por extenso para ver o texto final.'
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

watch(() => props.dateFormat, value => {
  dateFormat.value = value === undefined ? 'long' : normalizeOfferDateFormat(value)
  dateFormatSelected.value = dateFormat.value !== 'hidden'
})
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
  if (dateFormat.value === 'hidden') { dateFormat.value = 'long'; dateFormatSelected.value = true }
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
    startDate.value = ''
    endDate.value = ''
    emit('confirm', { startDate: '', endDate: '', mode: 'while_stocks', whileStocks: false, dateFormat: 'hidden', show: false })
    return
  }
  if (mode.value !== 'while_stocks' && !dateFormatSelected.value) {
    errorMessage.value = 'Escolha como a data deve aparecer: em formato numérico ou com o mês por extenso.'
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

      <div class="offer-validity-prompt__options" role="radiogroup" aria-label="Tipo de validade e exibição">
        <button
          type="button"
          role="radio"
          :aria-checked="dateFormat !== 'hidden' && mode === 'single_day'"
          :class="['offer-validity-prompt__option', dateFormat !== 'hidden' && mode === 'single_day' ? 'offer-validity-prompt__option--active' : '']"
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
          :aria-checked="dateFormat !== 'hidden' && mode === 'date_range'"
          :class="['offer-validity-prompt__option', dateFormat !== 'hidden' && mode === 'date_range' ? 'offer-validity-prompt__option--active' : '']"
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
          :aria-checked="dateFormat === 'hidden'"
          :class="['offer-validity-prompt__option', dateFormat === 'hidden' ? 'offer-validity-prompt__option--active' : '']"
          @click="dateFormat = 'hidden'; errorMessage = ''"
        >
          <span class="offer-validity-prompt__option-radio" aria-hidden="true"></span>
          <span class="offer-validity-prompt__option-copy">
            <strong>Sem data</strong>
            <small>Não mostrar validade no encarte</small>
          </span>
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="dateFormat !== 'hidden' && mode === 'while_stocks'"
          :class="['offer-validity-prompt__option', dateFormat !== 'hidden' && mode === 'while_stocks' ? 'offer-validity-prompt__option--active' : '']"
          @click="selectMode('while_stocks')"
        >
          <span class="offer-validity-prompt__option-radio" aria-hidden="true"></span>
          <span class="offer-validity-prompt__option-copy">
            <strong>Enquanto houver estoque</strong>
            <small>Mostrar validade sem datas</small>
          </span>
        </button>
      </div>
      <div v-if="dateFormat !== 'hidden'">
        <p class="offer-validity-prompt__stock-note">As ofertas são limitadas à disponibilidade de estoque.</p>

      <fieldset v-if="mode !== 'while_stocks'" class="offer-validity-prompt__format">
        <legend>Como exibir a data? <span>Obrigatório</span></legend>
        <div class="offer-validity-prompt__format-options">
          <button type="button" :class="{'is-selected':dateFormatSelected && dateFormat === 'numeric'}" :aria-pressed="dateFormatSelected && dateFormat === 'numeric'" @click="dateFormat = 'numeric'; dateFormatSelected = true; errorMessage = ''"><strong>{{ mode === 'date_range' ? '25/09/2026 a 26/09/2026' : '25/09/2026' }}</strong><small>Numérico</small></button>
          <button type="button" :class="{'is-selected':dateFormatSelected && dateFormat === 'long'}" :aria-pressed="dateFormatSelected && dateFormat === 'long'" @click="dateFormat = 'long'; dateFormatSelected = true; errorMessage = ''"><strong>{{ mode === 'date_range' ? '25 a 26 de setembro' : '25 de setembro' }}</strong><small>Mês por extenso</small></button>
        </div>
      </fieldset>
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
        <span class="offer-validity-prompt__preview-label">PRÉVIA NO ENCARTE</span>
        <strong>{{ validityPreview }}</strong>
      </div>

      <p v-if="errorMessage" class="offer-validity-prompt__error" role="alert">{{ errorMessage }}</p>
      </div>
      <footer class="offer-validity-prompt__footer">
      <button type="button" class="offer-validity-prompt__confirm" @click="confirm">
        Continuar para editar <span aria-hidden="true">→</span>
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
  width: min(600px, 100%);
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
  color: #2160b4;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.offer-validity-prompt__option {
  display: flex;
  align-items: flex-start;
  flex-direction: row;
  gap: 12px;
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  color: #1e293b;
  cursor: pointer;
  padding: 14px;
  min-height: 76px;
  text-align: left;
  transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
}

.offer-validity-prompt__option:hover {
  border-color: #8fb8e6;
  background: #eaf3ff;
  transform: translateY(-1px);
}

.offer-validity-prompt__option:focus-visible,
.offer-validity-prompt__confirm:focus-visible,
.offer-validity-prompt__dates input:focus-visible {
  outline: 3px solid #b7d3ef;
  outline-offset: 2px;
}

.offer-validity-prompt__option--active {
  border-color: #2160b4;
  background: #eaf3ff;
  box-shadow: 0 0 0 1px #2160b4;
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
  border-color: #2160b4;
  background: #2160b4;
  box-shadow: inset 0 0 0 4px #eaf3ff;
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
  border-color: #2160b4;
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
  background: #eaf3ff;
  color: #173d70;
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
  background: #eaf3ff;
  border-left: 3px solid #2160b4;
  padding: 14px 15px;
}

.offer-validity-prompt__preview-label {
  color: #173d70;
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
  border: 1px solid #2160b4;
  border-radius: 10px;
  background: #2160b4;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  transition: background-color 0.16s ease, transform 0.16s ease;
}

.offer-validity-prompt__confirm:hover {
  background: #1a4f96;
}

.offer-validity-prompt__confirm:active {
  transform: translateY(1px);
}

.offer-validity-prompt__format { min-width:0; padding:0; border:0; margin:18px 0 0; color:#475569; font-size:12px; font-weight:700; }
.offer-validity-prompt__format legend { padding:0; margin-bottom:9px; }
.offer-validity-prompt__format legend span { margin-left:6px; color:#2160b4; font-size:10px; text-transform:uppercase; letter-spacing:.04em; }
.offer-validity-prompt__format-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.offer-validity-prompt__format-options button { display:grid; gap:4px; min-height:58px; padding:10px 12px; border:1px solid #dbe2ed; border-radius:10px; background:#f8fafc; color:#243047; text-align:left; cursor:pointer; }
.offer-validity-prompt__format-options button strong { font-size:12px; line-height:1.2; }
.offer-validity-prompt__format-options button small { color:#60758f; font-size:11px; }
.offer-validity-prompt__format-options button.is-selected { border-color:#2160b4; background:#eaf3ff; box-shadow:0 0 0 1px #2160b4; }
.offer-validity-prompt__format-options button:focus-visible { outline:3px solid #b7d3ef; outline-offset:2px; }
.offer-validity-prompt__select { width:100%; min-height:44px; padding:10px 12px; border:1px solid #dbe2ed; border-radius:10px; background:#f8fafc; color:#243047; color-scheme:light; font:inherit; font-size:14px; font-weight:500; }
.offer-validity-prompt__select:focus-visible { outline:3px solid #ddd6fe; border-color:#2160b4; }
.offer-validity-prompt__confirm { display:flex; align-items:center; justify-content:center; gap:12px; }
.offer-validity-prompt__confirm span { font-size:20px; font-weight:500; }
.offer-validity-prompt__option-copy strong { line-height:1.3; }
.offer-validity-prompt__footer { border-top:1px solid #f1f5f9; margin-top:18px; padding-top:16px; }
@media (prefers-reduced-motion: reduce) { .offer-validity-prompt button { transition:none; } }

@media (max-width: 520px) {
  .offer-validity-prompt__options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
