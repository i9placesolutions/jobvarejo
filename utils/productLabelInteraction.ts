export type ProductLabelInteractionMode = 'move' | 'edit'

export const isProductLabelBackgroundName = (name: unknown): boolean => {
  const normalized = String(name || '').trim()
  return normalized === 'label_bg_image'
    || normalized === 'price_bg_image'
    || normalized === 'splash_image'
}

export const getProductLabelGroupInteractionProps = (mode: ProductLabelInteractionMode) => ({
  subTargetCheck: mode === 'edit',
  interactive: true,
  selectable: true,
  evented: true,
  hasControls: true,
  hasBorders: true,
  hoverCursor: mode === 'edit' ? 'pointer' : 'move',
  moveCursor: 'move'
})

export const getProductLabelChildInteractionProps = (
  mode: ProductLabelInteractionMode,
  isBackground: boolean
) => {
  const enabled = mode === 'edit' && !isBackground
  return {
    selectable: enabled,
    evented: enabled,
    hasControls: enabled,
    hasBorders: enabled,
    ...(enabled ? {
      lockMovementX: false,
      lockMovementY: false,
      lockScalingX: false,
      lockScalingY: false,
      lockRotation: false
    } : {})
  }
}
