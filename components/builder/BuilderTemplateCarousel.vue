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

<!-- Mini preview sub-component -->
<script lang="ts">
const TemplatePreview = defineComponent({
  props: {
    template: { type: Object as PropType<BuilderCardTemplate>, required: true },
  },
  setup(props) {
    const isHorizontal = computed(() => props.template.category === 'horizontal')
    const hasOverlay = computed(() =>
      props.template.card_style?.pricePosition?.startsWith('overlay')
    )

    const elements = computed(() => {
      const els = props.template.elements || []
      return els
        .filter(e => ['image', 'text', 'price'].includes(e.type))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    })

    return { isHorizontal, hasOverlay, elements }
  },
  template: `
    <div
      class="w-full h-full flex gap-0.5 rounded overflow-hidden"
      :class="isHorizontal ? 'flex-row' : 'flex-col'"
    >
      <template v-for="el in elements" :key="el.id">
        <div
          v-if="el.type === 'image'"
          class="bg-blue-100 dark:bg-blue-900/30 rounded-sm flex items-center justify-center"
          :class="hasOverlay ? 'relative' : ''"
          :style="{ flex: el.flex || 2 }"
        >
          <svg class="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div
          v-else-if="el.type === 'text'"
          class="bg-gray-100 dark:bg-gray-700 rounded-sm flex items-center justify-center px-1"
          :style="{ flex: el.flex || 1 }"
        >
          <div class="w-full space-y-0.5">
            <div class="h-0.5 bg-gray-300 dark:bg-gray-500 rounded-full w-3/4 mx-auto"></div>
            <div class="h-0.5 bg-gray-300 dark:bg-gray-500 rounded-full w-1/2 mx-auto"></div>
          </div>
        </div>
        <div
          v-else-if="el.type === 'price'"
          class="rounded-sm flex items-center justify-center"
          :class="el.slot?.startsWith('overlay')
            ? 'absolute bottom-0 left-0 right-0 bg-red-500/80 text-white'
            : 'bg-red-50 dark:bg-red-900/20'"
          :style="{ flex: el.flex || 1 }"
        >
          <span class="text-[8px] font-bold text-red-500">R$</span>
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
</style>
