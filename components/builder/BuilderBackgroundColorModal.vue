<script setup lang="ts">
/**
 * Modal para trocar cor de fundo do produto no encarte.
 * Baseado na documentacao QROfertas secao 17.
 * Grade de cores com slider de transparencia.
 */
const props = defineProps<{
  modelValue: boolean
  currentBg?: string
  currentOpacity?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', color: { bg: string; textColor: string; opacity: number }): void
}>()

const opacity = ref(props.currentOpacity ?? 100)

// Paleta de cores do QROfertas (amostra representativa das 1629 cores)
const colorPalette = [
  // Brancos e neutros
  { bg: '#ffffff', color: '#000000' },
  { bg: '#f5f5f5', color: '#000000' },
  { bg: '#e0e0e0', color: '#000000' },
  { bg: '#bdbdbd', color: '#000000' },
  { bg: '#9e9e9e', color: '#ffffff' },
  { bg: '#757575', color: '#ffffff' },
  { bg: '#616161', color: '#ffffff' },
  { bg: '#424242', color: '#ffffff' },
  { bg: '#212121', color: '#ffffff' },
  { bg: '#000000', color: '#ffffff' },
  // Vermelhos
  { bg: '#ffebee', color: '#000000' },
  { bg: '#ef9a9a', color: '#000000' },
  { bg: '#ef5350', color: '#ffffff' },
  { bg: '#f44336', color: '#ffffff' },
  { bg: '#e53935', color: '#ffffff' },
  { bg: '#d32f2f', color: '#ffffff' },
  { bg: '#c62828', color: '#ffffff' },
  { bg: '#b71c1c', color: '#ffffff' },
  { bg: '#bc1c1a', color: '#ffffff' },
  { bg: '#870000', color: '#ffffff' },
  { bg: '#840c0c', color: '#ffffff' },
  // Rosas
  { bg: '#fce4ec', color: '#000000' },
  { bg: '#f48fb1', color: '#000000' },
  { bg: '#ec407a', color: '#ffffff' },
  { bg: '#e91e63', color: '#ffffff' },
  { bg: '#c2185b', color: '#ffffff' },
  { bg: '#880e4f', color: '#ffffff' },
  // Roxos
  { bg: '#f3e5f5', color: '#000000' },
  { bg: '#ce93d8', color: '#000000' },
  { bg: '#ab47bc', color: '#ffffff' },
  { bg: '#9c27b0', color: '#ffffff' },
  { bg: '#7b1fa2', color: '#ffffff' },
  { bg: '#4a148c', color: '#ffffff' },
  { bg: '#7200ca', color: '#ffffff' },
  // Azuis
  { bg: '#e3f2fd', color: '#000000' },
  { bg: '#90caf9', color: '#000000' },
  { bg: '#42a5f5', color: '#ffffff' },
  { bg: '#2196f3', color: '#ffffff' },
  { bg: '#1976d2', color: '#ffffff' },
  { bg: '#1565c0', color: '#ffffff' },
  { bg: '#0d47a1', color: '#ffffff' },
  { bg: '#050a30', color: '#ffffff' },
  { bg: '#1a1f3a', color: '#ffffff' },
  // Azuis claros
  { bg: '#e0f7fa', color: '#000000' },
  { bg: '#80deea', color: '#000000' },
  { bg: '#26c6da', color: '#000000' },
  { bg: '#00bcd4', color: '#ffffff' },
  { bg: '#00838f', color: '#ffffff' },
  { bg: '#006064', color: '#ffffff' },
  // Verdes
  { bg: '#e8f5e9', color: '#000000' },
  { bg: '#a5d6a7', color: '#000000' },
  { bg: '#66bb6a', color: '#ffffff' },
  { bg: '#4caf50', color: '#ffffff' },
  { bg: '#388e3c', color: '#ffffff' },
  { bg: '#2e7d32', color: '#ffffff' },
  { bg: '#1b5e20', color: '#ffffff' },
  { bg: '#1f5812', color: '#ffffff' },
  { bg: '#00600f', color: '#ffffff' },
  { bg: '#22c55e', color: '#ffffff' },
  { bg: '#8fbb44', color: '#000000' },
  // Amarelos
  { bg: '#fffde7', color: '#000000' },
  { bg: '#fff59d', color: '#000000' },
  { bg: '#ffee58', color: '#000000' },
  { bg: '#ffeb3b', color: '#000000' },
  { bg: '#fdd835', color: '#000000' },
  { bg: '#f9a825', color: '#000000' },
  { bg: '#f57f17', color: '#ffffff' },
  { bg: '#ffff00', color: '#000000' },
  { bg: '#ffea00', color: '#000000' },
  { bg: '#ffe300', color: '#000000' },
  { bg: '#ffd88d', color: '#000000' },
  { bg: '#ffd700', color: '#000000' },
  // Laranjas
  { bg: '#fff3e0', color: '#000000' },
  { bg: '#ffcc80', color: '#000000' },
  { bg: '#ffa726', color: '#000000' },
  { bg: '#ff9800', color: '#000000' },
  { bg: '#f57c00', color: '#ffffff' },
  { bg: '#e65100', color: '#ffffff' },
  { bg: '#bf360c', color: '#ffffff' },
  { bg: '#f77f00', color: '#ffffff' },
  // Marrons
  { bg: '#efebe9', color: '#000000' },
  { bg: '#bcaaa4', color: '#000000' },
  { bg: '#8d6e63', color: '#ffffff' },
  { bg: '#795548', color: '#ffffff' },
  { bg: '#5d4037', color: '#ffffff' },
  { bg: '#3e2723', color: '#ffffff' },
  // Especiais
  { bg: '#faf33e', color: '#000000' },
  { bg: '#ff2d3d', color: '#ffffff' },
  { bg: '#f4ddbb', color: '#000000' },
]

