/**
 * No node-canvas, a sombra de uma imagem desenhada com recorte (cropX/cropY) é
 * calculada sobre o bitmap inteiro e aparece como uma cópia fantasma deslocada.
 * Recorta o bitmap antes do render para a sombra seguir só a área visível, como no navegador.
 */
export function bakeLogoCrops(objects: any[], createCanvas: () => HTMLCanvasElement): void {
  for (const object of objects || []) {
    if (typeof object?.getObjects === 'function') bakeLogoCrops(object.getObjects(), createCanvas)
    const cropX = Math.max(0, Number(object?.cropX) || 0), cropY = Math.max(0, Number(object?.cropY) || 0)
    const element = object?.getElement?.()
    if (!element || (!cropX && !cropY)) continue
    const width = Math.max(1, Math.round(Number(object.width) || 1)), height = Math.max(1, Math.round(Number(object.height) || 1))
    const cropped = createCanvas()
    cropped.width = width
    cropped.height = height
    cropped.getContext('2d')!.drawImage(element, cropX, cropY, width, height, 0, 0, width, height)
    object.setElement(cropped, { width, height })
    object.set({ cropX: 0, cropY: 0 })
  }
}
