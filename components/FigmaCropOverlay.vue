<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

/**
 * FigmaCropOverlay - Componente de seleção/crop estilo Figma
 *
 * Características:
 * - Borda azul (#0d99ff) ao redor da área de seleção
 * - 8 handles brancos (4 quinas + 4 pontos médios)
 * - Label de dimensões na parte inferior (ex: "335 × 502")
 * - Nome do frame no topo
 * - Interatividade para redimensionar movendo os handles
 */

interface Props {
  modelValue: boolean // Se o crop está ativo
  frameRect: { x: number; y: number; width: number; height: number }
  frameName?: string
  zoom?: number
  canvasOffset?: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  zoom: 1,
  canvasOffset: () => ({ x: 0, y: 0 })
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:frameRect', value: { x: number; y: number; width: number; height: number }): void
  (e: 'crop-complete', value: { x: number; y: number; width: number; height: number }): void
}>()

// Estado local para o rect durante o drag
const localRect = ref({ ...props.frameRect })

// Estado do drag
const isDragging = ref(false)
const dragHandle = ref<string | null>(null)
const dragStart = ref({ x: 0, y: 0 })
const dragStartRect = ref({ x: 0, y: 0, width: 0, height: 0 })

// Tamanho dos handles
const HANDLE_SIZE = 8
const HIT_SIZE = 16

// Símbolo de multiplicação para dimensões
const TIMES = '\u00D7'

// Estilo computado do overlay
const overlayStyle = computed(() => {
  const r = localRect.value
  const z = props.zoom

  return {
    transform: `translate(${props.canvasOffset.x}px, ${props.canvasOffset.y}px)`,
    pointerEvents: props.modelValue ? 'auto' : 'none'
  }
})

// Posição do frame
const frameStyle = computed(() => {
  const r = localRect.value
  const z = props.zoom

  return {
    left: `${r.x * z}px`,
    top: `${r.y * z}px`,
    width: `${r.width * z}px`,
    height: `${r.height * z}px`
  }
})

// Dimensões formatadas
const dimensionLabel = computed(() => {
  const w = Math.round(localRect.value.width)
  const h = Math.round(localRect.value.height)
  return `${w} ${TIMES} ${h}`
})

// Nome do frame
const displayName = computed(() => props.frameName || 'Frame 1')

// Handlers positions e estilos
const createHandleStyle = (position: string) => {
  const r = localRect.value
  const z = props.zoom

  const styles: Record<string, any> = {
    position: 'absolute',
    width: `${HANDLE_SIZE * z}px`,
    height: `${HANDLE_SIZE * z}px`,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    border: '2px solid #0d99ff',
    cursor: 'pointer',
    zIndex: 1000
  }

  switch (position) {
    case 'nw':
      styles.left = `${-HANDLE_SIZE / 2 * z}px`
      styles.top = `${-HANDLE_SIZE / 2 * z}px`
      styles.cursor = 'nwse-resize'
      break
    case 'n':
      styles.left = `${(r.width * z) / 2 - (HANDLE_SIZE * z) / 2}px`
      styles.top = `${-HANDLE_SIZE / 2 * z}px`
      styles.cursor = 'ns-resize'
      break
    case 'ne':
      styles.right = `${-HANDLE_SIZE / 2 * z}px`
      styles.top = `${-HANDLE_SIZE / 2 * z}px`
      styles.cursor = 'nesw-resize'
      break
    case 'e':
      styles.right = `${-HANDLE_SIZE / 2 * z}px`
      styles.top = `${(r.height * z) / 2 - (HANDLE_SIZE * z) / 2}px`
      styles.cursor = 'ew-resize'
      break
    case 'se':
      styles.right = `${-HANDLE_SIZE / 2 * z}px`
      styles.bottom = `${-HANDLE_SIZE / 2 * z}px`
      styles.cursor = 'nwse-resize'
      break
    case 's':
      styles.left = `${(r.width * z) / 2 - (HANDLE_SIZE * z) / 2}px`
      styles.bottom = `${-HANDLE_SIZE / 2 * z}px`
      styles.cursor = 'ns-resize'
      break
    case 'sw':
      styles.left = `${-HANDLE_SIZE / 2 * z}px`
      styles.bottom = `${-HANDLE_SIZE / 2 * z}px`
      styles.cursor = 'nesw-resize'
      break
    case 'w':
      styles.left = `${-HANDLE_SIZE / 2 * z}px`
      styles.top = `${(r.height * z) / 2 - (HANDLE_SIZE * z) / 2}px`
      styles.cursor = 'ew-resize'
      break
  }

  return styles
}

