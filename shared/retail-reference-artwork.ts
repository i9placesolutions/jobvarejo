export type ReferenceArtworkBox = readonly [number, number, number, number]

/** Coordenadas de máscara/caixa relativas à imagem completa de referência. */
export interface RetailReferenceArtwork {
  src: string
  width: number
  height: number
  headerBottom: number
  logoMask: ReferenceArtworkBox
  logoBox: ReferenceArtworkBox
  socialMask: ReferenceArtworkBox
  instagramBox: ReferenceArtworkBox
  additionalMasks?: { box: ReferenceArtworkBox; color: string }[]
  colors: { logo: string; social: string; logoText: string }
  sourceIndex: number
}

export interface ReferenceArtworkRect {
  x: number
  y: number
  width: number
  height: number
}

/** A proporção do recorte 0..headerBottom, mantendo os pixels originais. */
export function referenceHeaderAspect(artwork: RetailReferenceArtwork): number {
  return artwork.width / (artwork.height * artwork.headerBottom)
}

/** Encaixa o cabeçalho recortado dentro de uma área sem deformar a imagem. */
export function fitReferenceHeader(
  bounds: ReferenceArtworkRect,
  artwork: RetailReferenceArtwork
): ReferenceArtworkRect {
  const aspect = referenceHeaderAspect(artwork)
  const width = Math.min(bounds.width, bounds.height * aspect)
  const height = width / aspect
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y,
    width,
    height
  }
}

/** Projeta uma caixa normalizada da imagem original sobre o recorte do cabeçalho. */
export function projectReferenceArtworkBox(
  header: ReferenceArtworkRect,
  artwork: RetailReferenceArtwork,
  normalized: ReferenceArtworkBox
): ReferenceArtworkRect {
  const [x, y, width, height] = normalized
  return {
    x: header.x + x * header.width,
    y: header.y + (y / artwork.headerBottom) * header.height,
    width: width * header.width,
    height: (height / artwork.headerBottom) * header.height
  }
}
