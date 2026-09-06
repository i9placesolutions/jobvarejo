export const trimRasterImageBuffer = async (input: Buffer): Promise<Buffer> => {
  if (!input?.length) return input
  try {
    const sharp = (await import('sharp')).default
    const rotated = await sharp(input).rotate().toBuffer()
    const before = await sharp(rotated).metadata()
    const beforeWidth = Number(before.width || 0)
    const beforeHeight = Number(before.height || 0)
    if (beforeWidth < 8 || beforeHeight < 8) return rotated

    try {
      const trimmed = await sharp(rotated)
        .trim({ threshold: 16 })
        .toBuffer({ resolveWithObject: true })
      const nextWidth = Number(trimmed.info.width || 0)
      const nextHeight = Number(trimmed.info.height || 0)
      if (nextWidth < 8 || nextHeight < 8) return rotated
      if (nextWidth < beforeWidth - 1 || nextHeight < beforeHeight - 1) {
        return trimmed.data
      }
    } catch {
      // imagem uniforme ou sem borda para cortar
    }
    return rotated
  } catch {
    return input
  }
}
