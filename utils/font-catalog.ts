// Central place for font options used across the editor (canvas + panels).
// Web fonts are loaded via WebFontLoader (Google Fonts) on the client.

// Google WebFontLoader `families` format:
// - "Family"
// - "Family:400,700,900"
export const GOOGLE_WEBFONT_FAMILIES: string[] = [
  'Inter:400,500,600,700,800,900',
  'Roboto:300,400,500,700,900',
  'Montserrat:300,400,500,600,700,800,900',
  'Poppins:300,400,500,600,700,800,900',
  'Open Sans:300,400,500,600,700,800',
  'Raleway:300,400,500,600,700,800,900',
  'Oswald:300,400,500,600,700',
  'Lato:300,400,700,900',
  'Playfair Display:400,500,600,700,800,900',
  'Merriweather:300,400,700,900',
  'PT Sans:400,700',
  'Josefin Sans:300,400,500,600,700',
  'Rubik:300,400,500,600,700,800,900',
  'Bitter:300,400,500,600,700,800,900',
  'Archivo:300,400,500,600,700,800,900',
  'Manrope:400,500,600,700,800',

  // Display / promo-friendly (useful for etiquetas)
  'Bebas Neue',
  'Anton',
  'Archivo Black',
  'Alfa Slab One',
  'Bowlby One SC',
  'Lilita One',
  'Abril Fatface',
  'Righteous',
  'Sora:300,400,500,600,700,800',
  'Orbitron:400,500,600,700,800,900',

  // Fun / splash
  'Bangers',
  'Luckiest Guy',
  'Pacifico',
  'Caveat:400,500,600,700',
  'Permanent Marker',

  // Clean alternatives
  'Nunito:300,400,600,700,800,900',
  'Roboto Slab:300,400,500,700,900',
  'Libre Baskerville:400,700',
  'DM Serif Display:400',
  'DM Sans:400,500,700',
  'Space Grotesk:300,400,500,600,700',
  'Fira Sans:300,400,500,700,800,900'
]

// This list is used in dropdowns/autocomplete. Include a few system fallbacks too.
export const AVAILABLE_FONT_FAMILIES: string[] = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',

  // Web fonts (must exist in GOOGLE_WEBFONT_FAMILIES above)
  'Inter',
  'Roboto',
  'Montserrat',
  'Poppins',
  'Open Sans',
  'Raleway',
  'Oswald',
  'Lato',
  'Playfair Display',
  'Merriweather',
  'PT Sans',
  'Josefin Sans',
  'Rubik',
  'Bitter',
  'Archivo',
  'Manrope',
  'Bebas Neue',
  'Anton',
  'Archivo Black',
  'Alfa Slab One',
  'Bowlby One SC',
  'Lilita One',
  'Abril Fatface',
  'Righteous',
  'Sora',
  'Orbitron',
  'Bangers',
  'Luckiest Guy',
  'Pacifico',
  'Caveat',
  'Permanent Marker',
  'Nunito',
  'Roboto Slab',
  'Libre Baskerville',
  'DM Serif Display',
  'DM Sans',
  'Space Grotesk',
  'Fira Sans'
]

export type FontWeightOption = {
  label: string;
  value: number;
}

const DEFAULT_FONT_WEIGHT_VALUES: number[] = [100, 200, 300, 400, 500, 600, 700, 800, 900]

const FONT_WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black'
}

const SYSTEM_FONT_WEIGHT_VALUES: Record<string, number[]> = {
  Arial: [400, 700],
  Georgia: [400, 700],
  'Times New Roman': [400, 700],
  'Courier New': [400, 700]
}

const normalizeWeightValues = (weights: number[]): number[] => {
  const unique = new Set<number>()
  for (const weight of weights) {
    const normalized = Math.round(Number(weight))
    if (!Number.isFinite(normalized)) continue
    unique.add(normalized)
  }
  return Array.from(unique).sort((a, b) => a - b)
}

const WEB_FONT_WEIGHT_VALUES: Record<string, number[]> = GOOGLE_WEBFONT_FAMILIES.reduce((acc, declaration) => {
  const [rawFamily, rawVariants] = declaration.split(':', 2)
  const family = String(rawFamily || '').trim()
  if (!family) return acc

  if (!rawVariants) {
    acc[family] = [400]
    return acc
  }

  const weights = rawVariants
    .split(',')
    .map(variant => {
      const match = String(variant).trim().match(/^(\d{3})/)
      return match ? Number(match[1]) : NaN
    })
    .filter(value => Number.isFinite(value))

  acc[family] = normalizeWeightValues(weights.length ? weights : [400])
  return acc
}, {} as Record<string, number[]>)

export const FONT_WEIGHT_VALUES_BY_FAMILY: Record<string, number[]> = {
  ...SYSTEM_FONT_WEIGHT_VALUES,
  ...WEB_FONT_WEIGHT_VALUES
}

export const getFontWeightLabel = (weight: number): string => {
  const normalized = Math.round(Number(weight))
  if (!Number.isFinite(normalized)) return 'Regular'
  return FONT_WEIGHT_LABELS[normalized] ?? String(normalized)
}

export const getSupportedFontWeights = (fontFamily?: string | null): number[] => {
  const family = String(fontFamily || '').trim()
  if (!family) return [...DEFAULT_FONT_WEIGHT_VALUES]
  const weights = FONT_WEIGHT_VALUES_BY_FAMILY[family]
  if (!Array.isArray(weights) || !weights.length) return [...DEFAULT_FONT_WEIGHT_VALUES]
  return normalizeWeightValues(weights)
}

export const normalizeFontWeightForFamily = (fontFamily: string | null | undefined, fontWeight: number): number => {
  const normalizedWeight = Math.round(Number(fontWeight))
  if (!Number.isFinite(normalizedWeight)) return 400

  const supported = getSupportedFontWeights(fontFamily)
  if (!supported.length) return normalizedWeight
  if (supported.includes(normalizedWeight)) return normalizedWeight

  return supported.reduce((closest, current) => {
    return Math.abs(current - normalizedWeight) < Math.abs(closest - normalizedWeight) ? current : closest
  }, supported[0])
}

export const getFontWeightOptionsForFamily = (
  fontFamily?: string | null,
  options?: { includeValueInLabel?: boolean; ensureWeight?: number | null }
): FontWeightOption[] => {
  const includeValueInLabel = options?.includeValueInLabel === true
  const weights = getSupportedFontWeights(fontFamily)
  const ensured = Math.round(Number(options?.ensureWeight))

  if (Number.isFinite(ensured) && !weights.includes(ensured)) {
    weights.push(ensured)
  }

  return normalizeWeightValues(weights).map(value => {
    const label = getFontWeightLabel(value)
    return {
      value,
      label: includeValueInLabel ? `${label} (${value})` : label
    }
  })
}
