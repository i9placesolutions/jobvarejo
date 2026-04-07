import type { BuilderCardTemplate, CardTemplateElement } from '~/types/builder'

export type LayoutMode = 'vertical' | 'horizontal' | 'overlay' | 'mixed'

export interface SlotGroup {
  main: CardTemplateElement[]
  left: CardTemplateElement[]
  right: CardTemplateElement[]
  'right-top': CardTemplateElement[]
  'right-bottom': CardTemplateElement[]
  'overlay-top': CardTemplateElement[]
  'overlay-bottom': CardTemplateElement[]
  'overlay-center': CardTemplateElement[]
  overlay: CardTemplateElement[]
}

/**
 * Composable for managing card layout based on template configuration.
 * Supports all QROfertas-style layout variations:
 * - Vertical: image top, content below
 * - Horizontal: image left/right, content beside
 * - Overlay: price/name overlaid on image
 * - Mixed: combination of slots
 */
export function useCardLayout(template: Ref<BuilderCardTemplate | null | undefined>) {
  // Group elements by slot
  const slotGroups = computed<SlotGroup>(() => {
    const groups: SlotGroup = {
      main: [],
      left: [],
      right: [],
      'right-top': [],
      'right-bottom': [],
      'overlay-top': [],
      'overlay-bottom': [],
      'overlay-center': [],
      overlay: [],
    }

    if (!template.value?.elements) return groups

    for (const el of template.value.elements) {
      const slot = (el.slot || 'main') as keyof SlotGroup
      if (groups[slot]) {
        groups[slot].push(el)
      } else {
        groups.main.push(el)
      }
    }

    // Sort each group by order
    for (const key of Object.keys(groups) as (keyof SlotGroup)[]) {
      groups[key].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

    return groups
  })

  // Detect the layout mode from element slots
  const layoutMode = computed<LayoutMode>(() => {
    if (!template.value?.elements?.length) return 'vertical'

    const slots = new Set(template.value.elements.map(e => e.slot || 'main'))

    const hasLeftRight = slots.has('left') || slots.has('right') ||
                         slots.has('right-top') || slots.has('right-bottom')
    const hasOverlay = slots.has('overlay-top') || slots.has('overlay-bottom') ||
                       slots.has('overlay-center')

    if (hasLeftRight && hasOverlay) return 'mixed'
    if (hasLeftRight) return 'horizontal'
    if (hasOverlay) return 'overlay'
    return 'vertical'
  })

  // Check if layout is horizontal
  const isHorizontalLayout = computed(() =>
    layoutMode.value === 'horizontal' || layoutMode.value === 'mixed'
  )

  // Check if layout has overlay elements
  const hasOverlayElements = computed(() => {
    const g = slotGroups.value
    return g['overlay-top'].length > 0 ||
           g['overlay-bottom'].length > 0 ||
           g['overlay-center'].length > 0
  })

  // Get price position from template style
  const pricePosition = computed(() =>
    template.value?.card_style?.pricePosition || 'below'
  )

  // Get price alignment
  const priceAlign = computed(() =>
    template.value?.card_style?.priceAlign || 'center'
  )

  // Get price scale
  const priceScale = computed(() =>
    template.value?.card_style?.priceScale ?? 1
  )

  // Get suggested grid configuration
  const suggestedGrid = computed(() => ({
    perPage: template.value?.card_style?.suggestedPerPage,
    columns: template.value?.card_style?.suggestedColumns,
  }))

  // Get elements for a specific type from any slot
  function getElementByType(type: CardTemplateElement['type']): CardTemplateElement | undefined {
    return template.value?.elements?.find(e => e.type === type)
  }

  // Get the flex proportion for left/right split
  const splitRatio = computed(() => {
    if (!isHorizontalLayout.value) return { left: 1, right: 1 }

    const leftEls = slotGroups.value.left
    const rightEls = [
      ...slotGroups.value.right,
      ...slotGroups.value['right-top'],
      ...slotGroups.value['right-bottom'],
    ]

    const leftFlex = leftEls.reduce((sum, e) => sum + (e.flex ?? 1), 0) || 1
    const rightFlex = rightEls.reduce((sum, e) => sum + (e.flex ?? 1), 0) || 1

    return { left: leftFlex, right: rightFlex }
  })

  // Build flow elements for a given slot (sorted by order)
  function getFlowElements(slot: keyof SlotGroup) {
    return slotGroups.value[slot] || []
  }

  return {
    slotGroups,
    layoutMode,
    isHorizontalLayout,
    hasOverlayElements,
    pricePosition,
    priceAlign,
    priceScale,
    suggestedGrid,
    splitRatio,
    getElementByType,
    getFlowElements,
  }
}