// Opcao sem fundo
const selectNoBackground = () => {
  emit('select', { bg: 'transparent', textColor: '#000000', opacity: 1 })
  emit('update:modelValue', false)
}

const selectColor = (item: { bg: string; color: string }) => {
  emit('select', { bg: item.bg, textColor: item.color, opacity: opacity.value / 100 })
  emit('update:modelValue', false)
}

const close = () => emit('update:modelValue', false)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      :style="{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }"
      @click.self="close"
    >
      <div
        :style="{
          background: '#fff', borderRadius: '12px',
          width: '480px', maxWidth: '95vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }"
      >
        <!-- Header -->
        <div :style="{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }">
          <span :style="{ fontWeight: 700, fontSize: '16px', color: '#1a1f3a' }">Trocar Cor de Fundo</span>
          <button
            type="button"
            :style="{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666', padding: '4px' }"
            @click="close"
          >&times;</button>
        </div>

        <!-- Grade de cores -->
        <div :style="{ padding: '16px 20px', overflowY: 'auto', flex: 1 }">
          <div :style="{ marginBottom: '12px', fontSize: '13px', fontWeight: 600, color: '#555' }">Cor de Fundo:</div>

          <!-- Sem fundo -->
          <button
            type="button"
            :style="{
              width: '100%', padding: '8px', marginBottom: '12px',
              border: '2px dashed #ccc', borderRadius: '8px',
              background: 'repeating-conic-gradient(#e0e0e0 0% 25%, transparent 0% 50%) 50% / 16px 16px',
              cursor: 'pointer', fontSize: '12px', color: '#666', fontWeight: 600,
            }"
            @click="selectNoBackground"
          >Sem Fundo (Transparente)</button>

          <!-- Grade -->
          <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }">
            <button
              v-for="(item, idx) in colorPalette"
              :key="idx"
              type="button"
              :style="{
                width: '100%', aspectRatio: '1', borderRadius: '6px',
                border: currentBg === item.bg ? '3px solid #2196f3' : '1px solid rgba(0,0,0,0.1)',
                background: item.bg, cursor: 'pointer',
                transition: 'transform 0.1s',
              }"
              :title="item.bg"
              @click="selectColor(item)"
            />
          </div>

          <!-- Transparencia -->
          <div :style="{ marginTop: '16px' }">
            <div :style="{ fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' }">
              Transparência: {{ opacity }}%
            </div>
            <input
              v-model.number="opacity"
              type="range"
              min="0"
              max="100"
              :style="{ width: '100%' }"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
