export const ART_FONTS = [
  'Barlow', 'Montserrat',
  'Barlow Condensed',
  'Oswald',
  'Roboto Slab', 'Audiowide', 'Bebas Neue', 'Caveat', 'Russo One', 'Consumidor Referencia', 'Patua One',
  'Anton'
] as const
export const ART_CATEGORIES = [
  'Datas comemorativas',
  'Campanhas',
  'Mensagens',
  'Informativos',
  'Sinalização',
  'Divulgação'
] as const
export const ART_ICONS = {
  heart:
    'M 50 88 C 0 55 0 12 27 12 C 40 12 48 22 50 28 C 52 22 60 12 73 12 C 100 12 100 55 50 88 Z',
  star: 'M 50 3 L 62 35 L 97 36 L 70 58 L 80 92 L 50 72 L 20 92 L 30 58 L 3 36 L 38 35 Z',
  bolt: 'M 57 2 L 12 57 L 44 57 L 35 98 L 90 37 L 57 37 Z',
  check: 'M 10 50 L 35 77 L 90 18 L 99 28 L 35 95 L 1 60 Z',
  flower:
    'M 50 30 C 5 -20 -20 30 30 50 C -20 70 5 120 50 70 C 95 120 120 70 70 50 C 120 30 95 -20 50 30 Z'
} as const
export type ArtLayer = {
  id: string
  kind: 'text' | 'image' | 'shape' | 'icon'
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  fill: string
  text?: string
  fontFamily?: string
  fontScaleX?: number
  lineHeight?: number
  fontSize?: number
  fontWeight?: number
  align?: 'left' | 'center' | 'right'
  src?: string
  fit?: 'contain' | 'cover'
  cropX?: number
  cropY?: number
  shape?: 'rect' | 'ellipse' | 'path'
  blur?: number
  cornerRadius?: number
  pathData?: string
  gradient?: { type: 'linear' | 'radial'; from: string; to: string; startOpacity: number; endOpacity: number; angle: number }
  icon?: keyof typeof ART_ICONS
  autoTrim?: boolean
  logoBackdrop?: 'none' | 'square' | 'round' | 'oval'
  logoPadding?: number
  logoOutline?: boolean
  logoOutlineColor?: string
  logoOutlineWidth?: number
  binding?:
    'companyName' | 'logo' | 'phone' | 'address' | 'instagram' | 'date' | ''
}
export type ArtComposition = {
  version: 1
  width: number
  height: number
  background: string
  layers: ArtLayer[]
  alternates?: ArtComposition[]
}
export type ArtTemplate = {
  id: string
  name: string
  category: string
  collection: string
  tags: string[]
  composition: ArtComposition
  published: boolean
  revision: number
}
export type ArtDesign = {
  id: string
  name: string
  composition: ArtComposition
  revision: number
  template_id?: string | null
  updated_at?: string
}

export const ART_FORMATS = [
  { id: 'feed', label: 'Feed 4:5', width: 1080, height: 1350 },
  { id: 'square', label: 'Post 1:1', width: 1080, height: 1080 },
  { id: 'stories', label: 'Story 9:16', width: 1080, height: 1920 },
  { id: 'print', label: 'A4', width: 794, height: 1123 },
  { id: 'tv', label: 'Banner 16:9', width: 1920, height: 1080 }
] as const
