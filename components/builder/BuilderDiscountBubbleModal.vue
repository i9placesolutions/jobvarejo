<script setup lang="ts">
/**
 * Modal de Bubble de Desconto (Balao de Desconto)
 * Replica o escolher-bubble-destaque do QROfertas
 * Permite escolher o estilo do balao de desconto no card do produto
 */

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { flyer, updateFlyer } = useBuilderFlyer()
const fontConfig = computed(() => (flyer.value?.font_config || {}) as Record<string, any>)

// Estilos de bubble disponiveis
const bubbleStyles = [
  { id: 'none', label: 'Sem Bubble', shape: 'none', bgColor: 'transparent', textColor: '#000' },
  { id: 'circle-red', label: 'Circulo Vermelho', shape: 'circle', bgColor: '#E53935', textColor: '#fff' },
  { id: 'circle-green', label: 'Circulo Verde', shape: 'circle', bgColor: '#43A047', textColor: '#fff' },
  { id: 'circle-blue', label: 'Circulo Azul', shape: 'circle', bgColor: '#1E88E5', textColor: '#fff' },
  { id: 'star-yellow', label: 'Estrela Amarela', shape: 'star', bgColor: '#FDD835', textColor: '#000' },
  { id: 'star-red', label: 'Estrela Vermelha', shape: 'star', bgColor: '#E53935', textColor: '#fff' },
  { id: 'badge-orange', label: 'Badge Laranja', shape: 'badge', bgColor: '#FF9800', textColor: '#fff' },
  { id: 'badge-purple', label: 'Badge Roxo', shape: 'badge', bgColor: '#8E24AA', textColor: '#fff' },
  { id: 'ribbon-red', label: 'Fita Vermelha', shape: 'ribbon', bgColor: '#E53935', textColor: '#fff' },
  { id: 'ribbon-green', label: 'Fita Verde', shape: 'ribbon', bgColor: '#43A047', textColor: '#fff' },
  { id: 'splash-gold', label: 'Splash Dourado', shape: 'splash', bgColor: '#FDD835', textColor: '#000' },
  { id: 'splash-white', label: 'Splash Branco', shape: 'splash', bgColor: '#ffffff', textColor: '#000' },
]

const currentBubble = computed(() => fontConfig.value.discount_bubble || 'none')

const setBubble = (id: string) => {
  updateFlyer({ font_config: { ...fontConfig.value, discount_bubble: id } })
}

const setFc = (changes: Record<string, any>) => {
  updateFlyer({ font_config: { ...fontConfig.value, ...changes } })
}

// Preview do bubble no card
const renderBubbleShape = (style: typeof bubbleStyles[number]) => {
  if (style.shape === 'none') return null
  const size = '32px'
  const baseStyle: Record<string, string> = {
    width: size,
    height: size,
    backgroundColor: style.bgColor,
    color: style.textColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '8px',
    fontWeight: '900',
  }

  switch (style.shape) {
    case 'circle':
      return { ...baseStyle, borderRadius: '50%' }
    case 'star':
      return { ...baseStyle, clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }
    case 'badge':
      return { ...baseStyle, borderRadius: '6px', transform: 'rotate(-5deg)' }
    case 'ribbon':
      return { ...baseStyle, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10% 50%)' }
    case 'splash':
      return { ...baseStyle, borderRadius: '50% 40% 55% 45% / 45% 55% 40% 50%', transform: 'rotate(-3deg)' }
    default:
      return baseStyle
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 class="text-sm font-semibold text-gray-800">Bubble de Desconto</h3>
          <button @click="emit('close')" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-4">
          <p class="text-[11px] text-gray-400 mb-3">Escolha o estilo do balao de desconto que aparece nos cards dos produtos.</p>

          <div class="grid grid-cols-3 gap-3">
            <button v-for="style in bubbleStyles" :key="style.id"
              @click="setBubble(style.id)"
              :class="['flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                currentBubble === style.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300 bg-gray-50']">
              <!-- Preview do bubble -->
              <div :style="renderBubbleShape(style) as any" class="flex items-center justify-center">
                <span v-if="style.shape !== 'none'" class="text-[7px] font-black">%</span>
                <span v-else class="text-gray-400 text-[9px]">—</span>
              </div>
              <span class="text-[9px] text-gray-500 text-center leading-tight">{{ style.label }}</span>
            </button>
          </div>

          <!-- Configuracoes extras do bubble -->
          <div class="mt-5 space-y-3 border-t border-gray-200 pt-4">
            <div>
              <label class="text-[11px] font-medium text-gray-500 mb-1 block">Texto do Bubble</label>
              <input :value="fontConfig.discount_bubble_text || '%'" @input="setFc({ discount_bubble_text: ($event.target as HTMLInputElement).value })"
                maxlength="8"
                class="w-full bg-gray-100 text-xs text-gray-900 rounded px-2 py-1.5 border border-gray-200 outline-none"
                placeholder="% ou OFF" />
            </div>
            <div>
              <label class="text-[11px] font-medium text-gray-500 mb-1 block">Tamanho</label>
              <select :value="fontConfig.discount_bubble_size || 'medium'" @change="setFc({ discount_bubble_size: ($event.target as HTMLSelectElement).value })"
                class="w-full bg-gray-100 text-xs text-gray-600 rounded px-2 py-1.5 border border-gray-200 outline-none">
                <option value="small">Pequeno</option>
                <option value="medium">Medio</option>
                <option value="large">Grande</option>
              </select>
            </div>
            <div>
              <label class="text-[11px] font-medium text-gray-500 mb-1 block">Posicao</label>
              <select :value="fontConfig.discount_bubble_position || 'top-left'" @change="setFc({ discount_bubble_position: ($event.target as HTMLSelectElement).value })"
                class="w-full bg-gray-100 text-xs text-gray-600 rounded px-2 py-1.5 border border-gray-200 outline-none">
                <option value="top-left">Superior Esquerdo</option>
                <option value="top-right">Superior Direito</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end px-4 py-3 border-t border-gray-200">
          <button @click="emit('close')" class="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500">Fechar</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
