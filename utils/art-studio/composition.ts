import type { ArtComposition, ArtLayer } from '~/types/art-studio'

export const cloneArt = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export const newArtLayer = (kind: ArtLayer['kind'], index = 0): ArtLayer => ({
  id: crypto.randomUUID(),
  kind,
  name: { text: 'Novo texto', image: 'Imagem', shape: 'Forma', icon: 'Ícone' }[
    kind
  ],
  x: 100 + index * 10,
  y: 100 + index * 10,
  width: kind === 'text' ? 650 : 260,
  height: kind === 'text' ? 160 : 260,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  fill: '#263a32',
  ...(kind === 'text'
    ? {
        text: 'Escreva sua mensagem',
        fontFamily: 'Barlow',
        fontSize: 64,
        fontWeight: 600,
        align: 'left' as const
      }
    : {}),
  ...(kind === 'image'
    ? { src: '', fit: 'contain' as const, cropX: 0.5, cropY: 0.5 }
    : {}),
  ...(kind === 'shape' ? { shape: 'rect' as const } : {}),
  ...(kind === 'icon' ? { icon: 'heart' as const } : {})
})
export const blankArt = (): ArtComposition => ({
  version: 1,
  width: 1080,
  height: 1350,
  background: '#f7f4eb',
  layers: []
})

const legacyStoreLogoIds = new Set([
  'art-logo',
  'brand-logo',
  'cartaz-logo',
  'logo',
  'logo-da-loja',
  'logo-loja',
  'store-logo'
])

const legacyStoreLogoNames = new Set([
  'logo',
  'logo da empresa',
  'logo da loja',
  'logo do estabelecimento',
  'logo empresa',
  'logo loja',
  'store logo'
])

const normalizeLogoIdentifier = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Recognizes the store-logo slots created before `binding: 'logo'` became
 * mandatory. Campaign seals and supplier logos intentionally do not match
 * this conservative list.
 */
export const isArtStoreLogoLayer = (layer: ArtLayer): boolean => {
  if (layer.kind !== 'image') return false
  if (layer.binding === 'logo') return true
  return (
    legacyStoreLogoIds.has(normalizeLogoIdentifier(layer.id)) ||
    legacyStoreLogoNames.has(
      normalizeLogoIdentifier(layer.name).replace(/-/g, ' ')
    )
  )
}

// O documento é independente de Fabric e dos projetos de ofertas; nunca guarda URLs temporárias.
export const resizeArt = (
  source: ArtComposition,
  width: number,
  height: number
): ArtComposition => {
  const output = cloneArt(source),
    sx = width / source.width,
    sy = height / source.height
  output.width = width
  output.height = height
  output.layers = output.layers.map((layer) => ({
    ...layer,
    x: layer.x * sx,
    y: layer.y * sy,
    width: layer.width * sx,
    height: layer.height * sy,
    fontSize: layer.fontSize ? layer.fontSize * Math.min(sx, sy) : undefined
  }))
  return output
}
export const personalizeArt = (
  source: ArtComposition,
  values: Record<string, string>
): ArtComposition => {
  const result = cloneArt(source)
  for (const layer of [result, ...(result.alternates || [])].flatMap(
    (page) => page.layers
  )) {
    if (isArtStoreLogoLayer(layer)) {
      // A marca da conta substitui qualquer URL persistida por modelos ou
      // rascunhos antigos. Sem marca cadastrada, o slot fica vazio.
      layer.binding = 'logo'
      layer.src = values.logo || ''
      continue
    }
    const value = layer.binding ? values[layer.binding] : undefined
    if (!value) continue
    if (layer.kind === 'text') layer.text = value
  }
  return result
}
export const artImageCrop = (iw: number, ih: number, layer: ArtLayer) => {
  const scale =
    layer.fit === 'cover'
      ? Math.max(layer.width / iw, layer.height / ih)
      : Math.min(layer.width / iw, layer.height / ih)
  const width = layer.fit === 'cover' ? layer.width / scale : iw
  const height = layer.fit === 'cover' ? layer.height / scale : ih
  return {
    scale,
    width,
    height,
    cropX: Math.max(0, iw - width) * (layer.cropX ?? 0.5),
    cropY: Math.max(0, ih - height) * (layer.cropY ?? 0.5)
  }
}
export const artError = (error: any): string =>
  error?.data?.statusMessage ||
  error?.statusMessage ||
  error?.message ||
  'Não foi possível concluir. Tente novamente.'

export const stableArtString = (value: unknown): string => {
  const order = (v: any): any =>
    Array.isArray(v)
      ? v.map(order)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .filter((k) => v[k] !== undefined)
              .map((k) => [k, order(v[k])])
          )
        : v
  return JSON.stringify(order(value))
}
