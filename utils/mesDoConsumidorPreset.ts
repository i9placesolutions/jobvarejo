/**
 * Composição-base do modelo "Mês do Consumidor".
 *
 * A paleta e as formas são aplicadas como objetos nativos do Fabric no
 * editor. Estes metadados guardam apenas a receita responsiva e as chaves
 * dos poucos assets raster que precisam continuar independentes (selo,
 * moeda e efeito de brilho).
 */

export const FLYER_TEMPLATE_PRESETS = [
  {
    id: 'mes-do-consumidor-3d',
    name: 'Mês do Consumidor 3D',
    description: 'Fundo por cor editável, formas nativas, selo e elementos soltos.'
  }
] as const

export type FlyerTemplatePresetId = typeof FLYER_TEMPLATE_PRESETS[number]['id']

export const isFlyerTemplatePresetId = (value: unknown): value is FlyerTemplatePresetId =>
  FLYER_TEMPLATE_PRESETS.some(preset => preset.id === String(value || '').trim())

export const MES_DO_CONSUMIDOR_COLORS = {
  background: '#c90811',
  backgroundDark: '#920008',
  yellow: '#ffdf00',
  yellowShadow: '#d6a900',
  redChip: '#d5000b',
  footerText: '#970008',
  white: '#ffffff'
} as const

/** Chaves canônicas da biblioteca de uploads, não arquivos embutidos no modelo. */
export const MES_DO_CONSUMIDOR_ASSETS = {
  seal: {
    key: 'imagens/biblioteca/selos/mes-do-consumidor-calendario-3d.png',
    category: 'selos' as const,
    layerName: 'Selo 3D — Mês do Consumidor'
  },
  discountCoin: {
    key: 'imagens/biblioteca/elementos/moeda-desconto-3d.png',
    category: 'elementos' as const,
    layerName: 'Elemento 3D — moeda de desconto'
  },
  gloss: {
    key: 'imagens/biblioteca/elementos/efeito-brilho-diagonal-transparente.png',
    category: 'elementos' as const,
    layerName: 'Efeito transparente — brilho diagonal'
  }
} as const

/** Usa o proxy local para preservar a mesma origem e funcionar no editor/export. */
export const getMesDoConsumidorAssetUrl = (key: string): string =>
  `/api/storage/p?key=${encodeURIComponent(key)}`

type RelativeBox = {
  x: number
  y: number
  width: number
  height: number
  radius: number
}

type RelativeElement = {
  x: number
  y: number
  width: number
  angle?: number
}

export type MesDoConsumidorLayout = {
  topBandHeight: number
  header: RelativeBox
  footer: RelativeBox
  productZone: RelativeBox
  seal: RelativeElement
  coins: [RelativeElement, RelativeElement]
  validity: RelativeBox
  glossOpacity: number
}

/**
 * Cada formato possui uma composição própria. Os valores são percentuais do
 * frame, para que cada arte mantenha hierarquia e área livre de produtos em
 * vez de simplesmente esticar o Feed para outros formatos.
 */
const MES_DO_CONSUMIDOR_LAYOUTS: Record<string, MesDoConsumidorLayout> & { feed: MesDoConsumidorLayout } = {
  feed: {
    topBandHeight: 0.036,
    header: { x: -0.045, y: 0.045, width: 0.47, height: 0.255, radius: 0.09 },
    footer: { x: -0.045, y: 0.89, width: 1.09, height: 0.16, radius: 0.09 },
    productZone: { x: 0.5, y: 0.61, width: 0.89, height: 0.49, radius: 0.025 },
    seal: { x: 0.29, y: 0.22, width: 0.56, angle: -1 },
    coins: [
      { x: 0.065, y: 0.38, width: 0.13, angle: -28 },
      { x: 0.93, y: 0.84, width: 0.15, angle: 24 }
    ],
    validity: { x: 0.7, y: 0.275, width: 0.42, height: 0.055, radius: 0.03 },
    glossOpacity: 0.105
  },
  square: {
    topBandHeight: 0.045,
    header: { x: -0.055, y: 0.052, width: 0.54, height: 0.29, radius: 0.1 },
    footer: { x: -0.055, y: 0.875, width: 1.11, height: 0.175, radius: 0.1 },
    productZone: { x: 0.5, y: 0.63, width: 0.9, height: 0.42, radius: 0.03 },
    seal: { x: 0.31, y: 0.245, width: 0.61, angle: -1 },
    coins: [
      { x: 0.07, y: 0.43, width: 0.15, angle: -28 },
      { x: 0.93, y: 0.81, width: 0.16, angle: 24 }
    ],
    validity: { x: 0.72, y: 0.33, width: 0.43, height: 0.065, radius: 0.035 },
    glossOpacity: 0.1
  },
  stories: {
    topBandHeight: 0.028,
    header: { x: -0.04, y: 0.035, width: 0.44, height: 0.205, radius: 0.075 },
    footer: { x: -0.04, y: 0.925, width: 1.08, height: 0.11, radius: 0.07 },
    productZone: { x: 0.5, y: 0.61, width: 0.9, height: 0.56, radius: 0.022 },
    seal: { x: 0.27, y: 0.17, width: 0.52, angle: -1 },
    coins: [
      { x: 0.06, y: 0.34, width: 0.12, angle: -28 },
      { x: 0.93, y: 0.88, width: 0.14, angle: 24 }
    ],
    validity: { x: 0.71, y: 0.225, width: 0.43, height: 0.04, radius: 0.022 },
    glossOpacity: 0.09
  },
  print: {
    topBandHeight: 0.036,
    header: { x: -0.045, y: 0.045, width: 0.47, height: 0.255, radius: 0.09 },
    footer: { x: -0.045, y: 0.89, width: 1.09, height: 0.16, radius: 0.09 },
    productZone: { x: 0.5, y: 0.61, width: 0.89, height: 0.49, radius: 0.025 },
    seal: { x: 0.29, y: 0.22, width: 0.56, angle: -1 },
    coins: [
      { x: 0.065, y: 0.38, width: 0.13, angle: -28 },
      { x: 0.93, y: 0.84, width: 0.15, angle: 24 }
    ],
    validity: { x: 0.7, y: 0.275, width: 0.42, height: 0.055, radius: 0.03 },
    glossOpacity: 0.105
  },
  tv: {
    topBandHeight: 0.048,
    header: { x: -0.035, y: 0.08, width: 0.34, height: 0.54, radius: 0.09 },
    footer: { x: -0.035, y: 0.84, width: 1.07, height: 0.2, radius: 0.08 },
    productZone: { x: 0.64, y: 0.51, width: 0.65, height: 0.65, radius: 0.025 },
    seal: { x: 0.17, y: 0.29, width: 0.34, angle: -1 },
    coins: [
      { x: 0.33, y: 0.15, width: 0.1, angle: 18 },
      { x: 0.95, y: 0.78, width: 0.14, angle: 24 }
    ],
    validity: { x: 0.18, y: 0.59, width: 0.29, height: 0.07, radius: 0.035 },
    glossOpacity: 0.09
  }
}

export const getMesDoConsumidorLayout = (formatId: unknown): MesDoConsumidorLayout =>
  MES_DO_CONSUMIDOR_LAYOUTS[String(formatId || '').trim()] ?? MES_DO_CONSUMIDOR_LAYOUTS.feed
