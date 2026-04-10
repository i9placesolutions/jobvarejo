<template>
  <div class="builder-template-carousel">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Modelos disponeis
      </h3>
      <div class="flex gap-1">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="px-2 py-1 text-xs rounded-md transition-colors"
          :class="activeCategory === cat.id
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'"
          @click="activeCategory = cat.id"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Carousel -->
    <div
      ref="carouselRef"
      class="flex gap-3 overflow-x-auto px-3 py-3 scroll-smooth"
      style="scrollbar-width: thin;"
    >
      <button
        v-for="tpl in filteredTemplates"
        :key="tpl.id"
        class="flex-shrink-0 rounded-lg border-2 transition-all duration-200 hover:shadow-md"
        :class="isActive(tpl.id)
          ? 'border-blue-500 shadow-md ring-2 ring-blue-200'
          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'"
        :title="tpl.name"
        @click="selectTemplate(tpl)"
      >
        <!-- Mini preview card -->
        <div class="w-20 h-24 p-1 flex flex-col items-center justify-center gap-0.5 bg-white dark:bg-gray-800 rounded-md">
          <TemplatePreview :template="tpl" />
        </div>
        <div class="text-[10px] text-center pb-1 px-1 truncate max-w-20 text-gray-500 dark:text-gray-400">
          {{ tpl.name }}
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BuilderCardTemplate } from '~/types/builder'
import { QRO_CARD_TEMPLATES, QRO_TEMPLATE_CATEGORIES } from '~/utils/qro-card-templates'

const props = defineProps<{
  modelValue?: string | null
  templates?: BuilderCardTemplate[]
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string]
  'select': [template: BuilderCardTemplate]
}>()

const carouselRef = ref<HTMLElement>()
const activeCategory = ref('vertical')

const categories = computed(() => QRO_TEMPLATE_CATEGORIES)

const allTemplates = computed(() => {
  return props.templates?.length ? props.templates : QRO_CARD_TEMPLATES
})

const filteredTemplates = computed(() => {
  if (activeCategory.value === 'all') return allTemplates.value
  return allTemplates.value.filter(t => t.category === activeCategory.value)
})

function isActive(id: string) {
  return props.modelValue === id
}

function selectTemplate(tpl: BuilderCardTemplate) {
  emit('update:modelValue', tpl.id)
  emit('select', tpl)
}
</script>

<!-- Mini preview sub-component — usa V2 presets para thumbs fieis -->
<script lang="ts">
import { V2_PRESETS } from '~/utils/qro-card-v2-presets'

const TemplatePreview = defineComponent({
  props: {
    template: { type: Object as PropType<BuilderCardTemplate>, required: true },
  },
  setup(props) {
    const v2Preset = computed(() => V2_PRESETS[props.template.id] || null)
    const isExotic = computed(() => v2Preset.value?.layoutKind === 'exotic')
    const exoticClass = computed(() => isExotic.value ? `thumb--${props.template.id}` : '')
    const gridStyle = computed(() => {
      const p = v2Preset.value
      if (!p || p.layoutKind !== 'grid') return {}
      return {
        display: 'grid',
        gridTemplateAreas: p.areas,
        gridTemplateRows: p.rows,
        gridTemplateColumns: p.cols || '1fr',
        gap: '1px',
      } as Record<string, string>
    })
    return { v2Preset, isExotic, exoticClass, gridStyle }
  },
  template: `
    <div
      class="w-full h-full rounded overflow-hidden relative"
      :class="[isExotic ? 'thumb-exotic' : '', exoticClass]"
      :style="gridStyle"
    >
      <!-- Layout grid: usa grid-area -->
      <template v-if="v2Preset && v2Preset.layoutKind === 'grid'">
        <div class="thumb-slot thumb-name" style="grid-area: name">
          <div class="h-0.5 bg-gray-400 rounded-full w-3/4 mx-auto"></div>
          <div class="h-0.5 bg-gray-300 rounded-full w-1/2 mx-auto mt-0.5"></div>
        </div>
        <div class="thumb-slot thumb-image" style="grid-area: image">
          <svg class="w-3 h-3 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-6-10h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div class="thumb-slot thumb-price" style="grid-area: price">
          <span class="text-[7px] font-bold text-red-500">R$</span>
        </div>
      </template>
      <!-- Layout exotico: imagem full-bleed + slots posicionados via class -->
      <template v-else-if="isExotic">
        <div class="thumb-image-full">
          <svg class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-6-10h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div class="thumb-name-abs">
          <div class="h-0.5 bg-gray-400 rounded-full w-2/3"></div>
        </div>
        <div class="thumb-price-abs">
          <span class="text-[6px] font-bold text-red-500">R$</span>
        </div>
      </template>
    </div>
  `,
})
</script>

