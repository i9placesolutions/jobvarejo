import { ref, computed } from 'vue'

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export const useFigmaCrop = () => {
  const isCropActive = ref(false)
  const cropFrameRect = ref<CropRect>({ x: 0, y: 0, width: 100, height: 100 })
  const cropFrameName = ref<string>('Frame 1')
  const cropTargetObject = ref<any>(null)

  /**
   * Ativa o modo de crop para um objeto selecionado
   */
  const activateCrop = (obj: any) => {
    if (!obj) return false

    cropTargetObject.value = obj
    cropFrameName.value = obj.name || 'Frame 1'

    // Obter as dimensões e posição do objeto
    const bounds = getBoundingRect(obj)
    if (bounds) {
      cropFrameRect.value = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
    }

    isCropActive.value = true
    return true
  }

  /**
   * Desativa o modo de crop
   */
  const deactivateCrop = () => {
    isCropActive.value = false
    cropTargetObject.value = null
  }

  /**
   * Aplica o crop ao objeto alvo
   */
  const applyCrop = (rect: CropRect) => {
    const obj = cropTargetObject.value
    if (!obj) return false

    // Atualizar posição e tamanho do objeto
    obj.set({
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height
    })

    obj.setCoords()
    cropTargetObject.value = null
    isCropActive.value = false

    return true
  }

  /**
   * Cancela o crop (restaura o estado original)
   */
  const cancelCrop = () => {
    const obj = cropTargetObject.value
    if (obj) {
      // Restaurar dimensões originais se necessário
      obj.setCoords()
    }
    deactivateCrop()
  }

  /**
   * Obtém o bounding rect de um objeto Fabric.js
   */
  const getBoundingRect = (obj: any): CropRect | null => {
    if (!obj) return null

    try {
      const rect = obj.getBoundingRect?.()
      if (rect) {
        return {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      }
    } catch (e) {
      console.warn('[useFigmaCrop] Error getting bounding rect:', e)
    }

    // Fallback para propriedades diretas
    return {
      x: Math.round(obj.left || 0),
      y: Math.round(obj.top || 0),
      width: Math.round(obj.width || obj.getScaledWidth?.() || 0),
      height: Math.round(obj.height || obj.getScaledHeight?.() || 0)
    }
  }

  /**
   * Atualiza o rect do crop durante o drag
   */
  const updateCropRect = (rect: CropRect) => {
    cropFrameRect.value = { ...rect }
  }

  return {
    // Estado
    isCropActive,
    cropFrameRect,
    cropFrameName,
    cropTargetObject,

    // Ações
    activateCrop,
    deactivateCrop,
    applyCrop,
    cancelCrop,
    updateCropRect,
    getBoundingRect
  }
}
