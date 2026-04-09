<script setup lang="ts">
/**
 * BuilderImageEditorModal — Editor visual de imagem do produto
 * Baseado na documentacao QROfertas secao 21 (Modal "Editar Imagem")
 *
 * Funcionalidades:
 * - Ampliar e sobrepor (zoom + drag)
 * - Ampliar para o centro (toggle)
 * - Templates de composicao (layouts de multiplas imagens)
 * - Salvar e aplicar
 */
import {
  X,
  ZoomIn,
  Move,
  RotateCcw,
  Save,
  Maximize2,
  Grid3X3,
  Rows3,
  Columns3,
} from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  imageUrl: string | null
  imageZoom: number
  imageX: number
  imageY: number
  extraImages: string[]
  extraImagesLayout: 'auto' | 'horizontal' | 'vertical' | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'save', data: {
    zoom: number
    x: number
    y: number
    extraImagesLayout: 'auto' | 'horizontal' | 'vertical' | null
  }): void
}>()

// Estado local (copia para permitir cancelar)
const localZoom = ref(props.imageZoom || 100)
const localX = ref(props.imageX || 0)
const localY = ref(props.imageY || 0)
const centerOnZoom = ref(true)
const localLayout = ref<'auto' | 'horizontal' | 'vertical'>(
  (props.extraImagesLayout as any) || 'auto'
)

// Sync quando abre
watch(() => props.modelValue, (open) => {
  if (open) {
    localZoom.value = props.imageZoom || 100
    localX.value = props.imageX || 0
    localY.value = props.imageY || 0
    localLayout.value = (props.extraImagesLayout as any) || 'auto'
  }
})

// Canva de preview
const canvaRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragStartOffsetX = 0
let dragStartOffsetY = 0

const imageStyle = computed(() => {
  if (!props.imageUrl) return {}
  return {
    position: 'absolute' as const,
    width: `${localZoom.value}%`,
    height: `${localZoom.value}%`,
    left: `${localX.value}px`,
    top: `${localY.value}px`,
    backgroundImage: `url('${props.imageUrl}')`,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    cursor: localZoom.value > 100 ? 'grab' : 'default',
    userSelect: 'none' as const,
    transition: isDragging.value ? 'none' : 'all 0.15s ease',
  }
})

const handleZoom = (e: Event) => {
  const newZoom = Number((e.target as HTMLInputElement).value)
  const oldZoom = localZoom.value
  const container = canvaRef.value
  if (centerOnZoom.value && container) {
    const cw = container.offsetWidth
    const ch = container.offsetHeight
    const scale = (newZoom - oldZoom) / 100
    localX.value = localX.value - (cw * scale) / 2
    localY.value = localY.value - (ch * scale) / 2
  }
  localZoom.value = newZoom
}

const resetPosition = () => {
  localZoom.value = 100
  localX.value = 0
  localY.value = 0
}

const startDrag = (e: MouseEvent | TouchEvent) => {
  if (localZoom.value <= 100) return
  e.preventDefault()
  isDragging.value = true
  const point = 'touches' in e ? (e as TouchEvent).touches[0]! : (e as MouseEvent)
  dragStartX = point.clientX
  dragStartY = point.clientY
  dragStartOffsetX = localX.value
  dragStartOffsetY = localY.value
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
}

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  e.preventDefault()
  const point = 'touches' in e ? (e as TouchEvent).touches[0]! : (e as MouseEvent)
  localX.value = dragStartOffsetX + (point.clientX - dragStartX)
  localY.value = dragStartOffsetY + (point.clientY - dragStartY)
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
}

// Templates de composicao (layouts de multiplas imagens)
interface CompositionTemplate {
  id: string
  label: string
  images: number
  layout: 'horizontal' | 'vertical' | 'grid'
  icon: any
}

const compositionTemplates: CompositionTemplate[] = [
  { id: 'original', label: 'Imagem Original', images: 1, layout: 'horizontal', icon: Maximize2 },
  { id: 'h2', label: '2 Horizontal', images: 2, layout: 'horizontal', icon: Columns3 },
  { id: 'v2', label: '2 Vertical', images: 2, layout: 'vertical', icon: Rows3 },
  { id: 'h3', label: '3 Horizontal', images: 3, layout: 'horizontal', icon: Columns3 },
  { id: 'v3', label: '3 Vertical', images: 3, layout: 'vertical', icon: Rows3 },
  { id: 'g4', label: '4 Grade', images: 4, layout: 'grid', icon: Grid3X3 },
  { id: 'h4', label: '4 Horizontal', images: 4, layout: 'horizontal', icon: Columns3 },
  { id: 'v4', label: '4 Vertical', images: 4, layout: 'vertical', icon: Rows3 },
  { id: 'g6', label: '6 Grade', images: 6, layout: 'grid', icon: Grid3X3 },
  { id: 'g9', label: '9 Grade', images: 9, layout: 'grid', icon: Grid3X3 },
]

const selectedTemplate = ref('original')

const selectTemplate = (tpl: CompositionTemplate) => {
  selectedTemplate.value = tpl.id
  if (tpl.id === 'original') {
    localLayout.value = 'auto'
  } else {
    localLayout.value = tpl.layout === 'grid' ? 'auto' :
      tpl.layout as 'horizontal' | 'vertical'
  }
}

