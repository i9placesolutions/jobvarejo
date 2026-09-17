import { normalizeQuickLogoBackdropMode, type QuickLogoBackdropMode } from './quickLogoBackdrop'

export type LogoPreference = {
  backdrop: QuickLogoBackdropMode
  outline: boolean
  outlineColor: string
  outlineWidth: number
  outlineOpacity: number
  outlineMode: 'inside' | 'outside'
  border: boolean
  borderColor: string
  borderWidth: number
}
const color = (value: unknown, fallback = '#ffffff') => /^#[\da-f]{6}$/i.test(String(value)) ? String(value) : fallback
const number = (value: unknown, fallback: number, min: number, max: number) =>
  Number.isFinite(Number(value)) && value != null ? Math.min(max, Math.max(min, Number(value))) : fallback

/** Null means no choice yet; explicit false/none must override a template. */
export const normalizeLogoPreference = (value: unknown): LogoPreference | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const p = value as Record<string, unknown>
  return {
    backdrop: normalizeQuickLogoBackdropMode(p.backdrop),
    outline: p.outline === true,
    outlineColor: color(p.outlineColor),
    outlineWidth: number(p.outlineWidth, 4, 1, 40),
    outlineOpacity: number(p.outlineOpacity, 1, 0, 1),
    outlineMode: p.outlineMode === 'inside' ? 'inside' : 'outside',
    border: p.border === true,
    borderColor: color(p.borderColor),
    borderWidth: number(p.borderWidth, 1, 0, 40)
  }
}
export const LOGO_STYLE_PROPERTIES = new Set(['quickLogoBackdropMode', 'stickerOutlineEnabled', 'stickerOutlineColor', 'stickerOutlineWidth', 'stickerOutlineOpacity', 'stickerOutlineMode', 'strokeEnabled', 'stroke', 'strokeWidth'])
export const logoPreferenceFromFabric = (object: any): LogoPreference => normalizeLogoPreference({
  backdrop: object.quickLogoBackdropMode,
  outline: object.__stickerOutlineEnabled,
  outlineColor: object.__stickerOutlineColor,
  outlineWidth: object.__stickerOutlineWidth,
  outlineOpacity: object.__stickerOutlineOpacity,
  outlineMode: object.__stickerOutlineMode,
  border: object.__strokeEnabled ?? (!!object.stroke && object.strokeWidth > 0),
  borderColor: object.__strokeEnabled === false ? object.__strokeBackup : object.stroke,
  borderWidth: object.strokeWidth || object.__strokeWidthBackup
})!
export const applyLogoPreferenceToFabric = (object: any, value: unknown): boolean => {
  const p = normalizeLogoPreference(value)
  if (!p) return false
  const patch = {
    quickLogoBackdropMode: p.backdrop,
    __stickerOutlineEnabled: p.outline,
    __stickerOutlineColor: p.outlineColor,
    __stickerOutlineWidth: p.outlineWidth,
    __stickerOutlineOpacity: p.outlineOpacity,
    __stickerOutlineMode: p.outlineMode,
    __strokeEnabled: p.border,
    __strokeBackup: p.borderColor,
    __strokeWidthBackup: p.borderWidth,
    stroke: p.border ? p.borderColor : null,
    strokeWidth: p.border ? p.borderWidth : 0
  }
  if (!Object.entries(patch).some(([key, value]) => object[key] !== value)) return false
  if (typeof object.set === 'function') object.set(patch)
  else Object.assign(object, patch)
  object.dirty = true
  return true
}
export const applyLogoPreferenceToArt = (layer: any, value: unknown) => {
  const p = normalizeLogoPreference(value)
  if (!p || layer.binding !== 'logo') return
  Object.assign(layer, { logoBackdrop: p.backdrop, logoOutline: p.outline, logoOutlineColor: p.outlineColor, logoOutlineWidth: p.outlineWidth })
}