// Handle events
const handleMouseDown = (handle: string, event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  isDragging.value = true
  dragHandle.value = handle
  dragStart.value = { x: event.clientX, y: event.clientY }
  dragStartRect.value = { ...localRect.value }

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !dragHandle.value) return

  const dx = (event.clientX - dragStart.value.x) / props.zoom
  const dy = (event.clientY - dragStart.value.y) / props.zoom

  const start = dragStartRect.value
  const MIN_SIZE = 20

  let newX = start.x
  let newY = start.y
  let newWidth = start.width
  let newHeight = start.height

  // Aplicar mudanças baseado no handle
  const h = dragHandle.value

  // Norte/Sul (altura)
  if (h.includes('n')) {
    newY = start.y + dy
    newHeight = start.height - dy
    if (newHeight < MIN_SIZE) {
      newHeight = MIN_SIZE
      newY = start.y + start.height - MIN_SIZE
    }
  } else if (h.includes('s')) {
    newHeight = start.height + dy
    if (newHeight < MIN_SIZE) {
      newHeight = MIN_SIZE
    }
  }

  // Oeste/Leste (largura)
  if (h.includes('w')) {
    newX = start.x + dx
    newWidth = start.width - dx
    if (newWidth < MIN_SIZE) {
      newWidth = MIN_SIZE
      newX = start.x + start.width - MIN_SIZE
    }
  } else if (h.includes('e')) {
    newWidth = start.width + dx
    if (newWidth < MIN_SIZE) {
      newWidth = MIN_SIZE
    }
  }

  localRect.value = {
    x: Math.round(newX),
    y: Math.round(newY),
    width: Math.round(newWidth),
    height: Math.round(newHeight)
  }

  emit('update:frameRect', localRect.value)
}

const handleMouseUp = () => {
  if (isDragging.value) {
    emit('crop-complete', localRect.value)
  }

  isDragging.value = false
  dragHandle.value = null

  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

// Sincronizar com props
watch(() => props.frameRect, (newRect) => {
  if (!isDragging.value) {
    localRect.value = { ...newRect }
  }
}, { deep: true })

// Cleanup
onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('keydown', handleKeydown)
})

// Tecla Enter para confirmar, Escape para cancelar
const handleKeydown = (event: KeyboardEvent) => {
  // Só processar se o crop estiver ativo
  if (!props.modelValue) return

  // Ignorar atalhos com Ctrl/Cmd para não interferir com o sistema (undo, redo, etc)
  if (event.ctrlKey || event.metaKey) return

  // Só processar Enter e Escape
  if (event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    emit('crop-complete', localRect.value)
    emit('update:modelValue', false)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('update:modelValue', false)
  }
}

// Adicionar/remover listener de keyboard dinamicamente
watch(() => props.modelValue, (isActive) => {
  if (isActive) {
    window.addEventListener('keydown', handleKeydown)
  } else {
    window.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 pointer-events-none z-100"
      :style="{ pointerEvents: isDragging ? 'auto' : 'none' }"
    >
      <!-- Frame Border e Handles -->
      <div
        class="absolute"
        :style="frameStyle"
      >
        <!-- Borda azul estilo Figma -->
        <div class="absolute inset-0 border-2 border-[#0d99ff] pointer-events-none rounded-sm" />

        <!-- Nome do Frame (topo) -->
        <div
          class="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-zinc-400 whitespace-nowrap font-medium pointer-events-none"
        >
          {{ displayName }}
        </div>

        <!-- Label de dimensões (parte inferior) -->
        <div
          class="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#0d99ff] text-white text-xs font-medium rounded-sm whitespace-nowrap pointer-events-none"
        >
          {{ dimensionLabel }}
        </div>

        <!-- 8 Handles brancos estilo Figma -->
        <!-- Cantos -->
        <div
          class="handle pointer-events-auto"
          :style="createHandleStyle('nw')"
          @mousedown="(e) => handleMouseDown('nw', e as MouseEvent)"
          title="Redimensionar (canto superior esquerdo)"
        />
        <div
          class="handle pointer-events-auto"
          :style="createHandleStyle('ne')"
          @mousedown="(e) => handleMouseDown('ne', e as MouseEvent)"
          title="Redimensionar (canto superior direito)"
        />
        <div
          class="handle pointer-events-auto"
          :style="createHandleStyle('se')"
          @mousedown="(e) => handleMouseDown('se', e as MouseEvent)"
          title="Redimensionar (canto inferior direito)"
        />
        <div
          class="handle pointer-events-auto"
          :style="createHandleStyle('sw')"
          @mousedown="(e) => handleMouseDown('sw', e as MouseEvent)"
          title="Redimensionar (canto inferior esquerdo)"
        />

        <!-- Pontos médios -->
        <div
          class="handle pointer-events-auto"
          :style="createHandleStyle('n')"
          @mousedown="(e) => handleMouseDown('n', e as MouseEvent)"
          title="Redimensionar (topo)"
        />
        <div
          class="handle pointer-events-auto"
          :style="createHandleStyle('e')"
          @mousedown="(e) => handleMouseDown('e', e as MouseEvent)"
          title="Redimensionar (direita)"
        />
        <div
          class="handle pointer-events-auto"
          :style="createHandleStyle('s')"
          @mousedown="(e) => handleMouseDown('s', e as MouseEvent)"
          title="Redimensionar (base)"
        />
        <div
          class="handle pointer-events-auto"
          :style="createHandleStyle('w')"
          @mousedown="(e) => handleMouseDown('w', e as MouseEvent)"
          title="Redimensionar (esquerda)"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.handle {
  transition: transform 0.1s ease;
}

.handle:hover {
  transform: scale(1.2);
}

.handle:active {
  transform: scale(0.9);
}
</style>