// Salvar e aplicar
const handleSave = () => {
  emit('save', {
    zoom: localZoom.value,
    x: localX.value,
    y: localY.value,
    extraImagesLayout: localLayout.value,
  })
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
        background: 'rgba(0,0,0,0.7)',
      }"
      @click.self="close"
    >
      <div
        :style="{
          background: '#1a1a1a', borderRadius: '16px',
          width: '720px', maxWidth: '95vw', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
          color: '#fff',
        }"
      >
        <!-- Header -->
        <div :style="{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }">
          <span :style="{ fontWeight: 700, fontSize: '16px' }">Editar Imagem</span>
          <button
            type="button"
            :style="{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }"
            @click="close"
          >
            <X :style="{ width: '20px', height: '20px' }" />
          </button>
        </div>

        <!-- Body: canvas + controls -->
        <div :style="{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }">

          <!-- Painel esquerdo: Canvas de edicao -->
          <div :style="{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', minWidth: 0 }">
            <!-- Canvas principal -->
            <div
              ref="canvaRef"
              :style="{
                flex: 1, position: 'relative', overflow: 'hidden',
                background: 'repeating-conic-gradient(#2a2a2a 0% 25%, #1e1e1e 0% 50%) 50% / 20px 20px',
                borderRadius: '12px', minHeight: '300px',
                border: '1px solid rgba(255,255,255,0.06)',
              }"
            >
              <div
                v-if="imageUrl"
                :style="imageStyle"
                @mousedown="startDrag"
                @touchstart="startDrag"
                :class="isDragging ? 'cursor-grabbing' : ''"
              />
              <span v-else :style="{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '14px' }">
                Nenhuma imagem selecionada
              </span>
            </div>

            <!-- Controles de zoom e drag -->
            <div :style="{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }">
              <!-- Ampliar e Sobrepor -->
              <div :style="{ display: 'flex', alignItems: 'center', gap: '10px' }">
                <ZoomIn :style="{ width: '16px', height: '16px', color: '#888', flexShrink: 0 }" />
                <label :style="{ fontSize: '12px', color: '#aaa', whiteSpace: 'nowrap' }">Ampliar e Sobrepor</label>
                <input
                  type="range"
                  min="50"
                  max="400"
                  step="5"
                  :value="localZoom"
                  @input="handleZoom"
                  :style="{ flex: 1, accentColor: '#10b981' }"
                />
                <span :style="{ fontSize: '12px', color: '#aaa', width: '40px', textAlign: 'right' }">{{ localZoom }}%</span>
              </div>

              <!-- Orientacao de arraste -->
              <div :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }">
                <span :style="{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }">
                  <Move :style="{ width: '14px', height: '14px' }" />
                  Clique e arraste para ajustar
                </span>

                <!-- Ampliar para o Centro (toggle) -->
                <label :style="{ fontSize: '11px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }">
                  <input
                    type="checkbox"
                    v-model="centerOnZoom"
                    :style="{ width: '14px', height: '14px', accentColor: '#10b981' }"
                  />
                  Ampliar para o Centro
                </label>
              </div>

              <!-- Botoes de acao -->
              <div :style="{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }">
                <button
                  type="button"
                  @click="resetPosition"
                  :style="{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '6px 12px', borderRadius: '8px', fontSize: '12px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ccc', cursor: 'pointer',
                  }"
                >
                  <RotateCcw :style="{ width: '14px', height: '14px' }" />
                  Voltar ao Padrao Inicial
                </button>
                <div :style="{ flex: 1 }" />
                <button
                  type="button"
                  @click="handleSave"
                  :style="{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                    background: '#10b981', border: 'none',
                    color: '#fff', cursor: 'pointer',
                  }"
                >
                  <Save :style="{ width: '16px', height: '16px' }" />
                  Salvar e Aplicar
                </button>
              </div>
            </div>
          </div>

          <!-- Painel direito: Templates de composicao -->
          <div :style="{
            width: '200px', borderLeft: '1px solid rgba(255,255,255,0.06)',
            padding: '12px', overflowY: 'auto', flexShrink: 0,
          }">
            <div :style="{ fontSize: '12px', fontWeight: 600, color: '#aaa', marginBottom: '10px' }">
              Templates de Composicao
            </div>

            <!-- Layout das imagens duplicadas -->
            <div v-if="extraImages.length > 0" :style="{ marginBottom: '12px' }">
              <div :style="{ fontSize: '10px', color: '#666', marginBottom: '6px' }">Layout das Imagens</div>
              <div :style="{ display: 'flex', gap: '4px' }">
                <button
                  v-for="opt in [
                    { value: 'auto', label: 'Auto' },
                    { value: 'horizontal', label: 'Horiz.' },
                    { value: 'vertical', label: 'Vert.' },
                  ]"
                  :key="opt.value"
                  type="button"
                  @click="localLayout = opt.value as any"
                  :style="{
                    flex: 1, padding: '4px', borderRadius: '6px', fontSize: '10px',
                    border: localLayout === opt.value ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    background: localLayout === opt.value ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                    color: localLayout === opt.value ? '#10b981' : '#888',
                    cursor: 'pointer', textAlign: 'center',
                  }"
                >{{ opt.label }}</button>
              </div>
            </div>

            <!-- Grade de templates -->
            <div :style="{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }">
              <button
                v-for="tpl in compositionTemplates"
                :key="tpl.id"
                type="button"
                @click="selectTemplate(tpl)"
                :style="{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '4px', padding: '8px 4px', borderRadius: '8px',
                  border: selectedTemplate === tpl.id ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                  background: selectedTemplate === tpl.id ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }"
              >
                <component
                  :is="tpl.icon"
                  :style="{ width: '18px', height: '18px', color: selectedTemplate === tpl.id ? '#10b981' : '#666' }"
                />
                <span :style="{ fontSize: '9px', color: selectedTemplate === tpl.id ? '#10b981' : '#888', textAlign: 'center', lineHeight: 1.2 }">
                  {{ tpl.label }}
                </span>
              </button>
            </div>

            <!-- Info -->
            <div :style="{ marginTop: '16px', fontSize: '10px', color: '#555', lineHeight: 1.4 }">
              Selecione um template para definir como as imagens do produto serao compostas no card.
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
