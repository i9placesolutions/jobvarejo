/** Lê o bitmap já renderizado: o zoom/pan do Fabric já está aplicado nele. */
export function sampleCanvasColor(canvas: HTMLCanvasElement, clientX: number, clientY: number): string | null {
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height || !canvas.width || !canvas.height) return null
  const x = Math.floor((clientX - rect.left) * canvas.width / rect.width)
  const y = Math.floor((clientY - rect.top) * canvas.height / rect.height)
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null
  const context = canvas.getContext('2d')
  if (!context) return null
  const pixel = context.getImageData(x, y, 1, 1).data
  if (!pixel[3]) return null
  return '#' + Array.from(pixel.slice(0, 3), channel => channel.toString(16).padStart(2, '0')).join('')
}
