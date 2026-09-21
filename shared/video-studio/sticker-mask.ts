// Preenche apenas vazios fechados da base do adesivo, preservando o lado de fora.
export function fillStickerHoles(alpha: Uint8ClampedArray, width: number, height: number) {
  const outside = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0, tail = 0
  const visit = (i: number) => {
    if (!outside[i] && alpha[i]! < 128) { outside[i] = 1; queue[tail++] = i }
  }
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1) }
  while (head < tail) {
    const i = queue[head++]!, x = i % width
    if (x) visit(i - 1)
    if (x < width - 1) visit(i + 1)
    if (i >= width) visit(i - width)
    if (i < width * (height - 1)) visit(i + width)
  }
  return Uint8ClampedArray.from(outside, value => value ? 0 : 255)
}
