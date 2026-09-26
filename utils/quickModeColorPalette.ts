export const QUICK_MODE_COLOR_SWATCHES = [
  '#172033',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#facc15',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6'
] as const

export const normalizeQuickModePaletteColor = (value: unknown): string | null => {
  const color = String(value || '').trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split('').map(channel => `${channel}${channel}`).join('')}`
  }
  return null
}
