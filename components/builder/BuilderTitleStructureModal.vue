<script setup lang="ts">
/**
 * Modal de Estruturas de Titulo
 * Replica o modal-estruturas-de-titulo do QROfertas
 * Permite configurar distribuicao, destaque, cores e estilo do titulo do encarte
 */

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  apply: [config: Record<string, any>]
}>()

const { flyer, updateFlyer } = useBuilderFlyer()

const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)

// Distribuicao do titulo
const titleAlignments = [
  { value: 'left', label: 'Esquerda', icon: 'align-left' },
  { value: 'center', label: 'Centro', icon: 'align-center' },
  { value: 'right', label: 'Direita', icon: 'align-right' },
]

// Estilo do titulo
const titleStyles = [
  { value: 'normal', label: 'Normal' },
  { value: 'bold', label: 'Negrito' },
  { value: 'outline', label: 'Contorno' },
  { value: 'shadow', label: 'Sombra' },
]

// Tamanho do titulo
const titleSizes = [
  { value: 'small', label: 'Pequeno' },
  { value: 'medium', label: 'Medio' },
  { value: 'large', label: 'Grande' },
  { value: 'xlarge', label: 'Extra Grande' },
]

// Cores do titulo
const titleColorPresets = [
  { id: 'default', label: 'Padrao', color: 'inherit' },
  { id: 'white', label: 'Branco', color: '#ffffff' },
  { id: 'yellow', label: 'Amarelo', color: '#FDD835' },
  { id: 'red', label: 'Vermelho', color: '#E53935' },
  { id: 'green', label: 'Verde', color: '#43A047' },
  { id: 'blue', label: 'Azul', color: '#1E88E5' },
]

const currentAlignment = computed(() => fontConfig.value.title_alignment || 'center')
const currentStyle = computed(() => fontConfig.value.title_style || 'bold')
const currentSize = computed(() => fontConfig.value.title_size || 'large')
const currentColor = computed(() => fontConfig.value.title_color || 'inherit')
const currentBgColor = computed(() => fontConfig.value.title_bg_color || 'transparent')
const showTitleBg = computed(() => fontConfig.value.show_title_bg ?? false)

const handleApply = () => {
  emit('apply', {
    title_alignment: currentAlignment.value,
    title_style: currentStyle.value,
    title_size: currentSize.value,
    title_color: currentColor.value,
    title_bg_color: currentBgColor.value,
    show_title_bg: showTitleBg.value,
  })
  emit('close')
}

const setFc = (changes: Record<string, any>) => {
  updateFlyer({ font_config: { ...fontConfig.value, ...changes } })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 class="text-sm font-semibold text-gray-800">Estrutura do Titulo</h3>
          <button @click="emit('close')" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 space-y-5">
          <!-- Alinhamento -->
          <div>
            <label class="text-[11px] font-medium text-gray-500 mb-2 block">Alinhamento</label>
            <div class="flex gap-2">
              <button v-for="opt in titleAlignments" :key="opt.value"
                @click="setFc({ title_alignment: opt.value })"
                :class="['flex-1 py-2 rounded-lg text-xs font-medium border transition-colors',
                  currentAlignment === opt.value
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100']">
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Estilo -->
          <div>
            <label class="text-[11px] font-medium text-gray-500 mb-2 block">Estilo</label>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="opt in titleStyles" :key="opt.value"
                @click="setFc({ title_style: opt.value })"
                :class="['py-2 rounded-lg text-xs font-medium border transition-colors',
                  currentStyle === opt.value
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100']">
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Tamanho -->
          <div>
            <label class="text-[11px] font-medium text-gray-500 mb-2 block">Tamanho</label>
            <div class="grid grid-cols-4 gap-2">
              <button v-for="opt in titleSizes" :key="opt.value"
                @click="setFc({ title_size: opt.value })"
                :class="['py-2 rounded-lg text-xs font-medium border transition-colors',
                  currentSize === opt.value
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100']">
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Cor do Texto -->
          <div>
            <label class="text-[11px] font-medium text-gray-500 mb-2 block">Cor do Titulo</label>
            <div class="flex gap-2 flex-wrap">
              <button v-for="preset in titleColorPresets" :key="preset.id"
                @click="setFc({ title_color: preset.color })"
                :class="['w-8 h-8 rounded-full border-2 transition-all',
                  currentColor === preset.color ? 'border-emerald-500 scale-110' : 'border-gray-200 hover:border-gray-400']"
                :style="{ backgroundColor: preset.color === 'inherit' ? '#6b7280' : preset.color }"
                :title="preset.label">
              </button>
              <input type="color" :value="currentColor === 'inherit' ? '#000000' : currentColor"
                @input="setFc({ title_color: ($event.target as HTMLInputElement).value })"
                class="w-8 h-8 rounded-full border border-gray-200 cursor-pointer" />
            </div>
          </div>

          <!-- Fundo do Titulo -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-[11px] font-medium text-gray-500">Fundo do Titulo</label>
              <button type="button" @click="setFc({ show_title_bg: !showTitleBg })"
                :class="['w-8 h-4 rounded-full transition-colors', showTitleBg ? 'bg-emerald-500' : 'bg-gray-300']">
                <span :class="['block w-3 h-3 rounded-full bg-white shadow transition-transform', showTitleBg ? 'translate-x-4' : 'translate-x-0.5']" />
              </button>
            </div>
            <div v-if="showTitleBg" class="flex gap-2 flex-wrap">
              <button v-for="preset in [{id:'transparent',color:'transparent'},{id:'white',color:'#ffffff'},{id:'black',color:'#000000'},{id:'red',color:'#E53935'},{id:'dark',color:'#1a1a2e'}]" :key="preset.id"
                @click="setFc({ title_bg_color: preset.color })"
                :class="['w-8 h-8 rounded-full border-2 transition-all',
                  currentBgColor === preset.color ? 'border-emerald-500 scale-110' : 'border-gray-200 hover:border-gray-400']"
                :style="{ backgroundColor: preset.color }" />
              <input type="color" :value="currentBgColor === 'transparent' ? '#ffffff' : currentBgColor"
                @input="setFc({ title_bg_color: ($event.target as HTMLInputElement).value })"
                class="w-8 h-8 rounded-full border border-gray-200 cursor-pointer" />
            </div>
          </div>

          <!-- Preview -->
          <div class="bg-gray-50 rounded-lg p-4 text-center">
            <span class="text-lg font-bold"
              :style="{
                color: currentColor === 'inherit' ? 'inherit' : currentColor,
                backgroundColor: showTitleBg ? (currentBgColor === 'transparent' ? 'transparent' : currentBgColor) : 'transparent',
                textShadow: currentStyle === 'shadow' ? '2px 2px 4px rgba(0,0,0,0.3)' : 'none',
                WebkitTextStroke: currentStyle === 'outline' ? '1px #000' : 'unset',
                textAlign: currentAlignment,
                fontSize: currentSize === 'xlarge' ? '1.5rem' : currentSize === 'large' ? '1.25rem' : currentSize === 'medium' ? '1rem' : '0.875rem',
              }">
              ENCERTE DE OFERTAS
            </span>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button @click="emit('close')" class="px-4 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">Cancelar</button>
          <button @click="handleApply" class="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500">Aplicar</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