<style scoped>
.builder-template-carousel {
  background: var(--builder-surface, #f9fafb);
  border-radius: 8px;
  overflow: hidden;
}

/* Hide scrollbar but keep scrollability */
.builder-template-carousel .overflow-x-auto::-webkit-scrollbar {
  height: 4px;
}
.builder-template-carousel .overflow-x-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

/* ═══ Thumbs dos 25 presets v2 ═══ */
.thumb-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}
.thumb-name {
  background: #f3f4f6;
  border-radius: 2px;
  padding: 1px 2px;
  flex-direction: column;
}
.thumb-image {
  background: #dbeafe;
  border-radius: 2px;
}
.thumb-price {
  background: #fee2e2;
  border-radius: 2px;
}

/* Thumb exotico base */
.thumb-exotic {
  background: #dbeafe;
}
.thumb-image-full {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #dbeafe;
}
.thumb-name-abs {
  position: absolute;
  z-index: 2;
  left: 3px;
  right: 3px;
  top: 3px;
  display: flex;
  align-items: center;
}
.thumb-price-abs {
  position: absolute;
  z-index: 2;
  bottom: 3px;
  right: 3px;
  background: #fee2e2;
  padding: 1px 3px;
  border-radius: 2px;
  line-height: 1;
}

/* Variacoes exoticas por preset id */
.thumb--qro-vertical-shelf .thumb-name-abs {
  top: 0;
  left: 0;
  right: 0;
  background: #dc2626;
  padding: 2px 3px;
  border-radius: 0;
}
.thumb--qro-vertical-shelf .thumb-name-abs > div {
  background: #fca5a5;
}
.thumb--qro-vertical-shelf .thumb-price-abs {
  bottom: 3px;
  left: 3px;
  right: 3px;
  text-align: center;
  justify-content: center;
  display: flex;
}

.thumb--qro-vertical-price-band .thumb-price-abs {
  top: 50%;
  left: 3px;
  right: 3px;
  transform: translateY(-50%);
  text-align: center;
  display: flex;
  justify-content: center;
}
.thumb--qro-vertical-price-band .thumb-name-abs {
  top: auto;
  bottom: 3px;
}

.thumb--qro-destaque-overlay .thumb-price-abs {
  right: 3px;
  bottom: 3px;
  width: 50%;
  display: flex;
  justify-content: center;
}

.thumb--qro-special-overlay::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 55%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  z-index: 1;
}
.thumb--qro-special-overlay .thumb-name-abs {
  top: auto;
  bottom: 12px;
  z-index: 3;
}
.thumb--qro-special-overlay .thumb-name-abs > div {
  background: #f3f4f6;
}
.thumb--qro-special-overlay .thumb-price-abs {
  z-index: 3;
  left: 3px;
  right: 3px;
  bottom: 3px;
  display: flex;
  justify-content: center;
}

.thumb--qro-special-diagonal .thumb-image-full {
  clip-path: polygon(0 0, 100% 0, 100% 68%, 0 100%);
}
.thumb--qro-special-diagonal .thumb-name-abs {
  top: 3px;
  display: flex;
  justify-content: center;
}

.thumb--qro-special-price-stamp .thumb-price-abs {
  top: 3px;
  right: 3px;
  bottom: auto;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transform: rotate(-8deg);
}
.thumb--qro-special-price-stamp .thumb-price-abs > span {
  color: #fff;
  font-size: 6px;
}
.thumb--qro-special-price-stamp .thumb-name-abs {
  top: auto;
  bottom: 3px;
  display: flex;
  justify-content: center;
}
</style>
