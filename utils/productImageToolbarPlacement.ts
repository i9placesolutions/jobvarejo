export type ProductImageToolbarPlacement = {
  left: number
  top: number
  side: 'above' | 'below'
}

type ProductImageToolbarPlacementInput = {
  targetLeft: number
  targetTop: number
  targetWidth: number
  targetHeight: number
  containerWidth: number
  containerHeight: number
  toolbarWidth: number
  toolbarHeight: number
  gap?: number
  padding?: number
}

/**
 * Escolhe um lado do objeto selecionado para a barra de ações.
 *
 * A posição anterior sempre nascia acima e era simplesmente limitada à borda
 * superior. Para uma imagem próxima ao topo, isso colocava a própria barra em
 * cima do produto. Primeiro usamos o espaço inteiro acima/abaixo e só
 * limitamos a posição quando nenhum dos lados comporta o painel por completo.
 */
export const getProductImageToolbarPlacement = (
  input: ProductImageToolbarPlacementInput
): ProductImageToolbarPlacement => {
  const padding = Math.max(0, Number(input.padding) || 8)
  const gap = Math.max(0, Number(input.gap) || 10)
  const containerWidth = Math.max(1, Number(input.containerWidth) || 1)
  const containerHeight = Math.max(1, Number(input.containerHeight) || 1)
  const toolbarWidth = Math.min(
    Math.max(1, Number(input.toolbarWidth) || 1),
    Math.max(1, containerWidth - padding * 2)
  )
  const toolbarHeight = Math.min(
    Math.max(1, Number(input.toolbarHeight) || 1),
    Math.max(1, containerHeight - padding * 2)
  )
  const targetTop = Number(input.targetTop) || 0
  const targetLeft = Number(input.targetLeft) || 0
  const targetWidth = Math.max(0, Number(input.targetWidth) || 0)
  const targetHeight = Math.max(0, Number(input.targetHeight) || 0)

  const minLeft = padding
  const maxLeft = Math.max(minLeft, containerWidth - toolbarWidth - padding)
  const preferredLeft = targetLeft + targetWidth / 2 - toolbarWidth / 2
  const left = Math.max(minLeft, Math.min(preferredLeft, maxLeft))

  const aboveTop = targetTop - toolbarHeight - gap
  const belowTop = targetTop + targetHeight + gap
  const minTop = padding
  const maxTop = Math.max(minTop, containerHeight - toolbarHeight - padding)
  const hasRoomAbove = aboveTop >= minTop
  const hasRoomBelow = belowTop <= maxTop

  if (hasRoomAbove || !hasRoomBelow) {
    return {
      left,
      top: Math.max(minTop, Math.min(aboveTop, maxTop)),
      side: 'above'
    }
  }

  return {
    left,
    top: Math.max(minTop, Math.min(belowTop, maxTop)),
    side: 'below'
  }
}
